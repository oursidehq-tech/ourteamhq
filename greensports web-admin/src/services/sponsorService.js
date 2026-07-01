import { 
  collection, 
  query, 
  getDocs, 
  setDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  orderBy,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';

export const sponsorService = {
  async getSponsors(clubId) {
    if (!clubId) return [];
    try {
      const q = query(
        collection(db, 'clubs', clubId, 'sponsors'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.warn('Fallback: query sponsors without ordering', error);
      const q = collection(db, 'clubs', clubId, 'sponsors');
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  },

  async createSponsor(clubId, sponsorData) {
    const ref = doc(collection(db, 'clubs', clubId, 'sponsors'));
    await setDoc(ref, {
      ...sponsorData,
      clubId,
      impressions: 0,
      clicks: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return ref;
  },

  async updateSponsor(clubId, sponsorId, sponsorData) {
    const sponsorRef = doc(db, 'clubs', clubId, 'sponsors', sponsorId);
    return await updateDoc(sponsorRef, {
      ...sponsorData,
      updatedAt: serverTimestamp()
    });
  },

  async deleteSponsor(clubId, sponsorId) {
    return await deleteDoc(doc(db, 'clubs', clubId, 'sponsors', sponsorId));
  }
};
