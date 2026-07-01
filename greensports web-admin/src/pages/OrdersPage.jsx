import { useEffect, useState } from 'react';
import { collection, doc, getDocs, updateDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import Modal from '../components/Modal';
import { Search, Eye, CreditCard, Truck, MapPin, Mail, Phone, Calendar } from 'lucide-react';

export default function OrdersPage() {
  const { selectedClubId } = useClub();
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState(null);
  const [saving, setSaving] = useState(false);

  const col = () => collection(db, 'clubs', selectedClubId, 'orders');

  const fetch = async () => {
    if (!selectedClubId) return;
    try {
      const snap = await getDocs(query(col(), orderBy('createdAt', 'desc')));
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      const snap = await getDocs(col());
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
  };

  useEffect(() => { fetch(); }, [selectedClubId]);

  const filtered = orders.filter(o =>
    o.userName?.toLowerCase().includes(search.toLowerCase()) ||
    o.id?.toLowerCase().includes(search.toLowerCase()) ||
    o.status?.toLowerCase().includes(search.toLowerCase())
  );

  const handleStatusChange = async (order, newStatus) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'clubs', selectedClubId, 'orders', order.id), { status: newStatus, updatedAt: serverTimestamp() });
      await fetch();
      if (viewing?.id === order.id) setViewing({ ...viewing, status: newStatus });
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  const statusBadge = (s) => {
    const map = { pending: 'badge-warning', processing: 'badge-info', shipped: 'badge-info', delivered: 'badge-success', cancelled: 'badge-danger' };
    return map[s] || 'badge-default';
  };

  const paymentStatusBadge = (ps) => {
    if (ps === 'paid' || ps === 'completed') return 'badge-success';
    if (ps === 'pending' || ps === 'awaiting-payment') return 'badge-warning';
    if (ps === 'failed' || ps === 'cancelled') return 'badge-danger';
    return 'badge-default';
  };

  return (
    <div>
      <div className="page-header">
        <div><h1>Shop Orders</h1><p>Manage club sales and order fulfillment</p></div>
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <h3>{filtered.length} Order{filtered.length !== 1 ? 's' : ''}</h3>
          <div className="search-box"><Search size={16} /><input placeholder="Search orders by ID, customer or status…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        </div>
        <table>
          <thead><tr><th>Order ID</th><th>Customer</th><th>Items</th><th>Total</th><th>Order Status</th><th>Payment</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="table-empty">No orders found</td></tr>
            ) : filtered.map(o => (
              <tr key={o.id}>
                <td className="text-sm" style={{ fontFamily: 'monospace' }}>#{o.id.substring(0, 8)}</td>
                <td><strong>{o.userName || '—'}</strong></td>
                <td>{o.items?.length || 0} items</td>
                <td>${(o.total || 0).toFixed(2)}</td>
                <td><span className={`badge ${statusBadge(o.status)}`}>{o.status || 'pending'}</span></td>
                <td><span className={`badge ${paymentStatusBadge(o.paymentStatus)}`}>{o.paymentStatus || 'pending'}</span></td>
                <td className="text-sm text-muted">{o.createdAt?.toDate?.().toLocaleDateString() || '—'}</td>
                <td>
                  <button className="btn-icon" onClick={() => setViewing(o)} title="View Details"><Eye size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Order Summary" wide>
        {viewing && (
          <div className="order-details-modal">
            <div className="grid-2col mb-md">
              <div className="detail-card">
                <h5><CreditCard size={14} className="mr-xs" /> Order Info</h5>
                <p><strong>Order ID:</strong> <code style={{ fontSize: 11 }}>{viewing.id}</code></p>
                <p><strong>Date:</strong> {viewing.createdAt?.toDate?.().toLocaleString() || '—'}</p>
                <p><strong>Payment Status:</strong> <span className={`badge ${paymentStatusBadge(viewing.paymentStatus)}`}>{viewing.paymentStatus || 'pending'}</span></p>
                <p><strong>Gateway:</strong> {viewing.paymentMethod || 'In-App'}</p>
              </div>
              <div className="detail-card">
                <h5><Truck size={14} className="mr-xs" /> Fulfillment</h5>
                <p><strong>Fulfillment Status:</strong> <span className={`badge ${statusBadge(viewing.status)}`}>{viewing.status || 'pending'}</span></p>
                <div className="form-group mt-sm" style={{ margin: 0 }}>
                  <label>Update Order Status</label>
                  <select className="form-control" value={viewing.status || 'pending'} disabled={saving} onChange={e => handleStatusChange(viewing, e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid-2col mb-md">
              <div className="detail-card">
                <h5><MapPin size={14} className="mr-xs" /> Shipping & Contact</h5>
                <p><strong><Mail size={12} /> Email:</strong> {viewing.userEmail || viewing.email || '—'}</p>
                <p><strong><Phone size={12} /> Phone:</strong> {viewing.phone || '—'}</p>
                <p><strong>Shipping:</strong> {viewing.shippingAddress ? (
                  <span className="text-sm">{viewing.shippingAddress.line1}, {viewing.shippingAddress.city}</span>
                ) : 'Local Pickup / Standard'}</p>
              </div>
              <div className="detail-card">
                <h5>Summary</h5>
                <p><strong>Subtotal:</strong> ${(viewing.subtotal || viewing.total || 0).toFixed(2)}</p>
                <p><strong>Shipping:</strong> ${(viewing.shippingCost || 0).toFixed(2)}</p>
                <p style={{ fontSize: 18, fontWeight: 700, borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 8 }}>
                  Total: ${(viewing.total || 0).toFixed(2)}
                </p>
              </div>
            </div>

            <h5 className="mb-xs">Items ({viewing.items?.length || 0})</h5>
            <div className="table-container mini">
              <table>
                <thead><tr><th>Product Name</th><th>Category</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                <tbody>
                  {(viewing.items || []).map((item, i) => (
                    <tr key={i}>
                      <td><strong>{item.name || 'Unknown Item'}</strong></td>
                      <td>{item.category || '—'}</td>
                      <td>{item.quantity || 1}</td>
                      <td>${(item.price || 0).toFixed(2)}</td>
                      <td>${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
