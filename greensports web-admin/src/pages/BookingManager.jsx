import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, CheckCircle, XCircle, Plus, Filter } from 'lucide-react';
import { collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';

const BookingManager = () => {
  const { selectedClubId } = useClub();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [form, setForm] = useState({
    facility: 'Main Pitch',
    team: '',
    date: '',
    time: ''
  });

  const fetchBookings = async () => {
    if (!selectedClubId) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'clubs', selectedClubId, 'bookings'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      // Fallback if index doesn't exist
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

  useEffect(() => {
    fetchBookings();
  }, [selectedClubId]);

  const filteredBookings = bookings.filter(b => {
    const matchesSearch = (b.facility || '').toLowerCase().includes(search.toLowerCase()) ||
                          (b.team || '').toLowerCase().includes(search.toLowerCase());
    
    if (statusFilter === 'All') return matchesSearch;
    if (statusFilter === 'Upcoming') return matchesSearch && (b.date && new Date(b.date) >= new Date());
    if (statusFilter === 'Pending') return matchesSearch && b.status === 'Pending';
    return matchesSearch;
  });

  const handleStatusChange = async (id, status) => {
    try {
      await updateDoc(doc(db, 'clubs', selectedClubId, 'bookings', id), {
        status,
        updatedAt: serverTimestamp()
      });
      fetchBookings();
    } catch (error) {
      alert('Error updating status: ' + error.message);
    }
  };

  const handleSaveBooking = async (e) => {
    e.preventDefault();
    if (!selectedClubId) return alert('Please select a club');
    
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'clubs', selectedClubId, 'bookings'), {
        ...form,
        status: 'Pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowModal(false);
      setForm({ facility: 'Main Pitch', team: '', date: '', time: '' });
      fetchBookings();
    } catch (error) {
      alert('Error saving booking: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const columns = [
    { 
      header: 'Facility', 
      accessor: 'facility',
      render: (val) => (
        <div className="flex-center gap-sm">
          <MapPin size={16} className="text-muted" />
          <span style={{ fontWeight: 600 }}>{val}</span>
        </div>
      )
    },
    { header: 'Team', accessor: 'team' },
    { 
      header: 'Date & Time', 
      accessor: 'date',
      render: (val, row) => (
        <div>
          <div>{val}</div>
          <div className="text-muted text-sm">{row.time}</div>
        </div>
      )
    },
    { 
      header: 'Status', 
      accessor: 'status',
      render: (val) => {
        const variants = {
          'Confirmed': 'badge-success',
          'Pending': 'badge-warning',
          'Cancelled': 'badge-danger'
        };
        return <span className={`badge ${variants[val] || 'badge-default'}`}>{val}</span>;
      }
    }
  ];

  const actions = [
    { 
      label: 'Confirm', 
      icon: <CheckCircle size={16} />, 
      onClick: (row) => handleStatusChange(row.id, 'Confirmed') 
    },
    { 
      label: 'Cancel', 
      icon: <XCircle size={16} />, 
      variant: 'danger',
      onClick: (row) => handleStatusChange(row.id, 'Cancelled') 
    }
  ];

  const bookingsThisWeek = bookings.filter(b => b.date && new Date(b.date) >= new Date()).length;
  const pendingRequests = bookings.filter(b => b.status === 'Pending').length;

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1>Facility Booking</h1>
          <p>Manage training sessions, pitch allocations, and facility rentals.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={fetchBookings}>
            <Filter size={18} />
            <span>Refresh</span>
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
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
          style={{ cursor: 'pointer', border: statusFilter === 'All' ? '2px solid var(--primary)' : '1px solid var(--border)' }}
          onClick={() => setStatusFilter('All')}
        >
          <div className="sm-card-top">
            <div className="sm-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
              <Clock size={20} />
            </div>
          </div>
          <div className="sm-card-body">
            <h3>85%</h3>
            <p>Pitch Utilization</p>
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
        loading={loading}
        onSearch={(val) => setSearch(val)}
      />

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Booking">
        <form onSubmit={handleSaveBooking}>
          <div className="form-group">
            <label>Facility</label>
            <select className="form-control" value={form.facility} onChange={e => setForm({...form, facility: e.target.value})}>
              <option value="Main Pitch">Main Pitch</option>
              <option value="Small Sided Turf">Small Sided Turf</option>
              <option value="Indoor Hall">Indoor Hall</option>
              <option value="Gymnasium">Gymnasium</option>
            </select>
          </div>
          <div className="form-group">
            <label>Team / Group Name</label>
            <input className="form-control" placeholder="e.g. U14 Boys" required value={form.team} onChange={e => setForm({...form, team: e.target.value})} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input type="date" className="form-control" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Time Segment</label>
              <input type="text" className="form-control" placeholder="e.g. 18:00 - 19:30" required value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
            </div>
          </div>
          <div className="form-actions mt-md">
            <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default BookingManager;
