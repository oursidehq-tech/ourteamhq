import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, updateEmail, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { emailService } from '../services/emailService';

const AuthContext = createContext(null);

// Roles that can access the web admin panel
const ADMIN_ROLES = ['Owner', 'Admin', 'Registrar', 'Shop Manager'];
const SUPER_ADMIN_EMAILS = ['ourteamhq@gmail.com', 'idthe3tree@gmail.com', 'admin@greensports.com', 'admin@gmail.com'];
const SUPER_ADMIN_PASSWORD = 'admin@2026';
const ADMIN_PIN = 'OurTeamHQ@2026'; // Shared PIN for ALL admin types

const getNormalizedMemberships = (userData) => {
  const rawList = Array.isArray(userData?.clubMemberships)
    ? userData.clubMemberships
    : (Array.isArray(userData?.memberships) ? userData.memberships : []);

  const list = rawList
    .map((m) => {
      if (!m) return null;
      if (typeof m === 'string') {
        const id = m.trim();
        return id ? { clubId: id, clubName: '', role: 'Player', roles: ['Player'] } : null;
      }
      const clubId = String(m.clubId || m.id || '').trim();
      return clubId ? { ...m, clubId } : null;
    })
    .filter(Boolean);

  const accountType = String(userData?.accountType || '').toLowerCase();
  const fallbackRole = accountType.includes('owner')
    ? 'Owner'
    : accountType.includes('admin')
      ? 'Admin'
      : (userData?.role || 'Player');

  const extraIds = [
    String(userData?.clubId || '').trim(),
    ...(Array.isArray(userData?.clubIds) ? userData.clubIds.map(id => String(id || '').trim()) : []),
  ].filter(Boolean);

  extraIds.forEach((cid) => {
    if (!list.some(m => m.clubId === cid)) {
      list.push({
        clubId: cid,
        clubName: userData?.clubName || '',
        role: fallbackRole,
        roles: [fallbackRole],
      });
    }
  });

  return list;
};

const deriveClubRoleIds = (memberships) => {
  const ownerIds = memberships
    .filter(m => {
      const r = m.role || '';
      const rs = Array.isArray(m.roles) ? m.roles : [];
      return r.toLowerCase() === 'owner' || rs.some(val => String(val).toLowerCase() === 'owner');
    })
    .map(m => m.clubId);

  const adminIds = memberships
    .filter(m => {
      const r = m.role || '';
      const rs = Array.isArray(m.roles) ? m.roles : [];
      const checkRole = (val) => ADMIN_ROLES.some(ar => ar.toLowerCase() === String(val).toLowerCase());
      return checkRole(r) || rs.some(val => checkRole(val));
    })
    .map(m => m.clubId);

  const allUserIds = Array.from(new Set(memberships.map(m => m.clubId).filter(Boolean)));
  return { ownerIds, adminIds, allUserIds };
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [portalMode, setPortalModeState] = useState(() => localStorage.getItem('portalMode') || 'user');
  const [adminClubIds, setAdminClubIds] = useState([]);
  const [ownerClubIds, setOwnerClubIds] = useState([]);
  const [userClubIds, setUserClubIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const portalModeRef = useRef(portalMode);
  const signingUpRef = useRef(false);

  const setPortalMode = useCallback((mode) => {
    portalModeRef.current = mode;
    setPortalModeState(mode);
    localStorage.setItem('portalMode', mode);
  }, []);

  const applyUserProfile = useCallback((userData, firebaseUser) => {
    const isSuperByEmail = Boolean(
      firebaseUser?.email && SUPER_ADMIN_EMAILS.includes(firebaseUser.email.toLowerCase().trim())
    );
    const memberships = getNormalizedMemberships(userData);
    const { ownerIds, adminIds, allUserIds } = deriveClubRoleIds(memberships);
    const isSuper = userData?.accountType === 'superadmin' || isSuperByEmail;

    setProfile({ ...userData, clubMemberships: memberships });
    setOwnerClubIds(ownerIds);
    setAdminClubIds(adminIds);
    setUserClubIds(allUserIds);
    setIsSuperAdmin(isSuper);
    setIsAuthenticated(true);
    setAuthError(null);

    if (adminIds.length === 0 && !isSuper) {
      setPortalMode('user');
      setIsPinVerified(true);
    } else if (portalModeRef.current === 'user') {
      setIsPinVerified(true);
    }
  }, [setPortalMode]);

  useEffect(() => {
    let profileUnsubscribe = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      if (firebaseUser) {
        setUser(firebaseUser);
        const userRef = doc(db, 'users', firebaseUser.uid);
        const isSuperByEmail = Boolean(
          firebaseUser.email && SUPER_ADMIN_EMAILS.includes(firebaseUser.email.toLowerCase().trim())
        );

        let initialSnap = null;
        let fetchFailed = false;
        try {
          initialSnap = await getDoc(userRef);
        } catch (profileErr) {
          fetchFailed = true;
          console.warn('Profile doc fetch failed:', profileErr);
        }

        if (initialSnap && initialSnap.exists()) {
          applyUserProfile({ id: initialSnap.id, ...initialSnap.data() }, firebaseUser);
        } else if (isSuperByEmail) {
          setIsSuperAdmin(true);
          setIsAuthenticated(true);
          setAuthError(null);
          setProfile({ uid: firebaseUser.uid, email: firebaseUser.email, accountType: 'superadmin', clubMemberships: [] });
          setIsPinVerified(true);
        } else if (!fetchFailed && !signingUpRef.current) {
          // Only create a new profile when we confirmed the doc does not exist (never overwrite on transient errors)
          try {
            const basicProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Member'),
              clubMemberships: [],
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            await setDoc(userRef, basicProfile, { merge: true });
            applyUserProfile({ id: firebaseUser.uid, ...basicProfile }, firebaseUser);
          } catch (createErr) {
            console.error('Profile creation failed:', createErr);
            setProfile({ uid: firebaseUser.uid, email: firebaseUser.email || '', displayName: firebaseUser.displayName || '', clubMemberships: [] });
            setIsAuthenticated(true);
            setPortalMode('user');
            setIsPinVerified(true);
          }
        } else {
          // Transient fetch error or mid-signup: authenticate without overwriting Firestore
          setIsAuthenticated(true);
          setPortalMode('user');
          setIsPinVerified(true);
        }

        // Subscribe to real-time updates on the user document so membership repairs & mobile updates sync immediately
        profileUnsubscribe = onSnapshot(
          userRef,
          (snap) => {
            if (snap.exists()) {
              applyUserProfile({ id: snap.id, ...snap.data() }, firebaseUser);
            }
          },
          (err) => {
            console.warn('User profile listener warning:', err?.code || err?.message);
          }
        );
      } else {
        resetState();
      }
      setLoading(false);
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, [applyUserProfile, setPortalMode]);

  const mergeDiscoveredMemberships = useCallback(async (discoveredMemberships) => {
    if (!user?.uid || !Array.isArray(discoveredMemberships) || discoveredMemberships.length === 0) return;

    const currentMemberships = getNormalizedMemberships(profile);
    const merged = [...currentMemberships];
    let changed = false;

    discoveredMemberships.forEach((item) => {
      if (!item?.clubId) return;
      const existingIdx = merged.findIndex(m => m.clubId === item.clubId);
      if (existingIdx === -1) {
        merged.push(item);
        changed = true;
      } else {
        const existing = merged[existingIdx];
        const needsName = !existing.clubName && item.clubName;
        const needsRole = !existing.role && item.role;
        if (needsName || needsRole) {
          merged[existingIdx] = {
            ...existing,
            clubName: existing.clubName || item.clubName || '',
            role: existing.role || item.role || 'Player',
            roles: (Array.isArray(existing.roles) && existing.roles.length > 0) ? existing.roles : (item.roles || [item.role || 'Player']),
          };
          changed = true;
        }
      }
    });

    if (!changed) return;

    applyUserProfile({ ...(profile || {}), uid: user.uid, clubMemberships: merged }, user);

    try {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        clubMemberships: merged,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.warn('Failed to persist discovered clubMemberships:', err?.message || err);
    }
  }, [user, profile, applyUserProfile]);

  const resetState = () => {
    setUser(null);
    setProfile(null);
    setIsAuthenticated(false);
    setIsSuperAdmin(false);
    setIsPinVerified(false);
    setAdminClubIds([]);
    setOwnerClubIds([]);
    setUserClubIds([]);
  };

  const isOwnerOf = (clubId) => ownerClubIds.includes(clubId);
  const hasRole = (clubId, roles) => {
    if (isSuperAdmin) return true;
    if (!clubId || !profile?.clubMemberships) return false;
    const membership = profile.clubMemberships.find(m => m.clubId === clubId);
    if (!membership) return false;
    const userRoles = membership.roles || [membership.role];
    return roles.some(role => userRoles.includes(role));
  };

  const login = async (email, password, bypassPinForNormal = false) => {
    setAuthError(null);
    const normalizedEmail = (email || '').trim().toLowerCase();
    const isSuper = SUPER_ADMIN_EMAILS.includes(normalizedEmail) && password === SUPER_ADMIN_PASSWORD;

    try {
      if (bypassPinForNormal) {
        setIsPinVerified(true);
      }
      const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      return true;
    } catch (error) {
      if (isSuper && (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential')) {
        try {
          const created = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
          await ensureSuperAdminProfile(created.user, normalizedEmail);
          return true;
        } catch (e) {
          console.error('Super admin auto-creation failed:', e);
        }
      }

      // Emergency Repair for theboysofficialone typo variations
      const isTarget = normalizedEmail.includes('theboysofficialone') || normalizedEmail.includes('theboysoffficialone');
      if (isTarget && (normalizedEmail.includes('@gmail.com') || normalizedEmail.includes('@gmial.com'))) {
        setAuthError('Accessing recovery mode. Please try signing in again in 10 seconds.');
      }

      if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(error.code)) {
        setAuthError('Invalid email or password.');
      } else if (error.code === 'auth/invalid-email') {
        setAuthError('Please enter a valid email address.');
      } else if (error.code === 'auth/too-many-requests') {
        setAuthError('Too many attempts. Please try again later.');
      } else {
        setAuthError('Login failed. Please try again.');
      }
      return false;
    }
  };

  const ensureSuperAdminProfile = async (firebaseUser, email) => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    await setDoc(userRef, {
      uid: firebaseUser.uid,
      email,
      accountType: 'superadmin',
      displayName: 'Platform Admin',
      updatedAt: serverTimestamp(),
    }, { merge: true });
  };

  const verifyPin = (pin) => {
    if (pin === ADMIN_PIN) {
      setIsPinVerified(true);
      return true;
    }
    return false;
  };

  const logout = async () => {
    await signOut(auth);
    resetState();
  };

  // Sign up directly on the web with full in-app sync
  const signUp = async (email, password, displayName, phone, role) => {
    setAuthError(null);
    signingUpRef.current = true;
    try {
      const normalizedEmail = (email || '').trim().toLowerCase();
      const res = await createUserWithEmailAndPassword(auth, normalizedEmail, password);

      // Update Auth display name
      try {
        await updateProfile(res.user, { displayName });
      } catch (profileNameErr) {
        console.warn('Update profile display name notice:', profileNameErr);
      }

      // Self-Healing: check if this email was already invited/registered inside clubs
      let initialMemberships = [];
      try {
        const clubsSnap = await getDocs(collection(db, 'clubs'));
        for (const clubDoc of clubsSnap.docs) {
          let mDoc = null;
          try {
            const membersRef = collection(db, 'clubs', clubDoc.id, 'members');
            const mSnap = await getDocs(query(membersRef, where('email', '==', normalizedEmail)));
            if (!mSnap.empty) {
              mDoc = mSnap.docs[0];
            }
          } catch {
            // Subcollection query may be restricted by rules until UID member doc exists
          }

          if (mDoc) {
            const mData = mDoc.data();
            const memberRole = mData.role || (role === 'Club Owner' ? 'Owner' : 'Player');
            const memberRoles = Array.isArray(mData.roles) && mData.roles.length > 0 ? mData.roles : [memberRole];

            // Link UID to member document
            await setDoc(doc(db, 'clubs', clubDoc.id, 'members', res.user.uid), {
              ...mData,
              uid: res.user.uid,
              userId: res.user.uid,
              email: normalizedEmail,
              displayName: displayName || mData.displayName || '',
              joinedAt: mData.joinedAt || serverTimestamp(),
              updatedAt: serverTimestamp()
            }, { merge: true });

            if (mDoc.id !== res.user.uid) {
              await deleteDoc(mDoc.ref);
            }

            initialMemberships.push({
              clubId: clubDoc.id,
              clubName: clubDoc.data().name || 'Club',
              role: memberRole,
              roles: memberRoles,
              joinedAt: new Date().toISOString()
            });
          }
        }
      } catch (linkingErr) {
        console.warn('Auto-link memberships notice:', linkingErr);
      }

      const userRef = doc(db, 'users', res.user.uid);
      const userProfile = {
        uid: res.user.uid,
        profileOwnerUid: res.user.uid,
        email: normalizedEmail,
        displayName: displayName || normalizedEmail.split('@')[0],
        phone: phone || '',
        avatarUrl: '',
        accountType: role === 'Club Owner' ? 'owner' : 'member',
        followedClubIds: [],
        clubMemberships: initialMemberships,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(userRef, userProfile, { merge: true });
      applyUserProfile({ id: res.user.uid, ...userProfile }, res.user);
      setPortalMode('user');
      setIsPinVerified(true);
      return { user: res.user, profile: userProfile };
    } catch (error) {
      let msg = error.message;
      if (error.code === 'auth/email-already-in-use') {
        msg = 'This email is already registered. Please sign in or reset your password.';
      } else if (error.code === 'auth/weak-password') {
        msg = 'Password must be at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      signingUpRef.current = false;
    }
  };

  // Password reset via Firebase Auth & Resend
  const resetPassword = async (email) => {
    setAuthError(null);
    try {
      await emailService.sendPasswordReset(email);
      return true;
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        setAuthError('No account found with this email address.');
      } else if (error.code === 'auth/invalid-email') {
        setAuthError('Please enter a valid email address.');
      } else {
        setAuthError(error.message || 'Failed to send password reset email.');
      }
      return false;
    }
  };

  // Join a club with invite code
  const joinClubWithCode = async (code, overrideUser = null, overrideProfile = null) => {
    const activeUser = overrideUser || user || auth.currentUser;
    const activeProfile = overrideProfile || profile;
    if (!activeUser) {
      alert('Authentication required. Please sign in or complete registration.');
      return false;
    }
    try {
      const normalizedCode = code.toUpperCase().trim();
      const clubsSnap = await getDocs(collection(db, 'clubs'));
      let targetClub = null;
      let matchedInvite = null;

      // Primary: match inviteCode stored directly on the club document
      for (const clubDoc of clubsSnap.docs) {
        const clubData = clubDoc.data();
        if (String(clubData?.inviteCode || '').toUpperCase().trim() === normalizedCode) {
          targetClub = { id: clubDoc.id, ...clubData };
          break;
        }
      }

      // Fallback: check invites subcollection if present and readable
      if (!targetClub) {
        for (const clubDoc of clubsSnap.docs) {
          try {
            const invitesRef = collection(db, 'clubs', clubDoc.id, 'invites');
            const invitesSnap = await getDocs(query(invitesRef, where('code', '==', normalizedCode)));
            if (!invitesSnap.empty) {
              targetClub = { id: clubDoc.id, ...clubDoc.data() };
              matchedInvite = invitesSnap.docs[0].data();
              break;
            }
          } catch {
            // Subcollection may not exist or be readable
          }
        }
      }

      if (!targetClub) {
        throw new Error('Invalid invite code. Please check and try again.');
      }

      const assignedRole = matchedInvite?.role || 'Player';

      // Update profile
      const updatedMemberships = [...getNormalizedMemberships(activeProfile)];
      if (updatedMemberships.some(m => m.clubId === targetClub.id)) {
        throw new Error('You are already a member of this club!');
      }

      updatedMemberships.push({
        clubId: targetClub.id,
        clubName: targetClub.name,
        role: assignedRole,
        roles: [assignedRole],
        joinedAt: new Date().toISOString()
      });

      // Add to club members subcollection first so Firestore membership checks succeed
      const memberRef = doc(db, 'clubs', targetClub.id, 'members', activeUser.uid);
      await setDoc(memberRef, {
        uid: activeUser.uid,
        userId: activeUser.uid,
        displayName: activeProfile?.displayName || activeUser.email?.split('@')[0] || 'Member',
        email: activeUser.email || '',
        role: assignedRole,
        roles: [assignedRole],
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Update user document (include uid to satisfy strict Firestore rules)
      await setDoc(doc(db, 'users', activeUser.uid), {
        uid: activeUser.uid,
        clubMemberships: updatedMemberships,
        updatedAt: serverTimestamp()
      }, { merge: true });

      applyUserProfile({ ...(activeProfile || {}), uid: activeUser.uid, clubMemberships: updatedMemberships }, activeUser);
      return targetClub;
    } catch (err) {
      alert(err.message);
      return false;
    }
  };

  // Create a brand new club
  const createClubOnboarding = async (clubName, sport, location, overrideUser = null, overrideProfile = null) => {
    const activeUser = overrideUser || user || auth.currentUser;
    const activeProfile = overrideProfile || profile || {
      displayName: activeUser?.displayName || activeUser?.email?.split('@')[0] || 'Club Owner',
      clubMemberships: []
    };
    if (!activeUser) {
      alert('Authentication required. Please sign in or complete registration.');
      return false;
    }
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const clubRef = doc(collection(db, 'clubs'));

      await setDoc(clubRef, {
        name: clubName,
        sport: sport || 'Soccer',
        location: location || '',
        inviteCode: code,
        ownerId: activeUser.uid,
        createdBy: activeUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        plan: 'Starter'
      });

      // Add to members subcollection
      const memberRef = doc(db, 'clubs', clubRef.id, 'members', activeUser.uid);
      await setDoc(memberRef, {
        uid: activeUser.uid,
        userId: activeUser.uid,
        displayName: activeProfile.displayName || activeUser.email?.split('@')[0] || 'Club Owner',
        email: activeUser.email || '',
        role: 'Owner',
        roles: ['Owner'],
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Add owner membership to user
      const updatedMemberships = [...getNormalizedMemberships(activeProfile)];
      updatedMemberships.push({
        clubId: clubRef.id,
        clubName: clubName,
        role: 'Owner',
        roles: ['Owner'],
        joinedAt: new Date().toISOString()
      });

      await setDoc(doc(db, 'users', activeUser.uid), {
        uid: activeUser.uid,
        clubMemberships: updatedMemberships,
        accountType: 'owner',
        updatedAt: serverTimestamp()
      }, { merge: true });

      applyUserProfile({
        ...(activeProfile || {}),
        uid: activeUser.uid,
        accountType: 'owner',
        clubMemberships: updatedMemberships
      }, activeUser);
      return clubRef.id;
    } catch (err) {
      console.error(err);
      alert('Failed to create club: ' + err.message);
      return false;
    }
  };

  // Allow super admins to update user emails
  const updateUserEmail = async (newEmail) => {
    if (!user) return;
    try {
      await updateEmail(user, newEmail);
    } catch (err) {
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{
      user, profile, isAuthenticated, isSuperAdmin, isPinVerified,
      portalMode, setPortalMode, adminClubIds, ownerClubIds, userClubIds,
      isOwnerOf, hasRole, loading, authError, setAuthError, mergeDiscoveredMemberships,
      login, logout, verifyPin, signUp, resetPassword, joinClubWithCode, createClubOnboarding, updateUserEmail
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
