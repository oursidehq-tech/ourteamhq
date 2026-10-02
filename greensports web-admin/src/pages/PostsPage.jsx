import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import Modal from '../components/Modal';
import MultiSelect from '../components/MultiSelect';
import { Search, Plus, Trash2, Eye, Edit2 } from 'lucide-react';
import { updateDoc } from 'firebase/firestore';

export default function PostsPage() {
  const { selectedClubId } = useClub();
  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // 'add' | 'edit'
  const [editingPost, setEditingPost] = useState(null);
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
    setEditingPost(null);
    setForm({
      content: '',
      visibility: 'Club-Only',
      type: 'update',
      authorName: 'Admin',
      visibilityTargetIds: [],
    });
    setModal('add');
  };

  const openEdit = (post) => {
    setEditingPost(post);
    const targetIds = [
      ...(post.teamIds || []).map(id => `team_${id}`),
      ...(post.groupIds || []).map(id => `group_${id}`),
      ...(post.teamId ? [`team_${post.teamId}`] : []),
      ...(post.groupId ? [`group_${post.groupId}`] : []),
    ];
    setForm({
      content: post.content || '',
      visibility: post.visibility || 'Club-Only',
      type: post.type || 'update',
      authorName: post.authorName || 'Admin',
      visibilityTargetIds: Array.from(new Set(targetIds)),
    });
    setViewing(null);
    setModal('edit');
  };

  const handleSave = async () => {
    if (!form.content?.trim()) return alert('Post content is required');
    setSaving(true);
    try {
      const teamIds = (form.visibilityTargetIds || []).filter(id => id.startsWith('team_')).map(id => id.replace('team_', ''));
      const groupIds = (form.visibilityTargetIds || []).filter(id => id.startsWith('group_')).map(id => id.replace('group_', ''));
      const assignedGroupIds = [...groupIds, ...teamIds].map(id => String(id).toLowerCase());

      const payload = {
        clubId: selectedClubId,
        content: form.content.trim(),
        visibility: form.visibility || (teamIds.length > 0 ? 'Team-Only' : 'Club-Only'),
        type: 'update',
        category: 'Updates',
        authorName: form.authorName || 'Admin',
        teamId: teamIds[0] || null,
        teamIds,
        groupId: groupIds[0] || null,
        groupIds,
        assignedGroupId: groupIds[0] || teamIds[0] || null,
        assignedGroupIds,
        updatedAt: serverTimestamp(),
      };

      if (modal === 'edit' && editingPost) {
        const postRef = doc(db, 'clubs', selectedClubId, 'posts', editingPost.id);
        await updateDoc(postRef, payload);
        alert('Post updated successfully!');
      } else {
        const ref = doc(col());
        await setDoc(ref, {
          ...payload,
          authorId: 'admin',
          imageUrl: '',
          isPinned: false,
          likedBy: [],
          comments: [],
          createdAt: serverTimestamp(),
        });
        alert('Post created successfully!');
      }
      await fetch();
      setModal(null);
      setEditingPost(null);
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
              <tr 
                key={p.id} 
                className="clickable-row" 
                onClick={(e) => {
                  if (!e.target.closest('button')) setViewing(p);
                }}
              >
                <td><span className="text-truncate" style={{ display: 'block', fontWeight: 500 }}>{p.content?.substring(0, 80)}{p.content?.length > 80 ? '…' : ''}</span></td>
                <td>{p.authorName || '—'}</td>
                <td><span className={`badge ${vizBadge(p.visibility)}`}>{p.visibility || 'Club-Only'}</span></td>
                <td className="text-sm">{resolveLink(p)}</td>
                <td className="text-sm text-muted">{p.createdAt?.toDate?.().toLocaleDateString() || '—'}</td>
                <td>
                  <div className="flex gap-sm">
                    <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setViewing(p); }} title="View Details"><Eye size={15} /></button>
                    <button className="btn-icon" onClick={(e) => { e.stopPropagation(); openEdit(p); }} title="Edit Post"><Edit2 size={15} /></button>
                    <button className="btn-icon danger" onClick={(e) => { e.stopPropagation(); handleDelete(p); }} title="Delete Post"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Post Modal */}
      <Modal open={modal === 'add' || modal === 'edit'} onClose={() => { setModal(null); setEditingPost(null); }} title={modal === 'edit' ? "Edit Post" : "Create Post"}>
        <div className="form-group"><label>Content <span className="text-danger">*</span></label><textarea className="form-control" rows={4} value={form.content || ''} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Write your post…" required /></div>
        <div className="form-row">
          <div className="form-group">
            <label>Visibility</label>
            <select className="form-control" value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value })}>
              <option value="Club-Only">Club Only</option>
              <option value="Team-Only">Team Only</option>
              <option value="Public">Public</option>
              <option value="Network">Network</option>
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
          <button className="btn btn-outline" onClick={() => { setModal(null); setEditingPost(null); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : modal === 'edit' ? 'Save Changes' : 'Publish Post'}
          </button>
        </div>
      </Modal>

      {/* View Post Modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Post Detail">
        {viewing && (
          <div>
            <p style={{ lineHeight: 1.7, marginBottom: 16, fontSize: '15px' }}>{viewing.content}</p>
            <div className="card mb-md" style={{ background: 'var(--bg)', padding: '12px' }}>
              <p className="text-sm text-muted" style={{ margin: '0 0 4px 0' }}><strong>Author:</strong> {viewing.authorName} • <strong>Date:</strong> {viewing.createdAt?.toDate?.().toLocaleString() || '—'}</p>
              <p className="text-sm text-muted" style={{ margin: 0 }}><strong>Visibility:</strong> {viewing.visibility} • <strong>Type:</strong> {viewing.type} • <strong>Target:</strong> {resolveLink(viewing)}</p>
            </div>
            {viewing.imageUrl && <img src={viewing.imageUrl} alt="" style={{ width: '100%', borderRadius: 8, marginTop: 12 }} />}
            <div className="form-actions mt-md" style={{ justifyContent: 'space-between' }}>
              <button className="btn btn-outline danger" onClick={() => { handleDelete(viewing); setViewing(null); }}>
                <Trash2 size={15} /> Delete
              </button>
              <div className="flex gap-sm">
                <button className="btn btn-outline" onClick={() => setViewing(null)}>Close</button>
                <button className="btn btn-primary" onClick={() => openEdit(viewing)}>
                  <Edit2 size={15} /> Edit Post
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
