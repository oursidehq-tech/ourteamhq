import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";

const normalizeGroupId = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const buildVisibleDutyQueries = (colRef, userGroupIds = [], userId = "") => {
  const normalizedGroups = Array.from(
    new Set(
      (userGroupIds || []).map((id) => normalizeGroupId(id)).filter(Boolean),
    ),
  );
  const chunks = chunkArray(normalizedGroups, 10);
  const queries = [query(colRef, where("openToAll", "==", true))];

  // Also include items with no assigned groups (club-wide)
  queries.push(query(colRef, where("groupType", "==", "Club")));

  if (userId) {
    queries.push(query(colRef, where("createdBy", "==", userId)));
    queries.push(query(colRef, where("assignedUserId", "==", userId)));
  }

  chunks.forEach((groupChunk) => {
    queries.push(query(colRef, where("assignedGroupId", "in", groupChunk)));
    queries.push(query(colRef, where("teamId", "in", groupChunk)));
    queries.push(
      query(colRef, where("assignedGroupIds", "array-contains-any", groupChunk)),
    );
  });

  return queries;
};

const isDutyVisibleToUserGroups = (duty, userGroupIds = [], userId = "") => {
  if (!duty) return false;
  if (userId && duty.createdBy === userId) return true;
  if (duty.openToAll === true || duty.groupType === "Club") return true;

  const directUserId = String(duty.assignedUserId || duty.assigneeId || "");
  if (directUserId && userId && directUserId === userId) return true;

  const userGroups = new Set(
    (userGroupIds || []).map((id) => normalizeGroupId(id)),
  );
  const assigned = Array.from(
    new Set([
      normalizeGroupId(duty.assignedGroupId),
      normalizeGroupId(duty.teamId),
      ...(Array.isArray(duty.assignedGroupIds) ? duty.assignedGroupIds : []).map(
        (id) => normalizeGroupId(id),
      ),
    ]),
  ).filter(Boolean);

  if (assigned.length === 0) return false;
  return assigned.some((groupId) => userGroups.has(groupId));
};

const mergeMaps = (maps = []) => {
  const result = new Map();
  maps.forEach((m) => {
    if (m instanceof Map) {
      m.forEach((val, key) => result.set(key, val));
    }
  });
  return Array.from(result.values());
};

const checklistsCol = (clubId) => collection(db, "clubs", clubId, "checklists");
const teamComplianceCol = (clubId) =>
  collection(db, "clubs", clubId, "teamCompliance");
const drillsCol = (clubId) => collection(db, "clubs", clubId, "drills");
const trainingPlansCol = (clubId) =>
  collection(db, "clubs", clubId, "trainingPlans");
const trainingSessionsCol = (clubId) =>
  collection(db, "clubs", clubId, "trainingSessions");
const eventsCol = (clubId) => collection(db, "clubs", clubId, "events");
const notificationsCol = (clubId) => collection(db, "clubs", clubId, "notifications");
const familyProfilesCol = (clubId) =>
  collection(db, "clubs", clubId, "familyProfiles");
const playerProfilesCol = (clubId) =>
  collection(db, "clubs", clubId, "playerProfiles");

const toRows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

const normalizeChecklistItems = (items = []) =>
  (items || [])
    .map((item, index) => {
      const label = String(item?.label || "").trim();
      if (!label) return null;
      return {
        id: item?.id || `item-${Date.now()}-${index}`,
        label,
        required: item?.required !== false,
        done: item?.done === true,
        completedByUid: item?.completedByUid || "",
        completedByName: item?.completedByName || "",
        completedAt: item?.completedAt || "",
      };
    })
    .filter(Boolean);

const normalizeChildren = (children = []) =>
  (children || [])
    .map((child, index) => {
      const name = String(child?.name || "").trim();
      if (!name) return null;

      const playerId = String(
        child?.playerId || child?.id || `player-${Date.now()}-${index}`,
      ).trim();

      const linkedPlayerUid = String(
        child?.linkedPlayerUserUid || child?.linkedUserUid || "",
      ).trim();

      return {
        id: playerId,
        playerId,
        name,
        teamId: String(child?.teamId || "").trim(),
        ageGroup: String(child?.ageGroup || "").trim(),
        linkedPlayerUserUid: linkedPlayerUid,
        requireParentApprovalForPayments:
          child?.requireParentApprovalForPayments !== false,
      };
    })
    .filter(Boolean);

const normalizeParentLinks = (parentLinks = []) => {
  return Array.from(
    new Map(
      (parentLinks || [])
        .map((row) => {
          const uid = String(row?.uid || "").trim();
          if (!uid) return null;

          return [
            uid,
            {
              uid,
              name: String(row?.name || "").trim(),
              relationship: String(row?.relationship || "parent").trim(),
            },
          ];
        })
        .filter(Boolean),
    ).values(),
  );
};

const normalizePlayerProfileInput = (payload = {}) => {
  const parentLinks = normalizeParentLinks(payload.parentLinks || []);
  const parentUids = parentLinks.map((row) => row.uid);

  return {
    playerName: String(payload.playerName || "").trim(),
    teamId: String(payload.teamId || "").trim(),
    teamName: String(payload.teamName || "").trim(),
    ageGroup: String(payload.ageGroup || "").trim(),
    linkedPlayerUserUid: String(payload.linkedPlayerUserUid || "").trim(),
    parentLinks,
    parentUids,
    paymentPolicy: {
      requireParentApprovalForPayments:
        payload?.paymentPolicy?.requireParentApprovalForPayments !== false,
    },
  };
};

export const createChecklist = async (
  clubId,
  {
    title,
    category = "general",
    dueDate = "",
    startDate = "",
    endDate = "",
    isAllDay = false,
    startTime = "",
    endTime = "",
    appliesTo = "team",
    teamId = "",
    teamName = "",
    items = [],
    assignedGroupIds = [],
    assignedGroupNames = "",
    createdBy = "",
    createdByName = "",
  },
) => {
  const normalizedTeamId = String(teamId || "").trim();
  if (!normalizedTeamId) {
    throw new Error("Checklist must be assigned to a team.");
  }

  const ref = doc(checklistsCol(clubId));
  const data = {
    title: String(title || "").trim(),
    category: String(category || "general")
      .trim()
      .toLowerCase(),
    dueDate: String(dueDate || "").trim(),
    startDate: String(startDate || "").trim(),
    endDate: String(endDate || "").trim(),
    isAllDay: !!isAllDay,
    startTime: String(startTime || "").trim(),
    endTime: String(endTime || "").trim(),
    appliesTo: String(appliesTo || "team")
      .trim()
      .toLowerCase(),
    teamId: normalizedTeamId,
    teamName: String(teamName || "").trim(),
    assignedGroupId: assignedGroupIds[0] || normalizedTeamId || null,
    assignedGroupIds:
      assignedGroupIds.length > 0
        ? assignedGroupIds
        : normalizedTeamId
          ? [normalizedTeamId]
          : [],
    assignedGroupNames: String(assignedGroupNames || teamName || "").trim(),
    items: normalizeChecklistItems(items),
    createdBy,
    createdByName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, data);
  return { id: ref.id, ...data };
};

export const updateChecklist = async (
  clubId,
  checklistId,
  {
    title,
    category,
    dueDate,
    startDate,
    endDate,
    isAllDay,
    startTime,
    endTime,
    appliesTo,
    teamId,
    teamName,
    assignedGroupIds,
    assignedGroupNames,
    items,
  },
) => {
  if (!checklistId) throw new Error("Checklist ID is required");

  const normalizedTeamId = String(teamId || "").trim();
  const ref = doc(checklistsCol(clubId), checklistId);
  const updates = {
    ...(title !== undefined && { title: String(title).trim() }),
    ...(category !== undefined && {
      category: String(category).trim().toLowerCase(),
    }),
    ...(dueDate !== undefined && { dueDate: String(dueDate).trim() }),
    ...(startDate !== undefined && { startDate: String(startDate).trim() }),
    ...(endDate !== undefined && { endDate: String(endDate).trim() }),
    ...(isAllDay !== undefined && { isAllDay: !!isAllDay }),
    ...(startTime !== undefined && { startTime: String(startTime).trim() }),
    ...(endTime !== undefined && { endTime: String(endTime).trim() }),
    ...(appliesTo !== undefined && {
      appliesTo: String(appliesTo).trim().toLowerCase(),
    }),
    ...(teamId !== undefined && { teamId: normalizedTeamId }),
    ...(teamName !== undefined && { teamName: String(teamName).trim() }),
    ...(assignedGroupIds !== undefined && {
      assignedGroupId: assignedGroupIds[0] || normalizedTeamId || null,
      assignedGroupIds:
        assignedGroupIds.length > 0
          ? assignedGroupIds
          : normalizedTeamId
            ? [normalizedTeamId]
            : [],
      assignedGroupNames: String(assignedGroupNames || teamName || "").trim(),
    }),
    ...(items !== undefined && { items: normalizeChecklistItems(items) }),
    updatedAt: serverTimestamp(),
  };

  await updateDoc(ref, updates);
  return { id: checklistId, ...updates };
};

export const deleteChecklist = async (clubId, checklistId) => {
  if (!checklistId) throw new Error("Checklist ID is required");
  const ref = doc(checklistsCol(clubId), checklistId);
  await updateDoc(ref, {
    isDeleted: true,
    deletedAt: serverTimestamp(),
  });
};

export const toggleChecklistItemDone = async (
  clubId,
  checklistId,
  itemId,
  { done, userId = "", userName = "" },
) => {
  const ref = doc(db, "clubs", clubId, "checklists", checklistId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Checklist not found.");

  const row = snap.data() || {};
  const nextItems = (row.items || []).map((item) => {
    if (item.id !== itemId) return item;

    const completed = !!done;
    return {
      ...item,
      done: completed,
      completedByUid: completed ? userId : "",
      completedByName: completed ? userName : "",
      completedAt: completed ? new Date().toISOString() : "",
    };
  });

  await updateDoc(ref, {
    items: nextItems,
    updatedAt: serverTimestamp(),
  });
};

export const subscribeToChecklists = (
  clubId,
  callback,
  { userGroupIds = [], userId = "", isAdmin = false } = {},
) => {
  if (isAdmin) {
    const q = query(checklistsCol(clubId), orderBy("updatedAt", "desc"));
    return onSnapshot(
      q,
      (snap) => callback(toRows(snap).filter((r) => r.isDeleted !== true)),
      () => callback([]),
    );
  }

  const qrs = buildVisibleDutyQueries(checklistsCol(clubId), userGroupIds, userId);
  const snapshots = qrs.map(() => new Map());

  const push = () => {
    const merged = mergeMaps(snapshots);
    const visible = merged
      .filter((r) => isDutyVisibleToUserGroups(r, userGroupIds, userId))
      .filter((r) => r.isDeleted !== true);
    // Sort by updatedAt desc
    visible.sort((a, b) => {
      const ta = a.updatedAt?.toMillis?.() || 0;
      const tb = b.updatedAt?.toMillis?.() || 0;
      return tb - ta;
    });
    callback(visible);
  };

  const unsubs = qrs.map((qRef, index) =>
    onSnapshot(
      qRef,
      (snap) => {
        const map = new Map();
        snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
        snapshots[index] = map;
        push();
      },
      () => {
        snapshots[index] = new Map();
        push();
      },
    ),
  );

  return () => unsubs.forEach((unsub) => unsub?.());
};

export const upsertTeamCompliance = async (
  clubId,
  {
    teamId,
    teamName,
    coachAccredited,
    managerAssigned,
    safetyOfficerAssigned,
    sportsTrainerAssigned,
    requiredRoles,
    assignedRoles,
    notes = "",
    updatedBy = "",
  },
) => {
  const ref = doc(teamComplianceCol(clubId), teamId);
  const snap = await getDoc(ref);
  const base = {
    teamId,
    teamName: String(teamName || "").trim(),
    coachAccredited: !!coachAccredited,
    managerAssigned: !!managerAssigned,
    safetyOfficerAssigned: !!safetyOfficerAssigned,
    sportsTrainerAssigned: !!sportsTrainerAssigned,
    requiredRoles: Array.isArray(requiredRoles) ? requiredRoles : [],
    assignedRoles: Array.isArray(assignedRoles) ? assignedRoles : [],
    notes: String(notes || "").trim(),
    updatedBy,
    updatedAt: serverTimestamp(),
  };

  if (!snap.exists()) {
    await setDoc(ref, {
      ...base,
      createdAt: serverTimestamp(),
    });
    return;
  }

  await updateDoc(ref, base);
};

export const subscribeToTeamCompliance = (clubId, callback) => {
  const q = query(teamComplianceCol(clubId), orderBy("teamName"));
  return onSnapshot(
    q,
    (snap) => callback(toRows(snap)),
    () => callback([]),
  );
};

export const createDrill = async (
  clubId,
  {
    title,
    category = "General",
    difficulty = "Intermediate",
    durationMins = 20,
    videoUrl = "",
    videoUrls = [],
    description = "",
    imageUrls = [],
    teamId = "",
    teamName = "",
    assignedGroupIds = [],
    assignedGroupNames = "",
    createdBy = "",
  },
) => {
  const normalizedTeamId = String(teamId || "").trim();
  const normalizedVideoUrls = (videoUrls || [])
    .filter((url) => String(url || "").trim())
    .map((url) => String(url).trim());

  // If legacy videoUrl is provided, add it to videoUrls
  if (videoUrl && !normalizedVideoUrls.includes(videoUrl)) {
    normalizedVideoUrls.unshift(videoUrl);
  }

  const normalizedImageUrls = (imageUrls || [])
    .filter((url) => String(url || "").trim())
    .map((url) => String(url).trim());

  const ref = doc(drillsCol(clubId));
  const data = {
    title: String(title || "").trim(),
    category: String(category || "General").trim(),
    difficulty: String(difficulty || "Intermediate").trim(),
    durationMins: Number(durationMins) || 20,
    videoUrl: normalizedVideoUrls[0] || "", // Keep for backward compat
    videoUrls: normalizedVideoUrls,
    imageUrls: normalizedImageUrls,
    description: String(description || "").trim(),
    teamId: normalizedTeamId,
    teamName: String(teamName || "").trim(),
    assignedGroupId: assignedGroupIds[0] || normalizedTeamId || null,
    assignedGroupIds:
      assignedGroupIds.length > 0
        ? assignedGroupIds
        : normalizedTeamId
          ? [normalizedTeamId]
          : [],
    assignedGroupNames: String(assignedGroupNames || teamName || "").trim(),
    groupType:
      assignedGroupIds.length > 0 || normalizedTeamId ? "Team" : "Club",
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, data);
  return { id: ref.id, ...data };
};

export const updateDrill = async (
  clubId,
  drillId,
  {
    title,
    category,
    difficulty,
    durationMins,
    videoUrl,
    videoUrls,
    description,
    imageUrls,
    teamId,
    teamName,
    assignedGroupIds = [],
    assignedGroupNames = "",
  },
) => {
  if (!drillId) throw new Error("Drill ID is required");

  const normalizedTeamId = String(teamId || "").trim();
  const normalizedVideoUrls = (videoUrls || [])
    .filter((url) => String(url || "").trim())
    .map((url) => String(url).trim());

  if (videoUrl && !normalizedVideoUrls.includes(videoUrl)) {
    normalizedVideoUrls.unshift(videoUrl);
  }

  const normalizedImageUrls = (imageUrls || [])
    .filter((url) => String(url || "").trim())
    .map((url) => String(url).trim());

  const ref = doc(drillsCol(clubId), drillId);
  const updates = {
    ...(title !== undefined && { title: String(title).trim() }),
    ...(category !== undefined && { category: String(category).trim() }),
    ...(difficulty !== undefined && { difficulty: String(difficulty).trim() }),
    ...(durationMins !== undefined && {
      durationMins: Number(durationMins) || 20,
    }),
    ...(description !== undefined && {
      description: String(description).trim(),
    }),
    ...(teamId !== undefined && { teamId: normalizedTeamId }),
    ...(teamName !== undefined && { teamName: String(teamName).trim() }),
    ...((videoUrls || videoUrl) && {
      videoUrl: normalizedVideoUrls[0] || "",
      videoUrls: normalizedVideoUrls,
    }),
    ...(imageUrls && { imageUrls: normalizedImageUrls }),
    ...(assignedGroupIds !== undefined && {
      assignedGroupId: assignedGroupIds[0] || normalizedTeamId || null,
      assignedGroupIds:
        assignedGroupIds.length > 0
          ? assignedGroupIds
          : normalizedTeamId
            ? [normalizedTeamId]
            : [],
      assignedGroupNames: String(assignedGroupNames || teamName || "").trim(),
    }),
    updatedAt: serverTimestamp(),
  };

  await updateDoc(ref, updates);
  return { id: drillId, ...updates };
};

export const deleteDrill = async (clubId, drillId) => {
  if (!drillId) throw new Error("Drill ID is required");
  const ref = doc(drillsCol(clubId), drillId);
  await updateDoc(ref, {
    isDeleted: true,
    deletedAt: serverTimestamp(),
  });
};

export const subscribeToDrills = (
  clubId,
  callback,
  { userGroupIds = [], userId = "", isAdmin = false } = {},
) => {
  if (isAdmin) {
    const q = query(drillsCol(clubId), orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      (snap) => callback(toRows(snap).filter((d) => d.isDeleted !== true)),
      () => callback([]),
    );
  }

  const qrs = buildVisibleDutyQueries(drillsCol(clubId), userGroupIds, userId);
  const snapshots = qrs.map(() => new Map());

  const push = () => {
    const merged = mergeMaps(snapshots);
    const visible = merged
      .filter((r) => isDutyVisibleToUserGroups(r, userGroupIds, userId))
      .filter((d) => d.isDeleted !== true);
    visible.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });
    callback(visible);
  };

  const unsubs = qrs.map((qRef, index) =>
    onSnapshot(
      qRef,
      (snap) => {
        const map = new Map();
        snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
        snapshots[index] = map;
        push();
      },
      () => {
        snapshots[index] = new Map();
        push();
      },
    ),
  );

  return () => unsubs.forEach((unsub) => unsub?.());
};

export const createTrainingPlan = async (
  clubId,
  {
    title,
    teamId = "",
    teamName = "",
    objective = "",
    description = "",
    sessionDate = "",
    drillIds = [],
    planItems = [],
    durationMins = 0,
    status = "draft",
    isTemplate = false,
    sharedWithGroupIds = [],
    createdBy = "",
    createdByName = "",
  },
) => {
  const ref = doc(trainingPlansCol(clubId));
  const normalizedTeamId = String(teamId || "").trim();
  const normalizedItems = (planItems || []).map((item, idx) => ({
    ...item,
    sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : idx,
    durationOverride:
      item.durationOverride != null && item.durationOverride !== ""
        ? Number(item.durationOverride)
        : null,
  }));
  const normalizedDrillIds = Array.from(
    new Set(
      (normalizedItems.length > 0 ? normalizedItems.map((i) => i.drillId) : drillIds || []).filter(Boolean)
    )
  );
  const normalizedSharedGroupIds = Array.from(
    new Set((sharedWithGroupIds || []).filter(Boolean)),
  );
  const data = {
    title: String(title || "").trim(),
    teamId: normalizedTeamId,
    teamName: String(teamName || "").trim(),
    assignedGroupId: normalizedTeamId || null,
    assignedGroupIds: normalizedTeamId
      ? [normalizedTeamId, normalizedTeamId.toLowerCase()]
      : [],
    groupType: normalizedTeamId ? "Team" : "Club",
    objective: String(objective || description || "").trim(),
    description: String(description || objective || "").trim(),
    sessionDate: String(sessionDate || "").trim(),
    drillIds: normalizedDrillIds,
    planItems: normalizedItems,
    durationMins: Number(durationMins) || 0,
    status: status || "draft",
    isTemplate: Boolean(isTemplate),
    sharedWithGroupIds: normalizedSharedGroupIds,
    isDeleted: false,
    createdBy,
    createdByName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, data);
  return { id: ref.id, ...data };
};

export const updateTrainingPlan = async (
  clubId,
  planId,
  {
    title,
    teamId,
    teamName,
    objective,
    description,
    sessionDate,
    drillIds,
    planItems,
    durationMins,
    status,
    isTemplate,
    sharedWithGroupIds,
  },
) => {
  if (!planId) throw new Error("Training Plan ID is required");

  const normalizedTeamId =
    teamId !== undefined ? String(teamId).trim() : undefined;
  const normalizedItems = Array.isArray(planItems)
    ? planItems.map((item, idx) => ({
        ...item,
        sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : idx,
        durationOverride:
          item.durationOverride != null && item.durationOverride !== ""
            ? Number(item.durationOverride)
            : null,
      }))
    : undefined;
  const normalizedDrillIds =
    drillIds || (normalizedItems ? normalizedItems.map((i) => i.drillId) : undefined);
  const normalizedSharedGroupIds =
    sharedWithGroupIds &&
    Array.from(new Set((sharedWithGroupIds || []).filter(Boolean)));

  const ref = doc(trainingPlansCol(clubId), planId);
  const updates = {
    ...(title !== undefined && { title: String(title).trim() }),
    ...(teamId !== undefined && {
      teamId: normalizedTeamId,
      assignedGroupId: normalizedTeamId || null,
      assignedGroupIds: normalizedTeamId
        ? [normalizedTeamId, normalizedTeamId.toLowerCase()]
        : [],
      groupType: normalizedTeamId ? "Team" : "Club",
    }),
    ...(teamName !== undefined && { teamName: String(teamName).trim() }),
    ...(objective !== undefined && { objective: String(objective).trim() }),
    ...(description !== undefined && { description: String(description).trim() }),
    ...(sessionDate !== undefined && {
      sessionDate: String(sessionDate).trim(),
    }),
    ...(normalizedDrillIds && { drillIds: normalizedDrillIds }),
    ...(normalizedItems !== undefined && { planItems: normalizedItems }),
    ...(durationMins !== undefined && { durationMins: Number(durationMins) || 0 }),
    ...(status !== undefined && { status }),
    ...(isTemplate !== undefined && { isTemplate: Boolean(isTemplate) }),
    ...(sharedWithGroupIds && { sharedWithGroupIds: normalizedSharedGroupIds }),
    updatedAt: serverTimestamp(),
  };

  await updateDoc(ref, updates);
  return { id: planId, ...updates };
};

export const deleteTrainingPlan = async (clubId, planId) => {
  if (!planId) throw new Error("Training Plan ID is required");
  const ref = doc(trainingPlansCol(clubId), planId);
  await updateDoc(ref, {
    isDeleted: true,
    deletedAt: serverTimestamp(),
  });
};

export const shareTrainingPlan = async (
  clubId,
  planId,
  { sharedWithGroupIds },
) => {
  if (!planId) throw new Error("Training Plan ID is required");
  const normalizedSharedGroupIds = Array.from(
    new Set((sharedWithGroupIds || []).filter(Boolean)),
  );
  const ref = doc(trainingPlansCol(clubId), planId);
  await updateDoc(ref, {
    sharedWithGroupIds: normalizedSharedGroupIds,
    updatedAt: serverTimestamp(),
  });
};

export const subscribeToTrainingPlans = (
  clubId,
  callback,
  { userGroupIds = [], userId = "", isAdmin = false } = {},
) => {
  if (isAdmin) {
    const q = query(trainingPlansCol(clubId), orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      (snap) => callback(toRows(snap).filter((d) => d.isDeleted !== true)),
      () => callback([]),
    );
  }

  const qrs = buildVisibleDutyQueries(
    trainingPlansCol(clubId),
    userGroupIds,
    userId,
  );
  const snapshots = qrs.map(() => new Map());

  const push = () => {
    const merged = mergeMaps(snapshots);
    const visible = merged
      .filter((r) => isDutyVisibleToUserGroups(r, userGroupIds, userId))
      .filter((d) => d.isDeleted !== true);
    visible.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });
    callback(visible);
  };

  const unsubs = qrs.map((qRef, index) =>
    onSnapshot(
      qRef,
      (snap) => {
        const map = new Map();
        snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
        snapshots[index] = map;
        push();
      },
      () => {
        snapshots[index] = new Map();
        push();
      },
    ),
  );

  return () => unsubs.forEach((unsub) => unsub?.());
};

export const subscribeToTrainingSessions = (
  clubId,
  callback,
  { userGroupIds = [], userId = "", isAdmin = false } = {},
) => {
  if (!clubId) {
    callback([]);
    return () => {};
  }

  const q = query(trainingSessionsCol(clubId), orderBy("scheduledAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const allSessions = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((d) => d.isDeleted !== true);

      if (isAdmin) {
        callback(allSessions);
        return;
      }

      // Filter sessions for player/parent if specific to team
      const normalizedGroupIds = new Set(
        (userGroupIds || []).map((id) => String(id || "").toLowerCase())
      );

      const visible = allSessions.filter((session) => {
        if (!session.teamId) return true; // Club-wide session
        const tid = String(session.teamId).toLowerCase();
        return normalizedGroupIds.has(tid) || normalizedGroupIds.has(`team:${tid}`);
      });

      callback(visible);
    },
    (err) => {
      console.warn("subscribeToTrainingSessions error:", err);
      callback([]);
    }
  );
};

export const createTrainingSession = async (
  clubId,
  {
    planId,
    planTitle = "",
    teamId = "",
    teamName = "",
    scheduledAt = "",
    location = "",
    createdBy = "",
    locked = false,
  },
) => {
  const sessionRef = doc(trainingSessionsCol(clubId));
  const sessionId = sessionRef.id;

  const sessionPayload = {
    planId,
    planTitle: planTitle || "Training Session",
    teamId: teamId || null,
    teamName: teamName || "Club Wide",
    scheduledAt: scheduledAt || new Date().toISOString(),
    location: location || "",
    status: "scheduled",
    attendance: [],
    locked: Boolean(locked),
    isDeleted: false,
    createdBy: createdBy || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(sessionRef, sessionPayload);

  // Sync to calendar in clubs/{clubId}/events
  let eventDate = "";
  let eventStartTime = "";
  if (scheduledAt) {
    if (scheduledAt.includes("T")) {
      const [d, t] = scheduledAt.split("T");
      eventDate = d;
      eventStartTime = t.slice(0, 5);
    } else {
      eventDate = scheduledAt.slice(0, 10);
    }
  }

  try {
    const eventRef = doc(eventsCol(clubId));
    await setDoc(eventRef, {
      title: `Training: ${planTitle || "Team Session"}`,
      description: `Training session scheduled from plan "${planTitle}". Location: ${location || "Club Ground"}.`,
      date: eventDate || new Date().toISOString().slice(0, 10),
      startTime: eventStartTime || "18:00",
      endTime: "",
      location: location || "Club Ground",
      type: "training",
      category: "training",
      teamId: teamId || null,
      assignedGroupId: teamId || null,
      assignedGroupIds: teamId ? [teamId, teamId.toLowerCase()] : [],
      assignedGroupName: teamName || "Club",
      groupType: teamId ? "Team" : "Club",
      openToAll: !teamId,
      trainingSessionId: sessionId,
      planId: planId,
      createdBy: createdBy || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await updateDoc(sessionRef, { calendarEventId: eventRef.id });
  } catch (e) {
    console.warn("Failed to push session to calendar events:", e);
  }

  // Push notification for members
  try {
    const notifRef = doc(notificationsCol(clubId));
    const prettyDate = eventDate ? `${eventDate} ${eventStartTime ? 'at ' + eventStartTime : ''}` : 'Upcoming date';
    await setDoc(notifRef, {
      title: `New Training: ${planTitle || "Team Session"}`,
      body: `A training session has been scheduled for ${prettyDate} at ${location || "Club Ground"}. Open to view drills.`,
      message: `A training session has been scheduled for ${prettyDate} at ${location || "Club Ground"}. Open to view drills.`,
      recipientId: teamId || "all",
      clubId,
      read: false,
      type: "training",
      meta: {
        trainingSessionId: sessionId,
        planId: planId,
        teamId: teamId || null,
      },
      sentBy: "coach",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn("Failed to push session notification:", e);
  }

  return sessionId;
};

export const deleteTrainingSession = async (clubId, sessionId) => {
  if (!sessionId) throw new Error("Session ID is required");
  const ref = doc(trainingSessionsCol(clubId), sessionId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const sess = snap.data();
    if (sess.calendarEventId) {
      try {
        await updateDoc(doc(eventsCol(clubId), sess.calendarEventId), {
          isDeleted: true,
          deletedAt: serverTimestamp(),
        });
      } catch {}
    }
  }
  await updateDoc(ref, {
    isDeleted: true,
    deletedAt: serverTimestamp(),
  });
};

export const getDrillPlanUsageCount = async (clubId, drillId) => {
  try {
    const q = query(
      trainingPlansCol(clubId),
      where("drillIds", "array-contains", drillId),
    );
    const snap = await getDocs(q);
    return snap.docs.filter((d) => d.data()?.isDeleted !== true).length;
  } catch {
    return 0;
  }
};

export const upsertFamilyProfile = async (
  clubId,
  { parentUid, parentName = "", children = [] },
) => {
  const ref = doc(familyProfilesCol(clubId), parentUid);
  const snap = await getDoc(ref);

  const payload = {
    parentUid,
    parentName: String(parentName || "").trim(),
    children: normalizeChildren(children),
    updatedAt: serverTimestamp(),
  };

  if (!snap.exists()) {
    await setDoc(ref, {
      ...payload,
      createdAt: serverTimestamp(),
    });
    return;
  }

  await updateDoc(ref, payload);
};

export const getTeamComplianceRows = async (clubId) => {
  const snap = await getDocs(
    query(teamComplianceCol(clubId), orderBy("teamName")),
  );
  return toRows(snap);
};

export const subscribeToFamilyProfile = (clubId, parentUid, callback) => {
  const ref = doc(familyProfilesCol(clubId), parentUid);
  return onSnapshot(
    ref,
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    () => callback(null),
  );
};

export const upsertPlayerProfile = async (clubId, playerId, payload = {}) => {
  const normalizedPlayerId = String(playerId || "").trim();
  if (!normalizedPlayerId) {
    throw new Error("Player id is required.");
  }

  const ref = doc(playerProfilesCol(clubId), normalizedPlayerId);
  const snap = await getDoc(ref);
  const normalized = normalizePlayerProfileInput(payload);

  const base = {
    playerId: normalizedPlayerId,
    playerName: normalized.playerName,
    teamId: normalized.teamId,
    teamName: normalized.teamName,
    ageGroup: normalized.ageGroup,
    linkedPlayerUserUid: normalized.linkedPlayerUserUid,
    parentLinks: normalized.parentLinks,
    parentUids: normalized.parentUids,
    paymentPolicy: normalized.paymentPolicy,
    updatedAt: serverTimestamp(),
  };

  if (!snap.exists()) {
    await setDoc(ref, {
      ...base,
      createdAt: serverTimestamp(),
    });
    return { id: normalizedPlayerId, ...base };
  }

  await updateDoc(ref, base);
  return { id: normalizedPlayerId, ...base };
};

export const getPlayerProfile = async (clubId, playerId) => {
  const normalizedPlayerId = String(playerId || "").trim();
  if (!normalizedPlayerId) return null;
  const snap = await getDoc(doc(playerProfilesCol(clubId), normalizedPlayerId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const getLinkedPlayerProfileByUser = async (clubId, userUid) => {
  const uid = String(userUid || "").trim();
  if (!uid) return null;

  const snap = await getDocs(
    query(playerProfilesCol(clubId), where("linkedPlayerUserUid", "==", uid)),
  );

  if (snap.empty) return null;
  const row = snap.docs[0];
  return { id: row.id, ...row.data() };
};

export const subscribeToParentPlayerProfiles = (
  clubId,
  parentUid,
  callback,
) => {
  const uid = String(parentUid || "").trim();
  if (!uid) {
    callback([]);
    return () => {};
  }

  const q = query(
    playerProfilesCol(clubId),
    where("parentUids", "array-contains", uid),
    orderBy("playerName", "asc"),
  );

  return onSnapshot(
    q,
    (snap) => callback(toRows(snap)),
    () => callback([]),
  );
};
