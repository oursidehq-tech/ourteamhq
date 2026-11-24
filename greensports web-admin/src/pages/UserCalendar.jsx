import { useState, useEffect, useMemo } from 'react';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft, ChevronRight, Calendar, MapPin, Clock, Check, X, HelpCircle, Repeat, Info, CheckCircle2 } from 'lucide-react';
import Modal from '../components/Modal';
import {
  buildOccurrenceDates,
  describeRecurrence,
  hasRecurrence,
  todayIsoDate,
  toIsoDateLocal,
  parseIsoDate,
} from '../utils/recurrence';

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

  // Main Subtabs matching Image 9 & 10: 'calendar' | 'tasks'
  const [mainTab, setMainTab] = useState('tasks');
  const [viewEventModal, setViewEventModal] = useState(false);
  const [eventTasksList, setEventTasksList] = useState([
    {
      id: 'evt-task-1',
      title: 'Prepare player packs',
      source: 'Assigned via U17 Nev Blair team',
      status: 'not_started',
      completedBy: null
    },
    {
      id: 'evt-task-2',
      title: 'Organise volunteers',
      source: 'Assigned via U13 Managers group',
      status: 'in_progress',
      completedBy: null
    },
    {
      id: 'evt-task-3',
      title: 'Book venue',
      source: 'Assigned via Committee group',
      status: 'complete',
      completedBy: 'Example Coordinator'
    }
  ]);

  const fetchCalendarData = async () => {
    if (!selectedClubId) {
      setLoading(false);
      return;
    }
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
    if (typeof date === 'string') {
      const parsed = parseIsoDate(date);
      return parsed ? toIsoDateLocal(parsed) : '';
    }
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return toIsoDateLocal(d);
  };

  // ─── Recurrence expansion ───────────────────────────────────────
  // Expand events / rosters / tasks (including recurring ones) into dated
  // occurrences covering the visible month, so recurring items appear on
  // every matching day instead of only on their anchor date.
  const monthRangeStart = useMemo(
    () => toIsoDateLocal(new Date(year, month, 1)),
    [year, month]
  );
  const monthRangeEnd = useMemo(
    () => toIsoDateLocal(new Date(year, month, daysInMonth)),
    [year, month, daysInMonth]
  );

  const occurrences = useMemo(() => {
    const out = [];

    // Club events & fixtures
    (events || []).forEach((event) => {
      const baseDate = event.startDate || event.date;
      if (!baseDate) return;
      const dates = buildOccurrenceDates(
        baseDate,
        event.recurringRule,
        monthRangeStart,
        monthRangeEnd,
        { endDate: event.endDate || event.date }
      );
      dates.forEach((occurrenceDate) => {
        out.push({
          ...event,
          date: occurrenceDate,
          occurrenceDate,
          itemType: 'event',
          primaryType: event.type === 'match' || event.type === 'game' ? 'Match' : 'Event',
          isRecurring: hasRecurrence(event.recurringRule),
        });
      });
    });

    // Volunteer shifts (one entry per shift per occurrence)
    (rosters || []).forEach((roster) => {
      if (!roster?.date) return;
      const dates = buildOccurrenceDates(
        roster.date,
        roster.recurringRule,
        monthRangeStart,
        monthRangeEnd
      );
      const shifts = Array.isArray(roster.shifts) ? roster.shifts : [];
      dates.forEach((occurrenceDate) => {
        if (shifts.length === 0) {
          out.push({
            itemType: 'shift',
            rosterId: roster.id,
            rosterTitle: roster.title,
            role: roster.title || 'Shift',
            date: occurrenceDate,
            occurrenceDate,
            isRecurring: hasRecurrence(roster.recurringRule),
          });
          return;
        }
        shifts.forEach((shift) => {
          out.push({
            ...shift,
            itemType: 'shift',
            rosterId: roster.id,
            rosterTitle: roster.title,
            date: occurrenceDate,
            occurrenceDate,
            isRecurring: hasRecurrence(roster.recurringRule),
          });
        });
      });
    });

    // Assigned checklist tasks
    (tasks || []).forEach((task) => {
      const baseDate = task.startDate || task.dueDate;
      if (!baseDate) return;
      const dates = buildOccurrenceDates(
        baseDate,
        task.recurringRule,
        monthRangeStart,
        monthRangeEnd,
        { endDate: task.endDate || task.dueDate }
      );
      dates.forEach((occurrenceDate) => {
        out.push({
          ...task,
          date: occurrenceDate,
          occurrenceDate,
          itemType: 'task',
          isRecurring: hasRecurrence(task.recurringRule),
        });
      });
    });

    return out;
  }, [events, rosters, tasks, monthRangeStart, monthRangeEnd]);

  // Aggregate occurrences by date
  const itemsByDate = useMemo(() => {
    const map = {};
    occurrences.forEach((item) => {
      const key = item.occurrenceDate;
      if (!key) return;
      (map[key] = map[key] || []).push(item);
    });
    // Sort each day chronologically
    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => {
        const aKey = `${a.startTime || a.time || '99:99'}`;
        const bKey = `${b.startTime || b.time || '99:99'}`;
        return aKey.localeCompare(bKey);
      });
    });
    return map;
  }, [occurrences]);

  const getItemsForDate = (date) => {
    if (!date) return [];
    return itemsByDate[formatLocalDateString(date)] || [];
  };

  const matchesFilter = (item) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Matches') return item.itemType === 'event' && (item.type === 'match' || item.type === 'game');
    if (activeFilter === 'Training') return item.itemType === 'event' && item.type === 'training';
    if (activeFilter === 'Shifts') return item.itemType === 'shift';
    if (activeFilter === 'Tasks') return item.itemType === 'task';
    return true;
  };

  // Filtered lists of items based on chosen activeFilter
  const allFilteredItems = useMemo(
    () => occurrences.filter(matchesFilter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [occurrences, activeFilter]
  );

  // Items for the currently selected day
  const selectedDayItems = useMemo(
    () => getItemsForDate(selectedDate).filter(matchesFilter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDate, itemsByDate, activeFilter]
  );

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

  // ─── Google Calendar style helpers ─────────────────────────────
  // Categorise an aggregated calendar item into a display "kind"
  const itemKind = (item) => {
    if (item.itemType === 'task') return 'task';
    if (item.itemType === 'shift') return 'shift';
    if (item.itemType === 'event') {
      return (item.type === 'match' || item.type === 'game') ? 'match' : 'training';
    }
    return 'other';
  };

  const KIND_STYLES = {
    match:    { bg: '#fef3c7', bar: '#f59e0b', text: '#92400e', label: 'Match' },
    training: { bg: '#dbeafe', bar: '#3b82f6', text: '#1e40af', label: 'Training' },
    shift:    { bg: '#d1fae5', bar: '#10b981', text: '#065f46', label: 'Shift' },
    task:     { bg: '#fee2e2', bar: '#ef4444', text: '#991b1b', label: 'Task' },
    other:    { bg: '#e2e8f0', bar: '#64748b', text: '#334155', label: 'Event' },
  };

  const itemTitle = (item) => item.title || item.role || item.rosterTitle || 'Untitled';
  const itemTime = (item) => item.time || (item.startTime ? `${item.startTime}${item.endTime ? `–${item.endTime}` : ''}` : '');

  // Returns only the items that pass the current filter (used for cell chips)
  const filteredItemsForDate = (date) => getItemsForDate(date).filter(matchesFilter);

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  // Open the appropriate details modal when a chip is clicked
  const handleItemClick = (item, e) => {
    e?.stopPropagation();
    if (item.itemType === 'event') {
      setSelectedEventDetails(item);
    } else {
      const parsed = parseIsoDate(item.date);
      if (parsed) setSelectedDate(parsed);
    }
  };

  const detailRecurrence = selectedEventDetails?.recurringRule
    ? describeRecurrence(
        selectedEventDetails.recurringRule,
        selectedEventDetails.startDate || selectedEventDetails.date
      )
    : '';

  return (
    <div style={{ maxWidth: '1500px', margin: '0 auto', padding: '24px', fontFamily: 'Arial, sans-serif' }}>
      
      {/* Page Header matching Image 9 & 10 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>
              Calendar & Duties
            </h1>
            <span style={{ fontSize: '11px', fontWeight: 800, background: '#1E3A8A', color: '#FFFFFF', padding: '3px 10px', borderRadius: '999px', letterSpacing: '0.05em' }}>
              USER SPACE
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, background: '#0D9488', color: '#FFFFFF', padding: '3px 10px', borderRadius: '999px' }}>
              Concept • Example data
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
            Your team fixtures, volunteer duties and club events
          </p>
        </div>

        {/* Subtabs: Calendar | My Tasks */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setMainTab('calendar')}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: mainTab === 'calendar' ? '#0F172A' : '#FFFFFF',
              color: mainTab === 'calendar' ? '#FFFFFF' : '#475569',
              fontSize: '13px',
              fontWeight: mainTab === 'calendar' ? 700 : 500,
              cursor: 'pointer'
            }}
          >
            Calendar
          </button>
          <button
            onClick={() => setMainTab('tasks')}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: mainTab === 'tasks' ? '#0F172A' : '#FFFFFF',
              color: mainTab === 'tasks' ? '#FFFFFF' : '#475569',
              fontSize: '13px',
              fontWeight: mainTab === 'tasks' ? 700 : 500,
              cursor: 'pointer'
            }}
          >
            My Tasks
          </button>
        </div>
      </div>

      {/* ─── TAB 1: MY TASKS (CONCEPT IMAGE 9 & 10) ─────────────────────────── */}
      {mainTab === 'tasks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Top Notification Pill (Image 9 & 10) */}
          <div style={{
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: '10px',
            padding: '12px 18px',
            fontSize: '13px',
            color: '#1E40AF',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Info size={16} color="#2563EB" />
            <span>New event task assigned: <strong>Prepare player packs</strong> [Example]</span>
          </div>

          {/* Section Heading */}
          <div style={{ marginTop: '4px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px 0', color: '#0F172A' }}>
              My Event Tasks
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
              Tasks assigned to you directly or through your team or group
            </p>
          </div>

          {/* Event progress banner */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{ fontSize: '13px', color: '#0F172A' }}>
              Event: <strong>2027 Season Registration</strong> • <span style={{ color: '#0D9488', fontWeight: 600 }}>{eventTasksList.filter(t => t.status === 'complete').length} of 5 tasks complete</span>
            </div>
            <button
              onClick={() => setViewEventModal(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: '#0284C7',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              View event
            </button>
          </div>

          {/* Task Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {eventTasksList.map(task => {
              const isComplete = task.status === 'complete';
              const isInProgress = task.status === 'in_progress';
              return (
                <div
                  key={task.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '14px',
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                      {task.title}
                    </h3>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>
                      {task.source}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    {/* Status Dot */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: isComplete ? '#10B981' : (isInProgress ? '#F59E0B' : '#94A3B8')
                      }} />
                      <span style={{ color: isComplete ? '#10B981' : (isInProgress ? '#D97706' : '#64748B') }}>
                        {isComplete ? 'Complete' : (isInProgress ? 'In progress' : 'Not started')}
                      </span>
                    </div>

                    {/* Action button */}
                    {isComplete ? (
                      <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={14} color="#16A34A" /> {task.completedBy ? `Completed by ${task.completedBy}` : 'Completed'}
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setEventTasksList(prev => prev.map(t => t.id === task.id ? { ...t, status: 'complete', completedBy: profile?.displayName || 'Example Member' } : t));
                        }}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          borderRadius: '8px',
                          padding: '6px 14px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#0F172A',
                          cursor: 'pointer'
                        }}
                      >
                        Mark complete
                      </button>
                    )}

                    <button
                      onClick={() => setViewEventModal(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: '#0284C7',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      View event
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Note matching Image 10 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748B', marginTop: '14px' }}>
            <Info size={14} color="#64748B" />
            <span>One authorised member can complete a team or group task. Completion records who did it.</span>
          </div>

        </div>
      )}

      {/* ─── TAB 2: CALENDAR VIEW ───────────────────────────────────────────── */}
      {mainTab === 'calendar' && (
        <div>
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

          {/* Colour Legend — pinned at the top so meanings are visible without scrolling */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              marginBottom: '20px',
              padding: '12px 16px',
              background: '#ffffff',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginRight: '4px', alignSelf: 'center' }}>
              Colour key:
            </span>
            {[
              { kind: 'match', label: 'Matches' },
              { kind: 'training', label: 'Training' },
              { kind: 'shift', label: 'Duties / Shifts' },
              { kind: 'task', label: 'My Tasks' },
            ].map(({ kind, label }) => {
              const style = KIND_STYLES[kind];
              return (
                <span
                  key={kind}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: style.bg,
                    color: style.text,
                    borderLeft: `4px solid ${style.bar}`,
                    borderRadius: '8px',
                    padding: '4px 12px',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                >
                  {label}
                </span>
              );
            })}
          </div>

      {/* Grid: Full-width month calendar, agenda below */}
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        
        {/* Left Card: Month Grid Calendar */}
        <div className="card shadow-sm" style={{ border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px', padding: '20px' }}>
          
          {/* Calendar Header Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '18px', color: 'var(--text)' }}>
                {monthNames[month]} {year}
              </h3>
              <button
                onClick={goToToday}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: '#ffffff',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Today
              </button>
            </div>
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
              if (!date) return <div key={`empty-${idx}`} style={{ minHeight: '132px' }} />;
              const isSel = isSelected(date);
              const isTdy = isToday(date);
              const dayItems = filteredItemsForDate(date);
              const maxChips = 3;

              return (
                <button
                  key={`day-${idx}`}
                  onClick={() => setSelectedDate(date)}
                  style={{
                    minHeight: '132px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    padding: '6px 7px',
                    border: '1px solid',
                    borderColor: isSel ? 'var(--primary)' : 'var(--border-light, #f1f5f9)',
                    borderRadius: '12px',
                    background: isSel
                      ? 'rgba(16, 185, 129, 0.08)'
                      : (isTdy ? '#f8fafc' : '#ffffff'),
                    color: 'var(--text)',
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    position: 'relative',
                    overflow: 'hidden',
                    textAlign: 'left'
                  }}
                >
                  {/* Day number */}
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    alignSelf: 'flex-start',
                    minWidth: '20px',
                    height: '20px',
                    padding: '0 5px',
                    borderRadius: '50%',
                    fontSize: '12px',
                    fontWeight: isSel || isTdy ? 700 : 500,
                    background: isTdy && !isSel ? 'var(--primary)' : 'none',
                    color: isTdy && !isSel ? '#ffffff' : (isSel ? 'var(--primary)' : 'inherit')
                  }}>
                    {date.getDate()}
                  </span>

                  {/* Google-Calendar style event chips */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '3px', width: '100%', overflow: 'hidden' }}>
                    {dayItems.slice(0, maxChips).map((item, i) => {
                      const style = KIND_STYLES[itemKind(item)];
                      return (
                        <span
                          key={`chip-${i}`}
                          onClick={(e) => handleItemClick(item, e)}
                          title={`${style.label}: ${itemTitle(item)}${itemTime(item) ? ` (${itemTime(item)})` : ''}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            width: '100%',
                            background: style.bg,
                            color: style.text,
                            borderRadius: '4px',
                            borderLeft: `3px solid ${style.bar}`,
                            padding: '2px 5px',
                            fontSize: '10.5px',
                            fontWeight: 600,
                            lineHeight: 1.3,
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                            textAlign: 'left',
                            cursor: 'pointer'
                          }}
                        >
                          {item.isRecurring && <Repeat size={9} style={{ flexShrink: 0 }} />}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{itemTitle(item)}</span>
                        </span>
                      );
                    })}
                    {dayItems.length > maxChips && (
                      <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-secondary)', paddingLeft: '2px' }}>
                        +{dayItems.length - maxChips} more
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
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
      </div>
      )}

      {/* ─── 2027 Season Registration Event Modal (Image 9 & 10) ─────────────── */}
      <Modal open={viewEventModal} onClose={() => setViewEventModal(false)} title="Event Details">
        <div style={{ padding: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, background: '#0D9488', color: '#FFFFFF', padding: '3px 10px', borderRadius: '6px' }}>
              Registration
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, background: '#DCFCE7', color: '#166534', padding: '3px 10px', borderRadius: '6px' }}>
              Published
            </span>
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px 0', color: '#0F172A' }}>
            2027 Season Registration
          </h2>
          <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748B' }}>
            Preseason registration day for all existing and new junior & senior players.
          </p>

          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 16px', marginBottom: '18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              <div>
                <span style={{ color: '#64748B', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Date & Time</span>
                <div style={{ fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>Sat 6 Feb 2027, 9:00 am – 2:00 pm</div>
              </div>
              <div>
                <span style={{ color: '#64748B', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Venue</span>
                <div style={{ fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>Main Clubhouse & Grounds</div>
              </div>
            </div>
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #E2E8F0', fontSize: '12px', color: '#475569' }}>
              <strong>Audience:</strong> All club members (Who can see this event — not task owners)
            </div>
          </div>

          <h3 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 10px 0', color: '#0F172A' }}>
            Event Checklist Tasks
          </h3>
          <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden', marginBottom: '18px' }}>
            {[
              { task: 'Book venue', owner: 'Committee', status: 'Complete', by: 'Example Coordinator' },
              { task: 'Set up online registration', owner: 'Example Admin', status: 'In progress' },
              { task: 'Organise volunteers', owner: 'U13 Managers group', status: 'In progress' },
              { task: 'Prepare player packs', owner: 'U17 Nev Blair team', status: eventTasksList.find(t => t.id === 'evt-task-1')?.status === 'complete' ? 'Complete' : 'Not started' },
              { task: 'Confirm first aid cover', owner: 'Club First Aid Officer', status: 'Not started' },
            ].map((t, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: idx < 4 ? '1px solid #F1F5F9' : 'none', fontSize: '12px' }}>
                <div>
                  <strong style={{ color: '#0F172A' }}>{t.task}</strong>
                  <div style={{ color: '#64748B', fontSize: '11px' }}>{t.owner}</div>
                </div>
                <div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: t.status === 'Complete' ? '#DCFCE7' : t.status === 'In progress' ? '#FEF3C7' : '#F1F5F9',
                    color: t.status === 'Complete' ? '#166534' : t.status === 'In progress' ? '#B45309' : '#64748B'
                  }}>
                    {t.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button className="btn btn-outline" onClick={() => setViewEventModal(false)} style={{ borderRadius: '8px', fontSize: '13px' }}>
              Close
            </button>
          </div>
        </div>
      </Modal>

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
                <span>Date: {selectedEventDetails.occurrenceDate || selectedEventDetails.date}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <Clock size={16} color="var(--primary)" />
                <span>Time: {selectedEventDetails.isAllDay ? 'All Day' : (selectedEventDetails.time || selectedEventDetails.startTime || 'TBA')}</span>
              </div>
              {selectedEventDetails.location && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <MapPin size={16} color="var(--primary)" />
                  <span>Location: {selectedEventDetails.location}</span>
                </div>
              )}
              {detailRecurrence && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <Repeat size={16} color="var(--primary)" />
                  <span>Repeats: {detailRecurrence}</span>
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
