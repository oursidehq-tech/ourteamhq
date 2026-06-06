import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";

const CLUBS_COL = "clubs";
const GROUPS_COL = "groups";
const GROUP_MEMBERSHIPS_COL = "groupMemberships";

const ROLE_GROUP_IDS = new Set([
  "executive",
  "group:executive",
  "committee",
  "group:committee",
]);

const OPEN_VOLUNTEERS_GROUP_ID = "open-volunteers";

const normalizeGroupId = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const membershipDocId = (uid, groupId) =>
  `${String(uid || "")}_${normalizeGroupId(groupId).replace(/[^a-z0-9:_-]/g, "_")}`;

const ensureDefaultClubGroups = async (clubId) => {
  const defaults = [
    {
      id: "executive",
      groupName: "Executive",
      groupType: "Executive",
    },
    {
      id: "committee",
      groupName: "Committee",
      groupType: "Committee",
    },
    {
      id: "open-volunteers",
      groupName: "Open Club Volunteers",
      groupType: "Open Volunteers",
    },
  ];

  await Promise.all(
    defaults.map((group) =>
      setDoc(
        doc(db, CLUBS_COL, clubId, GROUPS_COL, group.id),
        {
          groupId: group.id,
          groupName: group.groupName,
          groupType: group.groupType,
          system: true,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true },
      ),
    ),
  );
};

const toRoleList = (roleOrRoles = "") => {
  if (Array.isArray(roleOrRoles)) {
    return roleOrRoles
      .map((role) => String(role || "").trim())
      .filter(Boolean);
  }

  const normalized = String(roleOrRoles || "").trim();
  return normalized ? [normalized] : [];
};

const resolvePrimaryRole = (roleOrRoles = "") => {
  const roles = toRoleList(roleOrRoles);
  if (!roles.length) return "Player";

  if (roles.includes("Owner")) return "Owner";
  if (roles.includes("Admin")) return "Admin";
  return roles[0];
};

const buildGroupIds = (roleOrRoles = "", teamIds = []) => {
  const ids = new Set();

  ids.add(OPEN_VOLUNTEERS_GROUP_ID);

  (Array.isArray(teamIds) ? teamIds : []).forEach((teamId) => {
    if (!teamId) return;
    ids.add(String(teamId));
    ids.add(`team:${String(teamId)}`);
  });

  toRoleList(roleOrRoles).forEach((role) => {
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
  });

  return Array.from(ids);
};

export const syncGroupMembershipsForMember = async (
  clubId,
  { uid, role = "", roles = null, teamIds = [], groupIds = [] },
) => {
  if (!clubId || !uid) return;

  const roleSource = Array.isArray(roles) && roles.length ? roles : role;

  const finalGroupIds = Array.from(
    new Set(
      [
        ...buildGroupIds(roleSource, teamIds),
        ...(Array.isArray(groupIds) ? groupIds : []),
      ]
        .map((id) => normalizeGroupId(id))
        .filter(Boolean),
    ),
  );

  const membershipsRef = collection(
    db,
    CLUBS_COL,
    clubId,
    GROUP_MEMBERSHIPS_COL,
  );
  const existingSnap = await getDocs(
    query(membershipsRef, where("userId", "==", uid)),
  );

  const existingByGroupId = new Map();
  existingSnap.docs.forEach((membershipDoc) => {
    const groupId = normalizeGroupId(membershipDoc.data()?.groupId);
    if (groupId) {
      existingByGroupId.set(groupId, membershipDoc.id);
    }
  });

  await Promise.all(
    finalGroupIds.map((groupId) => {
      const docId =
        existingByGroupId.get(groupId) || membershipDocId(uid, groupId);
      return setDoc(
        doc(db, CLUBS_COL, clubId, GROUP_MEMBERSHIPS_COL, docId),
        {
          membershipId: docId,
          userId: uid,
          groupId,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );
    }),
  );

  await Promise.all(
    Array.from(existingByGroupId.entries())
      .filter(([groupId]) => !finalGroupIds.includes(groupId))
      .map(([, docId]) =>
        deleteDoc(doc(db, CLUBS_COL, clubId, GROUP_MEMBERSHIPS_COL, docId)),
      ),
  );
};

// Generate a random 6-digit invite code
const generateInviteCode = () => {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
};

const generateUniqueInviteCode = async () => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateInviteCode();
    const q = query(collection(db, CLUBS_COL), where("inviteCode", "==", code));
    const snap = await getDocs(q);
    if (snap.empty) return code;
  }

  throw new Error("Unable to generate unique invite code.");
};

export const createClub = async ({
  name,
  description,
  location,
  logoUrl,
  bannerUrl,
  website,
  planType,
  adminUid,
  adminName,
  adminEmail,
}) => {
  const clubRef = doc(collection(db, CLUBS_COL));
  const inviteCode = await generateUniqueInviteCode();

  const clubData = {
    name,
    description: description || "",
    location: location || "",
    logoUrl: logoUrl || "",
    bannerUrl: bannerUrl || "",
    website: website || "",
    inviteCode,
    planType: planType || "starter",
    subscriptionStatus: "active",
    contact: { email: adminEmail, phone: "" },
    contactVisibility: {
      location: "public",
      website: "public",
      phone: "members",
      email: "members",
    },
    keyPeopleVisibility: "public",
    keyPeople: [{ name: adminName, role: "Owner", uid: adminUid }],
    createdBy: adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Critical write 1: create club document.
  await setDoc(clubRef, clubData);

  // Critical write 2: add owner membership.
  await setDoc(doc(db, CLUBS_COL, clubRef.id, "members", adminUid), {
    uid: adminUid,
    displayName: adminName,
    email: adminEmail,
    role: "Owner",
    teamIds: [],
    groupIds: buildGroupIds("Owner", []),
    joinedAt: serverTimestamp(),
  });

  // Best-effort: some environments may not yet allow group writes.
  try {
    await ensureDefaultClubGroups(clubRef.id);
    await syncGroupMembershipsForMember(clubRef.id, {
      uid: adminUid,
      role: "Owner",
      teamIds: [],
      groupIds: buildGroupIds("Owner", []),
    });
  } catch (error) {
    console.warn(
      "Skipping default group setup during club creation:",
      error?.message || error,
    );
  }

  // Update user's club memberships
  // Best-effort: user profile sync should not block club onboarding.
  try {
    const userRef = doc(db, "users", adminUid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const memberships = userSnap.data().clubMemberships || [];
      memberships.push({
        clubId: clubRef.id,
        clubName: name,
        role: "Owner",
        teamIds: [],
        groupIds: Array.from(
          new Set([OPEN_VOLUNTEERS_GROUP_ID, ...buildGroupIds("Owner", [])]),
        ),
      });

      // Include uid explicitly so strict user rules can validate update payload.
      await setDoc(
        userRef,
        {
          uid: adminUid,
          clubMemberships: memberships,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }
  } catch (error) {
    console.warn(
      "Skipping user membership sync during club creation:",
      error?.message || error,
    );
  }

  return { id: clubRef.id, ...clubData };
};

export const ensureClubInviteCode = async (clubId) => {
  const clubRef = doc(db, CLUBS_COL, clubId);
  const clubSnap = await getDoc(clubRef);
  if (!clubSnap.exists()) throw new Error("Club not found.");

  const current = clubSnap.data()?.inviteCode;
  if (typeof current === "string" && /^\d{6}$/.test(current)) {
    return current;
  }

  const nextCode = await generateUniqueInviteCode();
  await updateDoc(clubRef, {
    inviteCode: nextCode,
    updatedAt: serverTimestamp(),
  });
  return nextCode;
};

export const regenerateClubInviteCode = async (clubId) => {
  const clubRef = doc(db, CLUBS_COL, clubId);
  const clubSnap = await getDoc(clubRef);
  if (!clubSnap.exists()) throw new Error("Club not found.");

  const nextCode = await generateUniqueInviteCode();
  await updateDoc(clubRef, {
    inviteCode: nextCode,
    updatedAt: serverTimestamp(),
  });
  return nextCode;
};

export const getClub = async (clubId) => {
  const snap = await getDoc(doc(db, CLUBS_COL, clubId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateClub = async (clubId, data) => {
  await updateDoc(doc(db, CLUBS_COL, clubId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const renameClubAndSyncMemberships = async (clubId, clubName) => {
  const nextName = (clubName || "").trim();
  if (!clubId) throw new Error("Club id is required.");
  if (!nextName) throw new Error("Club name is required.");

  await updateDoc(doc(db, CLUBS_COL, clubId), {
    name: nextName,
    updatedAt: serverTimestamp(),
  });

  const membersSnap = await getDocs(
    collection(db, CLUBS_COL, clubId, "members"),
  );
  await Promise.all(
    membersSnap.docs.map(async (memberDoc) => {
      const userRef = doc(db, "users", memberDoc.id);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const memberships = userSnap.data().clubMemberships || [];
      let changed = false;
      const updatedMemberships = memberships.map((membership) => {
        if (membership.clubId !== clubId) return membership;
        if (membership.clubName === nextName) return membership;
        changed = true;
        return { ...membership, clubName: nextName };
      });

      if (!changed) return;
      await updateDoc(userRef, {
        clubMemberships: updatedMemberships,
        updatedAt: serverTimestamp(),
      });
    }),
  );
};

export const getClubByInviteCode = async (code) => {
  const q = query(
    collection(db, CLUBS_COL),
    where("inviteCode", "==", code.toUpperCase()),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
};

export const joinClub = async (
  clubId,
  { uid, displayName, email, role, teamIds = [], clubName = "" },
) => {
  // Members always join with a basic role; elevated roles are admin-approved later.
  const joinedRole = "Player";
  const groupIds = buildGroupIds(joinedRole, teamIds);
  await setDoc(doc(db, CLUBS_COL, clubId, "members", uid), {
    uid,
    displayName,
    email,
    role: joinedRole,
    teamIds,
    groupIds,
    joinedAt: serverTimestamp(),
  });

  try {
    await syncGroupMembershipsForMember(clubId, {
      uid,
      role: joinedRole,
      teamIds,
      groupIds,
    });
  } catch (error) {
    console.warn(
      "Failed to sync group memberships on join:",
      error?.message || error,
    );
  }

  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const memberships = userSnap.data().clubMemberships || [];
    if (!memberships.find((m) => m.clubId === clubId)) {
      memberships.push({
        clubId,
        clubName,
        role: joinedRole,
        teamIds,
        groupIds: Array.from(new Set([OPEN_VOLUNTEERS_GROUP_ID, ...groupIds])),
      });
      await updateDoc(userRef, {
        clubMemberships: memberships,
        updatedAt: serverTimestamp(),
      });
    }
  }
};

export const getClubMembers = async (clubId) => {
  const snap = await getDocs(collection(db, CLUBS_COL, clubId, "members"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getPublicClubs = async (excludeClubId = null, limitCount = 50) => {
  const snap = await getDocs(query(collection(db, CLUBS_COL), orderBy("name")));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((club) => !excludeClubId || club.id !== excludeClubId)
    .slice(0, limitCount);
};

export const subscribeToClub = (clubId, callback) => {
  return onSnapshot(
    doc(db, CLUBS_COL, clubId),
    (snap) => {
      callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    },
    (error) => {
      if (error?.code !== "permission-denied") {
        console.error("subscribeToClub listener error:", error);
      }
      callback(null);
    },
  );
};

export const updateMemberRole = async (clubId, memberId, newRoleOrRoles) => {
  const memberRef = doc(db, CLUBS_COL, clubId, "members", memberId);
  const memberSnap = await getDoc(memberRef);
  const nextRoles = toRoleList(newRoleOrRoles);
  const primaryRole = resolvePrimaryRole(nextRoles);
  const teamIds = Array.isArray(memberSnap.data()?.teamIds)
    ? memberSnap.data().teamIds
    : [];
  const existingGroupIds = Array.isArray(memberSnap.data()?.groupIds)
    ? memberSnap.data().groupIds
    : [];

  const preserved = existingGroupIds.filter(
    (id) => !ROLE_GROUP_IDS.has(String(id || "").toLowerCase()),
  );
  const groupIds = Array.from(
    new Set([...preserved, ...buildGroupIds(nextRoles, teamIds)]),
  );

  // Update the member sub-document
  await updateDoc(memberRef, {
    role: primaryRole,
    roles: nextRoles,
    groupIds,
    updatedAt: serverTimestamp(),
  });

  try {
    await syncGroupMembershipsForMember(clubId, {
      uid: memberId,
      role: primaryRole,
      roles: nextRoles,
      teamIds,
      groupIds,
    });
  } catch (error) {
    console.warn(
      "Failed to sync group memberships on role update:",
      error?.message || error,
    );
  }

  // Sync role to user's clubMemberships array
  const userRef = doc(db, "users", memberId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const memberships = userSnap.data().clubMemberships || [];
    const updated = memberships.map((m) =>
      m.clubId === clubId
        ? {
            ...m,
            role: primaryRole,
            roles: nextRoles,
            groupIds: Array.from(
              new Set([
                ...(Array.isArray(m.groupIds) ? m.groupIds : []).filter(
                  (id) => !ROLE_GROUP_IDS.has(String(id || "").toLowerCase()),
                ),
                ...buildGroupIds(nextRoles, m.teamIds || teamIds),
              ]),
            ),
          }
        : m,
    );
    await updateDoc(userRef, {
      clubMemberships: updated,
      updatedAt: serverTimestamp(),
    });
  }
};

export const removeClubMember = async (clubId, memberId) => {
  // Remove from member sub-collection
  await deleteDoc(doc(db, CLUBS_COL, clubId, "members", memberId));

  // Remove from user's clubMemberships array
  const userRef = doc(db, "users", memberId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const memberships = (userSnap.data().clubMemberships || []).filter(
      (m) => m.clubId !== clubId,
    );
    await updateDoc(userRef, {
      clubMemberships: memberships,
      updatedAt: serverTimestamp(),
    });
  }
};

export const followClub = async (userId, clubId) => {
  await updateDoc(doc(db, "users", userId), {
    followedClubIds: arrayUnion(clubId),
    updatedAt: serverTimestamp(),
  });
};

export const unfollowClub = async (userId, clubId) => {
  await updateDoc(doc(db, "users", userId), {
    followedClubIds: arrayRemove(clubId),
    updatedAt: serverTimestamp(),
  });
};

// ─── Role Change Requests ──────────────────────────────────────────────────

export const createRoleChangeRequest = async (
  clubId,
  { userId, userName, currentRole, requestedRole, requestedRoles = [], reason },
) => {
  const normalizedRoles = Array.isArray(requestedRoles)
    ? requestedRoles.map((role) => String(role || "").trim()).filter(Boolean)
    : [];
  const primaryRequestedRole =
    normalizedRoles[0] || String(requestedRole || "").trim();
  const reqRef = doc(db, CLUBS_COL, clubId, "roleChangeRequests", userId);
  await setDoc(reqRef, {
    userId,
    userName: userName || "",
    currentRole: currentRole || "",
    requestedRole: primaryRequestedRole || "",
    requestedRoles: normalizedRoles,
    reason: reason || "",
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const subscribeToRoleChangeRequests = (clubId, callback) => {
  const q = query(
    collection(db, CLUBS_COL, clubId, "roleChangeRequests"),
    where("status", "==", "pending"),
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (error) => {
      if (error?.code !== "permission-denied") {
        console.error("subscribeToRoleChangeRequests listener error:", error);
      }
      callback([]);
    },
  );
};

export const approveRoleChangeRequest = async (clubId, request) => {
  const { userId, requestedRole, requestedRoles } = request;
  const nextRoles =
    Array.isArray(requestedRoles) && requestedRoles.length > 0
      ? requestedRoles
      : requestedRole;
  await updateMemberRole(clubId, userId, nextRoles);
  await updateDoc(
    doc(db, CLUBS_COL, clubId, "roleChangeRequests", userId),
    { status: "approved", updatedAt: serverTimestamp() },
  );
};

export const rejectRoleChangeRequest = async (clubId, userId, reason = "") => {
  await updateDoc(
    doc(db, CLUBS_COL, clubId, "roleChangeRequests", userId),
    { status: "rejected", rejectReason: reason, updatedAt: serverTimestamp() },
  );
};

// ─── Sponsor Invites ───────────────────────────────────────────────────────

export const createSponsorInvite = async (clubId, { sponsorEmail, createdBy, clubName }) => {
  const inviteRef = doc(collection(db, CLUBS_COL, clubId, "sponsorInvites"));
  await setDoc(inviteRef, {
    sponsorEmail: sponsorEmail.trim().toLowerCase(),
    clubId,
    clubName: clubName || "",
    status: "pending",
    createdBy: createdBy || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return inviteRef.id;
};

export const subscribeToSponsorInvites = (clubId, callback) => {
  return onSnapshot(
    collection(db, CLUBS_COL, clubId, "sponsorInvites"),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  );
};
