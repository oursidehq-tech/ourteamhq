import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit,
  orderBy,
  startAt,
  endAt
} from 'firebase/firestore';
import { db } from '../config/firebase';

export const searchService = {
  async globalSearch(clubId, searchTerm) {
    if (!searchTerm || searchTerm.length < 2) return [];

    const results = [];
    const searchLower = searchTerm.toLowerCase();

    if (clubId) {
      try {
        // Search Members inside club
        const memberQuery = query(
          collection(db, 'clubs', clubId, 'members'),
          orderBy('firstName'),
          startAt(searchTerm),
          endAt(searchTerm + '\uf8ff'),
          limit(5)
        );
        const memberSnap = await getDocs(memberQuery);
        memberSnap.forEach(doc => {
          results.push({
            id: doc.id,
            type: 'member',
            title: `${doc.data().firstName || ''} ${doc.data().lastName || ''}`.trim() || 'Member',
            subtitle: doc.data().email || doc.data().role || 'Club Member',
            link: `/members`
          });
        });
      } catch (err) {
        console.warn('Member search error (fallback without ordering):', err);
        try {
          const memberSnap = await getDocs(collection(db, 'clubs', clubId, 'members'));
          memberSnap.docs.forEach(doc => {
            const data = doc.data();
            const fullName = `${data.firstName || ''} ${data.lastName || ''}`.toLowerCase();
            if (fullName.includes(searchLower) || (data.email && data.email.toLowerCase().includes(searchLower))) {
              results.push({
                id: doc.id,
                type: 'member',
                title: `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Member',
                subtitle: data.email || data.role || 'Club Member',
                link: `/members`
              });
            }
          });
        } catch (fallbackErr) {
          console.warn('Member fallback search error:', fallbackErr);
        }
      }

      try {
        // Search Teams inside club
        const teamQuery = query(
          collection(db, 'clubs', clubId, 'teams'),
          orderBy('name'),
          startAt(searchTerm),
          endAt(searchTerm + '\uf8ff'),
          limit(5)
        );
        const teamSnap = await getDocs(teamQuery);
        teamSnap.forEach(doc => {
          results.push({
            id: doc.id,
            type: 'team',
            title: doc.data().name || 'Team',
            subtitle: `${doc.data().category || 'No Category'}`,
            link: `/teams`
          });
        });
      } catch (err) {
        console.warn('Team search error (fallback without ordering):', err);
        try {
          const teamSnap = await getDocs(collection(db, 'clubs', clubId, 'teams'));
          teamSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.name && data.name.toLowerCase().includes(searchLower)) {
              results.push({
                id: doc.id,
                type: 'team',
                title: data.name,
                subtitle: `${data.category || 'No Category'}`,
                link: `/teams`
              });
            }
          });
        } catch (fallbackErr) {
          console.warn('Team fallback search error:', fallbackErr);
        }
      }
    }

    return results;
  }
};
