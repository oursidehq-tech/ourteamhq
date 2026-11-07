import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import Modal from '../components/Modal';
import {
  ChevronLeft, ChevronRight, Calendar, MapPin, Clock, Users,
  Plus, RefreshCw, Trophy, Dumbbell, PartyPopper, Handshake,
  Repeat, AlignLeft, Tag, CalendarDays, X
} from 'lucide-react';
import {
  buildOccurrenceDates,
  describeRecurrence,
  hasRecurrence,
  todayIsoDate,
  toIsoDateLocal,
  parseIsoDate,
} from '../utils/recurrence';

// Colour + label configuration per event type (shared look with the member calendar)
const TYPE_STYLES = {
  match:    { bg: '#fef3c7', bar: '#f59e0b', text: '#92400e', label: 'Match',    icon: Trophy },
  game:     { bg: '#fef3c7', bar: '#f59e0b', text: '#92400e', label: 'Match',    icon: Trophy },
  training: { bg: '#dbeafe', bar: '#3b82f6', text: '#1e40af', label: 'Training', icon: Dumbbell },
  social:   { bg: '#d1fae5', bar: '#10b981', text: '#065f46', label: 'Social',   icon: PartyPopper },
  meeting:  { bg: '#e2e8f0', bar: '#64748b', text: '#334155', label: 'Meeting',  icon: Handshake },
  event:    { bg: '#ede9fe', bar: '#8b5cf6', text: '#5b21b6', label: 'Event',    icon: Calendar },
};

const styleForType = (t) => TYPE_STYLES[(t || '').toLowerCase()] || TYPE_STYLES.event;

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatLongDate = (isoDate) => {
  const d = parseIsoDate(isoDate);
  if (!d) return 'Date TBC';
  return `${WEEKDAY_SHORT[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
};

const formatTime = (item) => {
  if (item?.isAllDay) return 'All Day';
  const start = item?.startTime || item?.time || '';
  const end = item?.endTime || '';
  if (!start) return 'TBA';
  return end ? `${start} – ${end}` : start;
};

export default function AdminCalendar() {
  const { selectedClubId, selectedClub } = useClub();
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedItem, setSelectedItem] = useState(null);

  const fetchEvents = async () => {
    if (!selectedClubId) { setLoading(false); return; }
    setLoading(true);
    try {
      const col = collection(db, 'clubs', selectedClubId, 'events');
      let snap;
      try {
        snap = await getDocs(query(col, orderBy('date', 'desc')));
      } catch {
        snap = await getDocs(col);
      }
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, [selectedClubId]);

  // ─── Date helpers ───────────────────────────────────────────────
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));

  const formatDateKey = (date) => (date ? toIsoDateLocal(date) : '');

  const isToday = (date) =>
    !!date && formatDateKey(date) === todayIsoDate();

  const isSelected = (date) =>
    !!date && formatDateKey(date) === formatDateKey(selectedDate);

  const passesFilter = (e) => {
    if (activeFilter === 'All') return true;
    const t = (e.type || '').toLowerCase();
    if (activeFilter === 'Matches') return t === 'match' || t === 'game';
    if (activeFilter === 'Training') return t === 'training';
    if (activeFilter === 'Social') return t === 'social';
    if (activeFilter === 'Meetings') return t === 'meeting';
    if (activeFilter === 'Other') return !['match', 'game', 'training', 'social', 'meeting'].includes(t);
    return true;
  };

  // ─── Recurrence expansion ───────────────────────────────────────
  // Expand every event (including recurring ones) into dated occurrences
  // covering the visible month, so recurring events appear on every
  // matching day instead of only on their anchor date.
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
          occurrenceDate,
          isRecurring: hasRecurrence(event.recurringRule),
        });
      });
    });
    return out;
  }, [events, monthRangeStart, monthRangeEnd]);

  // Occurrences grouped by their YYYY-MM-DD key
  const eventsByDate = useMemo(() => {
    const map = {};
    occurrences.forEach((e) => {
      const key = e.occurrenceDate;
      if (!key) return;
      (map[key] = map[key] || []).push(e);
    });
    // Sort each day by start time so the agenda reads chronologically
    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => {
        const aKey = `${a.startTime || a.time || '99:99'}`;
        const bKey = `${b.startTime || b.time || '99:99'}`;
        return aKey.localeCompare(bKey);
      });
    });
    return map;
  }, [occurrences]);

  const itemsForDate = (date) => {
    const list = eventsByDate[formatDateKey(date)] || [];
    return list.filter(passesFilter);
  };

  const selectedDayItems = useMemo(
    () => itemsForDate(selectedDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDate, eventsByDate, activeFilter]
  );

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  const detailStyle = styleForType(selectedItem?.type);
  const DetailIcon = detailStyle.icon;
  const detailRecurrence = selectedItem?.recurringRule
    ? describeRecurrence(
        selectedItem.recurringRule,
        selectedItem.startDate || selectedItem.date
      )
    : '';

  return (
    <div style={{ maxWidth: '1500px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h1>Calendar</h1>
          <p className="subtitle">All matches, training sessions and club events for {selectedClub?.name}</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={fetchEvents}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> <span>Refresh</span>
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/events')}>
            <Plus size={16} /> <span>Manage Events</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        {['All', 'Matches', 'Training', 'Social', 'Meetings', 'Other'].map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            style={{
              padding: '8px 16px',
              borderRadius: '12px',
              border: `1px solid ${activeFilter === filter ? 'var(--primary)' : 'var(--border)'}`,
              background: activeFilter === filter ? 'var(--primary)' : '#ffffff',
              color: activeFilter === filter ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Colour key pinned at the top */}
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px',
          padding: '12px 16px', background: '#ffffff', border: '1px solid var(--border)',
          borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginRight: '4px', alignSelf: 'center' }}>
          Colour key:
        </span>
        {[
          { type: 'match', label: 'Matches' },
          { type: 'training', label: 'Training' },
          { type: 'social', label: 'Social' },
          { type: 'meeting', label: 'Meetings' },
          { type: 'event', label: 'Other' },
        ].map(({ type, label }) => {
          const s = styleForType(type);
          return (
            <span
              key={type}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: s.bg, color: s.text, borderLeft: `4px solid ${s.bar}`,
                borderRadius: '8px', padding: '4px 12px', fontSize: '12px', fontWeight: 600
              }}
            >
              {label}
            </span>
          );
        })}
      </div>

      {/* Month Calendar */}
      <div className="card shadow-sm" style={{ border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '18px', color: 'var(--text)' }}>
              {monthNames[month]} {year}
            </h3>
            <button
              onClick={goToToday}
              style={{
                padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                background: '#ffffff', color: 'var(--text-secondary)', fontSize: '12px',
                fontWeight: 600, cursor: 'pointer'
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

        {/* Weekday labels */}
        <div className="admin-cal-weekdays" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontWeight: 700, fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
          {WEEKDAY_SHORT.map(d => <div key={d}>{d}</div>)}
        </div>

        {/* Days grid */}
        <div className="admin-cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
          {days.map((date, idx) => {
            if (!date) return <div key={`empty-${idx}`} className="admin-cal-cell admin-cal-cell-empty" />;
            const isSel = isSelected(date);
            const isTdy = isToday(date);
            const dayItems = itemsForDate(date);
            const maxChips = 3;

            return (
              <button
                key={`day-${idx}`}
                onClick={() => setSelectedDate(date)}
                className="admin-cal-cell"
                style={{
                  minHeight: '132px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  padding: '6px 7px',
                  border: '1px solid',
                  borderColor: isSel ? 'var(--primary)' : 'var(--border-light, #f1f5f9)',
                  borderRadius: '12px',
                  background: isSel ? 'rgba(16, 185, 129, 0.08)' : (isTdy ? '#f8fafc' : '#ffffff'),
                  color: 'var(--text)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  position: 'relative',
                  overflow: 'hidden',
                  textAlign: 'left'
                }}
              >
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  alignSelf: 'flex-start', minWidth: '20px', height: '20px', padding: '0 5px',
                  borderRadius: '50%', fontSize: '12px',
                  fontWeight: isSel || isTdy ? 700 : 500,
                  background: isTdy && !isSel ? 'var(--primary)' : 'none',
                  color: isTdy && !isSel ? '#ffffff' : (isSel ? 'var(--primary)' : 'inherit')
                }}>
                  {date.getDate()}
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '3px', width: '100%', overflow: 'hidden' }}>
                  {dayItems.slice(0, maxChips).map((item, i) => {
                    const s = styleForType(item.type);
                    return (
                      <span
                        key={`chip-${i}`}
                        onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}
                        title={`${s.label}: ${item.title}${formatTime(item) ? ` (${formatTime(item)})` : ''}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '3px', width: '100%',
                          background: s.bg, color: s.text,
                          borderRadius: '4px', borderLeft: `3px solid ${s.bar}`, padding: '2px 5px',
                          fontSize: '10.5px', fontWeight: 600, lineHeight: 1.3,
                          whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'left',
                          cursor: 'pointer'
                        }}
                      >
                        {item.isRecurring && <Repeat size={9} style={{ flexShrink: 0 }} />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
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

      {/* Day agenda */}
      <div className="card shadow-sm" style={{ border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>
            Agenda for {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </h3>
          {selectedDayItems.length > 0 && (
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px',
              background: 'rgba(16, 139, 81, 0.1)', color: 'var(--primary)'
            }}>
              {selectedDayItems.length} item{selectedDayItems.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '30px 0' }}>Loading events...</p>
        ) : selectedDayItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-lighter)' }}>
            <Calendar size={32} style={{ marginBottom: '12px' }} />
            <h4 style={{ margin: 0, color: 'var(--text)' }}>No events scheduled</h4>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Pick another date or adjust the filters.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
            {selectedDayItems.map((e) => {
              const s = styleForType(e.type);
              const Icon = s.icon;
              const rsvpCount = Object.keys(e.rsvps || e.rsvp || {}).length;
              return (
                <div
                  key={`${e.id}-${e.occurrenceDate}`}
                  onClick={() => setSelectedItem(e)}
                  style={{
                    padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light, #f1f5f9)',
                    background: '#f8fafc', cursor: 'pointer', borderLeft: `4px solid ${s.bar}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                      background: s.bg, color: s.text, textTransform: 'uppercase',
                      display: 'inline-flex', alignItems: 'center', gap: '4px'
                    }}>
                      <Icon size={11} /> {s.label}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> {formatTime(e)}
                    </span>
                  </div>

                  <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {e.title}
                    {e.isRecurring && <Repeat size={12} color="var(--text-secondary)" />}
                  </h4>

                  {e.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      <MapPin size={12} /> <span>{e.location}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {e.assignedGroupName && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={12} /> {e.assignedGroupName}
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> {rsvpCount} RSVP{rsvpCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Event details modal */}
      <Modal
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={selectedItem ? styleForType(selectedItem.type).label : 'Event Details'}
      >
        {selectedItem && (
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '20px', flexShrink: 0,
                background: detailStyle.bg, color: detailStyle.text,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <DetailIcon size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--text)' }}>
                  {selectedItem.title}
                </h2>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                    background: detailStyle.bg, color: detailStyle.text, textTransform: 'uppercase'
                  }}>
                    {detailStyle.label}
                  </span>
                  {selectedItem.isRecurring && (
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                      background: '#f1f5f9', color: 'var(--text-secondary)',
                      display: 'inline-flex', alignItems: 'center', gap: '4px'
                    }}>
                      <Repeat size={10} /> Recurring
                    </span>
                  )}
                </div>
              </div>
              <button className="btn-icon" onClick={() => setSelectedItem(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <CalendarDays size={16} color="var(--primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-lighter)' }}>Date</div>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                    {formatLongDate(selectedItem.occurrenceDate || selectedItem.startDate || selectedItem.date)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <Clock size={16} color="var(--primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-lighter)' }}>Time</div>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>{formatTime(selectedItem)}</div>
                </div>
              </div>

              {selectedItem.location && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <MapPin size={16} color="var(--primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-lighter)' }}>Location</div>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{selectedItem.location}</div>
                  </div>
                </div>
              )}

              {(selectedItem.assignedGroupName || selectedItem.assignedUserName) && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <Users size={16} color="var(--primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-lighter)' }}>Assigned to</div>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {selectedItem.openToAll
                        ? 'Everyone in the club'
                        : selectedItem.assignedGroupName || selectedItem.assignedUserName}
                    </div>
                  </div>
                </div>
              )}

              {detailRecurrence && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <Repeat size={16} color="var(--primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-lighter)' }}>Repeats</div>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{detailRecurrence}</div>
                  </div>
                </div>
              )}

              {selectedItem.category && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <Tag size={16} color="var(--primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-lighter)' }}>Category</div>
                    <div style={{ fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{selectedItem.category}</div>
                  </div>
                </div>
              )}

              {selectedItem.description && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <AlignLeft size={16} color="var(--primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-lighter)' }}>Notes</div>
                    <div style={{ color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {selectedItem.description}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <button className="btn btn-outline" onClick={() => setSelectedItem(null)}>
                Close
              </button>
              <button className="btn btn-primary" onClick={() => navigate('/events')}>
                Manage Events
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
