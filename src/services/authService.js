import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
} from "firebase/firestore";
import { auth, db, firebaseInitError } from "../config/firebase";

export const SUPER_ADMIN_EMAIL = "idthe3tree@gmail.com";
const SUPER_ADMIN_PASSWORD = "admin@2026";

const isSuperAdminCredential = (email, password) =>
  (email || "").trim().toLowerCase() === SUPER_ADMIN_EMAIL &&
  password === SUPER_ADMIN_PASSWORD;

const getFirebaseErrorMessage = () => {
  const base = "Firebase is not configured correctly for this build.";
  const reason = firebaseInitError?.message
    ? ` Reason: ${firebaseInitError.message}`
    : "";
  return `${base}${reason}`;
};

const ensureAuthReady = () => {
  if (!auth) throw new Error(getFirebaseErrorMessage());
};

const ensureDbReady = () => {
  if (!db) throw new Error(getFirebaseErrorMessage());
};

const ensureSuperAdminProfile = async (user, email) => {
  ensureDbReady();
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  const baseProfile = {
    uid: user.uid,
    profileOwnerUid: user.uid,
    email,
    displayName: userSnap.data()?.displayName || "Platform Admin",
    phone: "",
    avatarUrl: "",
    accountType: "superadmin",
    followedClubIds: [],
    clubMemberships: [],
    updatedAt: serverTimestamp(),
  };

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      ...baseProfile,
      createdAt: serverTimestamp(),
    });
    return;
  }

  await setDoc(userRef, baseProfile, { merge: true });
};

export const signUp = async ({
  email,
  password,
  fullName,
  phone,
  role,
  clubId,
  clubName = "",
  teamIds = [],
}) => {
  ensureAuthReady();
  // Step 1: Create Firebase Auth user — this is the critical step; let errors propagate
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );
  const user = credential.user;

  // Step 2: Set display name (non-critical)
  try {
    await updateProfile(user, { displayName: fullName });
  } catch (e) {
    console.warn("SignUp: Failed to set display name:", e.message);
  }

  // Step 3: Create Firestore user document (recoverable — AuthContext will self-heal if this fails)
  const userDoc = {
    uid: user.uid,
    profileOwnerUid: user.uid,
    email,
    displayName: fullName,
    phone: phone || "",
    avatarUrl: "",
    accountType: (role || "").toLowerCase() === "owner" ? "owner" : "member",
    followedClubIds: [],
    clubMemberships: clubId ? [{ clubId, clubName, role, teamIds }] : [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, "users", user.uid), userDoc);
  } catch (e) {
    console.error("SignUp: Failed to create user document:", e.message);
  }

  // Step 4: Add member to club (if joining an existing club via params)
  if (clubId) {
    try {
      await setDoc(doc(db, "clubs", clubId, "members", user.uid), {
        uid: user.uid,
        displayName: fullName,
        email,
        role,
        teamIds,
        joinedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("SignUp: Failed to add member to club:", e.message);
    }
  }

  // Step 5: Self-Healing - Check if this email was already added as a member in ANY club
  // This handles the "Transferred Ownership" case where the member was added by email before having a UID.
  try {
    const clubsSnap = await getDocs(collection(db, "clubs"));
    for (const clubDoc of clubsSnap.docs) {
      // Skip if we already added them to this club in Step 4
      if (clubDoc.id === clubId) continue;

      const membersRef = collection(db, "clubs", clubDoc.id, "members");
      const emailsToTry = [email.trim().toLowerCase()];
      // Handle the common gmail typo too
      if (email.endsWith("@gmail.com")) {
        emailsToTry.push(email.replace("@gmail.com", "@gmial.com"));
      }

      for (const emailTry of emailsToTry) {
        const q = query(membersRef, where("email", "==", emailTry));
        const mSnap = await getDocs(q);
        if (!mSnap.empty) {
          const mDoc = mSnap.docs[0];
          const mData = mDoc.data();
          
          // Link this UID to the member record
          await setDoc(doc(db, "clubs", clubDoc.id, "members", user.uid), {
            ...mData,
            uid: user.uid,
            email: email.trim().toLowerCase(), // Use correct spelling
            joinedAt: mData.joinedAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // Delete the old "placeholder" member doc if it has a different ID
          if (mDoc.id !== user.uid) {
            await deleteDoc(mDoc.ref);
          }

          // Update the user profile doc with memberships
          const role = mData.role || "Member";
          const roles = mData.roles || [role];
          const memberships = [{ clubId: clubDoc.id, clubName: clubDoc.data().name, role, roles }];
          
          await updateDoc(doc(db, "users", user.uid), {
            clubMemberships: memberships,
            accountType: roles.includes("Owner") ? "owner" : (roles.includes("Admin") ? "admin" : "member"),
            updatedAt: serverTimestamp(),
          });
          break;
        }
      }
    }
  } catch (e) {
    console.error("SignUp: Failed to auto-link pending membership:", e.message);
  }

  return user;
};

export const signIn = async (email, password) => {
  ensureAuthReady();
  const normalizedEmail = (email || "").trim().toLowerCase();

  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      normalizedEmail,
      password,
    );

    if (isSuperAdminCredential(normalizedEmail, password) && db) {
      await ensureSuperAdminProfile(credential.user, normalizedEmail);
    }

    return credential.user;
  } catch (error) {
    if (!isSuperAdminCredential(normalizedEmail, password)) {
      throw error;
    }

    if (
      error.code !== "auth/user-not-found" &&
      error.code !== "auth/invalid-credential"
    ) {
      throw error;
    }

    const created = await createUserWithEmailAndPassword(
      auth,
      normalizedEmail,
      password,
    );
    if (db) {
      await ensureSuperAdminProfile(created.user, normalizedEmail);
    }
    return created.user;
  }
};

export const logOut = async () => {
  ensureAuthReady();
  await signOut(auth);
};

export const resetPassword = async (email) => {
  ensureAuthReady();
  await sendPasswordResetEmail(auth, email);
};

export const getUserProfile = async (uid) => {
  ensureDbReady();
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateUserProfile = async (uid, updates = {}) => {
  ensureDbReady();
  if (!uid) throw new Error("User id is required.");
  await updateDoc(doc(db, "users", uid), {
    ...updates,
    profileOwnerUid: uid,
    lastUpdatedByUid: uid,
    updatedAt: serverTimestamp(),
  });
};

export const subscribeToAuth = (callback) => {
  if (!auth) {
    console.error(getFirebaseErrorMessage());
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

export const subscribeToUserProfile = (uid, callback) => {
  ensureDbReady();
  if (!uid) {
    callback(null);
    return () => {};
  }
  return onSnapshot(doc(db, "users", uid), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
};
