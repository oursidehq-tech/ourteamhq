import { useEffect, useState } from 'react';
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import Modal from '../components/Modal';
import MultiSelect from '../components/MultiSelect';
import { Search, Plus, Edit2, Trash2, Calendar, RefreshCw } from 'lucide-react';

export default function EventsPage() {
  const { selectedClubId } = useClub();
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
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
      setMembers(membersSnap.docs.map(d => ({
        id: d.id,
        name: d.data().displayName || d.data().name || d.id
      })));

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
        assignedGroupId: form.assignedGroupIds?.[0] || null,
        assignedGroupIds: mergedGroupIds,
        assignedGroupName: mergedGroupNames.join(', '),
        groupType: form.assignedTeamIds?.length > 0 ? 'Team' : 'Committee',
        openToAll: mergedGroupIds.length === 0 && (form.assignedUserIds || []).length === 0,
        updatedAt: serverTimestamp()
      };

      if (modal === 'add') {
        const ref = doc(col());
        await setDoc(ref, {
          ...eventPayload,
          rsvp: {},
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
              <tr key={e.id}>
                <td><strong>{e.title}</strong></td>
                <td>{e.startDate === e.endDate ? e.startDate || e.date : `${e.startDate || e.date} to ${e.endDate || e.date}`}</td>
                <td>{e.isAllDay ? <span className="badge badge-info">All Day</span> : (e.time || e.startTime || '—')}</td>
                <td>{e.location || '—'}</td>
                <td><span className={`badge ${typeBadge(e.type)}`}>{e.type || '—'}</span></td>
                <td>{e.assignedUserName ? `👤 ${e.assignedUserName}` : e.assignedGroupName || <span className="text-muted text-sm">Open to All</span>}</td>
                <td>{Object.keys(e.rsvp || {}).length}</td>
                <td>
                  <div className="flex gap-sm">
                    <button className="btn-icon" onClick={() => openEdit(e)}><Edit2 size={15} /></button>
                    <button className="btn-icon danger" onClick={() => handleDelete(e)}><Trash2 size={15} /></button>
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
    </div>
  );
}
