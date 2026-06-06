import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db } from "../config/firebase";

const productsCol = (clubId) => collection(db, "clubs", clubId, "products");
const ordersCol = (clubId) => collection(db, "clubs", clubId, "orders");
const functions = getFunctions(app);

const isLockedPaymentStatus = (value) => {
  const normalized = (value || "").toString().toLowerCase();
  return normalized === "paid" || normalized === "succeeded";
};

const sortByCreatedAtDesc = (rows = []) => {
  return [...rows].sort((a, b) => {
    const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return bMs - aMs;
  });
};

const normalizeVisibility = (visibility) => {
  const value = (visibility || "club").toString().toLowerCase();
  if (value === "public") return "public";
  if (value === "network") return "network";
  return "club";
};

const normalizePostageOption = (value) => {
  const normalized = (value || "post").toString().trim().toLowerCase();
  if (normalized === "pickup") return "pickup";
  return "post";
};

const isVisibleForViewer = (productVisibility, viewerType = "club") => {
  const v = normalizeVisibility(productVisibility);
  const viewer = (viewerType || "club").toString().toLowerCase();

  if (viewer === "public") {
    return v === "public";
  }

  if (viewer === "network") {
    return v === "network" || v === "public";
  }

  return v === "club" || v === "network" || v === "public";
};

// ── Products ──

export const createProduct = async (
  clubId,
  {
    name,
    description,
    details,
    price,
    imageUrl,
    imageUrls,
    sizeGuideUrl,
    category,
    variants,
    visibility,
    postageOption,
    stock,
    createdBy,
    createdByName,
  },
) => {
  const ref = doc(productsCol(clubId));
  const normalizedVariants = Array.isArray(variants)
    ? variants
        .map((variant) => {
          if (typeof variant === "string") {
            return { label: variant.trim(), stock: stock || -1 };
          }

          return {
            label: (variant?.label || "").toString().trim(),
            stock:
              typeof variant?.stock === "number"
                ? variant.stock
                : parseInt(variant?.stock, 10) || -1,
          };
        })
        .filter((variant) => !!variant.label)
    : [];

  const data = {
    clubId,
    name,
    description: description || "",
    details: details || "",
    price: typeof price === "number" ? price : parseFloat(price) || 0,
    imageUrl: imageUrl || "",
    imageUrls: Array.isArray(imageUrls)
      ? imageUrls
          .map((url) => String(url || "").trim())
          .filter(Boolean)
      : [],
    sizeGuideUrl: sizeGuideUrl || "",
    category: category || "General",
    variants: normalizedVariants, // [{ label: 'M', stock: 5 }, { label: 'L', stock: 2 }]
    visibility: normalizeVisibility(visibility), // club, network, public
    postageOption: normalizePostageOption(postageOption), // post, pickup
    stock: stock || -1, // -1 means unlimited
    active: true,
    createdBy: createdBy || "",
    createdByName: createdByName || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { id: ref.id, ...data };
};

export const getProducts = async (clubId) => {
  const snap = await getDocs(
    query(productsCol(clubId), orderBy("createdAt", "desc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const updateProduct = async (clubId, productId, data) => {
  await updateDoc(doc(db, "clubs", clubId, "products", productId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deleteProduct = async (clubId, productId) => {
  await deleteDoc(doc(db, "clubs", clubId, "products", productId));
};

export const subscribeToProducts = (clubId, callback, options = {}) => {
  const viewerType = options?.publicOnly
    ? "public"
    : options?.viewerType || "club";
  const includeInactive = !!options?.includeInactive;

  let q = query(productsCol(clubId), orderBy("createdAt", "desc"));

  if (viewerType === "public") {
    q = query(
      productsCol(clubId),
      where("active", "==", true),
      where("visibility", "in", ["public", "Public"]),
      orderBy("createdAt", "desc"),
    );
  } else if (viewerType === "network") {
    q = query(
      productsCol(clubId),
      where("active", "==", true),
      where("visibility", "in", ["network", "Network", "public", "Public"]),
      orderBy("createdAt", "desc"),
    );
  }

  return onSnapshot(
    q,
    (snap) => {
      const products = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((product) => includeInactive || product.active !== false)
        .filter((product) =>
          isVisibleForViewer(product.visibility, viewerType),
        );

      callback(products);
    },
    (error) => {
      if (error?.code !== "permission-denied") {
        console.error("subscribeToProducts listener error:", error);
      }
      callback([]);
    },
  );
};

// ── Orders ──

export const createOrder = async (
  clubId,
  {
    userId,
    userName,
    userEmail,
    items,
    subtotal,
    tax,
    total,
    paymentMethod = "manual",
    paymentPolicy = {},
  },
) => {
  const ref = doc(ordersCol(clubId));
  const orderRef = `ORD-${Date.now()}`;
  const parentApprovalRequired =
    paymentPolicy?.requireParentApprovalForPayments === true;
  const parentApproverUids = Array.isArray(paymentPolicy?.parentApproverUids)
    ? Array.from(new Set(paymentPolicy.parentApproverUids.filter(Boolean)))
    : [];

  const paymentStatus = parentApprovalRequired
    ? "approval-required"
    : paymentMethod === "manual"
      ? "awaiting-payment"
      : "pending";

  const status = parentApprovalRequired ? "pending-approval" : "pending";

  const data = {
    orderRef,
    userId,
    userName,
    userEmail,
    items, // [{productId, name, variant, price, quantity}]
    subtotal,
    tax,
    total,
    paymentMethod, // manual, stripe
    paymentStatus,
    status, // pending, pending-approval, confirmed, shipped, delivered, cancelled
    paymentPolicy: {
      requireParentApprovalForPayments: parentApprovalRequired,
      parentApproverUids,
      approvedByUid: "",
      approvedAt: "",
    },
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { id: ref.id, ...data };
};

export const getOrders = async (clubId, userId) => {
  const snap = await getDocs(
    query(ordersCol(clubId), orderBy("createdAt", "desc")),
  );
  let orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (userId) {
    orders = orders.filter((o) => o.userId === userId);
  }
  return orders;
};

export const subscribeToOrders = (clubId, callback, options = {}) => {
  if (!clubId) {
    callback([]);
    return () => {};
  }

  if (options?.userId) {
    const q = query(ordersCol(clubId), where("userId", "==", options.userId));

    return onSnapshot(
      q,
      (snap) => {
        const orders = sortByCreatedAtDesc(
          snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        );
        callback(orders);
      },
      (error) => {
        // Expected for non-membership edge cases; keep UI stable without noisy logs.
        if (error?.code !== "permission-denied") {
          console.error("subscribeToOrders listener error:", error);
        }
        callback([]);
      },
    );
  }

  const q = query(ordersCol(clubId), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(orders);
    },
    (error) => {
      if (error?.code !== "permission-denied") {
        console.error("subscribeToOrders listener error:", error);
      }
      callback([]);
    },
  );
};

export const subscribeToOrdersAwaitingParentApproval = (
  clubId,
  parentUid,
  callback,
) => {
  if (!clubId || !parentUid) {
    callback([]);
    return () => {};
  }

  const fallback = (snap) => {
    const orders = sortByCreatedAtDesc(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((row) => {
          const status = String(row?.paymentStatus || "").toLowerCase();
          const approvers = Array.isArray(row?.paymentPolicy?.parentApproverUids)
            ? row.paymentPolicy.parentApproverUids
            : [];
          return status === "approval-required" && approvers.includes(parentUid);
        }),
    );
    callback(orders);
  };

  const q = query(
    ordersCol(clubId),
    where("paymentStatus", "==", "approval-required"),
    where("paymentPolicy.parentApproverUids", "array-contains", parentUid),
  );

  let fallbackUnsub = null;
  const unsub = onSnapshot(
    q,
    (snap) => {
      callback(sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    },
    (error) => {
      if (fallbackUnsub || error?.code !== "failed-precondition") {
        callback([]);
        return;
      }

      // Missing composite index fallback.
      fallbackUnsub = onSnapshot(
        query(
          ordersCol(clubId),
          where("paymentPolicy.parentApproverUids", "array-contains", parentUid),
        ),
        fallback,
        () => callback([]),
      );
    },
  );

  return () => {
    unsub();
    if (fallbackUnsub) fallbackUnsub();
  };
};

export const approveOrderPaymentByParent = async (
  clubId,
  orderId,
  { approverUid },
) => {
  const orderRef = doc(db, "clubs", clubId, "orders", orderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) {
    throw new Error("Order not found.");
  }

  const order = orderSnap.data() || {};
  const currentStatus = String(order?.paymentStatus || "").toLowerCase();
  if (currentStatus !== "approval-required") {
    throw new Error("This order does not require parent approval.");
  }

  const approvers = Array.isArray(order?.paymentPolicy?.parentApproverUids)
    ? order.paymentPolicy.parentApproverUids
    : [];
  if (!approvers.includes(approverUid)) {
    throw new Error("You are not an approver for this order.");
  }

  await updateDoc(orderRef, {
    paymentStatus: "awaiting-payment",
    status: "pending",
    paymentPolicy: {
      ...(order.paymentPolicy || {}),
      requireParentApprovalForPayments: true,
      parentApproverUids: approvers,
      approvedByUid: approverUid,
      approvedAt: new Date().toISOString(),
    },
    updatedAt: serverTimestamp(),
  });
};

export const updateOrderStatus = async (clubId, orderId, status) => {
  const orderRef = doc(db, "clubs", clubId, "orders", orderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) {
    throw new Error("Order not found.");
  }

  const order = orderSnap.data();
  if (isLockedPaymentStatus(order?.paymentStatus)) {
    throw new Error("Order is locked after payment and cannot be modified.");
  }

  await updateDoc(orderRef, { status });
};

export const createStripeCheckoutSession = async (
  clubId,
  { userId, userEmail, items, successUrl, cancelUrl },
) => {
  const callable = httpsCallable(
    functions,
    process.env.EXPO_PUBLIC_STRIPE_CHECKOUT_FUNCTION ||
      "createStripeCheckoutSession",
  );

  const result = await callable({
    clubId,
    userId,
    userEmail,
    items,
    successUrl,
    cancelUrl,
  });

  return result?.data || {};
};
