import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  writeBatch,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";

const notificationsCol = (clubId) =>
  collection(db, "clubs", clubId, "notifications");

const isMissingIndexError = (error) =>
  error?.code === "failed-precondition" ||
  (error?.message || "").toLowerCase().includes("requires an index");

const sortNotificationsDesc = (notifications) => {
  return [...notifications].sort((a, b) => {
    const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return bMs - aMs;
  });
};

export const subscribeToNotifications = (clubId, userId, callback) => {
  const q = query(
    notificationsCol(clubId),
    where("recipientId", "==", userId),
    orderBy("createdAt", "desc"),
  );

  let fallbackUnsub = null;
  const primaryUnsub = onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (error) => {
      if (!isMissingIndexError(error) || fallbackUnsub) {
        console.error("subscribeToNotifications listener error:", error);
        return;
      }

      console.warn(
        "Missing index for notifications query. Falling back to client-side sorting until index is created.",
      );
      const fallbackQ = query(
        notificationsCol(clubId),
        where("recipientId", "==", userId),
      );
      fallbackUnsub = onSnapshot(
        fallbackQ,
        (snap) => {
          const notifications = sortNotificationsDesc(
            snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          );
          callback(notifications);
        },
        (fallbackError) => {
          console.error(
            "subscribeToNotifications fallback listener error:",
            fallbackError,
          );
        },
      );
    },
  );

  return () => {
    primaryUnsub();
    if (fallbackUnsub) fallbackUnsub();
  };
};

export const createNotification = async (
  clubId,
  {
    recipientId,
    title,
    body,
    type = "general",
    read = false,
    meta = {},
    createdBy = "",
  },
) => {
  const ref = doc(notificationsCol(clubId));
  const data = {
    recipientId,
    title: title || "Notification",
    body: body || "",
    type,
    read,
    meta,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { id: ref.id, ...data };
};

export const markNotificationRead = async (clubId, notificationId) => {
  await updateDoc(doc(db, "clubs", clubId, "notifications", notificationId), {
    read: true,
  });
};

export const markAllNotificationsRead = async (clubId, userId) => {
  const q = query(
    notificationsCol(clubId),
    where("recipientId", "==", userId),
    where("read", "==", false),
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { read: true });
  });
  await batch.commit();
};
