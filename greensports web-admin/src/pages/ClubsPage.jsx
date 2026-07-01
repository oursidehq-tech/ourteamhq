import { useState } from 'react';
import { collection, doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { Search, Edit2, Trash2, Plus, Copy, Check } from 'lucide-react';

const generateInviteCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
};

export default function ClubsPage() {
  const { clubs, refreshClubs } = useClub();
  const { user, profile, isOwnerOf, isSuperAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({});
  const [copied, setCopied] = useState(null);

  const filtered = clubs.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.sport?.toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (club) => {
    setForm({ name: club.name || '', sport: club.sport || '', location: club.location || '', description: club.description || '', plan: club.plan || 'Free', website: club.website || '' });
    setEditing(club);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'clubs', editing.id), { ...form, updatedAt: serverTimestamp() });
      await refreshClubs();
      setEditing(null);
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  const openCreate = () => {
    setNewForm({ name: '', sport: 'Football', location: '', description: '', website: '', plan: 'Free', adminEmail: '' });
    setCreating(true);
  };

  const handleCreate = async () => {
    if (!newForm.name?.trim()) return alert('Club name is required');
    setSaving(true);
    try {
      const ref = doc(collection(db, 'clubs'));
      const inviteCode = generateInviteCode();

      const adminUid = user?.uid || 'admin';
      const adminName = profile?.displayName || user?.displayName || 'Admin';
      const adminEmail = newForm.adminEmail?.trim() || profile?.email || user?.email || '';

      await setDoc(ref, {
        name: newForm.name.trim(),
        sport: newForm.sport || 'Football',
        location: newForm.location || '',
        description: newForm.description || '',
        website: newForm.website || '',
        plan: newForm.plan || 'Free',
        inviteCode,
        planType: (newForm.plan || 'free').toLowerCase(),
        subscriptionStatus: 'active',
        contact: { email: adminEmail, phone: '' },
        keyPeople: [{ name: adminName, role: 'Owner', uid: adminUid }],
        createdBy: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create owner as member of the club
      await setDoc(doc(db, 'clubs', ref.id, 'members', adminUid), {
        uid: adminUid,
        displayName: adminName,
        email: adminEmail,
        role: 'Owner',
        teamIds: [],
        joinedAt: serverTimestamp(),
      });

      // Update owner's clubMemberships
      const userRef = doc(db, 'users', adminUid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const memberships = userSnap.data().clubMemberships || [];
        if (!memberships.find(m => m.clubId === ref.id)) {
          memberships.push({ clubId: ref.id, clubName: newForm.name.trim(), role: 'Owner', teamIds: [] });
          await updateDoc(userRef, { clubMemberships: memberships, updatedAt: serverTimestamp() });
        }
      }

      await refreshClubs();
      setCreating(false);
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  const handleDelete = async (club) => {
    if (!isSuperAdmin && !isOwnerOf(club.id)) return alert('Only the club Owner or Super Admin can delete this club.');
    if (!window.confirm(`Delete "${club.name}"? This cannot be undone.`)) return;
    await deleteDoc(doc(db, 'clubs', club.id));
    await refreshClubs();
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div>
      <div className="page-header">
        <div><h1>Clubs</h1><p>Manage your clubs</p></div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Add Club</button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <h3>{filtered.length} Club{filtered.length !== 1 ? 's' : ''}</h3>
          <div className="search-box">
            <Search size={16} />
            <input placeholder="Search clubs…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <table>
          <thead><tr><th>Club Name</th><th>Sport</th><th>Location</th><th>Invite Code</th><th>Plan</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="table-empty">No clubs found</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.sport || '—'}</td>
                <td>{c.location || '—'}</td>
                <td>
                  <span className="badge badge-info" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => c.inviteCode && copyCode(c.inviteCode)}>
                    {c.inviteCode || '—'}
                    {c.inviteCode && (copied === c.inviteCode ? <Check size={12} /> : <Copy size={12} />)}
                  </span>
                </td>
                <td><span className="badge badge-success">{c.plan || 'Free'}</span></td>
                <td className="text-sm text-muted">{c.createdAt?.toDate?.().toLocaleDateString() || '—'}</td>
                <td>
                  <div className="flex gap-sm">
                    <button className="btn-icon" onClick={() => openEdit(c)}><Edit2 size={15} /></button>
                    {(isSuperAdmin || isOwnerOf(c.id)) && <button className="btn-icon danger" onClick={() => handleDelete(c)}><Trash2 size={15} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Club Modal */}
      <Modal open={creating} onClose={() => setCreating(false)} title="Add New Club">
        <div className="form-row">
          <div className="form-group"><label>Club Name *</label><input className="form-control" placeholder="e.g. Easts Tigers FC" value={newForm.name || ''} onChange={e => setNewForm({ ...newForm, name: e.target.value })} /></div>
          <div className="form-group"><label>Sport</label><input className="form-control" placeholder="Football" value={newForm.sport || ''} onChange={e => setNewForm({ ...newForm, sport: e.target.value })} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Location</label><input className="form-control" placeholder="City, Region" value={newForm.location || ''} onChange={e => setNewForm({ ...newForm, location: e.target.value })} /></div>
          <div className="form-group"><label>Website</label><input className="form-control" placeholder="https://…" value={newForm.website || ''} onChange={e => setNewForm({ ...newForm, website: e.target.value })} /></div>
        </div>
        <div className="form-group"><label>Description</label><textarea className="form-control" placeholder="About the club…" value={newForm.description || ''} onChange={e => setNewForm({ ...newForm, description: e.target.value })} /></div>
        <div className="form-group">
          <label>Plan</label>
          <select className="form-control" value={newForm.plan || 'Free'} onChange={e => setNewForm({ ...newForm, plan: e.target.value })}>
            <option>Free</option><option>Starter</option><option>Growth</option><option>Premium</option>
          </select>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-lighter)', marginBottom: 12 }}>You will be assigned as the club Owner. A 6-digit invite code will be auto-generated for members to join.</p>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setCreating(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>{saving ? 'Creating…' : 'Create Club'}</button>
        </div>
      </Modal>

      {/* Edit Club Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Club">
        <div className="form-row">
          <div className="form-group"><label>Club Name</label><input className="form-control" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="form-group"><label>Sport</label><input className="form-control" value={form.sport || ''} onChange={e => setForm({ ...form, sport: e.target.value })} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Location</label><input className="form-control" value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
          <div className="form-group"><label>Website</label><input className="form-control" value={form.website || ''} onChange={e => setForm({ ...form, website: e.target.value })} /></div>
        </div>
        <div className="form-group"><label>Description</label><textarea className="form-control" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div className="form-group">
          <label>Plan</label>
          <select className="form-control" value={form.plan || 'Free'} onChange={e => setForm({ ...form, plan: e.target.value })}>
            <option>Free</option><option>Starter</option><option>Growth</option><option>Premium</option>
          </select>
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </Modal>
    </div>
  );
}
