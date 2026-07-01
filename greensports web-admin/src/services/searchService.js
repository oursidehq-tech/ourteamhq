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

    // Search Members
    const memberQuery = query(
      collection(db, 'members'),
      where('clubId', '==', clubId),
      orderBy('firstName'),
      startAt(searchTerm),
      endAt(searchTerm + '\uf8ff'),
      limit(5)
    );

    // Search Teams
    const teamQuery = query(
      collection(db, 'teams'),
      where('clubId', '==', clubId),
      orderBy('name'),
      startAt(searchTerm),
      endAt(searchTerm + '\uf8ff'),
      limit(5)
    );

    const [memberSnap, teamSnap] = await Promise.all([
      getDocs(memberQuery),
      getDocs(teamQuery)
    ]);

    memberSnap.forEach(doc => {
      results.push({
        id: doc.id,
        type: 'member',
        title: `${doc.data().firstName} ${doc.data().lastName}`,
        subtitle: doc.data().email,
        link: `/members`
      });
    });

    teamSnap.forEach(doc => {
      results.push({
        id: doc.id,
        type: 'team',
        title: doc.data().name,
        subtitle: `${doc.data().category || 'No Category'}`,
        link: `/teams`
      });
    });

    return results;
  }
};
