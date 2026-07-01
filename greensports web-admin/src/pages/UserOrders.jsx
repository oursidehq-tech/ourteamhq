import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import { PackageCheck, Search, Eye, CreditCard, Truck, MapPin, Calendar, ShoppingBag, Check } from 'lucide-react';
import Modal from '../components/Modal';

export default function UserOrders() {
  const { selectedClubId, selectedClub } = useClub();
  const { user } = useAuth();
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchOrders = async () => {
    if (!selectedClubId) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'clubs', selectedClubId, 'orders'), orderBy('createdAt', 'desc')));
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching orders:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [selectedClubId]);

  // Filter orders made by the logged-in user in this club
  const myOrders = useMemo(() => {
    return orders.filter(o => {
      const isUidMatch = o.userId === user?.uid;
      const isEmailMatch = String(o.userEmail || '').trim().toLowerCase() === String(user?.email || '').trim().toLowerCase();
      return isUidMatch || isEmailMatch;
    });
  }, [orders, user]);

  const filteredOrders = useMemo(() => {
    return myOrders.filter(o => 
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.status?.toLowerCase().includes(search.toLowerCase())
    );
  }, [myOrders, search]);

  const statusColor = (s) => {
    const map = { pending: '#f59e0b', processing: '#3b82f6', shipped: '#10b981', delivered: '#10b981', cancelled: '#ef4444' };
    return map[s] || '#64748b';
  };

  const statusLabel = (s) => {
    const map = { pending: 'Pending', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };
    return map[s] || s || 'Pending';
  };

  const paymentStatusBadge = (ps) => {
    if (ps === 'paid' || ps === 'completed') return 'badge-success';
    if (ps === 'pending' || ps === 'awaiting-payment') return 'badge-warning';
    if (ps === 'failed' || ps === 'cancelled') return 'badge-danger';
    return 'badge-default';
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1>My Purchase Orders</h1>
          <p className="subtitle">Track your merchandise orders, custom sizing selections, and delivery status with {selectedClub?.name}</p>
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>Loading purchase history...</p>
      ) : myOrders.length === 0 ? (
        <div className="card text-center" style={{ padding: '60px 20px', border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px' }}>
          <ShoppingBag size={40} style={{ color: 'var(--text-lighter)', marginBottom: '16px' }} />
          <h3 style={{ margin: 0, color: 'var(--text)' }}>No Orders Placed</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px', maxWidth: '350px', marginInline: 'auto' }}>
            You haven't ordered any merchandise from the club shop yet. Check out the Club Store to find premium custom team apparel!
          </p>
        </div>
      ) : (
        <div className="table-container">
          <div className="table-toolbar" style={{ borderBottom: '1px solid var(--border-light, #f1f5f9)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 800 }}>Order History ({filteredOrders.length})</h3>
            <div className="search-box">
              <Search size={16} />
              <input 
                placeholder="Search by order reference or status..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: '600px', borderCollapse: 'collapse', border: 'none', background: 'transparent' }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr style={{ borderBottom: '1px solid var(--border-light, #f1f5f9)' }}>
                  <th style={{ padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'left' }}>Order Reference</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'left' }}>Items</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'left' }}>Amount Paid</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'left' }}>Fulfillment</th>
                  <th style={{ padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'left' }}>Payment</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }} />
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--border-light, #f1f5f9)', transition: 'background-color 0.2s' }}>
                    <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text)' }}>
                      #{order.id.substring(0, 8).toUpperCase()}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {order.createdAt?.toDate?.().toLocaleDateString() || new Date(order.createdAt).toLocaleDateString() || '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {order.items?.length || 0} unit{order.items?.length !== 1 ? 's' : ''}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                      ${(order.total || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 700,
                        fontSize: '11px',
                        color: statusColor(order.status)
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusColor(order.status) }} />
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '11px' }}>
                      <span className={`badge ${paymentStatusBadge(order.paymentStatus)}`}>
                        {order.paymentStatus || 'paid'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <button className="btn-icon" onClick={() => setSelectedOrder(order)} title="Receipt Details">
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Receipt details modal */}
      <Modal open={!!selectedOrder} onClose={() => setSelectedOrder(null)} title="Purchase Invoice Summary" wide>
        {selectedOrder && (
          <div style={{ padding: '4px' }}>
            
            {/* Status Tracking Bar */}
            <div style={{ background: '#f8fafc', border: '1px solid var(--border-light, #f1f5f9)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                Fulfillment Tracker
              </h4>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', padding: '0 10px' }}>
                {/* Horizontal progress background line */}
                <div style={{ position: 'absolute', top: '15px', left: '20px', right: '20px', height: '3px', background: 'var(--border)', zIndex: 0 }} />
                
                {['pending', 'processing', 'shipped', 'delivered'].map((step, idx) => {
                  const states = ['pending', 'processing', 'shipped', 'delivered'];
                  const currentIdx = states.indexOf(selectedOrder.status || 'pending');
                  const isDone = states.indexOf(step) <= currentIdx && selectedOrder.status !== 'cancelled';
                  const isCurrent = step === selectedOrder.status;

                  return (
                    <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, position: 'relative' }}>
                      <div style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        background: isDone ? 'var(--primary)' : '#ffffff',
                        border: `2px solid ${isDone ? 'var(--primary)' : 'var(--border)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isDone ? '#ffffff' : 'var(--text-lighter)',
                        fontWeight: 700,
                        fontSize: '12px',
                        boxShadow: isCurrent ? '0 0 0 4px rgba(16, 185, 129, 0.2)' : 'none'
                      }}>
                        {isDone ? <Check size={14} strokeWidth={3} /> : idx + 1}
                      </div>
                      <span style={{ fontSize: '11px', marginTop: '6px', fontWeight: isDone ? 700 : 500, color: isDone ? 'var(--text)' : 'var(--text-lighter)', textTransform: 'capitalize' }}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              
              {/* Box 1: Order Details */}
              <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light, #f1f5f9)', background: '#ffffff' }}>
                <h5 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={14} color="var(--primary)" /> Billing Context
                </h5>
                <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <strong>Invoice Ref:</strong> <code style={{ fontSize: '11px' }}>{selectedOrder.id}</code>
                </p>
                <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <strong>Created:</strong> {selectedOrder.createdAt?.toDate?.().toLocaleString() || new Date(selectedOrder.createdAt).toLocaleString() || '—'}
                </p>
                <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <strong>Payment Method:</strong> Stripe Sandbox Gateway (Mockup)
                </p>
              </div>

              {/* Box 2: Fulfillment Details */}
              <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light, #f1f5f9)', background: '#ffffff' }}>
                <h5 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Truck size={14} color="var(--primary)" /> Shipping & Delivery
                </h5>
                <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <strong>Customer:</strong> {selectedOrder.userName}
                </p>
                <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <strong>Email:</strong> {selectedOrder.userEmail}
                </p>
                <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <strong>Destination:</strong> {selectedOrder.shippingAddress ? (
                    <span>{selectedOrder.shippingAddress.line1}, {selectedOrder.shippingAddress.city}</span>
                  ) : 'Local Club Shop Pickup'}
                </p>
              </div>

            </div>

            {/* Items Table */}
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 800, color: 'var(--text)' }}>
              Item Details ({selectedOrder.items?.length || 0})
            </h4>

            <div style={{ border: '1px solid var(--border-light, #f1f5f9)', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
              <table style={{ margin: 0, border: 'none', background: 'transparent' }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th style={{ padding: '10px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Item</th>
                    <th style={{ padding: '10px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Size Variant</th>
                    <th style={{ padding: '10px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '10px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'right' }}>Unit Price</th>
                    <th style={{ padding: '10px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedOrder.items || []).map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-light, #f1f5f9)' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                        {item.name}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span className="badge badge-default" style={{ fontSize: '10px', padding: '1px 6px' }}>{item.size || 'Standard'}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text)', textAlign: 'center' }}>
                        {item.quantity || 1}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                        ${(item.price || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: 'var(--text)', textAlign: 'right' }}>
                        ${((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Order Totals Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', gap: '40px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>Subtotal:</span>
                <span style={{ fontWeight: 600 }}>${(selectedOrder.subtotal || selectedOrder.total || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', gap: '40px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>Sales Tax (Mock):</span>
                <span style={{ fontWeight: 600 }}>$0.00</span>
              </div>
              <div style={{ display: 'flex', gap: '40px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>Standard Shipping:</span>
                <span style={{ fontWeight: 600 }}>$0.00</span>
              </div>
              <div style={{ display: 'flex', gap: '40px', fontSize: '16px', fontWeight: 800, color: 'var(--text)', borderTop: '1px solid var(--border-light, #f1f5f9)', paddingTop: '6px', marginTop: '4px' }}>
                <span>Grand Total:</span>
                <span>${(selectedOrder.total || 0).toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', marginTop: '20px', paddingTop: '16px' }}>
              <button className="btn btn-outline" onClick={() => setSelectedOrder(null)}>
                Close Invoice
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
