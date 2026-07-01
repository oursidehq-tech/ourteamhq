import { collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export const trainingService = {
  getDrills: async (clubId) => {
    const q = query(
      collection(db, 'clubs', clubId, 'drills'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  addContent: async (clubId, data) => {
    return await addDoc(collection(db, 'clubs', clubId, 'drills'), {
      ...data,
      clubId,
      views: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  },

  updateContent: async (clubId, id, data) => {
    const ref = doc(db, 'clubs', clubId, 'drills', id);
    return await updateDoc(ref, {
      ...data,
      updatedAt: serverTimestamp()
    });
  },

  deleteContent: async (clubId, id) => {
    return await deleteDoc(doc(db, 'clubs', clubId, 'drills', id));
  }
};
