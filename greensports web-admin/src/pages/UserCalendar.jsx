import { useState, useEffect, useMemo } from 'react';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft, ChevronRight, Calendar, MapPin, Clock, Check, X, HelpCircle, Trophy, Users, ListChecks } from 'lucide-react';
import Modal from '../components/Modal';

export default function UserCalendar() {
  const { selectedClubId, selectedClub } = useClub();
  const { user, profile } = useAuth();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All'); // 'All', 'Matches', 'Training', 'Shifts', 'Tasks'
  const [loading, setLoading] = useState(true);
  const [selectedEventDetails, setSelectedEventDetails] = useState(null);

  const fetchCalendarData = async () => {
    if (!selectedClubId) return;
    setLoading(true);
    try {
      const [eventsSnap, rostersSnap, tasksSnap] = await Promise.all([
        getDocs(collection(db, 'clubs', selectedClubId, 'events')),
        getDocs(collection(db, 'clubs', selectedClubId, 'rosters')),
        getDocs(collection(db, 'clubs', selectedClubId, 'tasks'))
      ]);

      setEvents(eventsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setRosters(rostersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTasks(tasksSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCalendarData();
  }, [selectedClubId]);

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = [];
  // Fill leading empty spaces
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  // Fill month days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date) => {
    if (!date) return false;
    return date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear();
  };

  // Convert Firebase Date / string into pure YYYY-MM-DD
  const formatLocalDateString = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  };

  // Aggregate items by date
  const getItemsForDate = (date) => {
    if (!date) return [];
    const dateStr = formatLocalDateString(date);

    const dayEvents = events.filter(e => e.date === dateStr).map(e => ({
      ...e,
      itemType: 'event',
      primaryType: e.type === 'match' || e.type === 'game' ? 'Match' : 'Event'
    }));

    const dayShifts = [];
    rosters.filter(r => r.date === dateStr).forEach(r => {
      (r.shifts || []).forEach(s => {
        dayShifts.push({
          ...s,
          itemType: 'shift',
          rosterId: r.id,
          rosterTitle: r.title,
          date: r.date
        });
      });
    });

    const dayTasks = tasks.filter(t => t.dueDate === dateStr).map(t => ({
      ...t,
      itemType: 'task'
    }));

    return [...dayEvents, ...dayShifts, ...dayTasks];
  };

  // Filtered lists of items based on chosen activeFilter
  const allFilteredItems = useMemo(() => {
    let list = [];
    events.forEach(e => {
      list.push({ ...e, itemType: 'event', primaryType: e.type === 'match' || e.type === 'game' ? 'Match' : 'Event' });
    });

    rosters.forEach(r => {
      (r.shifts || []).forEach(s => {
        list.push({ ...s, itemType: 'shift', rosterId: r.id, rosterTitle: r.title, date: r.date });
      });
    });

    tasks.forEach(t => {
      list.push({ ...t, itemType: 'task', date: t.dueDate });
    });

    return list.filter(item => {
      if (activeFilter === 'All') return true;
      if (activeFilter === 'Matches') return item.itemType === 'event' && (item.type === 'match' || item.type === 'game');
      if (activeFilter === 'Training') return item.itemType === 'event' && item.type === 'training';
      if (activeFilter === 'Shifts') return item.itemType === 'shift';
      if (activeFilter === 'Tasks') return item.itemType === 'task';
      return true;
    });
  }, [events, rosters, tasks, activeFilter]);

  // Items for the currently selected day
  const selectedDayItems = useMemo(() => {
    const items = getItemsForDate(selectedDate);
    return items.filter(item => {
      if (activeFilter === 'All') return true;
      if (activeFilter === 'Matches') return item.itemType === 'event' && (item.type === 'match' || item.type === 'game');
      if (activeFilter === 'Training') return item.itemType === 'event' && item.type === 'training';
      if (activeFilter === 'Shifts') return item.itemType === 'shift';
      if (activeFilter === 'Tasks') return item.itemType === 'task';
      return true;
    });
  }, [selectedDate, events, rosters, tasks, activeFilter]);

  // Handle RSVP
  const handleRSVP = async (eventId, status) => {
    if (!user) return;
    try {
      const eventRef = doc(db, 'clubs', selectedClubId, 'events', eventId);
      const targetEvent = events.find(e => e.id === eventId);
      if (!targetEvent) return;

      const updatedRsvp = { ...(targetEvent.rsvp || {}) };
      updatedRsvp[user.uid] = status;

      await updateDoc(eventRef, { rsvp: updatedRsvp });
      
      // Update local state
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, rsvp: updatedRsvp } : e));
      if (selectedEventDetails && selectedEventDetails.id === eventId) {
        setSelectedEventDetails(prev => ({ ...prev, rsvp: updatedRsvp }));
      }
    } catch (err) {
      alert('Failed to RSVP: ' + err.message);
    }
  };

  // Sign up for unfilled shift
  const handleShiftSignUp = async (shiftItem) => {
    if (!user) return;
    try {
      const rosterRef = doc(db, 'clubs', selectedClubId, 'rosters', shiftItem.rosterId);
      const rosterItem = rosters.find(r => r.id === shiftItem.rosterId);
      if (!rosterItem) return;

      const updatedShifts = rosterItem.shifts.map(s => {
        if (s.role === shiftItem.role && s.startTime === shiftItem.startTime && s.endTime === shiftItem.endTime) {
          return {
            ...s,
            filledBy: user.uid,
            filledByName: profile?.displayName || 'Club Member'
          };
        }
        return s;
      });

      await updateDoc(rosterRef, { shifts: updatedShifts });
      setRosters(prev => prev.map(r => r.id === shiftItem.rosterId ? { ...r, shifts: updatedShifts } : r));
    } catch (err) {
      alert('Failed to sign up: ' + err.message);
    }
  };

  // Resign from filled shift
  const handleShiftResign = async (shiftItem) => {
    if (!user) return;
    if (!window.confirm('Are you sure you want to opt-out of this shift?')) return;
    try {
      const rosterRef = doc(db, 'clubs', selectedClubId, 'rosters', shiftItem.rosterId);
      const rosterItem = rosters.find(r => r.id === shiftItem.rosterId);
      if (!rosterItem) return;

      const updatedShifts = rosterItem.shifts.map(s => {
        if (s.role === shiftItem.role && s.startTime === shiftItem.startTime && s.endTime === shiftItem.endTime) {
          return {
            ...s,
            filledBy: '',
            filledByName: ''
          };
        }
        return s;
      });

      await updateDoc(rosterRef, { shifts: updatedShifts });
      setRosters(prev => prev.map(r => r.id === shiftItem.rosterId ? { ...r, shifts: updatedShifts } : r));
    } catch (err) {
      alert('Failed to resign: ' + err.message);
    }
  };

  // Toggle checklist tasks completion
  const handleToggleTask = async (taskItem) => {
    try {
      const taskRef = doc(db, 'clubs', selectedClubId, 'tasks', taskItem.id);
      const newStatus = taskItem.status === 'completed' ? 'pending' : 'completed';
      await updateDoc(taskRef, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskItem.id ? { ...t, status: newStatus } : t));
    } catch (err) {
      alert('Failed to update task: ' + err.message);
    }
  };

  // Helper check if a date has any matching items in the filtered list
  const hasItem = (date, type) => {
    if (!date) return false;
    const items = getItemsForDate(date);
    if (type === 'all') return items.length > 0;
    return items.some(item => {
      if (type === 'match') return item.itemType === 'event' && (item.type === 'match' || item.type === 'game');
      if (type === 'training') return item.itemType === 'event' && item.type === 'training';
      if (type === 'shift') return item.itemType === 'shift';
      if (type === 'task') return item.itemType === 'task';
      return false;
    });
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1>Calendar & Duties</h1>
          <p className="subtitle">Track match schedules, training sessions, shifts, and checklists for {selectedClub?.name}</p>
        </div>
      </div>

      {/* Navigation Filter Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
        {['All', 'Matches', 'Training', 'Shifts', 'Tasks'].map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            style={{
              padding: '8px 16px',
              borderRadius: '12px',
              border: `1px solid ${activeFilter === filter ? 'var(--primary)' : 'var(--border)'}`,
              background: activeFilter === filter ? 'var(--primary)' : 'var(--card-bg, #ffffff)',
              color: activeFilter === filter ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: activeFilter === filter ? '0 4px 12px rgba(16, 139, 81, 0.15)' : 'none'
            }}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Grid: Left Calendar / Right Selected Day Agenda */}
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        
        {/* Left Card: Month Grid Calendar */}
        <div className="card shadow-sm" style={{ border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px', padding: '20px' }}>
          
          {/* Calendar Header Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '18px', color: 'var(--text)' }}>
              {monthNames[month]} {year}
            </h3>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={prevMonth} className="btn-icon" style={{ padding: '6px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={nextMonth} className="btn-icon" style={{ padding: '6px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontWeight: 700, fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
          </div>

          {/* Days Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
            {days.map((date, idx) => {
              if (!date) return <div key={`empty-${idx}`} style={{ height: '55px' }} />;
              const isSel = isSelected(date);
              const isTdy = isToday(date);
              const hasMatch = hasItem(date, 'match');
              const hasTrain = hasItem(date, 'training');
              const hasShift = hasItem(date, 'shift');
              const hasTask = hasItem(date, 'task');

              return (
                <button
                  key={`day-${idx}`}
                  onClick={() => setSelectedDate(date)}
                  style={{
                    height: '55px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px',
                    border: '1px solid',
                    borderColor: isSel ? 'var(--primary)' : 'var(--border-light, #f1f5f9)',
                    borderRadius: '12px',
                    background: isSel 
                      ? 'rgba(16, 185, 129, 0.08)' 
                      : (isTdy ? '#f1f5f9' : '#ffffff'),
                    color: isSel ? 'var(--primary)' : 'var(--text)',
                    fontWeight: isSel || isTdy ? 700 : 500,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                >
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: isTdy && !isSel ? 'var(--primary)' : 'none',
                    color: isTdy && !isSel ? '#ffffff' : 'inherit'
                  }}>
                    {date.getDate()}
                  </span>

                  {/* Indicator Dots */}
                  <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', width: '100%' }}>
                    {hasMatch && <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#f59e0b' }} title="Match" />}
                    {hasTrain && <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#3b82f6' }} title="Training" />}
                    {hasShift && <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#10b981' }} title="Shift" />}
                    {hasTask && <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#ef4444' }} title="Task" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend Banner */}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: '20px', paddingTop: '12px', display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '11px', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }} /> Matches
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6' }} /> Training
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} /> Duties/Shifts
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444' }} /> My Tasks
            </span>
          </div>

        </div>

        {/* Right Card: Day Agenda */}
        <div>
          <div className="card shadow-sm" style={{ border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px', padding: '20px', minHeight: '380px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 800, borderBottom: '1px solid var(--border)', paddingBottom: '10px', color: 'var(--text)' }}>
              Agenda for {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </h3>

            {loading ? (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>Loading items...</p>
            ) : selectedDayItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-lighter)' }}>
                <Calendar size={32} style={{ marginBottom: '12px' }} />
                <h4 style={{ margin: 0, color: 'var(--text)' }}>No activities scheduled</h4>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>Enjoy a free day or switch date/filters!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedDayItems.map((item, index) => {
                  
                  // 1. RENDER CLUB EVENTS & FIXTURES
                  if (item.itemType === 'event') {
                    const userRSVP = item.rsvp?.[user?.uid] || 'none';
                    return (
                      <div key={`item-${index}`} className="shadow-sm" style={{
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-light, #f1f5f9)',
                        background: '#f8fafc',
                        cursor: 'pointer'
                      }} onClick={() => setSelectedEventDetails(item)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: item.type === 'match' || item.type === 'game' ? '#fef3c7' : '#dbeafe',
                            color: item.type === 'match' || item.type === 'game' ? '#d97706' : '#2563eb',
                            textTransform: 'uppercase'
                          }}>
                            {item.primaryType}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} /> {item.time || 'TBA'}
                          </span>
                        </div>

                        <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{item.title}</h4>
                        {item.location && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                            <MapPin size={12} /> <span>{item.location}</span>
                          </div>
                        )}

                        {/* RSVP Action strip */}
                        <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--border-light, #f1f5f9)', paddingTop: '10px' }} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleRSVP(item.id, 'going')}
                            style={{
                              flex: 1,
                              padding: '6px',
                              borderRadius: '8px',
                              border: `1px solid ${userRSVP === 'going' ? '#10b981' : 'var(--border)'}`,
                              background: userRSVP === 'going' ? '#d1fae5' : '#ffffff',
                              color: userRSVP === 'going' ? '#065f46' : 'var(--text-secondary)',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                          >
                            <Check size={12} /> Going
                          </button>
                          <button
                            onClick={() => handleRSVP(item.id, 'maybe')}
                            style={{
                              flex: 1,
                              padding: '6px',
                              borderRadius: '8px',
                              border: `1px solid ${userRSVP === 'maybe' ? '#f59e0b' : 'var(--border)'}`,
                              background: userRSVP === 'maybe' ? '#fef3c7' : '#ffffff',
                              color: userRSVP === 'maybe' ? '#92400e' : 'var(--text-secondary)',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                          >
                            <HelpCircle size={12} /> Maybe
                          </button>
                          <button
                            onClick={() => handleRSVP(item.id, 'declined')}
                            style={{
                              flex: 1,
                              padding: '6px',
                              borderRadius: '8px',
                              border: `1px solid ${userRSVP === 'declined' ? '#ef4444' : 'var(--border)'}`,
                              background: userRSVP === 'declined' ? '#fee2e2' : '#ffffff',
                              color: userRSVP === 'declined' ? '#991b1b' : 'var(--text-secondary)',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                          >
                            <X size={12} /> Decline
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // 2. RENDER VOLUNTEER SHIFTS
                  if (item.itemType === 'shift') {
                    const isFilledByMe = item.filledBy === user?.uid;
                    const isUnfilled = !item.filledBy;
                    return (
                      <div key={`item-${index}`} style={{
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-light, #f1f5f9)',
                        background: isFilledByMe ? 'rgba(16, 185, 129, 0.04)' : '#f8fafc'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: '#d1fae5',
                            color: '#065f46',
                            textTransform: 'uppercase'
                          }}>
                            VOLUNTEER SHIFT
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} /> {item.startTime} - {item.endTime}
                          </span>
                        </div>

                        <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                          {item.role}
                        </h4>
                        <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          Event: {item.rosterTitle}
                        </p>

                        {isFilledByMe ? (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Check size={14} /> Assigned to You
                            </span>
                            <button
                              onClick={() => handleShiftResign(item)}
                              className="btn btn-outline"
                              style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px', border: '1px solid #ef4444', color: '#ef4444' }}
                            >
                              Opt Out
                            </button>
                          </div>
                        ) : isUnfilled ? (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                              Shift Unfilled
                            </span>
                            <button
                              onClick={() => handleShiftSignUp(item)}
                              className="btn btn-primary"
                              style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '6px' }}
                            >
                              Sign Up
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: 'var(--text-lighter)', fontStyle: 'italic' }}>
                            Assigned to {item.filledByName}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // 3. RENDER ASSIGNED CHECKLIST TASKS
                  if (item.itemType === 'task') {
                    const isCompleted = item.status === 'completed';
                    return (
                      <div key={`item-${index}`} style={{
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-light, #f1f5f9)',
                        background: '#f8fafc',
                        opacity: isCompleted ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px'
                      }}>
                        <button
                          onClick={() => handleToggleTask(item)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            marginTop: '2px',
                            padding: 0
                          }}
                        >
                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '6px',
                            border: `2px solid ${isCompleted ? 'var(--primary)' : 'var(--border)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isCompleted ? 'var(--primary)' : 'transparent',
                            color: '#ffffff'
                          }}>
                            {isCompleted && <Check size={14} strokeWidth={3} />}
                          </div>
                        </button>

                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: '#fee2e2',
                              color: '#991b1b',
                              textTransform: 'uppercase'
                            }}>
                              CHECKLIST TASK
                            </span>
                            {item.priority && (
                              <span style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: item.priority === 'high' ? '#fee2e2' : '#f1f5f9',
                                color: item.priority === 'high' ? '#b91c1c' : '#64748b',
                                fontWeight: 600
                              }}>
                                {item.priority}
                              </span>
                            )}
                          </div>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, textDecoration: isCompleted ? 'line-through' : 'none', color: 'var(--text)' }}>
                            {item.title}
                          </h4>
                          {item.description && <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>{item.description}</p>}
                        </div>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Event Details Modal */}
      <Modal open={!!selectedEventDetails} onClose={() => setSelectedEventDetails(null)} title={selectedEventDetails?.primaryType || 'Event Details'}>
        {selectedEventDetails && (
          <div style={{ padding: '4px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--text)' }}>
              {selectedEventDetails.title}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <Calendar size={16} color="var(--primary)" />
                <span>Date: {selectedEventDetails.date}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <Clock size={16} color="var(--primary)" />
                <span>Time: {selectedEventDetails.time || 'TBA'}</span>
              </div>
              {selectedEventDetails.location && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <MapPin size={16} color="var(--primary)" />
                  <span>Location: {selectedEventDetails.location}</span>
                </div>
              )}
            </div>

            {selectedEventDetails.description && (
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text)' }}>Description</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {selectedEventDetails.description}
                </p>
              </div>
            )}

            {/* List RSVPs inside Modal */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 10px 0', color: 'var(--text)' }}>
                Member Attendance Status
              </h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {Object.entries(selectedEventDetails.rsvp || {}).length === 0 ? (
                  <p style={{ fontStyle: 'italic', fontSize: '12px', color: 'var(--text-lighter)', margin: 0 }}>
                    No RSVPs submitted yet.
                  </p>
                ) : (
                  Object.entries(selectedEventDetails.rsvp || {}).map(([uid, status]) => (
                    <div key={uid} style={{
                      padding: '4px 10px',
                      borderRadius: '10px',
                      background: '#f8fafc',
                      border: '1px solid var(--border-light, #f1f5f9)',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: status === 'going' ? '#10b981' : (status === 'maybe' ? '#f59e0b' : '#ef4444')
                      }} />
                      <span>{status}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', marginTop: '20px', paddingTop: '16px' }}>
              <button className="btn btn-outline" onClick={() => setSelectedEventDetails(null)}>
                Close Details
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
