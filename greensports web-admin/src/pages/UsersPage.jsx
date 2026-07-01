import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { Search, Edit2, Trash2, Shield, User, Star, Mail, Calendar, Hash } from 'lucide-react';

export default function UsersPage() {
  const { isSuperAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Fetch users failed:', err);
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) fetchUsers();
  }, [isSuperAdmin]);

  const filtered = users.filter(u =>
    u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.accountType?.toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (user) => {
    setForm({ 
      displayName: user.displayName || '', 
      accountType: user.accountType || 'member',
      email: user.email || '',
      phone: user.phone || '',
    });
    setEditing(user);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', editing.id), {
        displayName: form.displayName,
        email: form.email,
        accountType: form.accountType,
        phone: form.phone,
        updatedAt: serverTimestamp(),
      });
      await fetchUsers();
      setEditing(null);
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  const handleDelete = async (user) => {
    if (user.accountType === 'superadmin') return alert('Cannot delete a Super Admin.');
    if (!window.confirm(`Delete user "${user.displayName || user.email}"? This will remove their profile data.`)) return;
    try {
      await deleteDoc(doc(db, 'users', user.id));
      await fetchUsers();
    } catch (err) { alert(err.message); }
  };

  const accountTypeBadge = (type) => {
    if (type === 'superadmin') return <span className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={12} /> Super Admin</span>;
    if (type === 'owner') return <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Star size={12} /> Club Owner</span>;
    return <span className="badge badge-default" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={12} /> Member</span>;
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-xl text-center">
        <h2>Access Denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Platform Users</h1>
          <p>Global database management for all registered users</p>
        </div>
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <div className="flex items-center gap-md">
            <h3>{filtered.length} Total Users</h3>
            <div className="badge badge-info">{users.filter(u => u.accountType === 'superadmin').length} Admins</div>
          </div>
          <div className="search-box">
            <Search size={16} />
            <input 
              placeholder="Search by name, email or role…" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>User Information</th>
              <th>System Role</th>
              <th>Contact</th>
              <th>Clubs</th>
              <th>Joined Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="table-empty">Fetching platform data…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="table-empty">No matching users found</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id}>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong style={{ fontSize: 15 }}>{u.displayName || 'Unnamed User'}</strong>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Mail size={10} /> {u.email}
                    </span>
                  </div>
                </td>
                <td>{accountTypeBadge(u.accountType)}</td>
                <td className="text-sm">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Hash size={12} className="text-muted" /> {u.phone || 'No phone'}
                  </div>
                </td>
                <td>
                  <span className="badge badge-info">
                    {u.clubMemberships?.length || 0} Clubs
                  </span>
                </td>
                <td className="text-sm text-muted">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={12} />
                    {u.createdAt?.toDate?.().toLocaleDateString() || '—'}
                  </div>
                </td>
                <td>
                  <div className="flex gap-sm">
                    <button className="btn-icon" onClick={() => openEdit(u)} title="Edit Account">
                      <Edit2 size={15} />
                    </button>
                    {u.accountType !== 'superadmin' && (
                      <button className="btn-icon danger" onClick={() => handleDelete(u)} title="Delete Profile">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Manage Global Profile">
        <div className="form-group">
          <label>Full Name</label>
          <input 
            className="form-control" 
            value={form.displayName || ''} 
            onChange={e => setForm({ ...form, displayName: e.target.value })} 
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Email Address</label>
            <input 
              className="form-control" 
              value={form.email || ''} 
              onChange={e => setForm({ ...form, email: e.target.value })} 
            />
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <input 
              className="form-control" 
              value={form.phone || ''} 
              onChange={e => setForm({ ...form, phone: e.target.value })} 
            />
          </div>
        </div>
        <div className="form-group">
          <label>Platform Access Level</label>
          <div className="grid-roles" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div 
              className={`role-select-card ${form.accountType === 'member' ? 'active' : ''}`}
              onClick={() => setForm({ ...form, accountType: 'member' })}
            >
              <User size={20} />
              <span>Member</span>
            </div>
            <div 
              className={`role-select-card ${form.accountType === 'owner' ? 'active' : ''}`}
              onClick={() => setForm({ ...form, accountType: 'owner' })}
            >
              <Star size={20} />
              <span>Owner</span>
            </div>
            <div 
              className={`role-select-card ${form.accountType === 'superadmin' ? 'active' : ''}`}
              onClick={() => setForm({ ...form, accountType: 'superadmin' })}
            >
              <Shield size={20} />
              <span>Super Admin</span>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.4 }}>
            <b>Member:</b> Standard app access.<br/>
            <b>Owner:</b> Can create and manage their own clubs in the Admin Panel.<br/>
            <b>Super Admin:</b> Full access to all clubs and platform data.
          </p>
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Updating Profile…' : 'Save Platform Changes'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
