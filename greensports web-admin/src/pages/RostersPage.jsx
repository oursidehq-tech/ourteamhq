import { useEffect, useState } from 'react';
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import Modal from '../components/Modal';
import MultiSelect from '../components/MultiSelect';
import { Search, Plus, Edit2, Trash2, Users, Eye, RefreshCw } from 'lucide-react';

export default function RostersPage() {
  const { selectedClubId } = useClub();
  const [rosters, setRosters] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Options for assignment
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

  const col = () => collection(db, 'clubs', selectedClubId, 'rosters');

  const fetchClubOptions = async () => {
    if (!selectedClubId) return;
    try {
      const membersSnap = await getDocs(collection(db, 'clubs', selectedClubId, 'members'));
      setMembers(membersSnap.docs.map(d => ({
        id: `user_${d.id}`,
        rawId: d.id,
        type: 'user',
        name: `👤 ${d.data().displayName || d.data().name || d.id}`
      })));

      const teamsSnap = await getDocs(collection(db, 'clubs', selectedClubId, 'teams'));
      setTeams(teamsSnap.docs.map(d => ({
        id: `team_${d.id}`,
        rawId: d.id,
        type: 'team',
        name: `👥 ${d.data().name || d.id}`
      })));

      const groupsSnap = await getDocs(collection(db, 'clubs', selectedClubId, 'groups'));
      setGroups(groupsSnap.docs.map(d => ({
        id: `group_${d.id}`,
        rawId: d.id,
        type: 'group',
        name: `🏛️ ${d.data().groupName || d.id}`
      })));
    } catch (err) {
      console.error('Error fetching club options:', err);
    }
  };

  const fetch = async () => {
    if (!selectedClubId) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(col(), orderBy('createdAt', 'desc')));
      setRosters(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      const snap = await getDocs(col());
      setRosters(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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

  const combinedOptions = [
    ...(members.length > 0 ? [{ id: 'hdr_users', name: 'Users / Members', isHeader: true }, ...members] : []),
    ...(teams.length > 0 ? [{ id: 'hdr_teams', name: 'Teams', isHeader: true }, ...teams] : []),
    ...(groups.length > 0 ? [{ id: 'hdr_groups', name: 'Groups / Committees', isHeader: true }, ...groups] : []),
  ];

  const filtered = rosters.filter(r =>
    r.title?.toLowerCase().includes(search.toLowerCase())
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

  const blank = { 
    title: '', 
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    isAllDay: false,
    shifts: [{ role: '', startTime: '', endTime: '', assignedIds: [] }] 
  };

  const openAdd = () => { 
    setForm(structuredClone(blank)); 
    setRepeatPreset('none');
    setModal('add'); 
  };

  const openEdit = (r) => { 
    setForm({ 
      title: r.title || '', 
      startDate: r.startDate || r.date || '',
      endDate: r.endDate || r.date || '',
      isAllDay: !!r.isAllDay,
      shifts: r.shifts?.length ? r.shifts.map(s => ({ ...s, assignedIds: s.assignedIds || [] })) : [{ role: '', startTime: '', endTime: '', assignedIds: [] }] 
    }); 
    if (r.isRecurring && r.recurringRule) {
      const rule = r.recurringRule;
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
    setModal(r); 
  };

  const addShift = () => setForm(f => ({ ...f, shifts: [...f.shifts, { role: '', startTime: '', endTime: '', assignedIds: [] }] }));
  const removeShift = (i) => setForm(f => ({ ...f, shifts: f.shifts.filter((_, idx) => idx !== i) }));
  const updateShift = (i, key, val) => setForm(f => {
    const shifts = [...f.shifts];
    shifts[i] = { ...shifts[i], [key]: val };
    return { ...f, shifts };
  });

  const handleSave = async () => {
    if (!form.title?.trim()) return alert('Roster title is required');
    if (!form.startDate) return alert('Start date is required');
    setSaving(true);
    try {
      const recurringRule = buildRecurringRule(form.startDate);
      
      const shiftsWithNames = form.shifts.map(s => {
        const selectedObjs = (s.assignedIds || []).map(id => combinedOptions.find(o => o.id === id)).filter(Boolean);
        const assignedNames = selectedObjs.map(o => (o.name || '').replace(/^[👤👥🏛️]\s*/, '')).filter(Boolean);
        
        const userIds = selectedObjs.filter(o => o.type === 'user').map(o => o.rawId);
        const teamIds = selectedObjs.filter(o => o.type === 'team').map(o => o.rawId);
        const groupIds = selectedObjs.filter(o => o.type === 'group').map(o => o.rawId);
        const mergedGroupIds = [...teamIds, ...groupIds];

        return {
          ...s,
          assignedIds: s.assignedIds || [],
          assignedUserIds: userIds,
          assignedTeamIds: teamIds,
          assignedGroupIds: mergedGroupIds,
          assignedUserId: userIds[0] || '',
          assignedGroupId: mergedGroupIds[0] || null,
          teamId: teamIds[0] || null,
          filledByName: assignedNames.join(', ') || s.filledByName || '',
        };
      });

      const data = { 
        title: form.title.trim(), 
        date: form.startDate, // Legacy support
        startDate: form.startDate,
        endDate: form.endDate || form.startDate,
        isAllDay: !!form.isAllDay,
        isRecurring: !!recurringRule,
        recurringRule,
        shifts: shiftsWithNames.filter(s => s.role), 
        updatedAt: serverTimestamp() 
      };

      if (modal === 'add') {
        const ref = doc(col());
        await setDoc(ref, { ...data, createdBy: 'admin', createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'clubs', selectedClubId, 'rosters', modal.id), data);
      }
      await fetch();
      setModal(null);
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`Delete roster "${r.title}"?`)) return;
    await deleteDoc(doc(db, 'clubs', selectedClubId, 'rosters', r.id));
    await fetch();
  };

  const getWeekDayName = (dayIdx) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIdx] || '';

  return (
    <div>
      <div className="page-header">
        <div><h1>Rosters</h1><p>Manage volunteer and duty rosters</p></div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={fetch} style={{ marginRight: 8 }}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} />New Roster</button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <h3>{filtered.length} Roster{filtered.length !== 1 ? 's' : ''}</h3>
          <div className="search-box"><Search size={16} /><input placeholder="Search rosters…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        </div>
        <table>
          <thead><tr><th>Title</th><th>Scheduled Period</th><th>Recurrence</th><th>Shifts</th><th>Filled</th><th></th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="table-empty">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="table-empty">No rosters found</td></tr>
            ) : filtered.map(r => {
              const shifts = r.shifts || [];
              const filled = shifts.filter(s => (s.assignedIds && s.assignedIds.length > 0) || s.filledByName || s.filledBy).length;
              return (
                <tr key={r.id}>
                  <td><strong>{r.title}</strong></td>
                  <td>
                    <div style={{ fontSize: '13px' }}>
                      {r.startDate === r.endDate ? r.startDate : `${r.startDate || r.date} to ${r.endDate || r.date}`}
                      {r.isAllDay && <div className="text-muted text-sm" style={{ fontWeight: 600, color: 'var(--primary)' }}>All Day</div>}
                    </div>
                  </td>
                  <td>
                    {r.isRecurring ? (
                      <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <RefreshCw size={10} /> {r.recurringRule?.frequency || 'recurring'}
                      </span>
                    ) : '—'}
                  </td>
                  <td><span className="badge badge-info"><Users size={12} style={{ marginRight: 4 }} />{shifts.length}</span></td>
                  <td>{filled}/{shifts.length}</td>
                  <td>
                    <div className="flex gap-sm">
                      <button className="btn-icon" onClick={() => setDetail(r)}><Eye size={15} /></button>
                      <button className="btn-icon" onClick={() => openEdit(r)}><Edit2 size={15} /></button>
                      <button className="btn-icon danger" onClick={() => handleDelete(r)}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.title || 'Roster Detail'} wide>
        {detail && (
          <>
            <p style={{ marginBottom: 12, color: 'var(--text-light)' }}>Scheduled: {detail.startDate || detail.date || 'Not set'}</p>
            <table>
              <thead><tr><th>Role</th><th>Start</th><th>End</th><th>Assigned To</th></tr></thead>
              <tbody>
                {(detail.shifts || []).map((s, i) => (
                  <tr key={i}>
                    <td><strong>{s.role || '—'}</strong></td>
                    <td>{s.startTime || '—'}</td>
                    <td>{s.endTime || '—'}</td>
                    <td>{s.filledByName || (s.filledBy ? s.filledBy : <em style={{ color: 'var(--text-lighter)' }}>Unfilled</em>)}</td>
                  </tr>
                ))}
                {(!detail.shifts || detail.shifts.length === 0) && <tr><td colSpan={4} className="table-empty">No shifts</td></tr>}
              </tbody>
            </table>
          </>
        )}
      </Modal>

      {/* Add / Edit modal */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'add' ? 'New Roster' : 'Edit Roster'} wide={true}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          {/* Left Column: Basic Details & Recurrence */}
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

          {/* Right Column: Shifts */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: 12 }}>Shifts</h4>
            {(form.shifts || []).map((s, i) => (
              <div key={i} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '12px', background: 'var(--surface)', position: 'relative' }}>
                <button className="btn-icon danger" onClick={() => removeShift(i)} style={{ position: 'absolute', top: 8, right: 8, padding: 4 }} title="Remove Shift"><Trash2 size={14} /></button>
                <div className="form-group" style={{ marginBottom: 12, paddingRight: 24 }}><label style={{ fontSize: 11 }}>Role</label><input className="form-control" value={s.role} onChange={e => updateShift(i, 'role', e.target.value)} /></div>
                
                {!form.isAllDay && (
                  <div className="form-row" style={{ marginBottom: 12 }}>
                    <div className="form-group" style={{ margin: 0 }}><label style={{ fontSize: 11 }}>Start</label><input className="form-control" type="time" value={s.startTime} onChange={e => updateShift(i, 'startTime', e.target.value)} /></div>
                    <div className="form-group" style={{ margin: 0 }}><label style={{ fontSize: 11 }}>End</label><input className="form-control" type="time" value={s.endTime} onChange={e => updateShift(i, 'endTime', e.target.value)} /></div>
                  </div>
                )}
                
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 11 }}>Assigned To</label>
                  <MultiSelect
                    options={combinedOptions}
                    selectedValues={s.assignedIds || []}
                    onChange={vals => updateShift(i, 'assignedIds', vals)}
                    placeholder="Select users, teams, or groups..."
                  />
                </div>
              </div>
            ))}
            <button className="btn btn-outline" onClick={addShift} style={{ marginTop: 4, width: '100%' }}><Plus size={14} />Add Shift</button>

            <div className="form-actions" style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : modal === 'add' ? 'Create Roster' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
