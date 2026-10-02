import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  CheckCircle, 
  XCircle, 
  Plus, 
  Filter, 
  Edit2, 
  Trash2, 
  RefreshCw, 
  CheckSquare, 
  Users 
} from 'lucide-react';
import { 
  collection, 
  query, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';

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

const BookingManager = () => {
  const { selectedClubId } = useClub();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [teams, setTeams] = useState([]);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null); // null for new, object for edit
  const [isSaving, setIsSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  
  const [form, setForm] = useState({
    facility: 'Main Pitch',
    team: '',
    date: '',
    time: '',
    status: 'Confirmed',
    notes: ''
  });

  const fetchBookings = async () => {
    if (!selectedClubId) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'clubs', selectedClubId, 'bookings'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      try {
        const snap = await getDocs(collection(db, 'clubs', selectedClubId, 'bookings'));
        setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('Error fetching bookings:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchClubEntities = async () => {
    if (!selectedClubId) return;
    try {
      const [tSnap, gSnap] = await Promise.all([
        getDocs(collection(db, 'clubs', selectedClubId, 'teams')),
        getDocs(collection(db, 'clubs', selectedClubId, 'groups')),
      ]);
      setTeams(tSnap.docs.map(d => ({ id: d.id, name: d.data().name || d.id })));
      setGroups(gSnap.docs.map(d => ({ id: d.id, name: d.data().groupName || d.data().name || d.id })));
    } catch (e) {
      console.warn('Error fetching teams/groups for booking:', e);
    }
  };

  useEffect(() => {
    fetchBookings();
    fetchClubEntities();
  }, [selectedClubId]);

  const openNewBooking = () => {
    setEditingBooking(null);
    setForm({
      facility: 'Main Pitch',
      team: '',
      date: new Date().toISOString().split('T')[0],
      time: '09:00 - 10:30',
      status: 'Confirmed',
      notes: ''
    });
    setShowModal(true);
  };

  const openEditBooking = (booking) => {
    setEditingBooking(booking);
    setForm({
      facility: booking.facility || 'Main Pitch',
      team: booking.team || '',
      date: booking.date || '',
      time: booking.time || '',
      status: booking.status || 'Confirmed',
      notes: booking.notes || booking.purpose || ''
    });
    setShowModal(true);
  };

  // Toggling status with visible feedback
  const handleStatusToggle = async (row) => {
    let nextStatus = 'Confirmed';
    if (row.status === 'Pending') {
      nextStatus = 'Confirmed';
    } else if (row.status === 'Confirmed') {
      nextStatus = 'Completed';
    } else if (row.status === 'Completed') {
      nextStatus = 'Pending';
    } else {
      nextStatus = 'Confirmed';
    }

    try {
      await updateDoc(doc(db, 'clubs', selectedClubId, 'bookings', row.id), {
        status: nextStatus,
        updatedAt: serverTimestamp()
      });
      // Optimistic update
      setBookings(prev => prev.map(b => b.id === row.id ? { ...b, status: nextStatus } : b));
    } catch (error) {
      alert('Error updating status: ' + error.message);
    }
  };

  const handleDeleteBooking = async (id) => {
    if (!window.confirm('Are you sure you want to delete this booking?')) return;
    try {
      await deleteDoc(doc(db, 'clubs', selectedClubId, 'bookings', id));
      setBookings(prev => prev.filter(b => b.id !== id));
      if (editingBooking?.id === id) setShowModal(false);
    } catch (error) {
      alert('Error deleting booking: ' + error.message);
    }
  };

  const handleSaveBooking = async (e) => {
    e.preventDefault();
    if (!selectedClubId) return alert('Please select a club');
    if (!form.team.trim()) return alert('Team or purpose name is required');
    if (!form.date) return alert('Booking date is required');
    
    setIsSaving(true);
    try {
      const payload = {
        facility: form.facility,
        team: form.team.trim(),
        date: form.date,
        time: form.time.trim(),
        status: form.status || 'Confirmed',
        notes: form.notes || '',
        updatedAt: serverTimestamp()
      };

      if (editingBooking) {
        await updateDoc(doc(db, 'clubs', selectedClubId, 'bookings', editingBooking.id), payload);
        alert('Booking updated successfully!');
      } else {
        await addDoc(collection(db, 'clubs', selectedClubId, 'bookings'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        alert('Booking created successfully!');
      }

      setShowModal(false);
      setEditingBooking(null);
      fetchBookings();
    } catch (error) {
      alert('Error saving booking: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredBookings = bookings.filter(b => {
    const matchesSearch = (b.facility || '').toLowerCase().includes(search.toLowerCase()) ||
                          (b.team || '').toLowerCase().includes(search.toLowerCase()) ||
                          (b.notes || '').toLowerCase().includes(search.toLowerCase());
    
    if (statusFilter === 'All') return matchesSearch;
    if (statusFilter === 'Upcoming') return matchesSearch && (b.date && new Date(b.date) >= new Date());
    if (statusFilter === 'Pending') return matchesSearch && b.status === 'Pending';
    if (statusFilter === 'Confirmed') return matchesSearch && b.status === 'Confirmed';
    if (statusFilter === 'Completed') return matchesSearch && b.status === 'Completed';
    return matchesSearch;
  });

  const columns = [
    { 
      header: 'Facility', 
      accessor: 'facility',
      render: (val) => (
        <div className="flex-center gap-sm">
          <MapPin size={16} className="text-primary" />
          <span style={{ fontWeight: 600 }}>{val}</span>
        </div>
      )
    },
    { 
      header: 'Team / Allocation', 
      accessor: 'team',
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{val}</div>
          {row.notes && <div className="text-xs text-muted">{row.notes}</div>}
        </div>
      )
    },
    { 
      header: 'Date & Time', 
      accessor: 'date',
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{val}</div>
          <div className="text-muted text-sm">{row.time || 'All Day'}</div>
        </div>
      )
    },
    { 
      header: 'Status', 
      accessor: 'status',
      render: (val, row) => {
        const variants = {
          'Confirmed': 'badge-success',
          'Pending': 'badge-warning',
          'Completed': 'badge-info',
          'Cancelled': 'badge-danger'
        };
        return (
          <span 
            className={`badge ${variants[val] || 'badge-default'}`} 
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              handleStatusToggle(row);
            }}
            title="Click to cycle status"
          >
            {val || 'Confirmed'}
          </span>
        );
      }
    }
  ];

  const actions = [
    { 
      label: 'Toggle / Advance Status', 
      icon: <CheckCircle size={16} />, 
      onClick: (row) => handleStatusToggle(row) 
    },
    { 
      label: 'Edit Booking', 
      icon: <Edit2 size={16} />, 
      onClick: (row) => openEditBooking(row) 
    },
    { 
      label: 'Delete Booking', 
      icon: <Trash2 size={16} />, 
      variant: 'danger',
      onClick: (row) => handleDeleteBooking(row.id) 
    }
  ];

  const bookingsThisWeek = bookings.filter(b => b.date && new Date(b.date) >= new Date()).length;
  const pendingRequests = bookings.filter(b => b.status === 'Pending').length;
  const confirmedBookings = bookings.filter(b => b.status === 'Confirmed').length;

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1>Facility Booking</h1>
          <p>Manage training sessions, pitch allocations, and facility rentals.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={fetchBookings}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button className="btn btn-primary" onClick={openNewBooking}>
            <Plus size={18} />
            <span>New Booking</span>
          </button>
        </div>
      </div>

      <div className="stats-marquee">
        <div 
          className="stats-marquee-card" 
          style={{ cursor: 'pointer', border: statusFilter === 'Upcoming' ? '2px solid var(--primary)' : '1px solid var(--border)' }}
          onClick={() => setStatusFilter(statusFilter === 'Upcoming' ? 'All' : 'Upcoming')}
        >
          <div className="sm-card-top">
            <div className="sm-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}>
              <Calendar size={20} />
            </div>
          </div>
          <div className="sm-card-body">
            <h3>{bookingsThisWeek}</h3>
            <p>Upcoming Bookings</p>
          </div>
        </div>

        <div 
          className="stats-marquee-card"
          style={{ cursor: 'pointer', border: statusFilter === 'Confirmed' ? '2px solid var(--primary)' : '1px solid var(--border)' }}
          onClick={() => setStatusFilter(statusFilter === 'Confirmed' ? 'All' : 'Confirmed')}
        >
          <div className="sm-card-top">
            <div className="sm-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
              <CheckCircle size={20} />
            </div>
          </div>
          <div className="sm-card-body">
            <h3>{confirmedBookings}</h3>
            <p>Confirmed Slots</p>
          </div>
        </div>

        <div 
          className="stats-marquee-card"
          style={{ cursor: 'pointer', border: statusFilter === 'Pending' ? '2px solid var(--primary)' : '1px solid var(--border)' }}
          onClick={() => setStatusFilter(statusFilter === 'Pending' ? 'All' : 'Pending')}
        >
          <div className="sm-card-top">
            <div className="sm-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>
              <Filter size={20} />
            </div>
          </div>
          <div className="sm-card-body">
            <h3>{pendingRequests}</h3>
            <p>Pending Requests</p>
          </div>
        </div>
      </div>

      <DataTable 
        title="Recent Bookings"
        columns={columns}
        data={filteredBookings}
        actions={actions}
        onRowClick={(row) => openEditBooking(row)}
        loading={loading}
        onSearch={(val) => setSearch(val)}
        emptyMessage="No bookings found for the current selection."
      />

      {/* Add / Edit Booking Modal */}
      <Modal 
        open={showModal} 
        onClose={() => setShowModal(false)} 
        title={editingBooking ? "Edit Facility Booking" : "New Facility Booking"}
      >
        <form onSubmit={handleSaveBooking}>
          <div className="form-group">
            <label>Facility <span className="text-danger">*</span></label>
            <select 
              className="form-control" 
              value={form.facility} 
              onChange={e => setForm({ ...form, facility: e.target.value })}
            >
              {FACILITIES.map(fac => (
                <option key={fac} value={fac}>{fac}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Team / Group / Event Name <span className="text-danger">*</span></label>
            <div style={{ position: 'relative' }}>
              <input 
                className="form-control" 
                placeholder="e.g. U14 Boys, Field Renovation Day 2, Senior Men" 
                required 
                value={form.team} 
                onChange={e => setForm({ ...form, team: e.target.value })} 
                list="team-suggestions"
              />
              <datalist id="team-suggestions">
                {teams.map(t => <option key={t.id} value={t.name} />)}
                {groups.map(g => <option key={g.id} value={g.name} />)}
                <option value="Field Renovation" />
                <option value="Match Day Setup" />
                <option value="Club Training Clinic" />
              </datalist>
            </div>
            {teams.length > 0 && (
              <div className="flex gap-xs mt-xs" style={{ flexWrap: 'wrap' }}>
                <span className="text-xs text-muted" style={{ alignSelf: 'center' }}>Quick pick:</span>
                {teams.slice(0, 3).map(t => (
                  <button 
                    key={t.id} 
                    type="button" 
                    className="btn btn-outline" 
                    style={{ padding: '2px 8px', fontSize: '11px' }}
                    onClick={() => setForm({ ...form, team: t.name })}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date <span className="text-danger">*</span></label>
              <input 
                type="date" 
                className="form-control" 
                required 
                value={form.date} 
                onChange={e => setForm({ ...form, date: e.target.value })} 
              />
            </div>
            <div className="form-group">
              <label>Time Segment <span className="text-danger">*</span></label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="e.g. 09:00 - 15:00 or 18:00 - 19:30" 
                required 
                value={form.time} 
                onChange={e => setForm({ ...form, time: e.target.value })} 
              />
            </div>
          </div>

          <div className="form-group">
            <label>Status</label>
            <select 
              className="form-control"
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}
            >
              <option value="Confirmed">Confirmed</option>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="form-group">
            <label>Notes / Purpose (Optional)</label>
            <textarea 
              rows={2}
              className="form-control" 
              placeholder="e.g. Pitch aeration, goalpost maintenance, special event..." 
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="form-actions mt-md" style={{ display: 'flex', justifyContent: 'space-between' }}>
            {editingBooking ? (
              <button 
                type="button" 
                className="btn btn-outline danger" 
                onClick={() => handleDeleteBooking(editingBooking.id)}
              >
                <Trash2 size={16} /> Delete
              </button>
            ) : <div />}

            <div className="flex gap-sm">
              <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Saving...' : editingBooking ? 'Save Changes' : 'Submit Booking'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default BookingManager;
