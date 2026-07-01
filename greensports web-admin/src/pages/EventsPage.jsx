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

  // Team and group dropdowns
  const [teams, setTeams] = useState([]);
  const [groups, setGroups] = useState([]);

  const col = () => collection(db, 'clubs', selectedClubId, 'events');

  const fetchClubOptions = async () => {
    if (!selectedClubId) return;
    try {
      // 1. Fetch Teams
      const teamsSnap = await getDocs(collection(db, 'clubs', selectedClubId, 'teams'));
      setTeams(teamsSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name || d.id
      })));

      // 2. Fetch Groups
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

  const openAdd = () => {
    setForm({
      title: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      time: '18:00',
      location: '',
      type: 'training',
      assignedTeamIds: [],
      assignedGroupIds: []
    });
    setModal('add');
  };

  const openEdit = (ev) => {
    setForm({
      title: ev.title || '',
      description: ev.description || '',
      date: ev.date || '',
      time: ev.time || '',
      location: ev.location || '',
      type: ev.type || 'training',
      assignedTeamIds: ev.teamId ? [ev.teamId] : (ev.assignedGroupIds || []).filter(id => teams.some(t => t.id === id)),
      assignedGroupIds: (ev.assignedGroupIds || []).filter(id => groups.some(g => g.id === id))
    });
    setModal(ev);
  };

  const handleSave = async () => {
    if (!form.title?.trim()) return alert('Event title is required');
    setSaving(true);
    try {
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

      const eventPayload = {
        title: form.title.trim(),
        description: form.description || '',
        date: form.date,
        startDate: form.date,
        endDate: form.date,
        time: form.time || '',
        startTime: form.time || '',
        endTime: '',
        isAllDay: false,
        location: form.location || '',
        type: form.type || 'training',
        category: form.type || 'training',
        teamId: form.assignedTeamIds?.[0] || null,
        assignedGroupId: form.assignedGroupIds?.[0] || null,
        assignedGroupIds: mergedGroupIds,
        assignedGroupName: mergedGroupNames.join(', '),
        groupType: form.assignedTeamIds?.length > 0 ? 'Team' : 'Committee',
        openToAll: mergedGroupIds.length === 0,
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
              <th>Assigned Groups</th>
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
                <td>{e.date || '—'}</td>
                <td>{e.time || '—'}</td>
                <td>{e.location || '—'}</td>
                <td><span className={`badge ${typeBadge(e.type)}`}>{e.type || '—'}</span></td>
                <td>{e.assignedGroupName || <span className="text-muted text-sm">Open to All</span>}</td>
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
              <div className="form-group"><label>Date</label><input className="form-control" type="date" value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} required /></div>
              <div className="form-group"><label>Time</label><input className="form-control" type="time" value={form.time || ''} onChange={e => setForm({ ...form, time: e.target.value })} /></div>
            </div>
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
            <div className="form-group"><label>Description</label><textarea className="form-control" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} style={{ height: '80px' }} /></div>
          </div>

          {/* Right Column */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: 12 }}>Linkages &amp; Visibility</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: 16 }}>
              Leave the fields empty to make the event visible to all members (Open to All).
            </p>
            
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
