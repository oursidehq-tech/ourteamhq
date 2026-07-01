import { createContext, useContext, useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, updateEmail, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const AuthContext = createContext(null);

// Roles that can access the web admin panel
const ADMIN_ROLES = ['Owner', 'Admin', 'Registrar', 'Shop Manager'];
const SUPER_ADMIN_EMAILS = ['ourteamhq@gmail.com', 'idthe3tree@gmail.com', 'admin@greensports.com', 'admin@gmail.com'];
const SUPER_ADMIN_PASSWORD = 'admin@2026';
const ADMIN_PIN = 'OurTeamHQ@2026'; // Shared PIN for ALL admin types

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

  const setPortalMode = (mode) => {
    setPortalModeState(mode);
    localStorage.setItem('portalMode', mode);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          let userSnap = null;
          try {
             userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          } catch (profileErr) {
             console.warn('Profile doc fetch failed, continuing as guest/superadmin:', profileErr);
          }

          const isSuperByEmail = firebaseUser.email && SUPER_ADMIN_EMAILS.includes(firebaseUser.email.toLowerCase().trim());
          
          if (userSnap && userSnap.exists()) {
            const userData = { id: userSnap.id, ...userSnap.data() };
            setProfile(userData);

            const memberships = userData.clubMemberships || [];
            const ownerIds = memberships
              .filter(m => {
                const r = m.role || '';
                const rs = m.roles || [];
                return r.toLowerCase() === 'owner' || rs.some(val => val.toLowerCase() === 'owner');
              })
              .map(m => m.clubId);

            const adminIds = memberships
              .filter(m => {
                const r = m.role || '';
                const rs = m.roles || [];
                const checkRole = (val) => ADMIN_ROLES.some(ar => ar.toLowerCase() === val.toLowerCase());
                return checkRole(r) || rs.some(val => checkRole(val));
              })
              .map(m => m.clubId);

            const allUserIds = memberships.map(m => m.clubId);

            setOwnerClubIds(ownerIds);
            setAdminClubIds(adminIds);
            setUserClubIds(allUserIds);

            const isSuper = userData.accountType === 'superadmin' || isSuperByEmail;
            setIsSuperAdmin(isSuper);

            // Authenticate successfully!
            setIsAuthenticated(true);
            setAuthError(null);

            // If user has no admin capabilities, force them into User Portal
            if (adminIds.length === 0 && !isSuper) {
              setPortalMode('user');
              setIsPinVerified(true); // Bypass pin for normal members
            } else if (portalMode === 'user') {
              setIsPinVerified(true); // Bypassed if explicitly browsing user mode
            }
          } else if (isSuperByEmail) {
            // Special case: Super Admin logged in but user profile doc missing
            setIsSuperAdmin(true);
            setIsAuthenticated(true);
            setAuthError(null);
            setProfile({ email: firebaseUser.email, accountType: 'superadmin' });
            setIsPinVerified(true);
          } else {
            // Auto-create basic profile to prevent orphaned users on web sign up
            const basicProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
              clubMemberships: [],
              createdAt: serverTimestamp(),
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), basicProfile);
            setProfile(basicProfile);
            setIsAuthenticated(true);
            setAuthError(null);
            setPortalMode('user');
            setIsPinVerified(true);
          }
        } catch (e) {
          console.error('Profile load failed:', e);
        }
      } else {
        resetState();
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [portalMode]);

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

  // Sign up directly on the web
  const signUp = async (email, password, displayName, phone, role) => {
    setAuthError(null);
    try {
      const normalizedEmail = (email || '').trim().toLowerCase();
      const res = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      
      const userRef = doc(db, 'users', res.user.uid);
      const userProfile = {
        uid: res.user.uid,
        email: normalizedEmail,
        displayName,
        phone: phone || '',
        accountType: role === 'Club Owner' ? 'owner' : 'member',
        clubMemberships: [],
        createdAt: serverTimestamp(),
      };
      
      await setDoc(userRef, userProfile);
      setProfile(userProfile);
      setPortalMode('user');
      setIsPinVerified(true);
      return res.user;
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        setAuthError('This email is already registered.');
      } else if (error.code === 'auth/weak-password') {
        setAuthError('Password must be at least 6 characters.');
      } else {
        setAuthError(error.message);
      }
      return null;
    }
  };

  // Join a club with invite code
  const joinClubWithCode = async (code) => {
    if (!user || !profile) return false;
    try {
      const normalizedCode = code.toUpperCase().trim();
      const clubsSnap = await getDocs(collection(db, 'clubs'));
      let targetClub = null;
      let matchedInvite = null;

      for (const clubDoc of clubsSnap.docs) {
        const invitesRef = collection(db, 'clubs', clubDoc.id, 'invites');
        const invitesSnap = await getDocs(query(invitesRef, where('code', '==', normalizedCode)));
        if (!invitesSnap.empty) {
          targetClub = { id: clubDoc.id, ...clubDoc.data() };
          matchedInvite = invitesSnap.docs[0].data();
          break;
        }
      }

      if (!targetClub) {
        throw new Error('Invalid invite code. Please check and try again.');
      }

      const assignedRole = matchedInvite.role || 'Player';
      
      // Update profile
      const updatedMemberships = [...(profile.clubMemberships || [])];
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

      // Update user document
      await setDoc(doc(db, 'users', user.uid), {
        clubMemberships: updatedMemberships
      }, { merge: true });

      // Add to club members subcollection
      const memberRef = doc(db, 'clubs', targetClub.id, 'members', user.uid);
      await setDoc(memberRef, {
        userId: user.uid,
        displayName: profile.displayName || user.email.split('@')[0],
        email: user.email,
        role: assignedRole,
        roles: [assignedRole],
        joinedAt: serverTimestamp()
      });

      setProfile(prev => ({ ...prev, clubMemberships: updatedMemberships }));
      setUserClubIds(updatedMemberships.map(m => m.clubId));
      return targetClub;
    } catch (err) {
      alert(err.message);
      return false;
    }
  };

  // Create a brand new club
  const createClubOnboarding = async (clubName, sport, location) => {
    if (!user || !profile) return false;
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const clubRef = doc(collection(db, 'clubs'));
      
      await setDoc(clubRef, {
        name: clubName,
        sport: sport || 'Soccer',
        location: location || '',
        inviteCode: code,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        plan: 'Starter'
      });

      // Write invite record inside club
      const inviteRef = doc(collection(db, 'clubs', clubRef.id, 'invites'));
      await setDoc(inviteRef, {
        code,
        role: 'Player',
        createdBy: user.uid,
        createdAt: serverTimestamp()
      });

      // Add owner membership to user
      const updatedMemberships = [...(profile.clubMemberships || [])];
      updatedMemberships.push({
        clubId: clubRef.id,
        clubName: clubName,
        role: 'Owner',
        roles: ['Owner'],
        joinedAt: new Date().toISOString()
      });

      await setDoc(doc(db, 'users', user.uid), {
        clubMemberships: updatedMemberships,
        accountType: 'owner'
      }, { merge: true });

      // Add to members subcollection
      const memberRef = doc(db, 'clubs', clubRef.id, 'members', user.uid);
      await setDoc(memberRef, {
        userId: user.uid,
        displayName: profile.displayName,
        email: user.email,
        role: 'Owner',
        roles: ['Owner'],
        joinedAt: serverTimestamp()
      });

      setProfile(prev => ({
        ...prev,
        accountType: 'owner',
        clubMemberships: updatedMemberships
      }));
      setAdminClubIds(prev => [...prev, clubRef.id]);
      setOwnerClubIds(prev => [...prev, clubRef.id]);
      setUserClubIds(updatedMemberships.map(m => m.clubId));
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
      isOwnerOf, hasRole, loading, authError,
      login, logout, verifyPin, signUp, joinClubWithCode, createClubOnboarding, updateUserEmail
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
