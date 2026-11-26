import { useEffect, useState } from 'react';
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import Modal from '../components/Modal';
import MultiSelect from '../components/MultiSelect';
import { Search, Plus, Edit2, Trash2, Calendar, RefreshCw, Eye, MapPin, Clock, Users, CheckCircle2, AlertCircle, Check, ListChecks, User } from 'lucide-react';

export default function EventsPage() {
  const { selectedClubId } = useClub();
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [viewingEvent, setViewingEvent] = useState(null);
  const [eventViewTab, setEventViewTab] = useState('checklist'); // 'details' | 'checklist' | 'attendees'
  const [checklistTasks, setChecklistTasks] = useState([]);
  const [assignModalTask, setAssignModalTask] = useState(null);
  const [assigneeForm, setAssigneeForm] = useState({ name: '', type: 'user' });
  const [newTaskInput, setNewTaskInput] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Team, group, and member dropdowns
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [groups, setGroups] = useState([]);

  // Recurrence states
  const [repeatPreset, setRepeatPreset] = useState('none');
  const [customFrequency, setCustomFrequency] = useState('weekly');
  const [customInterval, setCustomInterval] = useState(1);
  const [customWeekDays, setCustomWeekDays] = useState([]);
  const [customEnds, setCustomEnds] = useState('never');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customCount, setCustomCount] = useState(1);

  const col = () => collection(db, 'clubs', selectedClubId, 'events');

  const fetchClubOptions = async () => {
    if (!selectedClubId) return;
    try {
      const membersSnap = await getDocs(collection(db, 'clubs', selectedClubId, 'members'));
      setMembers(membersSnap.docs.map(d => {
        const data = d.data();
        const name = data.displayName || data.name || data.fullName || [data.firstName, data.lastName].filter(Boolean).join(' ') || data.email || d.id;
        return { id: d.id, name };
      }));

      const teamsSnap = await getDocs(collection(db, 'clubs', selectedClubId, 'teams'));
      setTeams(teamsSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name || d.id
      })));

      const groupsSnap = await getDocs(collection(db, 'clubs', selectedClubId, 'groups'));
      setGroups(groupsSnap.docs.map(d => ({
        id: d.id,
        name: d.data().groupName || d.id
      })));
    } catch (err) {
      console.error('Error fetching club options:', err);
    }
  };

  const fetch = async () => {
    if (!selectedClubId) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(col(), orderBy('date', 'desc')));
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      try {
        const snap = await getDocs(col());
        setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClubId) {
      fetch();
      fetchClubOptions();
    }
  }, [selectedClubId]);

  const filtered = events.filter(e =>
    e.title?.toLowerCase().includes(search.toLowerCase()) ||
    e.location?.toLowerCase().includes(search.toLowerCase()) ||
    e.assignedGroupName?.toLowerCase().includes(search.toLowerCase())
  );

  const getWeekdayIndex = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(`${dateStr}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date.getDay();
  };

  const buildRecurringRule = (baseDate) => {
    if (repeatPreset === 'none') return null;
    if (repeatPreset === 'daily') return { frequency: 'daily', interval: 1 };
    if (repeatPreset === 'weekly') {
      const weekdayIndex = getWeekdayIndex(baseDate);
      return { frequency: 'weekly', interval: 1, weekDays: weekdayIndex !== null ? [weekdayIndex] : undefined };
    }
    if (repeatPreset === 'monthly') return { frequency: 'monthly', interval: 1, monthlyMode: 'same_day' };
    if (repeatPreset === 'yearly') return { frequency: 'yearly', interval: 1 };
    if (repeatPreset === 'custom') {
      const rule = { frequency: customFrequency, interval: Math.max(1, parseInt(customInterval, 10) || 1) };
      if (customFrequency === 'weekly') {
        const weekdayIndex = getWeekdayIndex(baseDate);
        rule.weekDays = customWeekDays.length > 0 ? customWeekDays : (weekdayIndex !== null ? [weekdayIndex] : undefined);
      }
      if (customFrequency === 'monthly') rule.monthlyMode = 'same_day';
      if (customEnds === 'date' && customEndDate) rule.untilDate = customEndDate;
      else if (customEnds === 'count') rule.count = Math.max(1, parseInt(customCount, 10) || 1);
      return rule;
    }
    return null;
  };

  const openAdd = () => {
    setForm({
      title: '',
      description: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      time: '18:00',
      endTime: '19:00',
      isAllDay: false,
      location: '',
      type: 'training',
      assignedUserIds: [],
      assignedTeamIds: [],
      assignedGroupIds: []
    });
    setRepeatPreset('none');
    setModal('add');
  };

  const openEdit = (ev) => {
    setForm({
      title: ev.title || '',
      description: ev.description || '',
      startDate: ev.startDate || ev.date || '',
      endDate: ev.endDate || ev.date || '',
      time: ev.time || ev.startTime || '',
      endTime: ev.endTime || '',
      isAllDay: !!ev.isAllDay,
      location: ev.location || '',
      type: ev.type || 'training',
      assignedUserIds: ev.assignedUserIds || (ev.assignedUserId ? [ev.assignedUserId] : []),
      assignedTeamIds: ev.assignedTeamIds || (ev.teamId ? [ev.teamId] : []),
      assignedGroupIds: ev.assignedGroupIds || (ev.assignedGroupId ? [ev.assignedGroupId] : [])
    });

    if (ev.isRecurring && ev.recurringRule) {
      const rule = ev.recurringRule;
      const hasPreset = ['daily', 'weekly', 'monthly', 'yearly'].includes(rule.frequency) && rule.interval === 1 && !rule.untilDate && !rule.count;
      if (hasPreset) {
        setRepeatPreset(rule.frequency);
      } else {
        setRepeatPreset('custom');
        setCustomFrequency(rule.frequency || 'weekly');
        setCustomInterval(rule.interval || 1);
        setCustomWeekDays(rule.weekDays || []);
        if (rule.untilDate) { setCustomEnds('date'); setCustomEndDate(rule.untilDate); }
        else if (rule.count) { setCustomEnds('count'); setCustomCount(rule.count); }
        else setCustomEnds('never');
      }
    } else {
      setRepeatPreset('none');
    }
    setModal(ev);
  };

  const handleSave = async () => {
    if (!form.title?.trim()) return alert('Event title is required');
    if (!form.startDate) return alert('Start date is required');
    setSaving(true);
    try {
      const selectedUsers = members.filter(m => form.assignedUserIds?.includes(m.id));
      const selectedTeams = teams.filter(t => form.assignedTeamIds?.includes(t.id));
      const selectedGroups = groups.filter(g => form.assignedGroupIds?.includes(g.id));

      const mergedGroupIds = [
        ...(form.assignedGroupIds || []),
        ...(form.assignedTeamIds || [])
      ].map(id => id.toLowerCase());

      const mergedGroupNames = [
        ...selectedGroups.map(g => g.name),
        ...selectedTeams.map(t => t.name)
      ];

      const recurringRule = buildRecurringRule(form.startDate);

      const eventPayload = {
        title: form.title.trim(),
        description: form.description || '',
        date: form.startDate,
        startDate: form.startDate,
        endDate: form.endDate || form.startDate,
        time: form.isAllDay ? '' : (form.time || ''),
        startTime: form.isAllDay ? '' : (form.time || ''),
        endTime: form.isAllDay ? '' : (form.endTime || ''),
        isAllDay: !!form.isAllDay,
        isRecurring: !!recurringRule,
        recurringRule,
        location: form.location || '',
        type: form.type || 'training',
        category: form.type || 'training',
        assignedUserId: form.assignedUserIds?.[0] || '',
        assignedUserName: selectedUsers.map(u => u.name).join(', '),
        assignedUserIds: form.assignedUserIds || [],
        teamId: form.assignedTeamIds?.[0] || null,
        teamIds: form.assignedTeamIds || [],
        groupId: form.assignedGroupIds?.[0] || null,
        groupIds: form.assignedGroupIds || [],
        assignedGroupId: form.assignedGroupIds?.[0] || form.assignedTeamIds?.[0] || null,
        assignedGroupIds: mergedGroupIds,
        assignedGroupName: mergedGroupNames.join(', '),
        groupType: form.assignedTeamIds?.length > 0 ? 'Team' : 'Group',
        openToAll: mergedGroupIds.length === 0 && (form.assignedUserIds || []).length === 0,
        isPublic: mergedGroupIds.length === 0 && (form.assignedUserIds || []).length === 0,
        visibility: (mergedGroupIds.length === 0 && (form.assignedUserIds || []).length === 0) ? 'Public' : (form.assignedTeamIds?.length > 0 ? 'Team-Only' : 'Club-Only'),
        rsvps: (modal && modal !== 'add' && (modal.rsvps || modal.rsvp)) || {},
        rsvp: (modal && modal !== 'add' && (modal.rsvps || modal.rsvp)) || {},
        updatedAt: serverTimestamp()
      };

      if (modal === 'add') {
        const ref = doc(col());
        await setDoc(ref, {
          ...eventPayload,
          rsvp: {},
          rsvps: {},
          createdBy: 'admin',
          createdAt: serverTimestamp()
        });
      } else {
        await updateDoc(doc(db, 'clubs', selectedClubId, 'events', modal.id), eventPayload);
      }
      await fetch();
      setModal(null);
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ev) => {
    if (!window.confirm(`Delete event "${ev.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'clubs', selectedClubId, 'events', ev.id));
      await fetch();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const typeBadge = (t) => {
    const map = { training: 'badge-info', match: 'badge-warning', social: 'badge-success', meeting: 'badge-default' };
    return map[t] || 'badge-default';
  };

  const getWeekDayName = (dayIdx) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIdx] || '';

  return (
    <div>
      <div className="page-header">
        <div><h1>Events</h1><p>Manage matches, training &amp; other club events</p></div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={fetch} style={{ marginRight: 8 }}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span style={{ marginLeft: 4 }}>Refresh</span>
          </button>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} />Add Event</button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <h3>{filtered.length} Event{filtered.length !== 1 ? 's' : ''}</h3>
          <div className="search-box"><Search size={16} /><input placeholder="Search events…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Date</th>
              <th>Time</th>
              <th>Location</th>
              <th>Type</th>
              <th>Assigned Groups / Users</th>
              <th>RSVPs</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="table-empty">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="table-empty">No events found</td></tr>
            ) : filtered.map(e => (
              <tr 
                key={e.id} 
                className="clickable-row" 
                onClick={(eTarget) => {
                  if (!eTarget.target.closest('button')) setViewingEvent(e);
                }}
              >
                <td><strong>{e.title}</strong></td>
                <td>{e.startDate === e.endDate ? e.startDate || e.date : `${e.startDate || e.date} to ${e.endDate || e.date}`}</td>
                <td>{e.isAllDay ? <span className="badge badge-info">All Day</span> : (e.time || e.startTime || '—')}</td>
                <td>{e.location || '—'}</td>
                <td><span className={`badge ${typeBadge(e.type)}`}>{e.type || '—'}</span></td>
                <td>{e.assignedUserName ? `👤 ${e.assignedUserName}` : e.assignedGroupName || <span className="text-muted text-sm">Open to All</span>}</td>
                <td>{Object.keys(e.rsvps || e.rsvp || {}).length}</td>
                <td>
                  <div className="flex gap-sm">
                    <button className="btn-icon" onClick={(ev) => { ev.stopPropagation(); setViewingEvent(e); }} title="View Details"><Eye size={15} /></button>
                    <button className="btn-icon" onClick={(ev) => { ev.stopPropagation(); openEdit(e); }} title="Edit Event"><Edit2 size={15} /></button>
                    <button className="btn-icon danger" onClick={(ev) => { ev.stopPropagation(); handleDelete(e); }} title="Delete Event"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'add' ? 'Add Event' : 'Edit Event'} wide={true}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Left Column */}
          <div>
            <div className="form-group"><label>Title</label><input className="form-control" value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
            
            <div className="form-row">
              <div className="form-group"><label>Start Date</label><input className="form-control" type="date" value={form.startDate || ''} onChange={e => setForm({ ...form, startDate: e.target.value })} required /></div>
              <div className="form-group"><label>End Date</label><input className="form-control" type="date" value={form.endDate || ''} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: '100%', cursor: 'pointer', userSelect: 'none', margin: 0 }}>
                <input type="checkbox" checked={!!form.isAllDay} onChange={e => setForm({ ...form, isAllDay: e.target.checked })} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                <span>All Day Event</span>
              </label>
            </div>

            {!form.isAllDay && (
              <div className="form-row">
                <div className="form-group"><label>Start Time</label><input className="form-control" type="time" value={form.time || ''} onChange={e => setForm({ ...form, time: e.target.value })} /></div>
                <div className="form-group"><label>End Time</label><input className="form-control" type="time" value={form.endTime || ''} onChange={e => setForm({ ...form, endTime: e.target.value })} /></div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group"><label>Location</label><input className="form-control" value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
              <div className="form-group">
                <label>Type</label>
                <select className="form-control" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="training">Training</option>
                  <option value="match">Match / Game</option>
                  <option value="social">Social</option>
                  <option value="meeting">Meeting</option>
                  <option value="general">General</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label>Description</label><textarea className="form-control" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} style={{ height: '70px' }} /></div>

            {/* Recurrence Fields */}
            <div style={{ marginTop: 16, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg)' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><RefreshCw size={14} /> Recurrence Rules</h4>
              <div className="form-group">
                <label>Repeat Pattern</label>
                <select className="form-control" value={repeatPreset} onChange={e => setRepeatPreset(e.target.value)}>
                  <option value="none">Does Not Repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="custom">Custom Recurrence...</option>
                </select>
              </div>

              {repeatPreset === 'custom' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div className="form-group" style={{ flex: 1 }}><label>Frequency</label><select className="form-control" value={customFrequency} onChange={e => setCustomFrequency(e.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></div>
                    <div className="form-group" style={{ flex: 1 }}><label>Every (Interval)</label><input type="number" className="form-control" min={1} value={customInterval} onChange={e => setCustomInterval(e.target.value)} /></div>
                  </div>

                  {customFrequency === 'weekly' && (
                    <div className="form-group">
                      <label>On Days</label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                        {[0, 1, 2, 3, 4, 5, 6].map(dayIdx => {
                          const isSel = customWeekDays.includes(dayIdx);
                          return (
                            <button key={dayIdx} type="button" onClick={() => { setCustomWeekDays(isSel ? customWeekDays.filter(d => d !== dayIdx) : [...customWeekDays, dayIdx]); }} style={{ padding: '6px 8px', fontSize: '11px', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', background: isSel ? 'var(--primary)' : 'var(--surface)', color: isSel ? '#fff' : 'var(--text)', fontWeight: 600 }}>{getWeekDayName(dayIdx)}</button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group"><label>Ends</label><select className="form-control" value={customEnds} onChange={e => setCustomEnds(e.target.value)}><option value="never">Never Ends</option><option value="date">On Specific Date</option><option value="count">After Occurrences</option></select></div>
                    {customEnds === 'date' && <div className="form-group"><label>End Date</label><input className="form-control" type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} /></div>}
                    {customEnds === 'count' && <div className="form-group"><label>Occurrences</label><input type="number" className="form-control" min={1} value={customCount} onChange={e => setCustomCount(e.target.value)} /></div>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: 12 }}>Linkages &amp; Assignees</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: 16 }}>
              Leave all selection fields empty to make the event visible to all members (Open to All).
            </p>
            
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6 }}>Assigned Users / Members</label>
              <MultiSelect
                options={members}
                selectedValues={form.assignedUserIds || []}
                onChange={vals => setForm({ ...form, assignedUserIds: vals })}
                placeholder="Select members..."
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6 }}>Assigned Teams</label>
              <MultiSelect
                options={teams}
                selectedValues={form.assignedTeamIds || []}
                onChange={vals => setForm({ ...form, assignedTeamIds: vals })}
                placeholder="Select teams..."
              />
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 6 }}>Assigned Groups / Committees</label>
              <MultiSelect
                options={groups}
                selectedValues={form.assignedGroupIds || []}
                onChange={vals => setForm({ ...form, assignedGroupIds: vals })}
                placeholder="Select groups..."
              />
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : modal === 'add' ? 'Create Event' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      </Modal>

      {/* View Event Detail Modal matching Concept */}
      <Modal open={!!viewingEvent} onClose={() => setViewingEvent(null)} title="" wide={true}>
        {viewingEvent && (
          <div>
            {/* Top Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>
                    {viewingEvent.title || 'Event'}
                  </h2>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                  {viewingEvent.startDate || viewingEvent.date || 'Sat 6 Feb 2027'} • {viewingEvent.time || viewingEvent.startTime || '9:00 am'} • {viewingEvent.location || 'Clubhouse'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-outline" onClick={() => { const ev = viewingEvent; setViewingEvent(null); openEdit(ev); }} style={{ padding: '6px 12px', fontSize: '12px' }}>
                  <Edit2 size={14} style={{ marginRight: 4 }} /> Edit
                </button>
                <button className="btn btn-outline danger" onClick={() => handleDelete(viewingEvent)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid #E2E8F0', marginBottom: '20px' }}>
              {[
                { id: 'details', label: 'Event Details' },
                { id: 'checklist', label: 'Checklist' },
                { id: 'attendees', label: 'Attendees' },
              ].map(tab => {
                const isActive = eventViewTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setEventViewTab(tab.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      borderBottom: isActive ? '2px solid #0D9488' : '2px solid transparent',
                      padding: '0 4px 12px 4px',
                      fontSize: '13px',
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? '#0D9488' : '#64748B',
                      cursor: 'pointer'
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* ── TAB 1: CHECKLIST ── */}
            {eventViewTab === 'checklist' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Event audience callout */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 16px' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A', marginBottom: '2px' }}>
                    Event audience: {viewingEvent.assignedGroupName || viewingEvent.assignedUserName || 'All club members'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    Who can see this event — not task owners
                  </div>
                </div>

                {/* Main Checklist Card */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                      Registration Day checklist
                    </h3>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, background: '#F1F5F9', color: '#475569', padding: '4px 10px', borderRadius: '6px' }}>
                        Copied from template
                      </span>
                      <button
                        onClick={() => setShowAddTask(!showAddTask)}
                        className="btn btn-outline"
                        style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '8px' }}
                      >
                        + Add Task
                      </button>
                    </div>
                  </div>

                  {showAddTask && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <input
                        className="form-control"
                        placeholder="Enter task name..."
                        value={newTaskInput}
                        onChange={e => setNewTaskInput(e.target.value)}
                        style={{ flex: 1, fontSize: '13px' }}
                      />
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          if (!newTaskInput.trim()) return;
                          setChecklistTasks(prev => [
                            ...prev,
                            { id: `ev-t-${Date.now()}`, title: newTaskInput.trim(), owners: [{ name: 'Coordinator', type: 'user' }], status: 'not_started' }
                          ]);
                          setNewTaskInput('');
                          setShowAddTask(false);
                        }}
                        style={{ background: '#0D9488', borderColor: '#0D9488', fontSize: '12px', padding: '0 14px' }}
                      >
                        Add
                      </button>
                    </div>
                  )}

                  {/* Progress bar */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                      <div style={{ width: '120px', height: '6px', background: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${(checklistTasks.filter(t => t.status === 'complete').length / Math.max(checklistTasks.length, 1)) * 100}%`,
                          height: '100%',
                          background: '#0D9488',
                          borderRadius: '999px',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                        {checklistTasks.filter(t => t.status === 'complete').length} of {checklistTasks.length} tasks complete
                      </span>
                    </div>
                  </div>

                  {/* Tasks Table */}
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: '#64748B' }}>
                          <th style={{ padding: '10px 14px' }}>Task</th>
                          <th style={{ padding: '10px 14px' }}>Task owners</th>
                          <th style={{ padding: '10px 14px' }}>Status</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {checklistTasks.map(task => {
                          const isComplete = task.status === 'complete';
                          const isInProgress = task.status === 'in_progress';
                          return (
                            <tr key={task.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '12px 14px', fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                                {task.title}
                              </td>

                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                  {(task.owners || []).map((ow, idx) => (
                                    <span key={idx} style={{
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      background: '#F1F5F9',
                                      color: '#334155',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      border: '1px solid #E2E8F0'
                                    }}>
                                      {ow.name} ({ow.type})
                                    </span>
                                  ))}
                                </div>
                              </td>

                              <td style={{ padding: '12px 14px' }}>
                                {isComplete ? (
                                  <div style={{ background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '4px 8px', display: 'inline-block' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534' }}>Complete</div>
                                    <div style={{ fontSize: '10px', color: '#15803D' }}>Completed by {task.completedBy || 'Coordinator'}</div>
                                  </div>
                                ) : isInProgress ? (
                                  <span style={{ fontSize: '11px', fontWeight: 700, background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', padding: '3px 8px', borderRadius: '6px' }}>
                                    In progress
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '11px', fontWeight: 600, background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0', padding: '3px 8px', borderRadius: '6px' }}>
                                    Not started
                                  </span>
                                )}
                              </td>

                              <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '10px', alignItems: 'center' }}>
                                  {isComplete ? (
                                    <button
                                      onClick={() => {
                                        setChecklistTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'in_progress' } : t));
                                      }}
                                      style={{ background: 'none', border: 'none', padding: 0, color: '#0284C7', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                                    >
                                      Reassign
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setChecklistTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'complete', completedBy: 'Admin' } : t));
                                      }}
                                      style={{ background: 'none', border: 'none', padding: 0, color: '#0284C7', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                                    >
                                      Mark complete
                                    </button>
                                  )}

                                  <button
                                    onClick={() => {
                                      setAssignModalTask(task);
                                      setAssigneeForm({ name: '', type: 'user' });
                                    }}
                                    style={{ background: 'none', border: 'none', padding: 0, color: '#0284C7', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                                  >
                                    + Assign
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <p style={{ margin: '12px 0 0 0', fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>
                    Changing the template will not change this event checklist.
                  </p>
                </div>
              </div>
            )}

            {/* ── TAB 2: EVENT DETAILS ── */}
            {eventViewTab === 'details' && (
              <div>
                <div className="card mb-md" style={{ background: '#F8FAFC', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <div>
                    <label className="text-muted text-xs" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={13} /> Date
                    </label>
                    <strong>{viewingEvent.startDate === viewingEvent.endDate ? viewingEvent.startDate || viewingEvent.date : `${viewingEvent.startDate || viewingEvent.date} to ${viewingEvent.endDate || viewingEvent.date}`}</strong>
                  </div>
                  <div>
                    <label className="text-muted text-xs" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} /> Time
                    </label>
                    <strong>{viewingEvent.isAllDay ? 'All Day' : (viewingEvent.time || viewingEvent.startTime || '—')}</strong>
                  </div>
                  <div>
                    <label className="text-muted text-xs" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={13} /> Location
                    </label>
                    <strong>{viewingEvent.location || 'Clubhouse'}</strong>
                  </div>
                  <div>
                    <label className="text-muted text-xs" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={13} /> Target
                    </label>
                    <strong>{viewingEvent.assignedUserName ? viewingEvent.assignedUserName : viewingEvent.assignedGroupName || 'Open to All'}</strong>
                  </div>
                </div>

                {viewingEvent.description && (
                  <div className="card mb-md" style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <h5 style={{ margin: '0 0 8px 0', fontSize: '13px', textTransform: 'uppercase', color: '#64748B' }}>Description</h5>
                    <p style={{ margin: 0, lineHeight: 1.6, whiteSpace: 'pre-line', fontSize: '13px', color: '#334155' }}>{viewingEvent.description}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 3: ATTENDEES ── */}
            {eventViewTab === 'attendees' && (
              <div className="card mb-md" style={{ padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <h5 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600 }}>
                  RSVP Responses ({Object.keys(viewingEvent.rsvps || viewingEvent.rsvp || {}).length})
                </h5>
                {Object.keys(viewingEvent.rsvps || viewingEvent.rsvp || {}).length === 0 ? (
                  <p className="text-muted text-sm" style={{ margin: 0 }}>No RSVPs submitted yet for this event.</p>
                ) : (
                  <div className="flex gap-xs" style={{ flexWrap: 'wrap' }}>
                    {Object.entries(viewingEvent.rsvps || viewingEvent.rsvp || {}).map(([userId, status], idx) => (
                      <span key={idx} className={`badge ${status === 'yes' ? 'badge-success' : status === 'no' ? 'badge-danger' : 'badge-warning'}`}>
                        {userId}: {status}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="form-actions mt-md" style={{ marginTop: '20px' }}>
              <button className="btn btn-primary" onClick={() => setViewingEvent(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Assign Task Owner */}
      <Modal open={!!assignModalTask} onClose={() => setAssignModalTask(null)} title="Assign Task Owner">
        {assignModalTask && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>
              Assign owner for task: <strong>{assignModalTask.title}</strong>
            </p>
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 700 }}>Owner Type</label>
              <select
                className="form-control"
                value={assigneeForm.type}
                onChange={e => setAssigneeForm({ ...assigneeForm, type: e.target.value })}
              >
                <option value="user">User / Member</option>
                <option value="group">Group / Committee</option>
                <option value="team">Team</option>
              </select>
            </div>
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 700 }}>Owner Name / Assignee</label>
              <input
                className="form-control"
                placeholder="e.g. Coordinator / Committee / First Aid"
                value={assigneeForm.name}
                onChange={e => setAssigneeForm({ ...assigneeForm, name: e.target.value })}
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => setAssignModalTask(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (!assigneeForm.name.trim()) return;
                  setChecklistTasks(prev => prev.map(t => {
                    if (t.id === assignModalTask.id) {
                      const updatedOwners = [...(t.owners || []), { name: assigneeForm.name.trim(), type: assigneeForm.type }];
                      return { ...t, owners: updatedOwners };
                    }
                    return t;
                  }));
                  setAssignModalTask(null);
                }}
                style={{ background: '#0D9488', borderColor: '#0D9488' }}
              >
                Assign
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
