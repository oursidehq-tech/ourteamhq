import { useEffect, useState } from 'react';
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import Modal from '../components/Modal';
import { Search, Plus, Edit2, Trash2, Users, Eye } from 'lucide-react';

export default function RostersPage() {
  const { selectedClubId } = useClub();
  const [rosters, setRosters] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const col = () => collection(db, 'clubs', selectedClubId, 'rosters');

  const fetch = async () => {
    if (!selectedClubId) return;
    try {
      const snap = await getDocs(query(col(), orderBy('date', 'desc')));
      setRosters(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      const snap = await getDocs(col());
      setRosters(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
  };

  useEffect(() => { fetch(); }, [selectedClubId]);

  const filtered = rosters.filter(r =>
    r.title?.toLowerCase().includes(search.toLowerCase())
  );

  const blank = { title: '', date: '', shifts: [{ role: '', startTime: '', endTime: '', filledBy: '', filledByName: '' }] };
  const openAdd = () => { setForm(structuredClone(blank)); setModal('add'); };
  const openEdit = (r) => { setForm({ title: r.title || '', date: r.date || '', shifts: r.shifts?.length ? r.shifts.map(s => ({ ...s })) : [{ role: '', startTime: '', endTime: '', filledBy: '', filledByName: '' }] }); setModal(r); };

  const addShift = () => setForm(f => ({ ...f, shifts: [...f.shifts, { role: '', startTime: '', endTime: '', filledBy: '', filledByName: '' }] }));
  const removeShift = (i) => setForm(f => ({ ...f, shifts: f.shifts.filter((_, idx) => idx !== i) }));
  const updateShift = (i, key, val) => setForm(f => {
    const shifts = [...f.shifts];
    shifts[i] = { ...shifts[i], [key]: val };
    return { ...f, shifts };
  });

  const handleSave = async () => {
    if (!form.title?.trim()) return alert('Roster title is required');
    setSaving(true);
    try {
      const data = { title: form.title, date: form.date, shifts: form.shifts.filter(s => s.role), updatedAt: serverTimestamp() };
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

  return (
    <div>
      <div className="page-header">
        <div><h1>Rosters</h1><p>Manage volunteer and duty rosters</p></div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} />New Roster</button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <h3>{filtered.length} Roster{filtered.length !== 1 ? 's' : ''}</h3>
          <div className="search-box"><Search size={16} /><input placeholder="Search rosters…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        </div>
        <table>
          <thead><tr><th>Title</th><th>Date</th><th>Shifts</th><th>Filled</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="table-empty">No rosters found</td></tr>
            ) : filtered.map(r => {
              const shifts = r.shifts || [];
              const filled = shifts.filter(s => s.filledByName || s.filledBy).length;
              return (
                <tr key={r.id}>
                  <td><strong>{r.title}</strong></td>
                  <td>{r.date || '—'}</td>
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
            <p style={{ marginBottom: 12, color: 'var(--text-light)' }}>Date: {detail.date || 'Not set'}</p>
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
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'add' ? 'New Roster' : 'Edit Roster'} wide>
        <div className="form-row">
          <div className="form-group"><label>Title</label><input className="form-control" value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div className="form-group"><label>Date</label><input className="form-control" type="date" value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
        </div>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>Shifts</h4>
        {(form.shifts || []).map((s, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr .7fr .7fr 1fr auto', gap: 8, alignItems: 'end', marginBottom: 8 }}>
            <div className="form-group" style={{ margin: 0 }}><label style={{ fontSize: 11 }}>Role</label><input className="form-control" value={s.role} onChange={e => updateShift(i, 'role', e.target.value)} /></div>
            <div className="form-group" style={{ margin: 0 }}><label style={{ fontSize: 11 }}>Start</label><input className="form-control" type="time" value={s.startTime} onChange={e => updateShift(i, 'startTime', e.target.value)} /></div>
            <div className="form-group" style={{ margin: 0 }}><label style={{ fontSize: 11 }}>End</label><input className="form-control" type="time" value={s.endTime} onChange={e => updateShift(i, 'endTime', e.target.value)} /></div>
            <div className="form-group" style={{ margin: 0 }}><label style={{ fontSize: 11 }}>Assigned To</label><input className="form-control" value={s.filledByName} onChange={e => updateShift(i, 'filledByName', e.target.value)} /></div>
            <button className="btn-icon danger" onClick={() => removeShift(i)} style={{ marginBottom: 2 }}><Trash2 size={14} /></button>
          </div>
        ))}
        <button className="btn btn-outline" onClick={addShift} style={{ marginTop: 4 }}><Plus size={14} />Add Shift</button>

        <div className="form-actions" style={{ marginTop: 20 }}>
          <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : modal === 'add' ? 'Create Roster' : 'Save Changes'}</button>
        </div>
      </Modal>
    </div>
  );
}
