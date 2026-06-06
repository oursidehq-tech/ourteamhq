import React, { createContext, useContext, useState, useEffect } from "react";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";
import { subscribeToAuth, getUserProfile, subscribeToUserProfile } from "../services/authService";
import { registerForPushNotificationsAsync } from "../services/pushNotificationService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // Firebase Auth user
  const [profile, setProfile] = useState(null); // Firestore user profile
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let unsubscribe = () => {};

    try {
      unsubscribe = subscribeToAuth(async (firebaseUser) => {
        if (firebaseUser) {
          setLoading(true);
          setUser(firebaseUser);
          setProfile(null);
          try {
            let userProfile = await getUserProfile(firebaseUser.uid);

            // Profile may not exist yet (race with signup write) — retry after short delay
            if (!userProfile) {
              await new Promise((r) => setTimeout(r, 1500));
              userProfile = await getUserProfile(firebaseUser.uid);
            }

            // Self-healing: create a basic profile for orphaned auth users
            if (!userProfile) {
              try {
                const basicProfile = {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email || "",
                  displayName: firebaseUser.displayName || "",
                  phone: "",
                  avatarUrl: "",
                  accountType: "member",
                  followedClubIds: [],
                  clubMemberships: [],
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                };
                await setDoc(doc(db, "users", firebaseUser.uid), basicProfile);
                userProfile = { id: firebaseUser.uid, ...basicProfile };
              } catch (createErr) {
                console.error("Failed to self-heal user profile:", createErr);
              }
            }

            setProfile(userProfile);
          } catch (e) {
            console.warn("Failed to load user profile:", e);
            setProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email || "",
              displayName: firebaseUser.displayName || "",
              accountType: "member",
              followedClubIds: [],
              clubMemberships: [],
            });
          }
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
        setInitializing(false);
      });
    } catch (e) {
      console.error("Auth bootstrap failed:", e);
      setUser(null);
      setProfile(null);
      setLoading(false);
      setInitializing(false);
    }

    return unsubscribe;
  }, []);

  // Real-time profile listener
  useEffect(() => {
    if (!user?.uid) {
      setProfile(null);
      return;
    }

    const unsubscribe = subscribeToUserProfile(user.uid, (userProfile) => {
      if (userProfile) {
        setProfile(userProfile);
      }
    });

    return unsubscribe;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    let cancelled = false;
    const registerPush = async () => {
      try {
        const result = await registerForPushNotificationsAsync();
        if (cancelled) return;

        if (result?.status) {
          const updates = {
            notificationPermission: result.status,
            updatedAt: serverTimestamp(),
          };
          if (result.token) {
            updates.expoPushToken = result.token;
          }
          await updateDoc(doc(db, "users", user.uid), updates);
        }
      } catch (err) {
        console.warn("Push notification registration failed:", err);
      }
    };

    registerPush();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const refreshProfile = async () => {
    if (user) {
      const userProfile = await getUserProfile(user.uid);
      setProfile(userProfile);
    }
  };

  // Derive the role in the active club from profile
  const getRoleInClub = (clubId) => {
    if (!profile?.clubMemberships) return "Player";
    const membership = profile.clubMemberships.find((m) => m.clubId === clubId);
    return membership?.role || "Player";
  };

  const isSuperAdmin = profile?.accountType === "superadmin";

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        initializing,
        refreshProfile,
        getRoleInClub,
        isSuperAdmin,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
