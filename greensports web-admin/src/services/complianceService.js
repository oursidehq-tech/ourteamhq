import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
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

  async getComplianceForms(clubId) {
    try {
      const formsRef = collection(db, 'clubs', clubId, 'complianceForms');
      try {
        const snap = await getDocs(query(formsRef, orderBy('createdAt', 'desc')));
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch {
        const snap = await getDocs(formsRef);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
    } catch (err) {
      console.error('Error fetching compliance forms:', err);
      return [];
    }
  },

  async createComplianceForm(clubId, data) {
    const formsRef = collection(db, 'clubs', clubId, 'complianceForms');
    return await addDoc(formsRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  async updateComplianceForm(clubId, formId, data) {
    const formRef = doc(db, 'clubs', clubId, 'complianceForms', formId);
    return await updateDoc(formRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Fetch compliance submissions belonging to a specific user.
   * Used by the member portal to show submitted / approved / expired status.
   */
  async getUserSubmissions(clubId, uid) {
    if (!clubId || !uid) return [];
    try {
      const subRef = collection(db, 'clubs', clubId, 'compliance');
      try {
        const snap = await getDocs(query(subRef, where('uid', '==', uid)));
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch {
        const snap = await getDocs(subRef);
        return snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(d => d.uid === uid);
      }
    } catch (err) {
      console.warn('Error fetching user submissions:', err);
      return [];
    }
  },

  /**
   * Helper to compute dynamic compliance status based on submission and expiry date.
   * Returns: 'Current' | 'Expiring soon' | 'Pending review' | 'Expired' | 'Rejected' | 'Missing'
   */
  calculateStatus(sub, req) {
    if (!sub) return 'Missing';
    const s = String(sub.status || '').toLowerCase();
    if (s === 'pending' || s === 'awaiting review' || s === 'pending review') return 'Pending review';
    if (s === 'rejected') return 'Rejected';

    const expStr = sub.expiryDate || sub.expiry;
    if (!expStr) return 'Current';

    const exp = new Date(expStr);
    if (isNaN(exp.getTime())) return 'Current';

    const now = new Date();
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Expired';
    if (diffDays <= 30) return 'Expiring soon';
    return 'Current';
  },

  /**
   * Submit a single compliance requirement document from the member portal.
   * Writes into clubs/{clubId}/compliance so it appears in the admin review queue.
   * Dispatches reviewer alert.
   */
  async submitComplianceDocument(clubId, data) {
    const subRef = collection(db, 'clubs', clubId, 'compliance');
    const docRef = await addDoc(subRef, {
      status: 'Pending',
      ...data,
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Dispatch reviewer notification in clubs/{clubId}/notifications
    try {
      const notifsCol = collection(db, 'clubs', clubId, 'notifications');
      await addDoc(notifsCol, {
        title: `Compliance submission: ${data.requirementName || data.name || 'Document'}`,
        message: `${data.userName || data.memberName || 'A member'} submitted ${data.requirementName || 'evidence'} for review.`,
        body: `${data.userName || data.memberName || 'A member'} submitted ${data.requirementName || 'evidence'} for review.`,
        recipientId: 'admin',
        category: 'compliance',
        clubId,
        read: false,
        type: 'compliance',
        meta: {
          submissionId: docRef.id,
          memberId: data.memberId || data.uid || null,
          requirementName: data.requirementName || data.name
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('Failed to dispatch compliance submission alert:', e);
    }

    return docRef;
  },

  async deleteComplianceForm(clubId, formId) {
    const formRef = doc(db, 'clubs', clubId, 'complianceForms', formId);
    return await deleteDoc(formRef);
  },

  async updateComplianceStatus(clubId, id, status, notes = '', itemData = {}) {
    // Try updating subcollection doc first
    try {
      const docRef = doc(db, 'clubs', clubId, 'compliance', id);
      await updateDoc(docRef, {
        status,
        reviewNotes: notes,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('Subcollection update fallback:', e);
      try {
        const rootDocRef = doc(db, COMPLIANCE_COLLECTION, id);
        await updateDoc(rootDocRef, {
          status,
          reviewNotes: notes,
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.error('Failed updating compliance status:', err);
      }
    }

    // Dispatch notification to user about status change
    try {
      const recipientId = itemData.uid || itemData.userId || itemData.memberId;
      if (recipientId) {
        const notifsCol = collection(db, 'clubs', clubId, 'notifications');
        const isApproved = status.toLowerCase() === 'approved';
        await addDoc(notifsCol, {
          title: isApproved 
            ? `${itemData.requirementName || 'Compliance'} approved`
            : `${itemData.requirementName || 'Compliance'} needs resubmission`,
          message: isApproved
            ? `Your ${itemData.requirementName || 'compliance check'} has been approved.`
            : (notes || `The uploaded document was rejected. Please submit a clearer copy.`),
          body: isApproved
            ? `Your ${itemData.requirementName || 'compliance check'} has been approved.`
            : (notes || `The uploaded document was rejected. Please submit a clearer copy.`),
          recipientId,
          category: 'compliance',
          clubId,
          read: false,
          type: 'compliance',
          meta: {
            submissionId: id,
            status,
            requirementName: itemData.requirementName
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.warn('Failed to notify member of compliance review:', err);
    }
  }
};
