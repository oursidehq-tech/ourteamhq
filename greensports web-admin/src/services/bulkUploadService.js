import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export const bulkUploadService = {
  /**
   * Parse CSV content into an array of objects
   */
  parseCSV(text) {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const results = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index];
      });
      results.push(obj);
    }
    return results;
  },

  /**
   * Upload multiple members in a single batch
   */
  async bulkUploadMembers(clubId, members) {
    const batch = writeBatch(db);
    const membersRef = collection(db, 'members');

    members.forEach(member => {
      const newMemberRef = doc(membersRef);
      batch.set(newMemberRef, {
        ...member,
        clubId,
        status: 'Active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    return await batch.commit();
  }
};
