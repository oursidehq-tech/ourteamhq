import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';

const COMPLIANCE_COLLECTION = 'compliance';

export const complianceService = {
  async getStaffCompliance(clubId) {
    let items = [];

    // 1. Try fetching from clubs/{clubId}/compliance
    try {
      const subRef = collection(db, 'clubs', clubId, 'compliance');
      const snap = await getDocs(query(subRef, orderBy('submittedAt', 'desc')));
      items = items.concat(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch {
      try {
        const subRef = collection(db, 'clubs', clubId, 'compliance');
        const snap = await getDocs(subRef);
        items = items.concat(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.warn('Subcollection compliance query skipped:', err);
      }
    }

    // 2. Try fetching from clubs/{clubId}/teamCompliance
    try {
      const tcRef = collection(db, 'clubs', clubId, 'teamCompliance');
      const snap = await getDocs(tcRef);
      const tcDocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Avoid duplicate IDs
      tcDocs.forEach(d => {
        if (!items.find(x => x.id === d.id)) items.push(d);
      });
    } catch (err) {
      console.warn('Team compliance query skipped:', err);
    }

    // 3. Try fetching from root compliance collection
    try {
      const q = query(
        collection(db, COMPLIANCE_COLLECTION),
        where('clubId', '==', clubId)
      );
      const snapshot = await getDocs(q);
      const rootDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      rootDocs.forEach(d => {
        if (!items.find(x => x.id === d.id)) items.push(d);
      });
    } catch (err) {
      console.warn('Root compliance query skipped:', err);
    }

    return items;
  },

  async updateComplianceStatus(clubId, id, status, notes = '') {
    // Try updating subcollection doc first
    try {
      const docRef = doc(db, 'clubs', clubId, 'compliance', id);
      await updateDoc(docRef, {
        status,
        reviewNotes: notes,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return;
    } catch (e) {
      console.warn('Subcollection update fallback:', e);
    }

    // Fallback to root doc
    try {
      const docRef = doc(db, COMPLIANCE_COLLECTION, id);
      await updateDoc(docRef, {
        status,
        reviewNotes: notes,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error('Failed updating compliance status:', e);
    }
  }
};
