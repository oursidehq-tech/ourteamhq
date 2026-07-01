import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../config/firebase';

const ORDERS_SUB_COLLECTION = 'orders';

export const financeService = {
  async getTransactions(clubId, limitCount = 50) {
    const q = query(
      collection(db, 'clubs', clubId, ORDERS_SUB_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ 
      id: doc.id, 
      member: doc.data().userName || doc.data().userEmail || 'Guest',
      amount: doc.data().total || 0,
      status: doc.data().status || 'Pending',
      type: 'Order',
      ...doc.data() 
    }));
  },

  async getRevenueStats(clubId) {
    const q = query(
      collection(db, 'clubs', clubId, ORDERS_SUB_COLLECTION)
    );
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => doc.data());
    
    // Filter for paid orders (matching common statuses in rules)
    const paidOrders = orders.filter(o => 
      ['paid', 'Paid', 'succeeded', 'Succeeded'].includes(o.paymentStatus || o.status)
    );
    
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    const mtdRevenue = totalRevenue; // Simplified
    
    return {
      totalRevenue,
      mtdRevenue,
      pendingCollections: orders.filter(o => o.status === 'pending').length * 50, // Simulated estimate
      stripePayouts: totalRevenue * 0.97
    };
  }
};
