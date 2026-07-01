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
    const q = query(
      collection(db, COMPLIANCE_COLLECTION),
      where('clubId', '==', clubId),
      orderBy('submittedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async updateComplianceStatus(id, status, notes = '') {
    const docRef = doc(db, COMPLIANCE_COLLECTION, id);
    return await updateDoc(docRef, {
      status,
      reviewNotes: notes,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
};
