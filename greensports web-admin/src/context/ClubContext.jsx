import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';

const ClubContext = createContext(null);

export function ClubProvider({ children }) {
  const { adminClubIds, userClubIds, isSuperAdmin, portalMode, profile, user } = useAuth();
  const [allClubs, setAllClubs] = useState([]);
  const [selectedClubId, setSelectedClubId] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchClubs = () => {
    const clubsRef = collection(db, 'clubs');
    const clubsQuery = query(clubsRef, orderBy('createdAt', 'desc'));
    return onSnapshot(clubsQuery, (snap) => {
      setAllClubs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => {
      const fallbackUnsubscribe = onSnapshot(clubsRef, (fallbackSnap) => {
        setAllClubs(fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }, () => setLoading(false));
      return fallbackUnsubscribe;
    });
  };

  useEffect(() => {
    const unsubscribe = fetchClubs();
    return () => typeof unsubscribe === 'function' && unsubscribe();
  }, []);

  const derivedUserClubIds = useMemo(() => {
    if (userClubIds && userClubIds.length > 0) return userClubIds;
    if (profile?.clubMemberships && Array.isArray(profile.clubMemberships)) {
      return profile.clubMemberships.map(m => m.clubId).filter(Boolean);
    }
    return [];
  }, [userClubIds, profile]);

  // Show only clubs depending on the active portal mode, with owner fallback
  const clubs = useMemo(() => {
    if (isSuperAdmin) return allClubs;
    if (portalMode === 'admin') {
      return allClubs.filter(c => adminClubIds.includes(c.id) || (user?.uid && c.ownerId === user.uid));
    }
    return allClubs.filter(c => derivedUserClubIds.includes(c.id) || (user?.uid && c.ownerId === user.uid));
  }, [isSuperAdmin, allClubs, portalMode, adminClubIds, derivedUserClubIds, user]);

  // Auto-select first accessible club
  useEffect(() => {
    if (clubs.length > 0 && (!selectedClubId || !clubs.find(c => c.id === selectedClubId))) {
      setSelectedClubId(clubs[0].id);
    }
  }, [clubs, selectedClubId]);

  const selectedClub = clubs.find(c => c.id === selectedClubId) || null;

  return (
    <ClubContext.Provider value={{ clubs, allClubs, selectedClubId, setSelectedClubId, selectedClub, loading, refreshClubs: fetchClubs }}>
      {children}
    </ClubContext.Provider>
  );
}

export const useClub = () => useContext(ClubContext);
