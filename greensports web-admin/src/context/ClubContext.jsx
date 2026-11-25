import { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';

const ClubContext = createContext(null);

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export function ClubProvider({ children }) {
  const { adminClubIds, userClubIds, isSuperAdmin, portalMode, profile, user, mergeDiscoveredMemberships } = useAuth();
  const [allClubs, setAllClubs] = useState([]);
  const [selectedClubId, setSelectedClubId] = useState('');
  const [loading, setLoading] = useState(true);
  const [discoveredMemberships, setDiscoveredMemberships] = useState([]);
  const probedKeyRef = useRef('');

  const fetchClubs = () => {
    const clubsRef = collection(db, 'clubs');
    // Subscribe without orderBy('createdAt') so clubs missing createdAt are never silently omitted by Firestore
    return onSnapshot(clubsRef, (snap) => {
      const sorted = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      setAllClubs(sorted);
      setLoading(false);
    }, (err) => {
      console.warn('Clubs listener warning:', err?.code || err?.message);
      setLoading(false);
    });
  };

  useEffect(() => {
    const unsubscribe = fetchClubs();
    return () => typeof unsubscribe === 'function' && unsubscribe();
  }, []);

  // Discover any club memberships from clubs/{clubId}/members/{uid} or club creator/owner fields
  // if users/{uid}.clubMemberships is empty or out of sync.
  useEffect(() => {
    if (!user?.uid || allClubs.length === 0) {
      setDiscoveredMemberships([]);
      probedKeyRef.current = '';
      return;
    }

    const knownIds = new Set([
      ...(userClubIds || []),
      ...(Array.isArray(profile?.clubMemberships) ? profile.clubMemberships.map(m => m.clubId).filter(Boolean) : []),
      ...(profile?.clubId ? [String(profile.clubId).trim()] : []),
    ]);

    const probeKey = `${user.uid}:${allClubs.map(c => c.id).join(',')}:${Array.from(knownIds).sort().join(',')}`;
    if (probedKeyRef.current === probeKey) return;
    probedKeyRef.current = probeKey;

    let cancelled = false;

    const userEmail = String(user?.email || profile?.email || '').trim().toLowerCase();

    const isClubOwnerMatch = (club) => {
      if (club.ownerId === user.uid || club.createdBy === user.uid || club.adminUid === user.uid) return true;
      if (userEmail && String(club.contact?.email || club.adminEmail || '').trim().toLowerCase() === userEmail) return true;
      if (Array.isArray(club.keyPeople)) {
        return club.keyPeople.some(kp =>
          kp?.uid === user.uid || (userEmail && String(kp?.email || '').trim().toLowerCase() === userEmail)
        );
      }
      return false;
    };

    const discover = async () => {
      const found = [];

      // 1. Check clubs where user is ownerId, createdBy, contact email, or in keyPeople
      for (const club of allClubs) {
        if (isClubOwnerMatch(club) && !knownIds.has(club.id)) {
          found.push({
            clubId: club.id,
            clubName: club.name || 'Club',
            role: 'Owner',
            roles: ['Owner'],
            teamIds: [],
            groupIds: [],
          });
          knownIds.add(club.id);
        }
      }

      // 2. Probe clubs/{clubId}/members/{uid} (and email/uid fallbacks) for remaining clubs
      const clubsToProbe = allClubs.filter(c => !knownIds.has(c.id));
      await Promise.all(
        clubsToProbe.map(async (club) => {
          let mDocId = null;
          let mData = null;

          try {
            const memberSnap = await getDoc(doc(db, 'clubs', club.id, 'members', user.uid));
            if (memberSnap.exists()) {
              mDocId = memberSnap.id;
              mData = memberSnap.data();
            }
          } catch {
            // Expected permission-denied if not a member by UID
          }

          // Fallback: check email-keyed or query-matched member docs if permitted
          if (!mData && userEmail) {
            try {
              const emailSnap = await getDoc(doc(db, 'clubs', club.id, 'members', userEmail));
              if (emailSnap.exists()) {
                mDocId = emailSnap.id;
                mData = emailSnap.data();
              }
            } catch {
              // Ignore permission-denied
            }
          }

          if (!mData) {
            try {
              const membersRef = collection(db, 'clubs', club.id, 'members');
              const uidSnap = await getDocs(query(membersRef, where('uid', '==', user.uid)));
              if (!uidSnap.empty) {
                mDocId = uidSnap.docs[0].id;
                mData = uidSnap.docs[0].data();
              } else if (userEmail) {
                const emailQuerySnap = await getDocs(query(membersRef, where('email', '==', userEmail)));
                if (!emailQuerySnap.empty) {
                  mDocId = emailQuerySnap.docs[0].id;
                  mData = emailQuerySnap.docs[0].data();
                }
              }
            } catch {
              // Ignore permission-denied
            }
          }

          if (mData) {
            // Self-heal: ensure member doc is keyed by user.uid for Firestore security rules
            if (mDocId && mDocId !== user.uid) {
              try {
                await setDoc(doc(db, 'clubs', club.id, 'members', user.uid), {
                  ...mData,
                  uid: user.uid,
                  userId: user.uid,
                  email: userEmail || mData.email || '',
                  joinedAt: mData.joinedAt || serverTimestamp(),
                  updatedAt: serverTimestamp(),
                }, { merge: true });
                if (mDocId.includes('@')) {
                  await deleteDoc(doc(db, 'clubs', club.id, 'members', mDocId));
                }
              } catch {
                // Best-effort migration
              }
            }

            const roles = Array.isArray(mData.roles) && mData.roles.length > 0
              ? mData.roles
              : [mData.role || 'Player'];
            found.push({
              clubId: club.id,
              clubName: club.name || 'Club',
              role: mData.role || roles[0] || 'Player',
              roles,
              teamIds: Array.isArray(mData.teamIds) ? mData.teamIds : [],
              groupIds: Array.isArray(mData.groupIds) ? mData.groupIds : [],
            });
          }
        })
      );

      if (cancelled) return;
      setDiscoveredMemberships(found);

      if (found.length > 0 && typeof mergeDiscoveredMemberships === 'function') {
        mergeDiscoveredMemberships(found);
      }
    };

    discover();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, allClubs, userClubIds, profile?.clubMemberships, profile?.clubId, mergeDiscoveredMemberships]);

  const effectiveMemberships = useMemo(() => {
    const base = Array.isArray(profile?.clubMemberships) ? [...profile.clubMemberships] : [];
    const fallbackClubId = String(profile?.clubId || '').trim();
    if (fallbackClubId && !base.some(m => m.clubId === fallbackClubId)) {
      base.push({
        clubId: fallbackClubId,
        clubName: profile?.clubName || '',
        role: profile?.role || 'Player',
        roles: [profile?.role || 'Player'],
      });
    }
    discoveredMemberships.forEach((d) => {
      if (d?.clubId && !base.some(m => m.clubId === d.clubId)) {
        base.push(d);
      }
    });
    return base;
  }, [profile?.clubMemberships, profile?.clubId, profile?.clubName, profile?.role, discoveredMemberships]);

  const derivedUserClubIds = useMemo(() => {
    const ids = new Set([
      ...(userClubIds || []),
      ...effectiveMemberships.map(m => m.clubId).filter(Boolean),
    ]);
    return Array.from(ids);
  }, [userClubIds, effectiveMemberships]);

  const derivedAdminClubIds = useMemo(() => {
    const adminSet = new Set(adminClubIds || []);
    const adminRoles = ['owner', 'admin', 'registrar', 'shop manager'];
    discoveredMemberships.forEach((m) => {
      const roles = Array.isArray(m.roles) ? m.roles : [m.role];
      if (roles.some(r => adminRoles.includes(String(r || '').toLowerCase()))) {
        adminSet.add(m.clubId);
      }
    });
    return Array.from(adminSet);
  }, [adminClubIds, discoveredMemberships]);

  // Show only clubs depending on the active portal mode, with owner/creator fallback
  const clubs = useMemo(() => {
    if (isSuperAdmin) return allClubs;
    const isOwnerOrCreator = (c) => Boolean(user?.uid && (c.ownerId === user.uid || c.createdBy === user.uid));
    if (portalMode === 'admin') {
      return allClubs.filter(c => derivedAdminClubIds.includes(c.id) || isOwnerOrCreator(c));
    }
    return allClubs.filter(c => derivedUserClubIds.includes(c.id) || isOwnerOrCreator(c));
  }, [isSuperAdmin, allClubs, portalMode, derivedAdminClubIds, derivedUserClubIds, user]);

  // Auto-select first accessible club, or clear selection if none remain
  useEffect(() => {
    if (clubs.length > 0 && (!selectedClubId || !clubs.find(c => c.id === selectedClubId))) {
      setSelectedClubId(clubs[0].id);
    } else if (!loading && clubs.length === 0 && selectedClubId) {
      setSelectedClubId('');
    }
  }, [clubs, selectedClubId, loading]);

  const selectedClub = clubs.find(c => c.id === selectedClubId) || null;
  const activeMembership = effectiveMemberships.find(m => m.clubId === selectedClubId) || null;

  return (
    <ClubContext.Provider value={{
      clubs,
      allClubs,
      selectedClubId,
      setSelectedClubId,
      selectedClub,
      activeMembership,
      effectiveMemberships,
      loading,
      refreshClubs: fetchClubs,
    }}>
      {children}
    </ClubContext.Provider>
  );
}

export const useClub = () => useContext(ClubContext);
