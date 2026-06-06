import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { syncGroupMembershipsForMember } from "./clubService";

const teamsCol = (clubId) => collection(db, "clubs", clubId, "teams");
const groupsCol = (clubId) => collection(db, "clubs", clubId, "groups");

const buildGroupIds = (role = "", teamIds = []) => {
  const ids = new Set();

  ids.add("open-volunteers");

  (Array.isArray(teamIds) ? teamIds : []).forEach((t) => {
    if (!t) return;
    ids.add(String(t));
    ids.add(`team:${String(t)}`);
  });

  const normalizedRole = String(role || "")
    .trim()
    .toLowerCase();
  if (
    [
      "owner",
      "admin",
      "president",
      "vice president",
      "vice-president",
      "executive",
    ].includes(normalizedRole)
  ) {
    ids.add("executive");
    ids.add("group:executive");
  }
  if (
    [
      "committee",
      "treasurer",
      "secretary",
      "registrar",
      "coordinator",
    ].includes(normalizedRole)
  ) {
    ids.add("committee");
    ids.add("group:committee");
  }

  return Array.from(ids);
};

const normalizeMemberRoles = (memberData = {}) => {
  const rolePool = Array.isArray(memberData?.roles)
    ? memberData.roles
    : [memberData?.role];
  return rolePool
    .map((role) => String(role || "").trim().toLowerCase())
    .filter(Boolean);
};

const isPlayerMemberRecord = (memberData = {}) => {
  const normalizedRoles = normalizeMemberRoles(memberData);
  if (!normalizedRoles.length) return true;
  return normalizedRoles.includes("player");
};

export const createTeam = async (
  clubId,
  { name, ageGroup, division, coachName },
) => {
  const ref = doc(teamsCol(clubId));
  const data = {
    name,
    ageGroup: ageGroup || "",
    division: division || "",
    coachName: coachName || "",
    playerCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);

  await setDoc(
    doc(groupsCol(clubId), ref.id),
    {
      groupId: ref.id,
      groupName: name,
      groupType: "Team",
      source: "team",
      sourceId: ref.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return { id: ref.id, ...data };
};

export const getTeams = async (clubId) => {
  const snap = await getDocs(query(teamsCol(clubId), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getTeam = async (clubId, teamId) => {
  const snap = await getDoc(doc(db, "clubs", clubId, "teams", teamId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const subscribeToClubMembers = (clubId, callback) => {
  return onSnapshot(
    collection(db, "clubs", clubId, "members"),
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (error) => {
      if (error?.code !== "permission-denied") {
        console.error("subscribeToClubMembers listener error:", error);
      }
      callback([]);
    },
  );
};

export const updateTeam = async (clubId, teamId, data) => {
  await updateDoc(doc(db, "clubs", clubId, "teams", teamId), {
    ...data,
    updatedAt: serverTimestamp(),
  });

  if (data?.name) {
    await setDoc(
      doc(groupsCol(clubId), teamId),
      {
        groupId: teamId,
        groupName: data.name,
        groupType: "Team",
        source: "team",
        sourceId: teamId,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
};

export const deleteTeam = async (clubId, teamId) => {
  const memberSnap = await getDocs(collection(db, "clubs", clubId, "members"));
  await Promise.all(
    memberSnap.docs.map(async (memberDoc) => {
      const memberData = memberDoc.data() || [];
      const teamIds = Array.isArray(memberData.teamIds)
        ? memberData.teamIds.filter((id) => id !== teamId)
        : [];
      const groupIds = Array.isArray(memberData.groupIds)
        ? memberData.groupIds.filter(
            (id) => id !== teamId && id !== `team:${teamId}`,
          )
        : [];

      await updateDoc(doc(db, "clubs", clubId, "members", memberDoc.id), {
        teamIds,
        groupIds,
        updatedAt: serverTimestamp(),
      });

      try {
        await syncGroupMembershipsForMember(clubId, {
          uid: memberDoc.id,
          role: memberData?.role || "Player",
          teamIds,
          groupIds,
        });
      } catch (error) {
        console.warn(
          "Failed to sync group memberships during team delete:",
          error?.message || error,
        );
      }

      const userRef = doc(db, "users", memberDoc.id);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const memberships = (userSnap.data().clubMemberships || []).map((m) => {
        if (m.clubId !== clubId) return m;
        const nextTeamIds = Array.isArray(m.teamIds)
          ? m.teamIds.filter((id) => id !== teamId)
          : [];
        return {
          ...m,
          teamIds: nextTeamIds,
          groupIds: buildGroupIds(m.role, nextTeamIds),
        };
      });

      await updateDoc(userRef, {
        clubMemberships: memberships,
        updatedAt: serverTimestamp(),
      });
    }),
  );

  await deleteDoc(doc(db, "clubs", clubId, "teams", teamId));
  await deleteDoc(doc(db, "clubs", clubId, "groups", teamId));
};

export const subscribeToTeams = (clubId, callback, options = {}) => {
  const { teamIds = [], isAdmin = false } = options;
  const colRef = teamsCol(clubId);

  // If Admin/Staff, they can see all teams
  if (isAdmin) {
    const q = query(colRef, orderBy("name"));
    return onSnapshot(
      q,
      (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => {
        if (error?.code !== "permission-denied") {
          console.error("subscribeToTeams (admin) error:", error);
        }
        callback([]);
      },
    );
  }

  // For regular members/players, we must filter by their teamIds 
  // to avoid permission-denied errors from the restricted security rules.
  if (!Array.isArray(teamIds) || teamIds.length === 0) {
    callback([]);
    return () => {};
  }

  // Firestore "in" query limited to 10-30 items depending on version. 
  // Most users have < 10 teams.
  const q = query(colRef, where("__name__", "in", teamIds.slice(0, 30)));
  return onSnapshot(
    q,
    (snap) => {
      const results = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      results.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      callback(results);
    },
    (error) => {
      if (error?.code !== "permission-denied") {
        console.error("subscribeToTeams (member) error:", error);
      }
      callback([]);
    },
  );
};

export const assignMembersToTeam = async (clubId, teamId, memberIds = []) => {
  const uniqueMemberIds = Array.from(
    new Set((memberIds || []).filter(Boolean)),
  );
  if (!clubId || !teamId || uniqueMemberIds.length === 0) return;

  await Promise.all(
    uniqueMemberIds.map((memberId) =>
      updateDoc(doc(db, "clubs", clubId, "members", memberId), {
        teamIds: arrayUnion(teamId),
        groupIds: arrayUnion(teamId, `team:${teamId}`),
        updatedAt: serverTimestamp(),
      }),
    ),
  );

  await Promise.all(
    uniqueMemberIds.map(async (memberId) => {
      try {
        const memberSnap = await getDoc(
          doc(db, "clubs", clubId, "members", memberId),
        );
        if (!memberSnap.exists()) return;
        const memberData = memberSnap.data() || {};
        await syncGroupMembershipsForMember(clubId, {
          uid: memberId,
          role: memberData?.role || "Player",
          teamIds: Array.isArray(memberData?.teamIds) ? memberData.teamIds : [],
          groupIds: Array.isArray(memberData?.groupIds)
            ? memberData.groupIds
            : [],
        });
      } catch (error) {
        console.warn(
          "Failed to sync group memberships during team assignment:",
          error?.message || error,
        );
      }
    }),
  );

  await Promise.all(
    uniqueMemberIds.map(async (memberId) => {
      const userRef = doc(db, "users", memberId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const memberships = userSnap.data().clubMemberships || [];
      const updatedMemberships = memberships.map((membership) => {
        if (membership.clubId !== clubId) return membership;
        const currentTeamIds = Array.isArray(membership.teamIds)
          ? membership.teamIds
          : [];
        const nextTeamIds = currentTeamIds.includes(teamId)
          ? currentTeamIds
          : [...currentTeamIds, teamId];
        return {
          ...membership,
          teamIds: nextTeamIds,
          groupIds: buildGroupIds(membership.role, nextTeamIds),
        };
      });

      await updateDoc(userRef, {
        clubMemberships: updatedMemberships,
        updatedAt: serverTimestamp(),
      });
    }),
  );

  const memberSnap = await getDocs(collection(db, "clubs", clubId, "members"));
  const playerCount = memberSnap.docs.filter((d) => {
    const memberData = d.data() || {};
    const teamIds = memberData.teamIds || [];
    return (
      Array.isArray(teamIds) &&
      teamIds.includes(teamId) &&
      isPlayerMemberRecord(memberData)
    );
  }).length;

  await updateDoc(doc(db, "clubs", clubId, "teams", teamId), {
    playerCount,
    updatedAt: serverTimestamp(),
  });
};

export const unassignMembersFromTeam = async (
  clubId,
  teamId,
  memberIds = [],
) => {
  const uniqueMemberIds = Array.from(
    new Set((memberIds || []).filter(Boolean)),
  );
  if (!clubId || !teamId || uniqueMemberIds.length === 0) return;

  await Promise.all(
    uniqueMemberIds.map((memberId) =>
      updateDoc(doc(db, "clubs", clubId, "members", memberId), {
        teamIds: arrayRemove(teamId),
        groupIds: arrayRemove(teamId, `team:${teamId}`),
        updatedAt: serverTimestamp(),
      }),
    ),
  );

  await Promise.all(
    uniqueMemberIds.map(async (memberId) => {
      try {
        const memberSnap = await getDoc(
          doc(db, "clubs", clubId, "members", memberId),
        );
        if (!memberSnap.exists()) return;
        const memberData = memberSnap.data() || {};
        await syncGroupMembershipsForMember(clubId, {
          uid: memberId,
          role: memberData?.role || "Player",
          teamIds: Array.isArray(memberData?.teamIds) ? memberData.teamIds : [],
          groupIds: Array.isArray(memberData?.groupIds)
            ? memberData.groupIds
            : [],
        });
      } catch (error) {
        console.warn(
          "Failed to sync group memberships during team unassignment:",
          error?.message || error,
        );
      }
    }),
  );

  await Promise.all(
    uniqueMemberIds.map(async (memberId) => {
      const userRef = doc(db, "users", memberId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const memberships = userSnap.data().clubMemberships || [];
      const updatedMemberships = memberships.map((membership) => {
        if (membership.clubId !== clubId) return membership;
        const currentTeamIds = Array.isArray(membership.teamIds)
          ? membership.teamIds
          : [];
        const nextTeamIds = currentTeamIds.filter((id) => id !== teamId);
        return {
          ...membership,
          teamIds: nextTeamIds,
          groupIds: buildGroupIds(membership.role, nextTeamIds),
        };
      });

      await updateDoc(userRef, {
        clubMemberships: updatedMemberships,
        updatedAt: serverTimestamp(),
      });
    }),
  );

  const memberSnap = await getDocs(collection(db, "clubs", clubId, "members"));
  const playerCount = memberSnap.docs.filter((d) => {
    const memberData = d.data() || {};
    const teamIds = memberData.teamIds || [];
    return (
      Array.isArray(teamIds) &&
      teamIds.includes(teamId) &&
      isPlayerMemberRecord(memberData)
    );
  }).length;

  await updateDoc(doc(db, "clubs", clubId, "teams", teamId), {
    playerCount,
    updatedAt: serverTimestamp(),
  });
};

export const requestToFollowTeam = async (clubId, teamId, userId, userData) => {
  const ref = doc(teamsCol(clubId), teamId);
  const followerData = {
    uid: userId,
    name: userData?.displayName || userData?.email || "User",
    requestedAt: new Date().toISOString(),
  };

  await updateDoc(ref, {
    pendingFollowers: arrayUnion(followerData),
    updatedAt: serverTimestamp(),
  });
};

export const approveTeamFollower = async (clubId, teamId, followerData) => {
  const ref = doc(teamsCol(clubId), teamId);

  await updateDoc(ref, {
    pendingFollowers: arrayRemove(followerData),
    followers: arrayUnion({
      uid: followerData.uid,
      name: followerData.name,
      approvedAt: new Date().toISOString(),
    }),
    updatedAt: serverTimestamp(),
  });
};

export const removeTeamFollower = async (
  clubId,
  teamId,
  followerData,
  isPending = false,
) => {
  const ref = doc(teamsCol(clubId), teamId);
  const fieldName = isPending ? "pendingFollowers" : "followers";

  await updateDoc(ref, {
    [fieldName]: arrayRemove(followerData),
    updatedAt: serverTimestamp(),
  });
};
