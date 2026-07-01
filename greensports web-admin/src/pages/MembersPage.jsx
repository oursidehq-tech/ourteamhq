import { useEffect, useState, useRef } from 'react';
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch, setDoc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import ClubSelector from '../components/ClubSelector';
import Modal from '../components/Modal';
import MultiSelect from '../components/MultiSelect';
import { parseImportFile, downloadCsvTemplate } from '../utils/bulkImport';
import { Search, Edit2, Trash2, UserX, Check, Upload, Download, MoreVertical, ShieldAlert, UserCheck, UserPlus } from 'lucide-react';
import { onSnapshot, orderBy } from 'firebase/firestore';

export default function MembersPage() {
  const { selectedClubId, selectedClub } = useClub();
  const { isOwnerOf, isSuperAdmin } = useAuth();
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ roles: [] });
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [requests, setRequests] = useState([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  
  const [teams, setTeams] = useState([]);
  const [groups, setGroups] = useState([]);

  // Owner or Super Admin can assign Admin role
  const canAssignAdmin = selectedClubId ? (isOwnerOf(selectedClubId) || isSuperAdmin) : false;
  const rolesList = ['Player', 'Parent', 'Coach', 'Manager', 'Volunteer', 'Admin', 'Registrar', 'Shop Manager', 'Owner'];

  const fetchMembers = async () => {
    if (!selectedClubId) return;
    const snap = await getDocs(collection(db, 'clubs', selectedClubId, 'members'));
    setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setSelectedIds([]);
  };

  const fetchClubOptions = async () => {
    if (!selectedClubId) return;
    try {
      const teamsSnap = await getDocs(collection(db, 'clubs', selectedClubId, 'teams'));
      setTeams(teamsSnap.docs.map(d => ({ id: d.id, name: d.data().name || d.id })));

      const groupsSnap = await getDocs(collection(db, 'clubs', selectedClubId, 'groups'));
      setGroups(groupsSnap.docs.map(d => ({ id: d.id, name: d.data().groupName || d.id })));
    } catch (err) { console.error(err); }
  };

  useEffect(() => { 
    fetchMembers(); 
    fetchClubOptions();
  }, [selectedClubId]);

  useEffect(() => {
    if (!selectedClubId) return;
    const q = query(
      collection(db, 'clubs', selectedClubId, 'roleChangeRequests'),
      where('status', '==', 'pending')
    );
    return onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [selectedClubId]);

  const filtered = members.filter(m =>
    m.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    m.email?.toLowerCase().includes(search.toLowerCase()) ||
    (m.roles || [m.role]).some(r => r?.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) setSelectedIds([]);
    else setSelectedIds(filtered.map(m => m.id));
  };

  const openEdit = (member) => {
    const roles = member.roles || (member.role ? [member.role] : []);
    setForm({ 
      displayName: member.displayName || '', 
      roles, 
      email: member.email || '',
      teamIds: member.teamIds || [],
      groupIds: member.groupIds || []
    });
    setEditing(member);
  };

  const toggleRole = (role) => {
    // Note: User says Admins should be able to assign roles including Owner
    // But we'll add a confirmation for Owner role.
    setForm(prev => {
      const roles = prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role];
      return { ...prev, roles };
    });
  };

  const handleApproveRequest = async (request) => {
    if (!selectedClubId || !request) return;
    setSaving(true);
    try {
      const { userId, requestedRole, requestedRoles } = request;
      const nextRoles = Array.isArray(requestedRoles) && requestedRoles.length > 0
        ? requestedRoles
        : [requestedRole];
      
      const primaryRole = nextRoles.includes('Owner') ? 'Owner' : (nextRoles.includes('Admin') ? 'Admin' : nextRoles[0]);

      // Check if we are demoting the last owner
      const targetMember = members.find(m => m.id === userId);
      if (!targetMember) throw new Error('Target member not found in current list.');
      
      const isCurrentlyOwner = (targetMember?.roles || [targetMember?.role]).includes('Owner');
      const willBeOwner = nextRoles.includes('Owner');
      
      if (isCurrentlyOwner && !willBeOwner) {
        const otherOwners = members.filter(m => m.id !== userId && (m.roles || [m.role]).includes('Owner'));
        if (otherOwners.length === 0) {
          setEditing(targetMember); // Set for transfer modal context
          setForm({ role: primaryRole, roles: nextRoles }); // Set target roles for transfer
          setShowTransferModal(true);
          setSaving(false);
          return;
        }
      }

      // 1. Update Member doc
      await updateDoc(doc(db, 'clubs', selectedClubId, 'members', userId), {
        role: primaryRole,
        roles: nextRoles,
        updatedAt: serverTimestamp(),
      });

      // 2. Mark request as approved
      await updateDoc(doc(db, 'clubs', selectedClubId, 'roleChangeRequests', userId), {
        status: 'approved',
        updatedAt: serverTimestamp(),
      });

      // 3. Sync User profile
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const memberships = userSnap.data().clubMemberships || [];
        const updated = memberships.map(m =>
          m.clubId === selectedClubId ? { ...m, role: primaryRole, roles: nextRoles } : m
        );
        const accountType = nextRoles.includes('Owner') ? 'owner' : (nextRoles.includes('Admin') ? 'admin' : 'member');
        await updateDoc(userRef, { clubMemberships: updated, accountType, updatedAt: serverTimestamp() });
      }

      alert('Request approved and role updated.');
      await fetchMembers();
    } catch (err) { alert('Approval failed: ' + err.message); }
    setSaving(false);
  };

  const handleRejectRequest = async (requestId) => {
    if (!selectedClubId || !requestId) return;
    const reason = window.prompt('Enter reason for rejection (optional):');
    if (reason === null) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'clubs', selectedClubId, 'roleChangeRequests', requestId), {
        status: 'rejected',
        rejectReason: reason,
        updatedAt: serverTimestamp(),
      });
      alert('Request rejected.');
    } catch (err) { alert('Rejection failed: ' + err.message); }
    setSaving(false);
  };

  const handleTransferOwnership = async () => {
    if (!selectedClubId || !editing || !newOwnerId) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Promote new owner
      const newOwnerRef = doc(db, 'clubs', selectedClubId, 'members', newOwnerId);
      const newOwnerSnap = await getDoc(newOwnerRef);
      const newOwnerData = newOwnerSnap.data();
      const currentRoles = newOwnerData?.roles || [newOwnerData?.role || 'Player'];
      const nextRoles = Array.from(new Set([...currentRoles, 'Owner']));
      
      batch.update(newOwnerRef, { role: 'Owner', roles: nextRoles, updatedAt: serverTimestamp() });
      
      // 2. Demote old owner
      const oldOwnerRef = doc(db, 'clubs', selectedClubId, 'members', editing.id);
      batch.update(oldOwnerRef, { role: form.role || 'Player', roles: form.roles, updatedAt: serverTimestamp() });
      
      // 3. Mark any pending request for this user as approved
      const pendingReq = requests.find(r => r.userId === editing.id);
      if (pendingReq) {
        batch.update(doc(db, 'clubs', selectedClubId, 'roleChangeRequests', editing.id), {
          status: 'approved',
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();
      
      // 4. Sync user profiles (Real-time update for Mobile App)
      try {
        // Sync New Owner
        const newUserRef = doc(db, 'users', newOwnerId);
        const newUserSnap = await getDoc(newUserRef);
        if (newUserSnap.exists()) {
          const memberships = newUserSnap.data().clubMemberships || [];
          const updated = memberships.map(m =>
            m.clubId === selectedClubId ? { ...m, role: 'Owner', roles: nextRoles } : m
          );
          await updateDoc(newUserRef, { clubMemberships: updated, accountType: 'owner', updatedAt: serverTimestamp() });
        }

        // Sync Old Owner
        const oldUserRef = doc(db, 'users', editing.id);
        const oldUserSnap = await getDoc(oldUserRef);
        if (oldUserSnap.exists()) {
          const memberships = oldUserSnap.data().clubMemberships || [];
          const updated = memberships.map(m =>
            m.clubId === selectedClubId ? { ...m, role: form.role || 'Player', roles: form.roles } : m
          );
          const accountType = form.roles.includes('Owner') ? 'owner' : (form.roles.includes('Admin') ? 'admin' : 'member');
          await updateDoc(oldUserRef, { clubMemberships: updated, accountType, updatedAt: serverTimestamp() });
        }
      } catch (syncErr) {
        console.warn('Profile sync failed (non-critical):', syncErr);
      }
      
      alert('Ownership transferred and profiles synced successfully.');
      setShowTransferModal(false);
      setEditing(null);
      await fetchMembers();
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  const handleSave = async () => {
    if (!editing || !selectedClubId) return;
    if (form.roles.length === 0) return alert('Please select at least one role.');
    setSaving(true);
    try {
      const primaryRole = form.roles[0];
      const data = {
        displayName: form.displayName,
        roles: form.roles,
        role: primaryRole,
        teamIds: form.teamIds || [],
        groupIds: form.groupIds || [],
        updatedAt: serverTimestamp(),
      };

      const isRemovingOwner = editing.role === 'Owner' && !form.roles.includes('Owner');
      const otherOwners = members.filter(m => m.id !== editing.id && (m.roles || [m.role]).includes('Owner'));
      
      if (isRemovingOwner && otherOwners.length === 0) {
        setShowTransferModal(true);
        setSaving(false);
        return;
      }

      await updateDoc(doc(db, 'clubs', selectedClubId, 'members', editing.id), data);

      const userRef = doc(db, 'users', editing.id);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const memberships = userSnap.data().clubMemberships || [];
        const updated = memberships.map(m =>
          m.clubId === selectedClubId ? { ...m, role: primaryRole, roles: form.roles } : m
        );
        const accountType = form.roles.includes('Owner') ? 'owner' : (form.roles.includes('Admin') ? 'admin' : 'member');
        await updateDoc(userRef, { clubMemberships: updated, accountType, updatedAt: serverTimestamp() });
      }

      await fetchMembers();
      setEditing(null);
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  const handleBulkRoleAssign = async (role) => {
    if (selectedIds.length === 0) return;
    if (role === 'Admin' && !canAssignAdmin) return alert('Only owners can assign the Admin role.');
    if (!window.confirm(`Assign "${role}" role to ${selectedIds.length} members?`)) return;

    setSaving(true);
    try {
      const batch = writeBatch(db);
      for (const id of selectedIds) {
        const memberRef = doc(db, 'clubs', selectedClubId, 'members', id);
        batch.update(memberRef, { role, roles: [role], updatedAt: serverTimestamp() });
      }
      await batch.commit();
      await fetchMembers();
      alert('Bulk role assignment successful.');
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  const handleBulkRemove = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Remove ${selectedIds.length} members from the club?`)) return;

    setSaving(true);
    try {
      const batch = writeBatch(db);
      for (const id of selectedIds) {
        batch.delete(doc(db, 'clubs', selectedClubId, 'members', id));
      }
      await batch.commit();
      await fetchMembers();
      alert('Members removed successfully.');
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  const buildGroupIds = (role, teamIds) => {
    const ids = new Set();
    (teamIds || []).forEach((id) => {
      if (!id) return;
      ids.add(id);
      ids.add(`team:${id}`);
    });

    const normalizedRole = String(role || '').trim().toLowerCase();
    if ([
      'owner',
      'admin',
      'president',
      'vice president',
      'vice-president',
      'executive',
    ].includes(normalizedRole)) {
      ids.add('executive');
      ids.add('group:executive');
    }
    if ([
      'committee',
      'treasurer',
      'secretary',
      'registrar',
      'coordinator',
    ].includes(normalizedRole)) {
      ids.add('committee');
      ids.add('group:committee');
    }

    return Array.from(ids);
  };

  const parseIdList = (value) =>
    String(value || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

  const parseRoles = (value) =>
    String(value || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

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

      const batch = writeBatch(db);
      let created = 0;

      for (const row of rows) {
        const email = String(row.email || '').trim().toLowerCase();
        const displayName = row.name || row.display_name || row.display || '';
        if (!email || !displayName) continue;

        const roles = parseRoles(row.roles || row.role || 'Player');
        const primaryRole = roles[0] || 'Player';
        const teamIds = parseIdList(row.team_ids || row.teamids || row.teams || '');
        const extraGroupIds = parseIdList(row.group_ids || row.groupids || row.groups || '');
        const groupIds = Array.from(new Set([...buildGroupIds(primaryRole, teamIds), ...extraGroupIds]));

        const userSnap = await getDocs(
          query(collection(db, 'users'), where('email', '==', email))
        );
        const userId = userSnap.empty ? email : userSnap.docs[0].id;

        const memberRef = doc(db, 'clubs', selectedClubId, 'members', userId);
        batch.set(
          memberRef,
          {
            uid: userId,
            displayName,
            email,
            role: primaryRole,
            roles,
            teamIds,
            groupIds,
            joinedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            importSource: 'bulk',
          },
          { merge: true }
        );
        created += 1;
      }

      if (created === 0) {
        alert('No valid rows found. Check required columns (name, email).');
        return;
      }

      await batch.commit();
      await fetchMembers();
      alert(`Imported ${created} members successfully.`);
    } catch (err) {
      alert(err.message);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div>
      <div className="page-header">
        <div><h1>Members & Players</h1><p>Bulk manage club roster and roles</p></div>
        <div className="page-actions flex gap-sm">
          <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            <Upload size={16} /> {importing ? 'Importing...' : 'Bulk Import'}
          </button>
          <button
            className="btn btn-outline"
            onClick={() => downloadCsvTemplate('members-template.csv', ['name', 'email', 'role', 'roles', 'team_ids', 'group_ids'])}
          >
            <Download size={16} /> Template
          </button>
          <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".csv,.xlsx" hidden />
        </div>
      </div>

      <div className="card glass-card" style={{ marginBottom: 32, padding: '20px 24px' }}>
        <div className="card-header" style={{ marginBottom: 16 }}>
          <h3 style={{ color: 'var(--accent)' }}>
            <UserCheck size={20} style={{ marginRight: 8 }} />
            Role Change Requests {requests.length > 0 ? <span className="badge badge-warning" style={{ marginLeft: 8 }}>{requests.length}</span> : ''}
          </h3>
        </div>
        <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
        <table style={{ background: 'transparent' }}>
          <thead>
            <tr>
              <th>Member</th>
              <th>Current Role</th>
              <th>Requested Role</th>
              <th>Reason</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr><td colSpan={5} className="table-empty" style={{ padding: '24px' }}>No pending requests</td></tr>
            ) : requests.map(req => (
              <tr key={req.id}>
                <td><strong>{req.userName || 'Unknown'}</strong></td>
                <td><span className="badge">{req.currentRole}</span></td>
                <td><span className="badge badge-primary">{req.requestedRole}</span></td>
                <td className="text-sm">{req.reason || <em className="text-muted">No reason provided</em>}</td>
                <td>
                  <div className="flex gap-sm">
                    <button className="btn btn-primary btn-sm" onClick={() => handleApproveRequest(req)} disabled={saving}>Approve</button>
                    <button className="btn btn-outline btn-sm" onClick={() => handleRejectRequest(req.id)} disabled={saving}>Reject</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

      {selectedIds.length > 0 && (
        <div className="bulk-actions-bar">
          <div className="flex items-center gap-md">
            <ShieldAlert size={20} className="text-warning" />
            <span><strong>{selectedIds.length}</strong> members selected</span>
          </div>
          <div className="flex gap-sm">
            <select className="form-control form-control-sm" onChange={(e) => handleBulkRoleAssign(e.target.value)} defaultValue="">
              <option value="" disabled>Bulk Assign Role...</option>
              {rolesList.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button className="btn btn-danger btn-sm" onClick={handleBulkRemove}>Remove Selected</button>
            <button className="btn btn-outline btn-sm" onClick={() => setSelectedIds([])}>Cancel</button>
          </div>
        </div>
      )}

      <div className="table-container">
        <div className="table-toolbar">
          <h3>{filtered.length} Member{filtered.length !== 1 ? 's' : ''}</h3>
          <div className="search-box">
            <Search size={16} />
            <input placeholder="Search by name, email or role…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}><input type="checkbox" checked={selectedIds.length === filtered.length && filtered.length > 0} onChange={toggleSelectAll} /></th>
              <th>Member</th>
              <th>Email</th>
              <th>Roles</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="table-empty">No members found</td></tr>
            ) : filtered.map(m => {
              const roles = m.roles || (m.role ? [m.role] : ['Player']);
              return (
                <tr key={m.id} className={selectedIds.includes(m.id) ? 'row-selected' : ''}>
                  <td><input type="checkbox" checked={selectedIds.includes(m.id)} onChange={() => toggleSelect(m.id)} /></td>
                  <td><strong>{m.displayName || 'Unknown'}</strong></td>
                  <td className="text-sm text-muted">{m.email || '—'}</td>
                  <td>
                    <div className="flex gap-sm flex-wrap">
                      {roles.map(r => (
                        <span key={r} className={`badge ${r === 'Owner' ? 'badge-danger' : r === 'Admin' ? 'badge-warning' : 'badge-info'}`}>
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="text-sm text-muted">{m.joinedAt?.toDate?.().toLocaleDateString() || '—'}</td>
                  <td>
                    <div className="flex gap-sm">
                      <button className="btn-icon" onClick={() => openEdit(m)} title="Edit Roles"><Edit2 size={15} /></button>
                      <button className="btn-icon danger" onClick={() => handleBulkRemove()} title="Remove Member"><UserX size={15} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Manage Member Roles">
        <div className="form-group"><label>Display Name</label><input className="form-control" value={form.displayName || ''} onChange={e => setForm({ ...form, displayName: e.target.value })} /></div>
        <div className="form-group"><label>Email Address</label><input className="form-control" value={form.email || ''} disabled /></div>
        
        <div className="form-group">
          <label>Assign Roles</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            {rolesList.map(r => {
              const active = form.roles.includes(r);
              const disabled = r === 'Admin' && !canAssignAdmin;
              return (
                <div 
                  key={r} 
                  className={`role-select-card ${active ? 'active' : ''}`} 
                  style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer', padding: '10px', flexDirection: 'row', justifyContent: 'flex-start' }}
                  onClick={() => !disabled && toggleRole(r)}
                >
                  <div style={{ width: 18, height: 18, border: '2px solid var(--border)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'var(--primary)' : '#fff', borderColor: active ? 'var(--primary)' : 'var(--border)' }}>
                    {active && <Check size={14} color="#fff" />}
                  </div>
                  <span style={{ marginLeft: 8 }}>{r}</span>
                </div>
              );
            })}
          </div>
          {!canAssignAdmin && <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>Owner privileges required to assign 'Admin' role.</p>}
        </div>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>Assign to Teams</label>
          <MultiSelect
            options={teams}
            selectedValues={form.teamIds || []}
            onChange={vals => setForm({ ...form, teamIds: vals })}
            placeholder="Select teams..."
          />
        </div>
        <div className="form-group" style={{ marginTop: 16 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>Assign to Groups</label>
          <MultiSelect
            options={groups}
            selectedValues={form.groupIds || []}
            onChange={vals => setForm({ ...form, groupIds: vals })}
            placeholder="Select groups..."
          />
        </div>

        <div className="form-actions" style={{ marginTop: 24 }}>
          <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Updating Member…' : 'Save Roles'}</button>
        </div>
      </Modal>

      <Modal open={showTransferModal} onClose={() => setShowTransferModal(false)} title="Transfer Club Ownership">
        <p style={{ fontSize: 14, marginBottom: 16 }}>
          You are removing the <strong>Owner</strong> role from <strong>{editing?.displayName}</strong>. 
          Every club must have at least one owner. Please select a member to become the new Owner.
        </p>
        
        <div className="form-group">
          <label>Select Successor</label>
          <select className="form-control" value={newOwnerId} onChange={e => setNewOwnerId(e.target.value)}>
            <option value="">Choose a member...</option>
            {members.filter(m => m.id !== editing?.id).map(m => (
              <option key={m.id} value={m.id}>{m.displayName} ({m.role})</option>
            ))}
          </select>
        </div>

        <div className="form-actions" style={{ marginTop: 24 }}>
          <button className="btn btn-outline" onClick={() => setShowTransferModal(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={handleTransferOwnership} disabled={!newOwnerId || saving}>
            {saving ? 'Transferring...' : 'Transfer Ownership & Demote'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
