import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../config/firebase";

const postsCol = (clubId) => collection(db, "clubs", clubId, "posts");

const VISIBILITY_ALIASES = {
  public: "Public",
  network: "Network",
  club: "Club-Only",
  "club-only": "Club-Only",
  team: "Team-Only",
  "team-only": "Team-Only",
};

const NETWORK_FEED_VISIBILITY_VALUES = [
  "Public",
  "public",
  "Network",
  "network",
];

const normalizeWriteVisibility = (visibility) => {
  const normalized = normalizeVisibility(visibility);
  return VISIBILITY_ALIASES[normalized] || "Club-Only";
};

const normalizeVisibility = (visibility) =>
  (visibility || "Club-Only").toString().toLowerCase();

const isPublicVisibility = (visibility) => {
  const v = normalizeVisibility(visibility);
  return v === "public" || v === "network";
};

const canViewPost = (
  post,
  {
    userId = "",
    teamIds = [],
    isClubMember = true,
    includePublicOnly = false,
  } = {},
) => {
  const visibility = normalizeVisibility(post.visibility);

  if (includePublicOnly) {
    return isPublicVisibility(visibility);
  }

  if (visibility === "public" || visibility === "network") return true;
  if (visibility === "club-only" || visibility === "club")
    return !!isClubMember;
  if (visibility === "team-only" || visibility === "team") {
    if (!isClubMember) return false;
    if (post.authorId && post.authorId === userId) return true;
    if (!post.teamId) return false;
    return teamIds.includes(post.teamId);
  }

  return !!isClubMember;
};

const inferClubId = (docRef) => {
  const segments = docRef.path.split("/");
  const clubsIdx = segments.indexOf("clubs");
  if (clubsIdx >= 0 && segments[clubsIdx + 1]) {
    return segments[clubsIdx + 1];
  }
  return null;
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

export const createPost = async (
  clubId,
  {
    authorId,
    authorName,
    content,
    imageUrl,
    visibility,
    teamId,
    type,
    category,
  },
) => {
  const normalizedVisibility = normalizeWriteVisibility(visibility);
  const resolvedTeamId =
    normalizeVisibility(normalizedVisibility) === "team-only" && !teamId
      ? null
      : teamId || null;

  const ref = doc(postsCol(clubId));
  const data = {
    clubId,
    authorId,
    authorName,
    content,
    imageUrl: imageUrl || "",
    visibility: normalizedVisibility, // Club-Only, Team-Only, Public, Network
    teamId: resolvedTeamId,
    type: type || "post", // post, match, update, event
    category: category || "Updates",
    isPinned: false,
    pinnedAt: null,
    likedBy: [],
    comments: [],
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { id: ref.id, ...data };
};

export const updatePost = async (clubId, postId, updates = {}) => {
  await updateDoc(doc(db, "clubs", clubId, "posts", postId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const togglePostPin = async (clubId, postId, shouldPin) => {
  await updateDoc(doc(db, "clubs", clubId, "posts", postId), {
    isPinned: !!shouldPin,
    pinnedAt: shouldPin ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
};

export const getPosts = async (
  clubId,
  { filterType, filterTeamId, limitCount = 50, viewer = null } = {},
) => {
  let q = query(
    postsCol(clubId),
    orderBy("createdAt", "desc"),
    limit(limitCount),
  );

  if (filterType && filterType !== "All Posts") {
    const typeMap = {
      Matches: "match",
      Updates: "update",
      Events: "event",
    };
    if (typeMap[filterType]) {
      q = query(
        postsCol(clubId),
        where("type", "==", typeMap[filterType]),
        orderBy("createdAt", "desc"),
        limit(limitCount),
      );
    }
  }

  const snap = await getDocs(q);
  let posts = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    clubId: d.data().clubId || clubId,
  }));

  if (filterTeamId) {
    posts = posts.filter((post) => post.teamId === filterTeamId);
  }

  if (viewer) {
    posts = posts.filter((post) => canViewPost(post, viewer));
  }

  return posts;
};

export const deletePost = async (clubId, postId) => {
  await deleteDoc(doc(db, "clubs", clubId, "posts", postId));
};

export const subscribeToPosts = (
  clubId,
  callback,
  limitCount = 50,
  viewer = null,
) => {
  const includePublicOnly = !!viewer?.includePublicOnly;

  if (includePublicOnly) {
    const publicVisibilityValues = ["Public", "Network", "public", "network"];
    const baseCol = postsCol(clubId);

    let fallbackUnsub = null;
    const primaryQ = query(
      baseCol,
      where("visibility", "in", publicVisibilityValues),
      orderBy("createdAt", "desc"),
      limit(limitCount),
    );

    const primaryUnsub = onSnapshot(
      primaryQ,
      (snap) => {
        const posts = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          clubId: d.data().clubId || clubId,
        }));
        callback(posts);
      },
      () => {
        if (fallbackUnsub) return;
        const fallbackQ = query(
          baseCol,
          where("visibility", "in", publicVisibilityValues),
          limit(limitCount),
        );
        fallbackUnsub = onSnapshot(
          fallbackQ,
          (fallbackSnap) => {
            const posts = fallbackSnap.docs
              .map((d) => ({
                id: d.id,
                ...d.data(),
                clubId: d.data().clubId || clubId,
              }))
              .sort((a, b) => {
                const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return bMs - aMs;
              })
              .slice(0, limitCount);
            callback(posts);
          },
          (fallbackError) => {
            console.error(
              "subscribeToPosts fallback listener error:",
              fallbackError,
            );
            callback([]);
          },
        );
      },
    );

    return () => {
      primaryUnsub();
      if (fallbackUnsub) fallbackUnsub();
    };
  }

  const q = query(
    postsCol(clubId),
    orderBy("createdAt", "desc"),
    limit(limitCount),
  );
  return onSnapshot(
    q,
    (snap) => {
      let posts = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        clubId: d.data().clubId || clubId,
      }));
      if (viewer) {
        posts = posts.filter((post) => canViewPost(post, viewer));
      }
      callback(posts);
    },
    (error) => {
      console.error("subscribeToPosts listener error:", error);
      callback([]);
    },
  );
};

export const getNetworkPosts = async (
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

  const postsByClub = await Promise.all(
    normalizedClubIds.map(async (clubId) => {
      const mapRows = (snap) =>
        snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              clubId: data.clubId || clubId || inferClubId(d.ref),
            };
          })
          .filter((post) =>
            ["public", "network"].includes(
              normalizeVisibility(post.visibility),
            ),
          );

      try {
        const primaryQ = query(
          postsCol(clubId),
          where("visibility", "in", NETWORK_FEED_VISIBILITY_VALUES),
          orderBy("createdAt", "desc"),
          limit(perClubLimit),
        );
        return mapRows(await getDocs(primaryQ));
      } catch {
        try {
          const fallbackQ = query(
            postsCol(clubId),
            where("visibility", "in", NETWORK_FEED_VISIBILITY_VALUES),
            limit(perClubLimit),
          );
          return mapRows(await getDocs(fallbackQ));
        } catch {
          return [];
        }
      }
    }),
  );

  let posts = postsByClub
    .flat()
    .sort((a, b) => timestampToMs(b.createdAt) - timestampToMs(a.createdAt));

  const seen = new Set();
  posts = posts.filter((post) => {
    const key = `${post.clubId || "club"}:${post.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  posts = posts.slice(0, limitCount);

  // Attach club names for network cards.
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

  posts = posts.map((post) => ({
    ...post,
    clubName:
      post.clubName || clubNameMap[post.clubId] || post.clubId || "Club",
  }));

  return posts;
};

export const togglePostLike = async (clubId, postId, userId) => {
  const ref = doc(db, "clubs", clubId, "posts", postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  const likedBy = Array.isArray(data.likedBy) ? data.likedBy : [];

  const isLiked = likedBy.includes(userId);

  await updateDoc(ref, {
    likedBy: isLiked ? arrayRemove(userId) : arrayUnion(userId),
    updatedAt: serverTimestamp(),
  });
};

export const addPostComment = async (
  clubId,
  postId,
  userId,
  userName,
  content,
) => {
  const ref = doc(db, "clubs", clubId, "posts", postId);

  const newComment = {
    id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    uid: userId,
    name: userName,
    content: content.trim(),
    createdAt: new Date().toISOString(),
  };

  await updateDoc(ref, {
    comments: arrayUnion(newComment),
    updatedAt: serverTimestamp(),
  });

  return newComment;
};

export const deletePostComment = async (clubId, postId, comment) => {
  const ref = doc(db, "clubs", clubId, "posts", postId);
  await updateDoc(ref, {
    comments: arrayRemove(comment),
    updatedAt: serverTimestamp(),
  });
};
