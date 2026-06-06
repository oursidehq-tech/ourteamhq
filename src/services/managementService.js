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
  arrayUnion,
  arrayRemove,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { createNotification } from "./notificationService";

// ── Tasks ──

const tasksCol = (clubId) => collection(db, "clubs", clubId, "tasks");
const taskTemplatesCol = (clubId) =>
  collection(db, "clubs", clubId, "taskTemplates");
const groupsCol = (clubId) => collection(db, "clubs", clubId, "groups");
const groupMembershipsCol = (clubId) =>
  collection(db, "clubs", clubId, "groupMemberships");

const chunkArray = (rows = [], size = 10) => {
  const out = [];
  for (let i = 0; i < rows.length; i += size) {
    out.push(rows.slice(i, i + size));
  }
  return out;
};

const mergeMaps = (maps = []) => {
  const merged = new Map();
  maps.forEach((map) => {
    map.forEach((value, key) => merged.set(key, value));
  });
  return Array.from(merged.values());
};

const sortByCreatedDesc = (rows = []) =>
  [...rows].sort((a, b) => {
    const aSec = a?.createdAt?.seconds || 0;
    const bSec = b?.createdAt?.seconds || 0;
    if (aSec !== bSec) return bSec - aSec;
    return String(b?.id || "").localeCompare(String(a?.id || ""));
  });

const sortByDateAsc = (rows = []) =>
  [...rows].sort((a, b) =>
    `${a?.date || ""}`.localeCompare(`${b?.date || ""}`),
  );

const buildVisibleDutyQueries = (colRef, userGroupIds = [], userId = "") => {
  const normalizedGroups = Array.from(
    new Set(
      (userGroupIds || []).map((id) => normalizeGroupId(id)).filter(Boolean),
    ),
  );
  const chunks = chunkArray(normalizedGroups, 10);
  const queries = [query(colRef, where("openToAll", "==", true))];

  if (userId) {
    queries.push(query(colRef, where("createdBy", "==", userId)));
    queries.push(query(colRef, where("assignedUserId", "==", userId)));
    // Also check for filledBy for rosters
    queries.push(query(colRef, where("filledBy", "==", userId)));
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

const normalizeGroupId = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const expandAssignmentIds = (ids = []) => {
  const set = new Set();
  (Array.isArray(ids) ? ids : []).forEach((id) => {
    const raw = String(id || "").trim();
    const normalized = normalizeGroupId(id);
    if (raw) set.add(raw);
    if (normalized) set.add(normalized);
  });
  return Array.from(set);
};

const membershipDocId = (uid, groupId) =>
  `${String(uid || "")}_${normalizeGroupId(groupId).replace(/[^a-z0-9:_-]/g, "_")}`;
const OPEN_VOLUNTEERS_GROUP_ID = "open-volunteers";

const EXECUTIVE_ROLES = new Set([
  "owner",
  "admin",
  "president",
  "vice president",
  "vice-president",
  "executive",
]);

const COMMITTEE_ROLES = new Set([
  "committee",
  "treasurer",
  "secretary",
  "registrar",
  "coordinator",
]);

const createReminderNotifications = async (
  clubId,
  recipientIds,
  { title, body, meta = {}, createdBy = "" },
) => {
  const recipients = Array.from(
    new Set(
      (recipientIds || [])
        .map((id) => String(id || "").trim())
        .filter(Boolean),
    ),
  );
  if (!clubId || recipients.length === 0) return;

  await Promise.all(
    recipients.map((recipientId) =>
      createNotification(clubId, {
        recipientId,
        title,
        body,
        type: "reminder",
        meta,
        createdBy,
      }),
    ),
  );
};

const toGroupType = (value) => {
  const normalized = normalizeGroupId(value);
  if (normalized === "executive") return "Executive";
  if (normalized === "committee") return "Committee";
  return "Team";
};

const isTruthy = (value) => value === true;

const hasValidDutyAssignment = (duty = {}) => {
  if (isTruthy(duty.openToAll)) return true;
  return !!normalizeGroupId(duty.assignedGroupId || duty.teamId);
};

const assertValidDutyAssignment = (duty = {}, context = "duty") => {
  if (!hasValidDutyAssignment(duty)) {
    throw new Error(
      `${context} must include assignedGroupId unless openToAll is true.`,
    );
  }
};

const getAssignmentGroupIds = (duty = {}) => {
  const groupIds = new Set();

  const add = (id) => {
    const normalized = normalizeGroupId(id);
    if (!normalized) return;
    groupIds.add(normalized);
  };

  add(duty.assignedGroupId);
  add(duty.teamId);

  if (duty.openToAll === true) {
    add(OPEN_VOLUNTEERS_GROUP_ID);
  }

  (Array.isArray(duty.assignedGroupIds) ? duty.assignedGroupIds : []).forEach(
    (id) => add(id),
  );

  return Array.from(groupIds);
};

export const getUserGroupIdsForClub = (profile, clubId) => {
  const memberships = Array.isArray(profile?.clubMemberships)
    ? profile.clubMemberships
    : [];
  const membership = memberships.find((m) => m?.clubId === clubId) || null;

  const ids = new Set();
  const add = (id) => {
    const normalized = normalizeGroupId(id);
    if (normalized) ids.add(normalized);
  };

  (Array.isArray(membership?.groupIds) ? membership.groupIds : []).forEach(
    (id) => add(id),
  );

  (Array.isArray(membership?.groups) ? membership.groups : []).forEach((g) => {
    add(g?.groupId);
  });

  (Array.isArray(membership?.teamIds) ? membership.teamIds : []).forEach(
    (teamId) => {
      add(teamId);
      add(`team:${teamId}`);
    },
  );

  const role = normalizeGroupId(membership?.role);
  if (EXECUTIVE_ROLES.has(role)) {
    add("executive");
    add("group:executive");
  }
  if (COMMITTEE_ROLES.has(role)) {
    add("committee");
    add("group:committee");
  }

  // Open duties should always be visible to active members.
  add(OPEN_VOLUNTEERS_GROUP_ID);

  return Array.from(ids);
};

export const isDutyVisibleToUserGroups = (
  duty,
  userGroupIds = [],
  userId = "",
) => {
  if (!duty) return false;
  // Creator always sees their own duties
  if (userId && duty.createdBy === userId) return true;
  if (duty.openToAll === true) return true;

  const directUserId = String(duty.assignedUserId || duty.assigneeId || "");
  if (directUserId) {
    return !!userId && directUserId === userId;
  }

  const assigned = getAssignmentGroupIds(duty);
  if (assigned.length === 0) return false;

  const userGroups = new Set(
    (userGroupIds || []).map((id) => normalizeGroupId(id)),
  );
  return assigned.some((groupId) => userGroups.has(groupId));
};

export const filterVisibleTasksForUser = (
  tasks = [],
  userGroupIds = [],
  userId = "",
) =>
  (tasks || []).filter((task) =>
    isDutyVisibleToUserGroups(task, userGroupIds, userId),
  );

export const filterVisibleRostersForUser = (
  rosters = [],
  userGroupIds = [],
  userId = "",
) =>
  (rosters || [])
    .map((roster) => {
      const visibleShifts = (roster?.shifts || []).filter((shift) =>
        isDutyVisibleToUserGroups(
          {
            ...roster,
            ...shift,
            assignedGroupId: shift?.assignedGroupId || roster?.assignedGroupId,
            openToAll:
              shift?.openToAll === true ||
              (shift?.openToAll !== false && roster?.openToAll === true),
            teamId: shift?.teamId || roster?.teamId,
          },
          userGroupIds,
          userId,
        ),
      );

      return {
        ...roster,
        shifts: visibleShifts,
      };
    })
    .filter((roster) => (roster?.shifts || []).length > 0);

export const filterDutiesByScope = (duties = [], scope = "all") => {
  const normalizedScope = normalizeGroupId(scope);
  if (!normalizedScope || normalizedScope === "all") return duties;

  return (duties || []).filter((duty) => {
    const groupType = String(duty?.groupType || "")
      .trim()
      .toLowerCase();
    const assignedGroupId = normalizeGroupId(
      duty?.assignedGroupId || duty?.teamId,
    );
    const directUserId = String(
      duty?.assignedUserId || duty?.assigneeId || "",
    ).trim();
    const hasDirectUser = !!directUserId;

    const isCommittee =
      groupType === "committee" ||
      assignedGroupId === "committee" ||
      assignedGroupId === "group:committee";
    const isExecutive =
      groupType === "executive" ||
      assignedGroupId === "executive" ||
      assignedGroupId === "group:executive";
    const isOpen =
      duty?.openToAll === true ||
      assignedGroupId === OPEN_VOLUNTEERS_GROUP_ID;
    const isTeam =
      !hasDirectUser &&
      (groupType === "team" ||
        (!!duty?.teamId && !isCommittee && !isExecutive));
    const isGroup = !hasDirectUser && (isCommittee || isExecutive || isOpen);

    if (normalizedScope === "user") {
      return hasDirectUser;
    }
    if (normalizedScope === "group" || normalizedScope === "groups") {
      return isGroup;
    }
    if (normalizedScope === "team") {
      return isTeam;
    }

    // Backward-compatible scopes used by legacy screens.
    if (normalizedScope === "open") {
      return isOpen;
    }
    if (normalizedScope === "committee") {
      return isCommittee;
    }
    if (normalizedScope === "executive") {
      return isExecutive;
    }

    return true;
  });
};

export const filterVisibleTasksForUserByScope = (
  tasks = [],
  userGroupIds = [],
  userId = "",
  scope = "all",
  isAdmin = false,
) => {
  const visible = (isAdmin
    ? tasks
    : filterVisibleTasksForUser(tasks, userGroupIds, userId)
  ).filter((t) => t.isDeleted !== true);
  return filterDutiesByScope(visible, scope);
};

export const filterVisibleRostersForUserByScope = (
  rosters = [],
  userGroupIds = [],
  userId = "",
  scope = "all",
  isAdmin = false,
) => {
  const visible = (isAdmin
    ? rosters
    : filterVisibleRostersForUser(rosters, userGroupIds, userId)
  ).filter((r) => r.isDeleted !== true);
  if (!scope || normalizeGroupId(scope) === "all") return visible;

  return visible
    .map((roster) => {
      const scopedShifts = (roster?.shifts || []).filter(
        (shift) =>
          filterDutiesByScope(
            [
              {
                ...roster,
                ...shift,
                assignedGroupId:
                  shift?.assignedGroupId || roster?.assignedGroupId,
                groupType: shift?.groupType || roster?.groupType,
                openToAll:
                  shift?.openToAll === true ||
                  (shift?.openToAll !== false && roster?.openToAll === true),
              },
            ],
            scope,
          ).length > 0,
      );
      return {
        ...roster,
        shifts: scopedShifts,
      };
    })
    .filter((roster) => (roster?.shifts || []).length > 0);
};

export const createGroup = async (
  clubId,
  { groupName, groupType = "Team", groupId = "" },
) => {
  const ref = groupId
    ? doc(db, "clubs", clubId, "groups", groupId)
    : doc(groupsCol(clubId));
  const data = {
    groupId: ref.id,
    groupName: String(groupName || "").trim(),
    groupType: toGroupType(groupType),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data, { merge: true });
  return { id: ref.id, ...data };
};

export const getGroups = async (clubId) => {
  const snap = await getDocs(query(groupsCol(clubId), orderBy("groupName")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const subscribeToGroups = (clubId, callback, options = {}) => {
  const { groupIds = [], isAdmin = false } = options;
  const colRef = groupsCol(clubId);

  if (isAdmin) {
    const q = query(colRef, orderBy("groupName"));
    return onSnapshot(
      q,
      (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => {
        if (error?.code !== "permission-denied") {
          console.error("subscribeToGroups (admin) error:", error);
        }
        callback([]);
      },
    );
  }

  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    callback([]);
    return () => {};
  }

  const q = query(colRef, where("__name__", "in", groupIds.slice(0, 30)));
  return onSnapshot(
    q,
    (snap) => {
      const results = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      results.sort((a, b) => (a.groupName || "").localeCompare(b.groupName || ""));
      callback(results);
    },
    (error) => {
      if (error?.code !== "permission-denied") {
        console.error("subscribeToGroups (member) error:", error);
      }
      callback([]);
    },
  );
};

export const subscribeToGroupMemberships = (clubId, callback) => {
  const ref = groupMembershipsCol(clubId);
  return onSnapshot(
    ref,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (error) => {
      if (error?.code !== "permission-denied") {
        console.error("subscribeToGroupMemberships listener error:", error);
      }
      callback([]);
    },
  );
};

export const addMemberToGroup = async (
  clubId,
  groupId,
  { userId, displayName = "", email = "" },
) => {
  const normalizedGroupId = normalizeGroupId(groupId);
  const normalizedUserId = String(userId || "").trim();
  if (!clubId || !normalizedGroupId || !normalizedUserId) {
    throw new Error("clubId, groupId and userId are required.");
  }

  const docId = membershipDocId(normalizedUserId, normalizedGroupId);
  await setDoc(
    doc(db, "clubs", clubId, "groupMemberships", docId),
    {
      membershipId: docId,
      userId: normalizedUserId,
      groupId: normalizedGroupId,
      displayName: String(displayName || ""),
      email: String(email || ""),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await setDoc(
    doc(db, "clubs", clubId, "members", normalizedUserId),
    {
      groupIds: arrayUnion(normalizedGroupId),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const removeMemberFromGroup = async (clubId, groupId, userId) => {
  const normalizedGroupId = normalizeGroupId(groupId);
  const normalizedUserId = String(userId || "").trim();
  if (!clubId || !normalizedGroupId || !normalizedUserId) {
    throw new Error("clubId, groupId and userId are required.");
  }

  const docId = membershipDocId(normalizedUserId, normalizedGroupId);
  await deleteDoc(doc(db, "clubs", clubId, "groupMemberships", docId));

  await setDoc(
    doc(db, "clubs", clubId, "members", normalizedUserId),
    {
      groupIds: arrayRemove(normalizedGroupId),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const updateGroup = async (
  clubId,
  groupId,
  { groupName, groupType },
) => {
  const ref = doc(db, "clubs", clubId, "groups", groupId);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    throw new Error("Group not found.");
  }

  const payload = {
    updatedAt: serverTimestamp(),
  };

  if (typeof groupName === "string") {
    payload.groupName = groupName.trim();
  }
  if (typeof groupType === "string") {
    payload.groupType = toGroupType(groupType);
  }

  await updateDoc(ref, payload);
};

export const deleteGroup = async (clubId, groupId) => {
  const ref = doc(db, "clubs", clubId, "groups", groupId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data() || {};
  const isSystem = data.system === true;
  const isTeamBacked = String(data.source || "").toLowerCase() === "team";
  if (isSystem || isTeamBacked) {
    throw new Error("System or team groups cannot be deleted.");
  }

  await deleteDoc(ref);
};

export const createTask = async (
  clubId,
  {
    title,
    description,
    assigneeId,
    assigneeName,
    dueDate,
    startDate,
    endDate,
    startTime,
    endTime,
    isAllDay,
    priority,
    teamId,
    createdBy,
    isRecurring = false,
    recurringRule = null,
    templateId = null,
    season = "",
    assignedGroupId = null,
    assignedGroupIds: passedAssignedGroupIds = [],
    assignedGroupName = "",
    groupType = "Team",
    openToAll = false,
    eventId = "",
    role = "",
    assignedUserId = "",
    assignedUserName = "",
    checklistItems = [],
  },
) => {
  const ref = doc(tasksCol(clubId));
  const normalizedAssignedGroupId =
    assignedGroupId || teamId || (openToAll ? OPEN_VOLUNTEERS_GROUP_ID : null);

  const hasGroups = passedAssignedGroupIds && passedAssignedGroupIds.length > 0;

  if (!hasGroups) {
    assertValidDutyAssignment(
      { assignedGroupId: normalizedAssignedGroupId, teamId, openToAll },
      "Task",
    );
  }

  const assignedGroupIds = hasGroups
    ? expandAssignmentIds(passedAssignedGroupIds)
    : normalizedAssignedGroupId
      ? expandAssignmentIds([normalizedAssignedGroupId])
      : [];
  const normalizedStartDate = startDate || dueDate || "";
  const normalizedEndDate = endDate || normalizedStartDate;
  const normalizedDueDate = dueDate || normalizedStartDate;
  const data = {
    dutyId: ref.id,
    title,
    description: description || "",
    assigneeId: assigneeId || "",
    assigneeName: assigneeName || "",
    dueDate: normalizedDueDate,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    startTime: startTime || "",
    endTime: endTime || "",
    isAllDay: !!isAllDay,
    priority: priority || "medium", // low, medium, high
    teamId: teamId || null,
    status: "pending", // pending, in-progress, completed
    isRecurring,
    recurringRule: recurringRule || null,
    templateId: templateId || null,
    season: season || "",
    assignedGroupId: normalizedAssignedGroupId,
    assignedGroupIds,
    assignedGroupName: assignedGroupName || "",
    groupType: toGroupType(groupType),
    assignedUserId: assignedUserId || assigneeId || "",
    assignedUserName: assignedUserName || assigneeName || "",
    openToAll: !!openToAll,
    eventId: eventId || "",
    role: role || title || "",
    createdBy: createdBy || "",
    checklistItems: Array.isArray(checklistItems) ? checklistItems : [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);

  try {
    await createReminderNotifications(
      clubId,
      [createdBy, assignedUserId, assigneeId],
      {
        title: `Reminder: ${title || "Task"}`,
        body: isRecurring
          ? `Recurring task starts ${normalizedStartDate || normalizedDueDate || "soon"}.`
          : `Task is due on ${normalizedDueDate || normalizedStartDate || "soon"}.`,
        meta: {
          source: "task",
          taskId: ref.id,
          date: normalizedStartDate || normalizedDueDate || "",
          recurring: !!isRecurring,
          priority: priority || "medium",
        },
        createdBy,
      },
    );
  } catch (error) {
    console.warn("createTask reminder notification failed:", error?.message);
  }

  return { id: ref.id, ...data };
};

const getTasks = async (clubId) => {
  const snap = await getDocs(
    query(tasksCol(clubId), orderBy("createdAt", "desc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const updateTask = async (clubId, taskId, data) => {
  await updateDoc(doc(db, "clubs", clubId, "tasks", taskId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deleteTask = async (clubId, taskId) => {
  await deleteDoc(doc(db, "clubs", clubId, "tasks", taskId));
};

const subscribeToTasks = (clubId, callback) => {
  const q = query(tasksCol(clubId), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (error) => {
      if (error?.code !== "permission-denied") {
        console.error("subscribeToTasks listener error:", error);
      }
      callback([]);
    },
  );
};

export const getVisibleTasks = async (
  clubId,
  { userGroupIds = [], userId = "", scope = "all" } = {},
) => {
  const qrs = buildVisibleDutyQueries(tasksCol(clubId), userGroupIds, userId);
  const snaps = await Promise.all(qrs.map((qRef) => getDocs(qRef)));
  const maps = snaps.map((snap) => {
    const map = new Map();
    snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
    return map;
  });
  return filterVisibleTasksForUserByScope(
    sortByCreatedDesc(mergeMaps(maps)),
    userGroupIds,
    userId,
    scope,
  );
};

export const subscribeToVisibleTasks = (
  clubId,
  callback,
  { userGroupIds = [], userId = "", scope = "all", isAdmin = false } = {},
) => {
  // Admins see ALL tasks without group filtering
  if (isAdmin) {
    const q = query(tasksCol(clubId), orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        callback(
          filterVisibleTasksForUserByScope(
            sortByCreatedDesc(rows),
            userGroupIds,
            userId,
            scope,
            true, // isAdmin
          ),
        );
      },
      (error) => {
        if (error?.code !== "permission-denied") {
          console.error("subscribeToVisibleTasks admin listener error:", error);
        }
        callback([]);
      },
    );
  }

  const qrs = buildVisibleDutyQueries(tasksCol(clubId), userGroupIds, userId);
  const snapshots = qrs.map(() => new Map());

  const push = () => {
    callback(
      filterVisibleTasksForUserByScope(
        sortByCreatedDesc(mergeMaps(snapshots)),
        userGroupIds,
        userId,
        scope,
      ),
    );
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

  return () => {
    unsubs.forEach((unsub) => unsub?.());
  };
};

export const createTaskTemplate = async (
  clubId,
  {
    name,
    description,
    defaultPriority = "medium",
    recurringRule = null,
    teamId = null,
    createdBy = "",
    assignedGroupId = null,
    assignedGroupIds: passedAssignedGroupIds = [],
    assignedGroupName = "",
    groupType = "Team",
    openToAll = false,
    role = "",
    assignedUserId = "",
    assignedUserName = "",
  },
) => {
  const ref = doc(taskTemplatesCol(clubId));
  const normalizedAssignedGroupId =
    assignedGroupId || teamId || (openToAll ? OPEN_VOLUNTEERS_GROUP_ID : null);
  const hasGroups = passedAssignedGroupIds && passedAssignedGroupIds.length > 0;
  if (!hasGroups) {
    assertValidDutyAssignment(
      { assignedGroupId: normalizedAssignedGroupId, teamId, openToAll },
      "Task template",
    );
  }
  const assignedGroupIds = hasGroups
    ? expandAssignmentIds(passedAssignedGroupIds)
    : normalizedAssignedGroupId
      ? expandAssignmentIds([normalizedAssignedGroupId])
      : [];
  const data = {
    name,
    description: description || "",
    defaultPriority,
    recurringRule: recurringRule || null,
    teamId: teamId || null,
    assignedGroupId: normalizedAssignedGroupId,
    assignedGroupIds,
    assignedGroupName: assignedGroupName || "",
    groupType: toGroupType(groupType),
    assignedUserId: assignedUserId || "",
    assignedUserName: assignedUserName || "",
    openToAll: !!openToAll,
    role: role || name || "",
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);

  try {
    const shiftRecipients = normalizedShifts.flatMap((shift) => [
      shift.assignedUserId,
      shift.filledBy,
    ]);
    await createReminderNotifications(
      clubId,
      [createdBy, assignedUserId, ...shiftRecipients],
      {
        title: `Reminder: ${title || "Shift"}`,
        body: `Shift is scheduled for ${(date || startDate || "soon")}${startTime ? ` at ${startTime}` : ""}.`,
        meta: {
          source: "roster",
          rosterId: ref.id,
          date: date || startDate || "",
          recurring: !!recurringRule,
        },
        createdBy,
      },
    );
  } catch (error) {
    console.warn("createRoster reminder notification failed:", error?.message);
  }

  return { id: ref.id, ...data };
};

export const updateTaskTemplate = async (clubId, templateId, updates) => {
  const ref = doc(db, "clubs", clubId, "taskTemplates", templateId);
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const getTaskTemplates = async (clubId) => {
  const snap = await getDocs(
    query(taskTemplatesCol(clubId), orderBy("createdAt", "desc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const createTaskFromTemplate = async (
  clubId,
  templateId,
  {
    assigneeId = "",
    assigneeName = "",
    dueDate = "",
    createdBy = "",
    season = "",
  } = {},
) => {
  const templateRef = doc(db, "clubs", clubId, "taskTemplates", templateId);
  const templateSnap = await getDoc(templateRef);
  if (!templateSnap.exists()) throw new Error("Task template not found");

  const template = templateSnap.data();
  return createTask(clubId, {
    title: template.name,
    description: template.description,
    assigneeId,
    assigneeName,
    dueDate,
    startDate: dueDate,
    endDate: dueDate,
    priority: template.defaultPriority || "medium",
    teamId: template.teamId || null,
    createdBy,
    isRecurring: !!template.recurringRule,
    recurringRule: template.recurringRule || null,
    templateId,
    season,
    assignedGroupId: template.assignedGroupId || template.teamId || null,
    assignedGroupName: template.assignedGroupName || "",
    groupType: template.groupType || "Team",
    openToAll: !!template.openToAll,
    role: template.role || template.name,
    assignedUserId: template.assignedUserId || "",
    assignedUserName: template.assignedUserName || "",
  });
};

export const deleteTaskTemplate = async (clubId, templateId) => {
  const ref = doc(db, "clubs", clubId, "taskTemplates", templateId);
  await deleteDoc(ref);
};

export const rolloverRecurringTasksToSeason = async (
  clubId,
  { fromSeason, toSeason, createdBy = "", userGroupIds = [], userId = "" },
) => {
  const existingTasks = await getVisibleTasks(clubId, {
    userGroupIds,
    userId,
    scope: "all",
  });
  const recurringTemplates = existingTasks.filter(
    (t) => t.isRecurring && (!fromSeason || t.season === fromSeason),
  );

  const created = [];
  for (const task of recurringTemplates) {
    const nextDueDate = task.dueDate || "";
    const newTask = await createTask(clubId, {
      title: task.title,
      description: task.description,
      assigneeId: task.assigneeId,
      assigneeName: task.assigneeName,
      dueDate: nextDueDate,
      priority: task.priority,
      teamId: task.teamId,
      createdBy,
      isRecurring: true,
      recurringRule: task.recurringRule || null,
      templateId: task.templateId || null,
      season: toSeason || "",
      assignedGroupId: task.assignedGroupId || task.teamId || null,
      assignedGroupName: task.assignedGroupName || "",
      groupType: task.groupType || "Team",
      openToAll: !!task.openToAll,
      role: task.role || task.title,
      assignedUserId: task.assignedUserId || task.assigneeId || "",
      assignedUserName: task.assignedUserName || task.assigneeName || "",
    });
    created.push(newTask);
  }

  return created;
};

export const buildAutomaticMatchDayAssignments = (fixtures = []) => {
  const rows = (fixtures || [])
    .map((fixture) => ({
      ...fixture,
      kickoff: `${fixture?.date || ""} ${fixture?.startTime || ""}`.trim(),
    }))
    .filter((fixture) => !!fixture?.assignedGroupId)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  if (rows.length === 0)
    return { firstFixture: null, lastFixture: null, duties: [] };

  const firstFixture = rows[0];
  const lastFixture = rows[rows.length - 1];

  const duties = [
    {
      role: "Field Setup",
      assignedGroupId: firstFixture.assignedGroupId,
      assignedGroupName:
        firstFixture.assignedGroupName || firstFixture.teamName || "",
      groupType: firstFixture.groupType || "Team",
      eventId: firstFixture.eventId || "",
      status: "pending",
    },
    {
      role: "Pack Down",
      assignedGroupId: lastFixture.assignedGroupId,
      assignedGroupName:
        lastFixture.assignedGroupName || lastFixture.teamName || "",
      groupType: lastFixture.groupType || "Team",
      eventId: lastFixture.eventId || "",
      status: "pending",
    },
  ];

  return { firstFixture, lastFixture, duties };
};

export const createAutomaticMatchDayDuties = async (
  clubId,
  { fixtures = [], date = "", createdBy = "", openToAll = false } = {},
) => {
  const assignment = buildAutomaticMatchDayAssignments(fixtures);
  const created = [];

  for (const duty of assignment.duties) {
    const task = await createTask(clubId, {
      title: duty.role,
      description: `${duty.role} auto-assigned from match-day schedule${date ? ` (${date})` : ""}`,
      priority: "medium",
      dueDate: date || "",
      createdBy,
      assignedGroupId: duty.assignedGroupId,
      assignedGroupName: duty.assignedGroupName,
      groupType: duty.groupType,
      openToAll: !!openToAll,
      eventId: duty.eventId || "",
      role: duty.role,
    });
    created.push(task);
  }

  return {
    ...assignment,
    created,
  };
};

// ── Rosters ──

const rostersCol = (clubId) => collection(db, "clubs", clubId, "rosters");
const rosterTemplatesCol = (clubId) =>
  collection(db, "clubs", clubId, "rosterTemplates");
const rosterRemindersCol = (clubId) =>
  collection(db, "clubs", clubId, "rosterReminders");

export const createRoster = async (
  clubId,
  {
    title,
    date,
    startDate = "",
    endDate = "",
    isAllDay = false,
    startTime = "",
    endTime = "",
    shifts,
    teamId,
    createdBy,
    templateId = null,
    recurringRule = null,
    assignedGroupId = null,
    assignedGroupIds: passedAssignedGroupIds = [],
    assignedGroupName = "",
    groupType = "Team",
    openToAll = false,
    eventId = "",
    assignedUserId = "",
    assignedUserName = "",
  },
) => {
  const ref = doc(rostersCol(clubId));
  const normalizedAssignedGroupId =
    assignedGroupId || teamId || (openToAll ? OPEN_VOLUNTEERS_GROUP_ID : null);

  const hasGroups = passedAssignedGroupIds && passedAssignedGroupIds.length > 0;
  if (!hasGroups) {
    assertValidDutyAssignment(
      { assignedGroupId: normalizedAssignedGroupId, teamId, openToAll },
      "Roster",
    );
  }

  const rosterAssignedGroupIds = hasGroups
    ? passedAssignedGroupIds.map(normalizeGroupId)
    : normalizedAssignedGroupId
      ? [normalizeGroupId(normalizedAssignedGroupId)]
      : [];
  const normalizedShifts = (shifts || []).map((shift, index) => ({
    dutyId: shift?.dutyId || `${ref.id}_${index}`,
    role: shift?.role || "",
    startTime: shift?.startTime || "",
    endTime: shift?.endTime || "",
    filledBy: shift?.filledBy || null,
    filledByName: shift?.filledByName || "",
    status: shift?.status || (shift?.filledBy ? "assigned" : "open"),
    assignedGroupId:
      shift?.assignedGroupId || shift?.teamId || normalizedAssignedGroupId,
    assignedGroupIds: getAssignmentGroupIds({
      assignedGroupId:
        shift?.assignedGroupId || shift?.teamId || normalizedAssignedGroupId,
      teamId: shift?.teamId || teamId || null,
      assignedGroupIds: shift?.assignedGroupIds || rosterAssignedGroupIds || [],
      openToAll: shift?.openToAll === true || !!openToAll,
    }),
    assignedGroupName: shift?.assignedGroupName || assignedGroupName || "",
    groupType: toGroupType(shift?.groupType || groupType),
    assignedUserId: shift?.assignedUserId || assignedUserId || "",
    assignedUserName: shift?.assignedUserName || assignedUserName || "",
    openToAll: shift?.openToAll === true || !!openToAll,
    eventId: shift?.eventId || eventId || "",
    teamId: shift?.teamId || teamId || null,
  }));
  normalizedShifts.forEach((shift) => {
    assertValidDutyAssignment(
      {
        assignedGroupId: shift.assignedGroupId,
        teamId: shift.teamId,
        openToAll: shift.openToAll,
      },
      "Roster shift",
    );
  });
  const data = {
    title,
    date: date || "",
    startDate: startDate || "",
    endDate: endDate || "",
    isAllDay: !!isAllDay,
    startTime: startTime || "",
    endTime: endTime || "",
    shifts: normalizedShifts,
    teamId: teamId || null,
    assignedGroupId: normalizedAssignedGroupId,
    assignedGroupIds: rosterAssignedGroupIds,
    assignedGroupName: assignedGroupName || "",
    groupType: toGroupType(groupType),
    assignedUserId: assignedUserId || "",
    assignedUserName: assignedUserName || "",
    openToAll: !!openToAll,
    eventId: eventId || "",
    templateId: templateId || null,
    recurringRule: recurringRule || null,
    createdBy: createdBy || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { id: ref.id, ...data };
};

const getRosters = async (clubId) => {
  const snap = await getDocs(query(rostersCol(clubId), orderBy("date")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const signUpForShift = async (
  clubId,
  rosterId,
  shiftIndex,
  userId,
  userName,
  { userGroupIds = [] } = {},
) => {
  const rosterRef = doc(db, "clubs", clubId, "rosters", rosterId);
  const rosterSnap = await getDoc(rosterRef);
  if (!rosterSnap.exists()) return;

  const rosterData = rosterSnap.data();
  const shifts = [...(rosterData.shifts || [])];
  const shift = shifts[shiftIndex];
  if (!shift) throw new Error("Shift not found.");

  const visibleToUser = isDutyVisibleToUserGroups(
    {
      ...rosterData,
      ...shift,
      assignedGroupId: shift.assignedGroupId || rosterData.assignedGroupId,
      openToAll:
        shift.openToAll === true ||
        (shift.openToAll !== false && rosterData.openToAll === true),
      teamId: shift.teamId || rosterData.teamId,
    },
    userGroupIds,
    userId,
  );

  if (!visibleToUser) {
    throw new Error("This duty is not assigned to your group.");
  }

  if (shifts[shiftIndex]?.filledBy) {
    throw new Error("This shift is already filled.");
  }

  const directAssignedUserId = String(
    shift.assignedUserId || rosterData.assignedUserId || "",
  );
  if (directAssignedUserId && directAssignedUserId !== userId) {
    throw new Error("This shift is assigned to another user.");
  }

  shifts[shiftIndex].filledBy = userId;
  shifts[shiftIndex].filledByName = userName;
  shifts[shiftIndex].status = "assigned";
  await updateDoc(rosterRef, { shifts, updatedAt: serverTimestamp() });
};

export const cancelShiftSignup = async (
  clubId,
  rosterId,
  shiftIndex,
  userId,
) => {
  const rosterRef = doc(db, "clubs", clubId, "rosters", rosterId);
  const rosterSnap = await getDoc(rosterRef);
  if (!rosterSnap.exists()) return;

  const shifts = [...(rosterSnap.data().shifts || [])];
  if (!shifts[shiftIndex]) throw new Error("Shift not found.");

  if (shifts[shiftIndex].filledBy === userId) {
    shifts[shiftIndex].filledBy = null;
    shifts[shiftIndex].filledByName = "";
    shifts[shiftIndex].status = "open";
    await updateDoc(rosterRef, { shifts, updatedAt: serverTimestamp() });
    return;
  }

  throw new Error("You can only cancel your own signup.");
};

const subscribeToRosters = (clubId, callback) => {
  const q = query(rostersCol(clubId), orderBy("date"));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (error) => {
      if (error?.code !== "permission-denied") {
        console.error("subscribeToRosters listener error:", error);
      }
      callback([]);
    },
  );
};

export const getVisibleRosters = async (
  clubId,
  { userGroupIds = [], userId = "", scope = "all" } = {},
) => {
  const qrs = buildVisibleDutyQueries(rostersCol(clubId), userGroupIds, userId);
  const snaps = await Promise.all(qrs.map((qRef) => getDocs(qRef)));
  const maps = snaps.map((snap) => {
    const map = new Map();
    snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
    return map;
  });

  return filterVisibleRostersForUserByScope(
    sortByDateAsc(mergeMaps(maps)),
    userGroupIds,
    userId,
    scope,
  );
};

export const subscribeToVisibleRosters = (
  clubId,
  callback,
  { userGroupIds = [], userId = "", scope = "all", isAdmin = false } = {},
) => {
  // Admins see ALL rosters but still apply scope filtering
  if (isAdmin) {
    const q = query(rostersCol(clubId), orderBy("date", "asc"));
    return onSnapshot(
      q,
      (snap) => {
        const allRosters = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Apply scope filtering to admin rosters as well
        const filtered = filterVisibleRostersForUserByScope(
          sortByDateAsc(allRosters),
          userGroupIds,
          userId,
          scope,
          true, // isAdmin
        );
        callback(filtered);
      },
      (error) => {
        if (error?.code !== "permission-denied") {
          console.error(
            "subscribeToVisibleRosters admin listener error:",
            error,
          );
        }
        callback([]);
      },
    );
  }

  const qrs = buildVisibleDutyQueries(rostersCol(clubId), userGroupIds, userId);
  const snapshots = qrs.map(() => new Map());

  const push = () => {
    callback(
      filterVisibleRostersForUserByScope(
        sortByDateAsc(mergeMaps(snapshots)),
        userGroupIds,
        userId,
        scope,
      ),
    );
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

  return () => {
    unsubs.forEach((unsub) => unsub?.());
  };
};

export const createRosterTemplate = async (
  clubId,
  {
    name,
    description = "",
    shifts = [],
    teamId = null,
    recurringRule = null,
    createdBy = "",
    startDate = "",
    endDate = "",
    isAllDay = false,
    startTime = "",
    endTime = "",
    assignedGroupId = null,
    assignedGroupIds: passedAssignedGroupIds = [],
    assignedGroupName = "",
    groupType = "Team",
    openToAll = false,
    assignedUserId = "",
    assignedUserName = "",
  },
) => {
  const ref = doc(rosterTemplatesCol(clubId));
  const normalizedAssignedGroupId =
    assignedGroupId || teamId || (openToAll ? OPEN_VOLUNTEERS_GROUP_ID : null);

  // Only assert if not open to all and no group IDs provided
  if (!openToAll && !passedAssignedGroupIds?.length) {
    assertValidDutyAssignment(
      { assignedGroupId: normalizedAssignedGroupId, teamId, openToAll },
      "Roster template",
    );
  }

  const hasGroups = passedAssignedGroupIds && passedAssignedGroupIds.length > 0;
  const rosterAssignedGroupIds = hasGroups
    ? passedAssignedGroupIds.map(normalizeGroupId).filter(Boolean)
    : normalizedAssignedGroupId
      ? [normalizeGroupId(normalizedAssignedGroupId)]
      : [];

  const data = {
    name,
    description: String(description || "").trim(),
    startDate: startDate || "",
    endDate: endDate || "",
    isAllDay: !!isAllDay,
    startTime: startTime || "",
    endTime: endTime || "",
    shifts: (shifts || []).map((shift) => ({
      ...shift,
      assignedGroupId:
        shift?.assignedGroupId || shift?.teamId || normalizedAssignedGroupId,
      assignedGroupIds: getAssignmentGroupIds({
        assignedGroupId:
          shift?.assignedGroupId || shift?.teamId || normalizedAssignedGroupId,
        teamId: shift?.teamId || teamId || null,
        assignedGroupIds: shift?.assignedGroupIds || [],
        openToAll: shift?.openToAll === true || !!openToAll,
      }),
      assignedGroupName: shift?.assignedGroupName || assignedGroupName || "",
      groupType: toGroupType(shift?.groupType || groupType),
      assignedUserId: shift?.assignedUserId || assignedUserId || "",
      assignedUserName: shift?.assignedUserName || assignedUserName || "",
      openToAll: shift?.openToAll === true || !!openToAll,
      status: shift?.status || "open",
    })),
    teamId,
    assignedGroupId: normalizedAssignedGroupId,
    assignedGroupIds: rosterAssignedGroupIds,
    assignedGroupName: assignedGroupName || "",
    groupType: toGroupType(groupType),
    assignedUserId: assignedUserId || "",
    assignedUserName: assignedUserName || "",
    openToAll: !!openToAll,
    recurringRule,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { id: ref.id, ...data };
};

export const getRosterTemplates = async (clubId) => {
  const snap = await getDocs(
    query(rosterTemplatesCol(clubId), orderBy("createdAt", "desc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const updateRosterTemplate = async (clubId, templateId, updates) => {
  const ref = doc(db, "clubs", clubId, "rosterTemplates", templateId);
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deleteRosterTemplate = async (clubId, templateId) => {
  const ref = doc(db, "clubs", clubId, "rosterTemplates", templateId);
  await deleteDoc(ref);
};

export const createRosterFromTemplate = async (
  clubId,
  templateId,
  { title = "", date = "", createdBy = "" } = {},
) => {
  const templateRef = doc(db, "clubs", clubId, "rosterTemplates", templateId);
  const templateSnap = await getDoc(templateRef);
  if (!templateSnap.exists()) throw new Error("Roster template not found");

  const tpl = templateSnap.data();
  return createRoster(clubId, {
    title: title || tpl.name,
    date,
    startDate: tpl.startDate || date || "",
    endDate: tpl.endDate || date || "",
    isAllDay: tpl.isAllDay === true,
    startTime: tpl.startTime || "",
    endTime: tpl.endTime || "",
    shifts: (tpl.shifts || []).map((s) => ({
      ...s,
      filledBy: null,
      filledByName: "",
      status: "open",
    })),
    teamId: tpl.teamId || null,
    assignedGroupId: tpl.assignedGroupId || tpl.teamId || null,
    assignedGroupName: tpl.assignedGroupName || "",
    groupType: tpl.groupType || "Team",
    assignedUserId: tpl.assignedUserId || "",
    assignedUserName: tpl.assignedUserName || "",
    openToAll: !!tpl.openToAll,
    createdBy,
    templateId,
    recurringRule: tpl.recurringRule || null,
  });
};

export const createRosterReminder = async (
  clubId,
  {
    rosterId,
    shiftIndex,
    recipientId,
    recipientName,
    delivery = "in-app",
    when = "",
  },
) => {
  const ref = doc(rosterRemindersCol(clubId));
  const data = {
    rosterId,
    shiftIndex,
    recipientId,
    recipientName: recipientName || "",
    delivery,
    when,
    status: "scheduled",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { id: ref.id, ...data };
};

const csvEscape = (value) => {
  const text = `${value ?? ""}`;
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const exportRosterToCsv = (roster) => {
  const lines = [
    ["Roster Title", roster?.title || ""],
    ["Date", roster?.date || ""],
    [],
    ["Role", "Start Time", "End Time", "Assigned To", "Assigned User Id"],
  ];

  (roster?.shifts || []).forEach((shift) => {
    lines.push([
      shift.role || "",
      shift.startTime || "",
      shift.endTime || "",
      shift.filledByName || "",
      shift.filledBy || "",
    ]);
  });

  return lines.map((row) => row.map(csvEscape).join(",")).join("\n");
};

export const exportAllRostersToCsv = (rosters = []) => {
  const lines = [
    [
      "Roster Title",
      "Date",
      "Role",
      "Start Time",
      "End Time",
      "Assigned To",
      "Assigned User Id",
    ],
  ];

  rosters.forEach((roster) => {
    const shifts = roster.shifts || [];
    if (!shifts.length) {
      lines.push([roster.title || "", roster.date || "", "", "", "", "", ""]);
      return;
    }
    shifts.forEach((shift) => {
      lines.push([
        roster.title || "",
        roster.date || "",
        shift.role || "",
        shift.startTime || "",
        shift.endTime || "",
        shift.filledByName || "",
        shift.filledBy || "",
      ]);
    });
  });

  return lines.map((row) => row.map(csvEscape).join(",")).join("\n");
};

// ── Trades / Suppliers ──

const tradesCol = (clubId) => collection(db, "clubs", clubId, "trades");

export const createTrade = async (
  clubId,
  {
    name,
    category,
    phone,
    email,
    description,
    createdBy,
    emailTemplates = [],
    serviceLog = [],
  },
) => {
  const ref = doc(tradesCol(clubId));
  const data = {
    name,
    category: category || "",
    phone: phone || "",
    email: email || "",
    description: description || "",
    emailTemplates: emailTemplates || [],
    serviceLog: serviceLog || [],
    createdBy: createdBy || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { id: ref.id, ...data };
};

export const getTrades = async (clubId) => {
  const snap = await getDocs(query(tradesCol(clubId), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const deleteTrade = async (clubId, tradeId) => {
  await deleteDoc(doc(db, "clubs", clubId, "trades", tradeId));
};

export const subscribeToTrades = (clubId, callback) => {
  const q = query(tradesCol(clubId), orderBy("name"));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (error) => {
      if (error?.code !== "permission-denied") {
        console.error("subscribeToTrades listener error:", error);
      }
      callback([]);
    },
  );
};

export const addTradeEmailTemplate = async (
  clubId,
  tradeId,
  { title, subject, body, createdBy = "" },
) => {
  const tradeRef = doc(db, "clubs", clubId, "trades", tradeId);
  const tradeSnap = await getDoc(tradeRef);
  if (!tradeSnap.exists()) throw new Error("Trade not found");

  const data = tradeSnap.data();
  const templates = data.emailTemplates || [];
  templates.push({
    id: `${Date.now()}`,
    title,
    subject,
    body,
    createdBy,
    createdAtMs: Date.now(),
  });

  await updateDoc(tradeRef, {
    emailTemplates: templates,
    updatedAt: serverTimestamp(),
  });
  return templates;
};

export const addTradeServiceLogEntry = async (
  clubId,
  tradeId,
  { date, note, cost = "", createdBy = "" },
) => {
  const tradeRef = doc(db, "clubs", clubId, "trades", tradeId);
  const tradeSnap = await getDoc(tradeRef);
  if (!tradeSnap.exists()) throw new Error("Trade not found");

  const data = tradeSnap.data();
  const serviceLog = data.serviceLog || [];
  serviceLog.push({
    id: `${Date.now()}`,
    date,
    note,
    cost,
    createdBy,
    createdAtMs: Date.now(),
  });

  await updateDoc(tradeRef, {
    serviceLog,
    lastService: date || "",
    updatedAt: serverTimestamp(),
  });
  return serviceLog;
};
