import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import Modal from '../components/Modal';
import MultiSelect from '../components/MultiSelect';
import { Search, Plus, Trash2, Eye } from 'lucide-react';

export default function PostsPage() {
  const { selectedClubId } = useClub();
  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [teams, setTeams] = useState([]);
  const [groups, setGroups] = useState([]);
  const [viewMode, setViewMode] = useState('updates');

  const col = () => collection(db, 'clubs', selectedClubId, 'posts');

  const fetch = async () => {
    if (!selectedClubId) return;
    try {
      const snap = await getDocs(query(col(), orderBy('createdAt', 'desc')));
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      const snap = await getDocs(col());
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
  };

  useEffect(() => { fetch(); }, [selectedClubId]);

  useEffect(() => {
    if (!selectedClubId) return;
    const fetchRefs = async () => {
      const [teamSnap, groupSnap] = await Promise.all([
        getDocs(collection(db, 'clubs', selectedClubId, 'teams')),
        getDocs(collection(db, 'clubs', selectedClubId, 'groups')),
      ]);
      setTeams(teamSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setGroups(groupSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchRefs();
  }, [selectedClubId]);

  const filtered = useMemo(() => {
    const filteredPosts = posts.filter(p => {
      if (viewMode === 'updates') {
        const category = String(p.category || '').toLowerCase();
        const type = String(p.type || '').toLowerCase();
        if (category !== 'updates' && type !== 'update') return false;
      }
      return true;
    });

    const queryText = search.toLowerCase();
    return filteredPosts.filter(p =>
      p.content?.toLowerCase().includes(queryText) ||
      p.authorName?.toLowerCase().includes(queryText)
    );
  }, [posts, search, viewMode]);

  const openAdd = () => {
    setForm({
      content: '',
      visibility: 'Club-Only',
      type: 'update',
      authorName: 'Admin',
      visibilityTargetIds: [],
    });
    setModal('add');
  };

  const handleCreate = async () => {
    if (!form.content?.trim()) return alert('Post content is required');
    setSaving(true);
    try {
      const ref = doc(col());

      const teamIds = (form.visibilityTargetIds || []).filter(id => id.startsWith('team_')).map(id => id.replace('team_', ''));
      const groupIds = (form.visibilityTargetIds || []).filter(id => id.startsWith('group_')).map(id => id.replace('group_', ''));

      await setDoc(ref, {
        content: form.content.trim(),
        visibility: form.visibility,
        type: 'update',
        category: 'Updates',
        authorId: 'admin',
        authorName: form.authorName || 'Admin',
        imageUrl: '',
        teamIds,
        groupIds,
        createdAt: serverTimestamp(),
      });
      await fetch();
      setModal(null);
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  const handleDelete = async (post) => {
    if (!window.confirm('Delete this post?')) return;
    await deleteDoc(doc(db, 'clubs', selectedClubId, 'posts', post.id));
    await fetch();
  };

  const vizBadge = (v) => {
    const value = String(v || '').toLowerCase();
    if (value === 'public') return 'badge-success';
    if (value === 'network') return 'badge-info';
    return 'badge-default';
  };

  const resolveLink = (post) => {
    const parts = [];
    if (post.teamIds && post.teamIds.length > 0) {
      const tNames = teams.filter(t => post.teamIds.includes(t.id)).map(t => t.name);
      if (tNames.length > 0) parts.push(`Teams: ${tNames.join(', ')}`);
    } else if (post.teamId) {
      const team = teams.find(t => t.id === post.teamId);
      if (team) parts.push(`Team: ${team.name}`);
    }
    
    if (post.groupIds && post.groupIds.length > 0) {
      const gNames = groups.filter(g => post.groupIds.includes(g.id)).map(g => g.groupName || g.name);
      if (gNames.length > 0) parts.push(`Groups: ${gNames.join(', ')}`);
    } else if (post.groupId) {
      const group = groups.find(g => g.id === post.groupId);
      if (group) parts.push(`Group: ${group.groupName || group.name}`);
    }
    
    return parts.length > 0 ? parts.join(' | ') : '—';
  };

  return (
    <div>
      <div className="page-header">
        <div><h1>{viewMode === 'updates' ? 'Updates' : 'Posts'}</h1><p>Manage club announcements and feed updates</p></div>
        <div className="page-actions">
          <select className="form-control" value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
            <option value="updates">Updates Only</option>
            <option value="all">All Posts</option>
          </select>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} />New Post</button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <h3>{filtered.length} {viewMode === 'updates' ? 'Update' : 'Post'}{filtered.length !== 1 ? 's' : ''}</h3>
          <div className="search-box"><Search size={16} /><input placeholder="Search posts…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        </div>
        <table>
          <thead><tr><th>Content</th><th>Author</th><th>Visibility</th><th>Linked</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="table-empty">No posts found</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id}>
                <td><span className="text-truncate" style={{ display: 'block' }}>{p.content?.substring(0, 80)}{p.content?.length > 80 ? '…' : ''}</span></td>
                <td>{p.authorName || '—'}</td>
                <td><span className={`badge ${vizBadge(p.visibility)}`}>{p.visibility || 'Club-Only'}</span></td>
                <td className="text-sm">{resolveLink(p)}</td>
                <td className="text-sm text-muted">{p.createdAt?.toDate?.().toLocaleDateString() || '—'}</td>
                <td>
                  <div className="flex gap-sm">
                    <button className="btn-icon" onClick={() => setViewing(p)} title="View"><Eye size={15} /></button>
                    <button className="btn-icon danger" onClick={() => handleDelete(p)} title="Delete"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Post Modal */}
      <Modal open={modal === 'add'} onClose={() => setModal(null)} title="Create Post">
        <div className="form-group"><label>Content</label><textarea className="form-control" rows={4} value={form.content || ''} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Write your post…" /></div>
        <div className="form-row">
          <div className="form-group">
            <label>Visibility</label>
            <select className="form-control" value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value })}>
              <option value="Club-Only">Club Only</option><option value="Public">Public</option><option value="Network">Network</option>
            </select>
          </div>
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: 6 }}>Visibility Targets</label>
            <MultiSelect
              options={[
                { id: 'header_teams', name: 'Teams', isHeader: true },
                ...teams.map(t => ({ id: `team_${t.id}`, name: t.name })),
                { id: 'header_groups', name: 'Groups', isHeader: true },
                ...groups.map(g => ({ id: `group_${g.id}`, name: g.groupName || g.name })),
              ]}
              selectedValues={form.visibilityTargetIds || []}
              onChange={vals => setForm({ ...form, visibilityTargetIds: vals })}
              placeholder="Select teams or groups..."
            />
          </div>
        </div>
        <div className="form-group"><label>Author Name</label><input className="form-control" value={form.authorName || ''} onChange={e => setForm({ ...form, authorName: e.target.value })} /></div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>{saving ? 'Posting…' : 'Publish Post'}</button>
        </div>
      </Modal>

      {/* View Post Modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Post Detail">
        {viewing && (
          <div>
            <p style={{ lineHeight: 1.7, marginBottom: 16 }}>{viewing.content}</p>
            <p className="text-sm text-muted">By: {viewing.authorName} • {viewing.createdAt?.toDate?.().toLocaleString() || '—'}</p>
            <p className="text-sm text-muted">Visibility: {viewing.visibility} • Type: {viewing.type} • Linked: {resolveLink(viewing)}</p>
            {viewing.imageUrl && <img src={viewing.imageUrl} alt="" style={{ width: '100%', borderRadius: 8, marginTop: 12 }} />}
          </div>
        )}
      </Modal>
    </div>
  );
}
