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
  limit,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { createNotification } from "./notificationService";

const eventsCol = (clubId) => collection(db, "clubs", clubId, "events");
const PUBLIC_NETWORK_VISIBILITY_VALUES = [
  "Public",
  "Network",
  "public",
  "network",
];
const NETWORK_FEED_PUBLIC_VISIBILITY_VALUES = [
  "Public",
  "public",
  "Network",
  "network",
];

const isMissingIndexError = (error) =>
  error?.code === "failed-precondition" ||
  (error?.message || "").toLowerCase().includes("requires an index");

const sortEvents = (events) => {
  return [...events].sort((a, b) => {
    const aKey = `${a.date || ""} ${a.startTime || ""}`;
    const bKey = `${b.date || ""} ${b.startTime || ""}`;
    return aKey.localeCompare(bKey);
  });
};

const inferClubId = (docRef) => {
  const segments = docRef.path.split("/");
  const clubsIdx = segments.indexOf("clubs");
  if (clubsIdx >= 0 && segments[clubsIdx + 1]) {
    return segments[clubsIdx + 1];
  }
  return null;
};

const isPublicEvent = (event = {}) => {
  const visibility = (event.visibility || "").toString().trim().toLowerCase();
  return (
    visibility === "public" ||
    visibility === "network" ||
    event.isPublic === true
  );
};

const isUpcomingEvent = (event = {}) => {
  const eventDate = String(event.date || "").trim();
  if (!eventDate) return false;

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayKey = `${yyyy}-${mm}-${dd}`;

  return eventDate >= todayKey;
};

const timestampToMs = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const compareNetworkEvents = (a, b) => {
  const aMs = timestampToMs(a.updatedAt) || timestampToMs(a.createdAt);
  const bMs = timestampToMs(b.updatedAt) || timestampToMs(b.createdAt);
  if (aMs !== bMs) return bMs - aMs;

  const aKey = `${a.date || ""} ${a.startTime || ""}`;
  const bKey = `${b.date || ""} ${b.startTime || ""}`;
  return bKey.localeCompare(aKey);
};

const createReminderNotifications = async (
  clubId,
  recipientIds,
  { title, body, meta = {}, createdBy = "" },
) => {
  const recipients = Array.from(
    new Set(
      (recipientIds || []).map((id) => String(id || "").trim()).filter(Boolean),
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

export const createEvent = async (
  clubId,
  {
    title,
    description,
    date,
    startDate,
    endDate,
    isAllDay,
    startTime,
    endTime,
    location,
    type,
    category,
    teamId,
    assignedGroupId,
    assignedGroupIds,
    assignedGroupName,
    groupType,
    openToAll,
    assignedUserId,
    assignedUserName,
    assignedUserIds,
    assignedUserNames,
    recurringRule,
    createdBy,
  },
) => {
  const ref = doc(eventsCol(clubId));
  const normalizedAssignedGroupId = assignedGroupId || teamId || null;
  const normalizedAssignedGroupIds = Array.isArray(assignedGroupIds)
    ? assignedGroupIds
        .map((groupId) =>
          String(groupId || "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean)
    : normalizedAssignedGroupId
      ? [String(normalizedAssignedGroupId).trim().toLowerCase()]
      : [];
  const primaryAssignedGroupId =
    normalizedAssignedGroupId || normalizedAssignedGroupIds[0] || null;

  const normalizedAssignedUserIds = Array.isArray(assignedUserIds)
    ? assignedUserIds
        .map((userId) => String(userId || "").trim())
        .filter(Boolean)
    : assignedUserId
      ? [String(assignedUserId || "").trim()]
      : [];
  const normalizedAssignedUserNames = Array.isArray(assignedUserNames)
    ? assignedUserNames
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    : assignedUserName
      ? [String(assignedUserName || "").trim()]
      : [];

  const normalizedStartDate = startDate || date || "";
  const normalizedEndDate = endDate || normalizedStartDate;
  const data = {
    title,
    description: description || "",
    date: normalizedStartDate, // Backward-compatible anchor date
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    isAllDay: !!isAllDay,
    startTime: startTime || "",
    endTime: endTime || "",
    location: location || "",
    type: type || "event", // training, game, event, meeting
    category: category || type || "event",
    teamId: teamId || null,
    assignedGroupId: primaryAssignedGroupId,
    assignedGroupIds: normalizedAssignedGroupIds,
    assignedGroupName: assignedGroupName || "",
    groupType: groupType || "Team",
    openToAll: !!openToAll,
    assignedUserId: assignedUserId || normalizedAssignedUserIds[0] || "",
    assignedUserName: assignedUserName || normalizedAssignedUserNames[0] || "",
    assignedUserIds: normalizedAssignedUserIds,
    assignedUserNames: normalizedAssignedUserNames,
    createdBy: createdBy || "",
    recurringRule: recurringRule || null,
    rsvps: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);

  try {
    await createReminderNotifications(
      clubId,
      [createdBy, ...normalizedAssignedUserIds],
      {
        title: `Reminder: ${title || "Event"}`,
        body: recurringRule
          ? `Recurring ${(type || "event").toLowerCase()} starts ${normalizedStartDate || "soon"}.`
          : `${(type || "Event").toString()} is scheduled for ${normalizedStartDate || "soon"}.`,
        meta: {
          source: "event",
          eventId: ref.id,
          category: type || "event",
          date: normalizedStartDate || "",
          recurring: !!recurringRule,
        },
        createdBy,
      },
    );
  } catch (error) {
    console.warn("createEvent reminder notification failed:", error?.message);
  }

  return { id: ref.id, ...data };
};

export const createMatch = async (
  clubId,
  {
    teamId,
    teamName,
    opponent,
    date,
    startTime,
    endTime,
    location,
    description,
    assignedGroupId,
    assignedGroupName,
    groupType,
    openToAll,
    createdBy,
  },
) => {
  const ref = doc(eventsCol(clubId));
  const normalizedAssignedGroupId = assignedGroupId || teamId || null;
  const data = {
    title: `${teamName || "Team"} vs ${opponent || "Opponent"}`,
    description: description || "",
    date,
    startTime: startTime || "",
    endTime: endTime || "",
    location: location || "",
    type: "game",
    teamId: teamId || null,
    assignedGroupId: normalizedAssignedGroupId,
    assignedGroupIds: normalizedAssignedGroupId
      ? [String(normalizedAssignedGroupId).trim().toLowerCase()]
      : [],
    assignedGroupName: assignedGroupName || teamName || "",
    groupType: groupType || "Team",
    openToAll: !!openToAll,
    teamName: teamName || "",
    opponent: opponent || "",
    status: "scheduled",
    ourScore: null,
    opponentScore: null,
    createdBy: createdBy || "",
    rsvps: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);

  try {
    await createReminderNotifications(clubId, [createdBy], {
      title: `Reminder: ${data.title}`,
      body: `Match is scheduled for ${date || "soon"}${startTime ? ` at ${startTime}` : ""}.`,
      meta: {
        source: "match",
        eventId: ref.id,
        category: "game",
        date: date || "",
      },
      createdBy,
    });
  } catch (error) {
    console.warn("createMatch reminder notification failed:", error?.message);
  }

  return { id: ref.id, ...data };
};

export const getEvents = async (clubId, { date, type } = {}) => {
  let events = [];
  try {
    let q;
    if (date) {
      q = query(
        eventsCol(clubId),
        where("date", "==", date),
        orderBy("startTime"),
      );
    } else {
      q = query(eventsCol(clubId), orderBy("date"), orderBy("startTime"));
    }
    const snap = await getDocs(q);
    events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    if (!isMissingIndexError(error)) throw error;

    // Fallback while Firestore composite index is building.
    const fallbackQ = date
      ? query(eventsCol(clubId), where("date", "==", date))
      : query(eventsCol(clubId), orderBy("date"));
    const snap = await getDocs(fallbackQ);
    events = sortEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  if (type && type !== "All Events") {
    const typeMap = { Matches: "game", Training: "training", Tasks: "task" };
    if (typeMap[type]) {
      events = events.filter((e) => e.type === typeMap[type]);
    }
  }

  return events;
};

export const getEventById = async (clubId, eventId) => {
  if (!clubId || !eventId) return null;
  const snap = await getDoc(doc(db, "clubs", clubId, "events", eventId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateEvent = async (clubId, eventId, data) => {
  await updateDoc(doc(db, "clubs", clubId, "events", eventId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const updateMatch = async (clubId, eventId, data) => {
  const title = `${data.teamName || "Team"} vs ${data.opponent || "Opponent"}`;
  await updateDoc(doc(db, "clubs", clubId, "events", eventId), {
    ...data,
    title,
    type: "game",
    updatedAt: serverTimestamp(),
  });
};

export const rsvpEvent = async (clubId, eventId, userId, status) => {
  await updateDoc(doc(db, "clubs", clubId, "events", eventId), {
    [`rsvps.${userId}`]: status, // 'yes', 'no', 'maybe'
    updatedAt: serverTimestamp(),
  });
};

export const deleteEvent = async (clubId, eventId) => {
  await deleteDoc(doc(db, "clubs", clubId, "events", eventId));
};

export const subscribeToEvents = (clubId, callback, options = {}) => {
  const {
    teamIds = [],
    groupIds = [],
    isAdmin = false,
    publicOnly = false,
  } = options;
  const colRef = eventsCol(clubId);

  if (publicOnly) {
    const unsubscribers = [];
    const byId = new Map();

    const emit = () => {
      const rows = sortEvents(Array.from(byId.values()));
      callback(rows);
    };

    const syncMapFromSnapshot = (snap) => {
      snap.docs.forEach((d) => {
        byId.set(d.id, { id: d.id, ...d.data() });
      });
      snap.docChanges().forEach((chg) => {
        if (chg.type === "removed") {
          byId.delete(chg.doc.id);
        }
      });
      emit();
    };

    const qIsPublic = query(colRef, where("isPublic", "==", true));
    unsubscribers.push(
      onSnapshot(
        qIsPublic,
        (snap) => syncMapFromSnapshot(snap),
        (error) => {
          if (error?.code !== "permission-denied") {
            console.error("subscribeToEvents public listener error:", error);
          }
          callback([]);
        },
      ),
    );

    const qVisibility = query(
      colRef,
      where("visibility", "in", PUBLIC_NETWORK_VISIBILITY_VALUES),
    );
    unsubscribers.push(
      onSnapshot(
        qVisibility,
        (snap) => syncMapFromSnapshot(snap),
        (error) => {
          if (error?.code !== "permission-denied") {
            console.error(
              "subscribeToEvents visibility listener error:",
              error,
            );
          }
          callback([]);
        },
      ),
    );

    return () => unsubscribers.forEach((u) => u && u());
  }

  // If Admin, they can see everything.
  if (isAdmin) {
    const q = query(colRef, orderBy("date"), orderBy("startTime"));
    let fallbackUnsub = null;
    const primaryUnsub = onSnapshot(
      q,
      (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => {
        if (error?.code === "permission-denied") {
          callback([]);
          return;
        }
        if (!isMissingIndexError(error) || fallbackUnsub) {
          console.error("subscribeToEvents admin error:", error);
          callback([]);
          return;
        }
        const fallbackQ = query(colRef, orderBy("date"));
        fallbackUnsub = onSnapshot(fallbackQ, (snap) => {
          callback(
            sortEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
          );
        });
      },
    );
    return () => {
      primaryUnsub();
      if (fallbackUnsub) fallbackUnsub();
    };
  }

  // For regular members, we must query by their groups/teams
  // or they get permission-denied.
  const mergedGroupIds = Array.from(new Set([...teamIds, ...groupIds])).slice(
    0,
    30,
  );

  const unsubs = [];
  const resultsMap = new Map();

  const push = () => {
    const list = sortEvents(Array.from(resultsMap.values()));
    callback(list);
  };

  const handleSnap = (snap) => {
    snap.docs.forEach((d) => resultsMap.set(d.id, { id: d.id, ...d.data() }));
    snap.docChanges().forEach((chg) => {
      if (chg.type === "removed") resultsMap.delete(chg.doc.id);
    });
    push();
  };

  // 1. Open to All events
  unsubs.push(
    onSnapshot(
      query(colRef, where("openToAll", "==", true)),
      handleSnap,
      () => {},
    ),
  );

  // 2. Team/Group assigned events
  if (mergedGroupIds.length > 0) {
    unsubs.push(
      onSnapshot(
        query(colRef, where("teamId", "in", mergedGroupIds)),
        handleSnap,
        () => {},
      ),
    );
    unsubs.push(
      onSnapshot(
        query(colRef, where("assignedGroupId", "in", mergedGroupIds)),
        handleSnap,
        () => {},
      ),
    );
    unsubs.push(
      onSnapshot(
        query(
          colRef,
          where("assignedGroupIds", "array-contains-any", mergedGroupIds),
        ),
        handleSnap,
        () => {},
      ),
    );
  }

  return () => unsubs.forEach((u) => u());
};

export const getNetworkEvents = async (
  followedClubIds = [],
  limitCount = 50,
) => {
  const normalizedClubIds = Array.from(
    new Set(
      (followedClubIds || [])
        .filter(Boolean)
        .map((clubId) => String(clubId).trim()),
    ),
  ).slice(0, 60);

  if (normalizedClubIds.length === 0) return [];

  const perClubLimit =
    normalizedClubIds.length <= 5
      ? limitCount
      : Math.min(
          limitCount,
          Math.max(15, Math.ceil((limitCount * 3) / normalizedClubIds.length)),
        );

  const eventsByClub = await Promise.all(
    normalizedClubIds.map(async (clubId) => {
      const byId = new Map();

      const mergeRows = (snap) => {
        snap.docs.forEach((d) => {
          const data = d.data();
          const resolvedClubId = data.clubId || clubId || inferClubId(d.ref);
          byId.set(d.id, {
            id: d.id,
            ...data,
            clubId: resolvedClubId,
          });
        });
      };

      try {
        const visibilityQ = query(
          eventsCol(clubId),
          where("visibility", "in", NETWORK_FEED_PUBLIC_VISIBILITY_VALUES),
          orderBy("date", "desc"),
          limit(perClubLimit),
        );
        mergeRows(await getDocs(visibilityQ));
      } catch {
        try {
          const fallbackVisibilityQ = query(
            eventsCol(clubId),
            where("visibility", "in", NETWORK_FEED_PUBLIC_VISIBILITY_VALUES),
            limit(perClubLimit),
          );
          mergeRows(await getDocs(fallbackVisibilityQ));
        } catch {
          // Keep best-effort behavior for clubs with restricted/missing indexes.
        }
      }

      try {
        const publicQ = query(
          eventsCol(clubId),
          where("isPublic", "==", true),
          orderBy("date", "desc"),
          limit(perClubLimit),
        );
        mergeRows(await getDocs(publicQ));
      } catch {
        try {
          const fallbackPublicQ = query(
            eventsCol(clubId),
            where("isPublic", "==", true),
            limit(perClubLimit),
          );
          mergeRows(await getDocs(fallbackPublicQ));
        } catch {
          // Keep best-effort behavior for clubs with restricted/missing indexes.
        }
      }

      return Array.from(byId.values())
        .filter((event) => isPublicEvent(event))
        .filter((event) => isUpcomingEvent(event));
    }),
  );

  const byKey = new Map();
  eventsByClub
    .flat()
    .sort(compareNetworkEvents)
    .forEach((event) => {
      const key = `${event.clubId || "club"}:${event.id}`;
      if (!byKey.has(key)) {
        byKey.set(key, event);
      }
    });

  const clubNameMap = {};
  await Promise.all(
    normalizedClubIds.map(async (clubId) => {
      try {
        const clubSnap = await getDoc(doc(db, "clubs", clubId));
        if (clubSnap.exists()) {
          clubNameMap[clubId] = clubSnap.data().name || clubId;
        }
      } catch {
        clubNameMap[clubId] = clubId;
      }
    }),
  );

  return Array.from(byKey.values())
    .map((event) => ({
      ...event,
      clubName:
        event.clubName || clubNameMap[event.clubId] || event.clubId || "Club",
    }))
    .sort(compareNetworkEvents)
    .slice(0, limitCount);
};
