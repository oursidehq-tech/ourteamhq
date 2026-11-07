import { useEffect, useState, useMemo } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, doc, serverTimestamp, orderBy, query
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { Calendar, Clock, MapPin, Plus, RefreshCw, CheckCircle, XCircle, Search } from 'lucide-react';

const FACILITIES = [
  'Main Pitch',
  'Field Renovation',
  'Small Sided Turf',
  'Indoor Hall',
  'Gymnasium',
  'Pitch 2 (Training Ground)',
  'Pitch 3 (Junior Field)',
  'Clubhouse Function Room'
];

const STATUS_META = {
  Confirmed: { badge: 'badge-success', color: '#10b981' },
  Pending: { badge: 'badge-warning', color: '#f59e0b' },
  Cancelled: { badge: 'badge-danger', color: '#ef4444' },
  Rejected: { badge: 'badge-danger', color: '#ef4444' },
};

/**
 * Member-facing bookings.
 * Members can request a facility booking; their own requests are listed with status.
 */
export default function UserBookings() {
  const { selectedClubId, selectedClub } = useClub();
  const { user, profile } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    facility: FACILITIES[0],
    purpose: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00 - 10:30',
    notes: ''
  });

  const fetchBookings = async () => {
    if (!selectedClubId) { setLoading(false); return; }
    setLoading(true);
    try {
      const col = collection(db, 'clubs', selectedClubId, 'bookings');
      let snap;
      try {
        snap = await getDocs(query(col, orderBy('createdAt', 'desc')));
      } catch {
        snap = await getDocs(col);
      }
      setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, [selectedClubId]);

  // Only my bookings (matched by requester uid or name)
  const myBookings = useMemo(() => {
    const me = (profile?.displayName || '').trim().toLowerCase();
    return bookings.filter(b =>
      b.requestedByUid === user?.uid ||
      (b.requestedByName && b.requestedByName.trim().toLowerCase() === me) ||
      (b.team && me && b.team.trim().toLowerCase() === me)
    );
  }, [bookings, user, profile]);

  const filtered = myBookings.filter(b =>
    b.facility?.toLowerCase().includes(search.toLowerCase()) ||
    b.purpose?.toLowerCase().includes(search.toLowerCase()) ||
    b.team?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!form.purpose.trim()) return alert('Please enter a purpose or team name.');
    if (!form.date) return alert('Please choose a date.');
    setSaving(true);
    try {
      await addDoc(collection(db, 'clubs', selectedClubId, 'bookings'), {
        facility: form.facility,
        purpose: form.purpose.trim(),
        team: form.purpose.trim(), // keep admin 'team' field populated for parity
        date: form.date,
        time: form.time.trim(),
        notes: form.notes || '',
        status: 'Pending', // member requests await admin confirmation
        requestedByUid: user?.uid || '',
        requestedByName: profile?.displayName || user?.email || 'Club Member',
        requestedByEmail: user?.email || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowModal(false);
      setForm({
        facility: FACILITIES[0],
        purpose: '',
        date: new Date().toISOString().split('T')[0],
        time: '09:00 - 10:30',
        notes: ''
      });
      await fetchBookings();
    } catch (err) {
      alert('Failed to submit booking: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const cancelBooking = async (b) => {
    if (!window.confirm('Cancel this booking request?')) return;
    try {
      await updateDoc(doc(db, 'clubs', selectedClubId, 'bookings', b.id), {
        status: 'Cancelled',
        updatedAt: serverTimestamp()
      });
      await fetchBookings();
    } catch (err) {
      alert('Failed to cancel: ' + err.message);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h1>Bookings</h1>
          <p className="subtitle">Request and track facility bookings at {selectedClub?.name}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={fetchBookings}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> <span>Refresh</span>
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> <span>New Booking</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="search-box" style={{ marginBottom: '18px', background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '8px', height: '44px' }}>
        <Search size={16} color="var(--text-secondary)" />
        <input
          placeholder="Search my bookings..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ border: 'none', outline: 'none', flex: 1, fontSize: '14px', background: 'transparent' }}
        />
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>Loading bookings...</p>
      ) : filtered.length === 0 ? (
        <div className="card shadow-sm" style={{ padding: '60px 20px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: '16px', background: '#fff' }}>
          <Calendar size={36} color="var(--text-lighter)" style={{ marginBottom: '10px' }} />
          <h4 style={{ margin: 0, color: 'var(--text)' }}>No bookings yet</h4>
          <p className="text-muted" style={{ marginTop: '4px', fontSize: '13px' }}>Click "New Booking" to request a facility.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
          {filtered.map(b => {
            const meta = STATUS_META[b.status] || STATUS_META.Pending;
            return (
              <div key={b.id} className="card shadow-sm" style={{ border: '1px solid var(--border)', borderRadius: '14px', background: '#fff', padding: '16px', borderLeft: `4px solid ${meta.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className={`badge ${meta.badge}`}>{b.status || 'Pending'}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} /> {b.date}
                  </span>
                </div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 700 }}>{b.facility}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={13} /> {b.purpose || b.team || '—'}</span>
                  {b.time && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={13} /> {b.time}</span>}
                  {b.notes && <span style={{ fontStyle: 'italic', color: 'var(--text-lighter)' }}>{b.notes}</span>}
                </div>
                {(b.status === 'Pending' || b.status === 'Confirmed') && (
                  <button className="btn btn-outline" style={{ marginTop: '12px', width: '100%', borderColor: '#ef4444', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={() => cancelBooking(b)}>
                    <XCircle size={14} /> Cancel Request
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New booking modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Request a Facility Booking">
        <div>
          <div className="form-group">
            <label>Facility</label>
            <select className="form-control" value={form.facility} onChange={e => setForm({ ...form, facility: e.target.value })}>
              {FACILITIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Purpose / Team <span className="text-danger">*</span></label>
            <input className="form-control" placeholder="e.g. U12 Training" value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label>Date <span className="text-danger">*</span></label>
              <input type="date" className="form-control" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Time</label>
              <input className="form-control" placeholder="09:00 - 10:30" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea className="form-control" rows={2} placeholder="Any additional details..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="form-actions">
            <button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
