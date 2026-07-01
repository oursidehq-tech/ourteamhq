import { useEffect, useRef, useState } from 'react';
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import ClubSelector from '../components/ClubSelector';
import Modal from '../components/Modal';
import TeamGroupDetail from '../components/TeamGroupDetail';
import { parseImportFile, downloadCsvTemplate } from '../utils/bulkImport';
import { Search, Plus, Edit2, Trash2, Upload, Download, Eye } from 'lucide-react';

export default function TeamsPage() {
  const { selectedClubId } = useClub();
  const [teams, setTeams] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | team obj
  const [viewingItem, setViewingItem] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const col = () => collection(db, 'clubs', selectedClubId, 'teams');

  const fetch = async () => {
    if (!selectedClubId) return;
    try {
      const snap = await getDocs(query(col(), orderBy('createdAt', 'desc')));
      setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      const snap = await getDocs(col());
      setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
  };

  useEffect(() => { fetch(); }, [selectedClubId]);

  const filtered = teams.filter(t =>
    t.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.ageGroup?.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setForm({ name: '', ageGroup: '', description: '' }); setModal('add'); };
  const openEdit = (team) => { setForm({ name: team.name || '', ageGroup: team.ageGroup || '', description: team.description || '' }); setModal(team); };

  const handleSave = async () => {
    if (!form.name?.trim()) return alert('Team name is required');
    setSaving(true);
    try {
      if (modal === 'add') {
        const ref = doc(col());
        await setDoc(ref, { ...form, memberIds: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        await setDoc(doc(db, 'clubs', selectedClubId, 'groups', ref.id), {
          groupId: ref.id,
          groupName: form.name,
          groupType: 'Team',
          source: 'team',
          sourceId: ref.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } else {
        await updateDoc(doc(db, 'clubs', selectedClubId, 'teams', modal.id), { ...form, updatedAt: serverTimestamp() });
        if (form.name) {
          await setDoc(doc(db, 'clubs', selectedClubId, 'groups', modal.id), {
            groupId: modal.id,
            groupName: form.name,
            groupType: 'Team',
            source: 'team',
            sourceId: modal.id,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
      }
      await fetch();
      setModal(null);
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  const handleDelete = async (team) => {
    if (!window.confirm(`Delete team "${team.name}"?`)) return;
    await deleteDoc(doc(db, 'clubs', selectedClubId, 'teams', team.id));
    await deleteDoc(doc(db, 'clubs', selectedClubId, 'groups', team.id));
    await fetch();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClubId) return;

    setImporting(true);
    try {
      const { rows, errors } = await parseImportFile(file);
      if (errors.length) {
        alert(errors.join('\n'));
        return;
      }

      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      let created = 0;

      for (const row of rows) {
        const name = String(row.name || row.team_name || '').trim();
        if (!name) continue;

        const teamRef = doc(col());
        const groupRef = doc(db, 'clubs', selectedClubId, 'groups', teamRef.id);
        
        const data = {
          name,
          ageGroup: row.age_group || row.agegroup || '',
          division: row.division || '',
          coachName: row.coach_name || row.coach || '',
          description: row.description || '',
          memberIds: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        batch.set(teamRef, data);
        batch.set(groupRef, {
          groupId: teamRef.id,
          groupName: name,
          groupType: 'Team',
          source: 'team',
          sourceId: teamRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });

        created += 1;
      }

      if (created === 0) {
        alert('No valid rows found. Check required columns (name).');
        return;
      }

      await batch.commit();
      await fetch();
      alert(`Imported ${created} teams successfully.`);
    } catch (err) {
      alert(err.message);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  if (viewingItem) {
    return (
      <TeamGroupDetail 
        item={viewingItem} 
        itemType="team" 
        selectedClubId={selectedClubId} 
        onClose={() => setViewingItem(null)} 
      />
    );
  }

  return (
    <div>
      <div className="page-header">
        <div><h1>Teams</h1><p>Manage teams and squads</p></div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            <Upload size={16} /> {importing ? 'Importing...' : 'Bulk Import'}
          </button>
          <button
            className="btn btn-outline"
            onClick={() => downloadCsvTemplate('teams-template.csv', ['name', 'age_group', 'division', 'coach_name', 'description'])}
          >
            <Download size={16} /> Download Template
          </button>
          <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".csv,.xlsx" hidden />
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} />Add Team</button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <h3>{filtered.length} Team{filtered.length !== 1 ? 's' : ''}</h3>
          <div className="search-box"><Search size={16} /><input placeholder="Search teams…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        </div>
        <table>
          <thead><tr><th>Team Name</th><th>Age Group</th><th>Members</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="table-empty">No teams found</td></tr>
            ) : filtered.map(t => (
              <tr key={t.id}>
                <td><strong>{t.name}</strong></td>
                <td>{t.ageGroup || '—'}</td>
                <td>{t.memberIds?.length || 0}</td>
                <td className="text-sm text-muted">{t.createdAt?.toDate?.().toLocaleDateString() || '—'}</td>
                <td>
                  <div className="flex gap-sm">
                    <button className="btn-icon" onClick={() => setViewingItem(t)} title="View Details"><Eye size={15} /></button>
                    <button className="btn-icon" onClick={() => openEdit(t)} title="Edit"><Edit2 size={15} /></button>
                    <button className="btn-icon danger" onClick={() => handleDelete(t)} title="Delete"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'add' ? 'Add Team' : 'Edit Team'}>
        <div className="form-group"><label>Team Name</label><input className="form-control" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div className="form-group"><label>Age Group / Division</label><input className="form-control" placeholder="e.g. U15 Boys Premier" value={form.ageGroup || ''} onChange={e => setForm({ ...form, ageGroup: e.target.value })} /></div>
        <div className="form-group"><label>Description</label><textarea className="form-control" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : modal === 'add' ? 'Create Team' : 'Save Changes'}</button>
        </div>
      </Modal>
    </div>
  );
}
