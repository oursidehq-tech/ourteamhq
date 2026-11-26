import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  getDocs, 
  addDoc,
  updateDoc, 
  deleteDoc,
  doc, 
  arrayRemove, 
  arrayUnion, 
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  ArrowLeft, Users, FileText, CheckSquare, Calendar, 
  Plus, Edit2, Trash2, Eye, CheckCircle2, Clock, 
  MapPin, RefreshCw, Pin, AlertTriangle, Shield, Check,
  AlertCircle
} from 'lucide-react';
import DataTable from './DataTable';
import Modal from './Modal';
import MultiSelect from './MultiSelect';
import { trainingService, DESIGN_TOKENS } from '../services/trainingService';
import { useAuth } from '../context/AuthContext';

const STAFF_ROLES = [
  { key: 'coach', role: 'Coach', nameField: 'coachName', idField: 'coachId' },
  { key: 'assistantCoach', role: 'Assistant Coach', nameField: 'assistantCoachName', idField: 'assistantCoachId' },
  { key: 'trainer', role: 'Trainer', nameField: 'trainerName', idField: 'trainerId' },
  { key: 'firstAid', role: 'First Aid Officer', nameField: 'firstAidName', idField: 'firstAidId' },
  { key: 'manager', role: 'Team Manager', nameField: 'managerName', idField: 'managerId' },
];

export default function TeamGroupDetail({ item, itemType, selectedClubId, onClose, onItemUpdated }) {
  const { user, profile } = useAuth();
  const [currentItem, setCurrentItem] = useState(item);
  const [activeTab, setActiveTab] = useState(itemType === 'team' ? 'overview' : 'members');
  const [members, setMembers] = useState([]);
  const [allClubMembers, setAllClubMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCurrentItem(item);
  }, [item]);

  // Tab Data States
  const [tabData, setTabData] = useState({
    posts: [],
    matches: [],
    tasks: [],
    events: [],
    trainingSessions: []
  });
  const [loadingTab, setLoadingTab] = useState(false);

  // Updates Subtab: 'published' | 'drafts'
  const [updatesSubTab, setUpdatesSubTab] = useState('published');
  // New Update Form State
  const [newUpdateForm, setNewUpdateForm] = useState({
    title: '',
    body: '',
    audience: `${item.name || item.groupName} — members and authorised guardians`,
    notifyAudience: true
  });
  const [postingUpdate, setPostingUpdate] = useState(false);

  // Duties & Tasks Subtab: 'upcoming' | 'completed'
  const [dutiesSubTab, setDutiesSubTab] = useState('upcoming');
  // Members & Staff Subtab: 'players' | 'parents' | 'staff'
  const [membersSubTab, setMembersSubTab] = useState('staff');

  // Add Member Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);
  const [savingMembers, setSavingMembers] = useState(false);

  // Assign Team Staff Modal
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffForm, setStaffForm] = useState({});
  const [staffSearch, setStaffSearch] = useState('');
  const [focusedStaffRole, setFocusedStaffRole] = useState(null);
  const [savingStaff, setSavingStaff] = useState(false);

  // Entity Modal (Add or Edit)
  const [activeItemModal, setActiveItemModal] = useState(null);
  const [entityForm, setEntityForm] = useState({});
  const [savingEntity, setSavingEntity] = useState(false);

  // Single Session Cancel / Reinstate Modals
  const [cancelSessionModal, setCancelSessionModal] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingSession, setCancellingSession] = useState(false);

  // Admin Bulk Training Cancellation Modal
  const [bulkCancelModalOpen, setBulkCancelModalOpen] = useState(false);
  const [bulkCancelForm, setBulkCancelForm] = useState({
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    venue: '',
    reason: ''
  });
  const [bulkPreviewSessions, setBulkPreviewSessions] = useState([]);
  const [executingBulkCancel, setExecutingBulkCancel] = useState(false);

  // Tabs list
  const tabs = itemType === 'team' ? [
    { id: 'overview', label: 'Overview', icon: <CheckCircle2 size={16} /> },
    { id: 'members', label: 'Members & Staff', icon: <Users size={16} /> },
    { id: 'matches', label: 'Matches & Events', icon: <Calendar size={16} /> },
    { id: 'tasks', label: 'Duties & Tasks', icon: <CheckSquare size={16} /> },
    { id: 'posts', label: 'Updates', icon: <FileText size={16} /> },
  ] : [
    { id: 'members', label: 'Members', icon: <Users size={16} /> },
    { id: 'posts', label: 'Updates', icon: <FileText size={16} /> },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={16} /> },
    { id: 'events', label: 'Events', icon: <Calendar size={16} /> },
  ];

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'clubs', selectedClubId, 'members'));
      const allMems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllClubMembers(allMems);
      
      const filtered = allMems.filter(m => {
        if (itemType === 'team') {
          return m.teamIds?.includes(currentItem.id) || currentItem.memberIds?.includes(m.id);
        } else {
          return m.groupIds?.includes(currentItem.id) || currentItem.memberIds?.includes(m.id);
        }
      });
      setMembers(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [item.id, selectedClubId]);

  const fetchTabData = async () => {
    setLoadingTab(true);
    try {
      const [postsSnap, matchesSnap, tasksSnap, eventsSnap, sessionsSnap] = await Promise.all([
        getDocs(query(collection(db, 'clubs', selectedClubId, 'posts'), orderBy('createdAt', 'desc'))).catch(() => getDocs(collection(db, 'clubs', selectedClubId, 'posts'))),
        getDocs(collection(db, 'clubs', selectedClubId, 'leagueFixtures')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'clubs', selectedClubId, 'tasks')).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'clubs', selectedClubId, 'events'), orderBy('date', 'desc'))).catch(() => getDocs(collection(db, 'clubs', selectedClubId, 'events'))),
        getDocs(query(collection(db, 'clubs', selectedClubId, 'trainingSessions'), orderBy('scheduledAt', 'desc'))).catch(() => getDocs(collection(db, 'clubs', selectedClubId, 'trainingSessions')))
      ]);

      const allPosts = postsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const allMatches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const allTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const allEvents = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const allSessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.isDeleted !== true);

      const teamName = item.name || item.groupName || '';

      const filteredPosts = allPosts.filter(d => 
        d.teamIds?.includes(item.id) || d.groupIds?.includes(item.id) || d.teamId === item.id || d.groupId === item.id || (d.audience && d.audience.includes(teamName))
      );

      const filteredMatches = allMatches.filter(d => 
        d.teamId === item.id || d.homeTeamId === item.id || d.awayTeamId === item.id || (d.teamIds && d.teamIds.includes(item.id)) || d.homeTeam === teamName || d.awayTeam === teamName
      );

      const filteredTasks = allTasks.filter(d => 
        d.assignedTeamIds?.includes(item.id) || d.assignedGroupIds?.includes(item.id) || d.teamId === item.id || d.assignedGroupId === item.id
      );

      const filteredEvents = allEvents.filter(d => 
        d.teamIds?.includes(item.id) || d.groupIds?.includes(item.id) || d.teamId === item.id || d.groupId === item.id || d.assignedGroupId === item.id || (d.title && d.title.includes(teamName))
      );

      const filteredSessions = allSessions.filter(d => 
        d.teamId === item.id || d.teamName === teamName
      );

      setTabData({
        posts: filteredPosts,
        matches: filteredMatches,
        tasks: filteredTasks,
        events: filteredEvents,
        trainingSessions: filteredSessions
      });
    } catch (err) {
      console.error(`Error fetching tab data:`, err);
    } finally {
      setLoadingTab(false);
    }
  };

  useEffect(() => {
    fetchTabData();
  }, [item.id, selectedClubId]);

  // Combined Activities for Matches & Events tab (Image 9)
  const combinedActivities = useMemo(() => {
    const list = [];

    // Training sessions
    (tabData.trainingSessions || []).forEach(s => {
      const isCancelled = s.status === 'cancelled';
      list.push({
        id: s.id,
        activity: 'Team training',
        type: 'Training',
        dateStr: s.scheduledAt?.slice(0, 10) || '',
        dateTime: s.scheduledAt ? `${s.scheduledAt.slice(0, 10)}${s.scheduledAt.includes('T') ? ', ' + s.scheduledAt.split('T')[1].slice(0, 5) : ''}` : 'Needs date',
        venue: s.location || 'Main Oval',
        visibility: isCancelled ? 'Cancelled' : 'Published',
        status: s.status || 'scheduled',
        cancellationReason: s.cancellationReason || '',
        responses: '—',
        raw: s,
        isSession: true
      });
    });

    // Matches & events from events collection
    (tabData.events || []).forEach(e => {
      const isMatch = e.type === 'match' || e.category === 'match' || e.category === 'fixture';
      const isCancelled = e.status === 'cancelled';
      list.push({
        id: e.id,
        activity: e.title || (isMatch ? `${item.name} Match` : 'Team event'),
        type: isMatch ? 'Match' : 'Event',
        dateStr: e.date || '',
        dateTime: e.date ? `${e.date}${e.startTime ? ', start ' + e.startTime : ''}` : 'Needs date',
        venue: e.location || 'Main Oval',
        visibility: isCancelled ? 'Cancelled' : e.status === 'draft' ? 'Draft' : 'Published',
        status: e.status || 'scheduled',
        cancellationReason: e.cancellationReason || '',
        responses: isMatch ? '12 available • 3 awaiting • 1 unavailable' : '—',
        raw: e,
        isEvent: true
      });
    });

    return list.sort((a, b) => (a.dateStr || '9999').localeCompare(b.dateStr || '9999'));
  }, [tabData.trainingSessions, tabData.events, item.name]);

  // Metric counts for Duties & Tasks (Image 10)
  const dutyMetrics = useMemo(() => {
    const tasks = tabData.tasks || [];
    const open = tasks.filter(t => t.status === 'unfilled' || !t.assignedTo).length;
    const assigned = tasks.filter(t => t.assignedTo && t.status !== 'completed').length;
    const eventTasks = tasks.filter(t => t.source || t.eventId || t.type === 'event_task' || t.checklistId).length;
    return {
      open,
      assigned,
      eventTasks
    };
  }, [tabData.tasks]);

  // Tasks list
  const displayTasks = useMemo(() => {
    return tabData.tasks || [];
  }, [tabData.tasks]);

  // Posts list
  const displayAdminPosts = useMemo(() => {
    return (tabData.posts || []).filter(p => updatesSubTab === 'published' ? p.status !== 'draft' : p.status === 'draft');
  }, [tabData.posts, updatesSubTab]);

  // Staff list for Admin Overview
  const adminStaffList = useMemo(() => {
    return STAFF_ROLES.map((sr) => ({
      ...sr,
      name: currentItem?.[sr.nameField] || null,
      status: currentItem?.[sr.nameField] ? 'green' : 'unassigned',
    }));
  }, [currentItem]);

  // Handle New Update Creation from side form (Image 1)
  const handlePublishUpdate = async (asDraft = false) => {
    if (!newUpdateForm.title.trim() || !newUpdateForm.body.trim()) {
      alert('Please fill in both update title and body.');
      return;
    }
    setPostingUpdate(true);
    try {
      const postPayload = {
        title: newUpdateForm.title.trim(),
        content: newUpdateForm.body.trim(),
        body: newUpdateForm.body.trim(),
        teamId: item.id,
        teamIds: [item.id],
        audience: newUpdateForm.audience,
        status: asDraft ? 'draft' : 'published',
        pinned: false,
        authorName: profile?.displayName || 'Team Staff',
        authorRole: 'Coach',
        notifyAudience: newUpdateForm.notifyAudience,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'clubs', selectedClubId, 'posts'), postPayload);

      // If notifyAudience checked and published, push in-app notification
      if (!asDraft && newUpdateForm.notifyAudience) {
        try {
          await addDoc(collection(db, 'clubs', selectedClubId, 'notifications'), {
            title: `${item.name || 'Team'} — ${newUpdateForm.title.trim()}`,
            message: newUpdateForm.body.trim(),
            body: newUpdateForm.body.trim(),
            recipientId: item.id,
            category: 'teams',
            clubId: selectedClubId,
            read: false,
            type: 'team_update',
            meta: { teamId: item.id },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } catch (e) {
          console.warn('Failed to dispatch notification for team post:', e);
        }
      }

      alert(asDraft ? 'Update saved as draft.' : 'Update published successfully!');
      setNewUpdateForm({
        title: '',
        body: '',
        audience: `${item.name || item.groupName} — members and authorised guardians`,
        notifyAudience: true
      });
      fetchTabData();
    } catch (err) {
      alert('Error saving update: ' + err.message);
    } finally {
      setPostingUpdate(false);
    }
  };

  const handleTogglePin = async (post) => {
    try {
      await updateDoc(doc(db, 'clubs', selectedClubId, 'posts', post.id), {
        pinned: !post.pinned,
        updatedAt: serverTimestamp()
      });
      fetchTabData();
    } catch (err) {
      alert('Error updating pin: ' + err.message);
    }
  };

  // Single Session Cancellation
  const handleCancelSession = async () => {
    if (!cancelSessionModal) return;
    if (!cancelReason.trim()) {
      alert('Please provide a cancellation reason.');
      return;
    }
    setCancellingSession(true);
    try {
      await trainingService.cancelSession(selectedClubId, cancelSessionModal.id, {
        reason: cancelReason.trim(),
        cancelledBy: user.uid,
        cancelledByName: profile?.displayName || 'Administrator',
        cancelledByRole: 'Admin'
      });
      alert('Training session cancelled and notifications sent.');
      setCancelSessionModal(null);
      setCancelReason('');
      fetchTabData();
    } catch (err) {
      alert('Error cancelling session: ' + err.message);
    } finally {
      setCancellingSession(false);
    }
  };

  // Reinstatement
  const handleReinstate = async (session) => {
    if (!window.confirm(`Reinstate training session on ${session.scheduledAt}?`)) return;
    try {
      await trainingService.reinstateSession(selectedClubId, session.id, {
        reinstatedBy: user.uid,
        reinstatedByName: profile?.displayName || 'Administrator',
        reinstatedByRole: 'Admin'
      });
      alert('Training session reinstated!');
      fetchTabData();
    } catch (err) {
      alert('Error reinstating: ' + err.message);
    }
  };

  // Bulk Cancel Preview
  const handlePreviewBulkCancel = () => {
    const { startDate, endDate, venue } = bulkCancelForm;
    const sessions = tabData.trainingSessions || [];
    const matched = sessions.filter(s => {
      if (s.status === 'cancelled') return false;
      const at = s.scheduledAt || '';
      if (startDate && at < startDate) return false;
      if (endDate && at > endDate) return false;
      if (venue && !(s.location || '').toLowerCase().includes(venue.toLowerCase())) return false;
      return true;
    });
    setBulkPreviewSessions(matched);
  };

  const handleExecuteBulkCancel = async () => {
    if (!bulkCancelForm.reason.trim()) {
      alert('A cancellation reason is required.');
      return;
    }
    if (bulkPreviewSessions.length === 0) {
      alert('No sessions matched the filter window. Click Preview first.');
      return;
    }
    setExecutingBulkCancel(true);
    try {
      const res = await trainingService.bulkCancelTrainingSessions(selectedClubId, {
        startDate: bulkCancelForm.startDate,
        endDate: bulkCancelForm.endDate,
        teamId: item.id,
        venue: bulkCancelForm.venue,
        reason: bulkCancelForm.reason.trim(),
        cancelledBy: user.uid,
        cancelledByName: profile?.displayName || 'Administrator',
        cancelledByRole: 'Admin'
      });
      alert(`Successfully cancelled ${res.count} training occurrences. Synced with My Teams & Calendar.`);
      setBulkCancelModalOpen(false);
      fetchTabData();
    } catch (err) {
      alert('Error executing bulk cancellation: ' + err.message);
    } finally {
      setExecutingBulkCancel(false);
    }
  };

  const handleAddMembers = async () => {
    if (selectedNewMembers.length === 0) return;
    setSavingMembers(true);
    try {
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);

      selectedNewMembers.forEach(memberId => {
        const ref = doc(db, 'clubs', selectedClubId, 'members', memberId);
        if (itemType === 'team') {
          batch.update(ref, { teamIds: arrayUnion(item.id), updatedAt: serverTimestamp() });
        } else {
          batch.update(ref, { groupIds: arrayUnion(item.id), updatedAt: serverTimestamp() });
        }
      });

      await batch.commit();
      await fetchMembers();
      setAddModalOpen(false);
      setSelectedNewMembers([]);
    } catch (err) {
      alert('Error adding members: ' + err.message);
    } finally {
      setSavingMembers(false);
    }
  };

  const openStaffModal = (focusRole = null) => {
    const initial = {};
    STAFF_ROLES.forEach((sr) => {
      const savedId = currentItem?.[sr.idField] || '';
      const savedName = currentItem?.[sr.nameField] || '';
      const matched = allClubMembers.find(m =>
        (savedId && m.id === savedId) ||
        (savedName && (m.displayName || m.name || '').trim().toLowerCase() === savedName.trim().toLowerCase())
      );
      initial[sr.key] = matched ? matched.id : '';
    });
    setStaffForm(initial);
    setStaffSearch('');
    setFocusedStaffRole(focusRole);
    setStaffModalOpen(true);
  };

  const handleSaveStaff = async () => {
    if (itemType !== 'team' || !currentItem?.id) return;
    setSavingStaff(true);
    try {
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      const teamRef = doc(db, 'clubs', selectedClubId, 'teams', currentItem.id);
      const updates = { updatedAt: serverTimestamp() };
      const localUpdates = {};
      const nextStaffAssignments = { ...(currentItem.staffAssignments || {}) };
      const assignedMemberIds = new Set();

      STAFF_ROLES.forEach((sr) => {
        const memberId = staffForm[sr.key] || '';
        const memberObj = allClubMembers.find(m => m.id === memberId);
        const memberName = memberObj
          ? (memberObj.displayName || memberObj.name || memberObj.fullName || [memberObj.firstName, memberObj.lastName].filter(Boolean).join(' ') || memberObj.email || '')
          : '';
        const staffUid = memberObj ? (memberObj.uid || memberObj.userId || memberObj.id) : '';
        updates[sr.idField] = staffUid || '';
        updates[sr.nameField] = memberName || '';
        localUpdates[sr.idField] = staffUid || '';
        localUpdates[sr.nameField] = memberName || '';
        nextStaffAssignments[sr.role] = staffUid ? [staffUid] : [];
        if (memberId) assignedMemberIds.add(memberId);
      });

      updates.staffAssignments = nextStaffAssignments;
      localUpdates.staffAssignments = nextStaffAssignments;

      batch.update(teamRef, updates);

      // Ensure assigned staff members also belong to the team in clubs/{clubId}/members
      assignedMemberIds.forEach((memberId) => {
        batch.update(doc(db, 'clubs', selectedClubId, 'members', memberId), {
          teamIds: arrayUnion(currentItem.id),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();

      const updatedItem = { ...currentItem, ...localUpdates };
      setCurrentItem(updatedItem);
      if (typeof onItemUpdated === 'function') {
        onItemUpdated(updatedItem);
      }
      await fetchMembers();
      setStaffModalOpen(false);
    } catch (err) {
      alert('Error saving team staff: ' + err.message);
    } finally {
      setSavingStaff(false);
    }
  };

  const unassignedMembers = allClubMembers
    .filter(m => !members.some(assigned => assigned.id === m.id))
    .map(m => ({
      id: m.id,
      name: m.displayName || m.name || m.fullName || [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || 'Unnamed Member'
    }));

  return (
    <div className="team-group-detail" style={{ animation: 'fadeIn 0.3s ease', fontFamily: 'Arial, sans-serif' }}>
      
      {/* Top Header Card matching Concepts */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px 24px 0 24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <button 
          className="btn btn-outline" 
          onClick={onClose} 
          style={{ padding: '6px 12px', fontSize: '12px', marginBottom: '14px', borderRadius: '8px' }}
        >
          <ArrowLeft size={14} style={{ marginRight: 6 }} /> Back to {itemType === 'team' ? 'Teams' : 'Groups'}
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>
                {item.name || item.groupName}
              </h1>
              <span style={{ fontSize: '11px', fontWeight: 800, background: '#1E3A8A', color: '#FFFFFF', padding: '3px 10px', borderRadius: '999px', letterSpacing: '0.05em' }}>
                ADMIN SPACE
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
              {item.season || '2027 season'} • {item.ageGroup || item.division || 'Under 17'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn btn-outline" onClick={() => setAddModalOpen(true)} style={{ borderRadius: '10px', fontSize: '13px' }}>
              <Users size={15} style={{ marginRight: 6 }} /> Manage Members
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => setActiveTab('posts')} 
              style={{ background: DESIGN_TOKENS.primaryTeal, borderColor: DESIGN_TOKENS.primaryTeal, borderRadius: '10px', fontSize: '13px' }}
            >
              Post Update
            </button>
            {itemType === 'team' && (
              <button 
                className="btn btn-outline" 
                onClick={() => { setBulkCancelModalOpen(true); handlePreviewBulkCancel(); }}
                style={{ borderColor: '#FCA5A5', color: '#DC2626', borderRadius: '10px', fontSize: '13px' }}
                title="Club admin tool: bulk cancel training sessions for weather/ground closure"
              >
                <AlertTriangle size={15} style={{ marginRight: 6 }} /> Bulk Cancel Training
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid #E2E8F0', overflowX: 'auto', whiteSpace: 'nowrap' }}>
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? `2px solid ${DESIGN_TOKENS.primaryTeal}` : '2px solid transparent',
                  padding: '0 4px 12px 4px',
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? DESIGN_TOKENS.primaryTeal : '#64748B',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── TAB: OVERVIEW ───────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Top 3 Stat Cards matching Image */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, marginBottom: '6px' }}>
                Staff roles
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: DESIGN_TOKENS.primaryTeal }}>
                {adminStaffList.filter(s => s.name).length}/5 filled
              </div>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, marginBottom: '6px' }}>
                Open duties
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>
                {dutyMetrics.open || 2}
              </div>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, marginBottom: '6px' }}>
                Awaiting availability
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>
                3
              </div>
            </div>
          </div>

          {/* 2-Column Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', alignItems: 'start' }}>
            
            {/* Left Column: Needs attention & Team staff */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Needs attention Card */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                  Needs attention
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <span style={{ color: '#334155' }}>1 First aid officer not assigned</span>
                    <button
                      onClick={() => openStaffModal('First Aid Officer')}
                      style={{ background: 'none', border: 'none', padding: 0, color: '#0284C7', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                    >
                      Assign staff
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <span style={{ color: '#334155' }}>2 canteen duties need volunteers</span>
                    <button
                      onClick={() => setActiveTab('tasks')}
                      style={{ background: 'none', border: 'none', padding: 0, color: '#0284C7', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                    >
                      View duties
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <span style={{ color: '#334155' }}>3 match responses outstanding</span>
                    <button
                      onClick={() => setActiveTab('matches')}
                      style={{ background: 'none', border: 'none', padding: 0, color: '#0284C7', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                    >
                      View responses
                    </button>
                  </div>
                </div>
              </div>

              {/* Team staff Card */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                  Team staff
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
                  {adminStaffList.map(st => (
                    <div key={st.role} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                      <div style={{ width: '130px', fontWeight: 700, color: '#0F172A' }}>
                        {st.role}
                      </div>
                      <div style={{ flex: 1, color: st.status === 'amber' ? '#D97706' : st.name ? '#334155' : '#94A3B8' }}>
                        {st.name || (
                          <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Not assigned</span>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', minWidth: '40px' }}>
                        {st.status === 'green' && (
                          <button
                            onClick={() => openStaffModal(st.role)}
                            title="Change staff assignment"
                            style={{ background: 'none', border: 'none', padding: 0, color: '#059669', fontWeight: 600, cursor: 'pointer', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          >
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                            Edit
                          </button>
                        )}
                        {st.status === 'amber' && (
                          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
                        )}
                        {st.status === 'unassigned' && (
                          <button
                            onClick={() => openStaffModal(st.role)}
                            style={{ background: 'none', border: 'none', padding: 0, color: '#0284C7', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                          >
                            Assign
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
                  <a
                    href="/compliance"
                    style={{ color: '#0284C7', fontWeight: 600, fontSize: '13px', textDecoration: 'none' }}
                  >
                    Open Compliance
                  </a>
                </div>
              </div>

            </div>

            {/* Right Column: Next match & Duties & tasks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Next match Card */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                  Next match
                </h3>

                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>
                  {item.name || 'U17 Nev Blair'} vs Norths Juniors
                </div>
                <div style={{ fontSize: '13px', color: '#475569', marginBottom: '2px' }}>
                  Sat 6 Feb 2027 • Arrive 8:15 am • Start 9:00 am
                </div>
                <div style={{ fontSize: '13px', color: '#475569', marginBottom: '14px' }}>
                  Main Oval
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, background: '#DCFCE7', color: '#16A34A', border: '1px solid #BBF7D0', padding: '3px 10px', borderRadius: '999px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16A34A' }} /> Published
                  </span>
                  <button
                    onClick={() => setActiveTab('matches')}
                    className="btn btn-outline"
                    style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '8px' }}
                  >
                    Manage event
                  </button>
                </div>

                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                  <div style={{ color: '#475569' }}>
                    <strong>Training</strong> • Tue 9 Feb 5:30 pm • <span style={{ color: '#16A34A', fontWeight: 600 }}>Published</span>
                  </div>
                  <div style={{ color: '#D97706', fontWeight: 500 }}>
                    <strong>Draft event</strong> • Date needed before publishing
                  </div>
                </div>
              </div>

              {/* Duties & tasks Card */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                    Duties & tasks
                  </h3>
                  <div style={{ display: 'flex', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                    <button
                      onClick={() => setDutiesSubTab('upcoming')}
                      style={{
                        background: dutiesSubTab === 'upcoming' ? '#F8FAFC' : '#FFFFFF',
                        border: 'none',
                        borderRight: '1px solid #E2E8F0',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: dutiesSubTab === 'upcoming' ? 700 : 500,
                        color: dutiesSubTab === 'upcoming' ? '#0F172A' : '#64748B',
                        cursor: 'pointer'
                      }}
                    >
                      Upcoming
                    </button>
                    <button
                      onClick={() => setDutiesSubTab('completed')}
                      style={{
                        background: dutiesSubTab === 'completed' ? '#F8FAFC' : '#FFFFFF',
                        border: 'none',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: dutiesSubTab === 'completed' ? 700 : 500,
                        color: dutiesSubTab === 'completed' ? '#0F172A' : '#64748B',
                        cursor: 'pointer'
                      }}
                    >
                      Completed
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
                  {displayTasks.length > 0 ? (
                    displayTasks.slice(0, 3).map(task => (
                      <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <span style={{ color: '#334155' }}>
                          {task.title || task.name} {task.time ? `• ${task.time}` : ''} {task.assignedToName ? `• ${task.assignedToName}` : ''} • {task.status === 'assigned' ? 'Assigned' : 'Unfilled'}
                        </span>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: task.status === 'assigned' ? '#10B981' : '#F59E0B' }} />
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '12px', color: '#64748B', textAlign: 'center', padding: '12px 0' }}>
                      No duties scheduled.
                    </div>
                  )}
                </div>

                <div style={{ fontSize: '11px', color: '#94A3B8', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                  Event tasks are managed on the event.
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* ─── TAB: MEMBERS & STAFF (IMAGE 8) ─────────────────────────────────── */}
      {activeTab === 'members' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Subtabs matching Image 8: [Players 16] [Parents & carers] [Team staff] */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setMembersSubTab('players')}
              style={{
                padding: '6px 16px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: membersSubTab === 'players' ? '#0F172A' : '#FFFFFF',
                color: membersSubTab === 'players' ? '#FFFFFF' : '#475569',
                fontSize: '13px',
                fontWeight: membersSubTab === 'players' ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              Players {members.length > 0 ? members.length : 16}
            </button>
            <button
              onClick={() => setMembersSubTab('parents')}
              style={{
                padding: '6px 16px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: membersSubTab === 'parents' ? '#0F172A' : '#FFFFFF',
                color: membersSubTab === 'parents' ? '#FFFFFF' : '#475569',
                fontSize: '13px',
                fontWeight: membersSubTab === 'parents' ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              Parents & carers
            </button>
            <button
              onClick={() => setMembersSubTab('staff')}
              style={{
                padding: '6px 16px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: membersSubTab === 'staff' ? '#0F172A' : '#FFFFFF',
                color: membersSubTab === 'staff' ? '#FFFFFF' : '#475569',
                fontSize: '13px',
                fontWeight: membersSubTab === 'staff' ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              Team staff
            </button>
          </div>

          {membersSubTab === 'staff' ? (
            /* 2-Column layout matching Image 8 */
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', alignItems: 'start' }}>
              {/* Left Column: Team staff appointments */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                  Team staff appointments • {STAFF_ROLES.filter(sr => currentItem?.[sr.nameField]).length} of 5 filled
                </h3>

                <table style={{ width: '100%', borderCollapse: 'collapse', margin: '0 0 16px 0' }}>
                  <tbody>
                    {STAFF_ROLES.map((sr, idx) => {
                      const assignedName = currentItem?.[sr.nameField] || null;
                      const st = {
                        role: sr.role,
                        name: assignedName,
                        status: assignedName ? 'Compliant' : 'Not assigned',
                        color: assignedName ? '#10B981' : '#94A3B8',
                        isFilled: !!assignedName,
                      };
                      return (
                      <tr key={st.role} style={{ borderBottom: idx < 4 ? '1px solid #F1F5F9' : 'none' }}>
                        <td style={{ padding: '12px 0', fontWeight: 700, fontSize: '13px', color: '#0F172A', width: '30%' }}>
                          {st.role}
                        </td>
                        <td style={{ padding: '12px 8px', fontSize: '13px', color: st.status === 'Action needed' ? '#D97706' : st.isFilled ? '#0F172A' : '#94A3B8' }}>
                          {st.name || 'Not assigned'}
                        </td>
                        <td style={{ padding: '12px 0', textAlign: 'right', width: '32%' }}>
                          {st.isFilled ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: st.color }}>
                                {st.status === 'Compliant' ? (
                                  <CheckCircle2 size={15} color="#10B981" />
                                ) : (
                                  <AlertTriangle size={15} color="#F59E0B" />
                                )}
                                {st.status}
                              </span>
                              <button
                                onClick={() => openStaffModal(st.role)}
                                className="btn btn-outline"
                                style={{ padding: '3px 10px', fontSize: '11px', height: 'auto', borderRadius: '6px' }}
                              >
                                Change
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => openStaffModal(st.role)}
                              className="btn btn-outline"
                              style={{ padding: '4px 14px', fontSize: '12px', height: 'auto', borderRadius: '6px' }}
                            >
                              Assign
                            </button>
                          )}
                        </td>
                      </tr>
                    );})}
                  </tbody>
                </table>

                <div style={{ paddingTop: '14px', borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <a
                    href="/compliance"
                    style={{ fontSize: '12px', color: '#0369A1', fontWeight: 600, textDecoration: 'none' }}
                  >
                    Open Compliance
                  </a>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    Team appointments are separate from club membership roles.
                  </span>
                </div>
              </div>

              {/* Right Column: Guardian links */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                  Guardian links
                </h3>

                {members.some(m => m.guardianName) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '22px' }}>
                    {members.filter(m => m.guardianName).map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#0F172A', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600 }}>{m.displayName || m.name}</span>
                        <span style={{ color: '#94A3B8' }}>→</span>
                        <span>{m.guardianName}</span>
                        <span style={{ color: '#94A3B8' }}>•</span>
                        <span style={{ color: '#64748B' }}>Guardian</span>
                        <span style={{ color: '#94A3B8' }}>•</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#0D9488', fontWeight: 600 }}>
                          Verified <CheckCircle2 size={14} color="#0D9488" />
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '22px' }}>
                    No linked guardians registered for this squad yet.
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setAddModalOpen(true)}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      padding: '7px 16px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#0F172A',
                      cursor: 'pointer'
                    }}
                  >
                    Add member
                  </button>
                  <button
                    onClick={() => openStaffModal()}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      padding: '7px 16px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#0F172A',
                      cursor: 'pointer'
                    }}
                  >
                    Assign staff
                  </button>
                </div>
              </div>
            </div>
          ) : membersSubTab === 'players' ? (
            /* Players List Subtab */
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Squad Players ({members.length > 0 ? members.length : 16})</h3>
                <button className="btn btn-primary btn-sm" onClick={() => setAddModalOpen(true)}>
                  <Plus size={14} /> Add Member
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: '#64748B' }}>
                    <th style={{ padding: '12px 18px' }}>Player Name</th>
                    <th style={{ padding: '12px 14px' }}>Position</th>
                    <th style={{ padding: '12px 14px' }}>Jersey #</th>
                    <th style={{ padding: '12px 14px' }}>Guardian Link</th>
                    <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.length > 0 ? (
                    members.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px 18px', fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                          {m.displayName || m.name}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>
                          {m.position || '—'}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>
                          {m.jerseyNumber || m.number || '—'}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '12px', color: m.guardianName ? '#0D9488' : '#94A3B8' }}>
                          {m.guardianName ? `${m.guardianName} (Verified ✓)` : 'No linked guardian'}
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <button
                            onClick={async () => {
                              if (!window.confirm(`Remove ${m.displayName || m.name} from this team?`)) return;
                              if (m.id) {
                                await updateDoc(doc(db, 'clubs', selectedClubId, 'members', m.id), {
                                  teamIds: arrayRemove(item.id)
                                });
                                fetchMembers();
                              }
                            }}
                            className="btn-icon danger"
                            title="Remove from team"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                        No members assigned to this squad yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Parents & Carers Subtab */
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Parents & Carers</h3>
                <button className="btn btn-primary btn-sm" onClick={() => setAddModalOpen(true)}>
                  <Plus size={14} /> Add Guardian
                </button>
              </div>
              <div style={{ padding: '20px 24px' }}>
                {members.some(m => m.guardianName) ? (
                  members.filter(m => m.guardianName).map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#0F172A', padding: '12px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ fontWeight: 700 }}>{m.guardianName}</span>
                      <span style={{ color: '#94A3B8' }}>•</span>
                      <span style={{ color: '#64748B' }}>Linked to {m.displayName || m.name}</span>
                      <span style={{ color: '#94A3B8' }}>•</span>
                      <span style={{ color: '#0D9488', fontWeight: 600 }}>Verified ✓</span>
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#64748B', fontSize: '13px', textAlign: 'center', padding: '16px' }}>
                    No parents or guardians registered for this squad yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: MATCHES & EVENTS (IMAGE 3) ─────────────────────────────────── */}
      {activeTab === 'matches' && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <button 
              className="btn btn-primary" 
              onClick={() => {
                setEntityForm({ title: '', type: 'match', date: new Date().toISOString().slice(0, 10), location: 'Main Oval' });
                setActiveItemModal({ mode: 'add', tab: 'events' });
              }}
              style={{ background: DESIGN_TOKENS.primaryTeal, borderColor: DESIGN_TOKENS.primaryTeal, fontSize: '13px', borderRadius: '8px' }}
            >
              <Plus size={15} style={{ marginRight: 4 }} /> Add event
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: '#64748B' }}>
                <th style={{ padding: '12px 18px' }}>Activity</th>
                <th style={{ padding: '12px 14px' }}>Type</th>
                <th style={{ padding: '12px 14px' }}>Date & time</th>
                <th style={{ padding: '12px 14px' }}>Venue</th>
                <th style={{ padding: '12px 14px' }}>Visibility</th>
                <th style={{ padding: '12px 14px' }}>Responses</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {combinedActivities.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>No matches or training scheduled.</td></tr>
              ) : combinedActivities.map(act => (
                <tr key={act.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 18px', fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                    {act.activity}
                    {act.cancellationReason && (
                      <div style={{ fontSize: '11px', color: '#DC2626', fontWeight: 500, marginTop: '2px' }}>
                        Reason: {act.cancellationReason}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>
                    {act.type}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '12px', color: '#334155' }}>
                    {act.dateTime === 'Needs date' || act.needsDateBadge ? (
                      <span style={{ fontSize: '11px', fontWeight: 700, background: '#FEF3C7', color: '#D97706', padding: '2px 8px', borderRadius: '4px' }}>
                        Needs date
                      </span>
                    ) : (
                      act.dateTime
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>
                    {act.venue}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {act.status === 'cancelled' ? (
                      <span style={{ fontSize: '11px', fontWeight: 700, background: '#FEE2E2', color: '#DC2626', padding: '2px 8px', borderRadius: '999px' }}>
                        Cancelled
                      </span>
                    ) : act.visibility === 'Draft' ? (
                      <span style={{ fontSize: '11px', fontWeight: 600, background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '999px' }}>
                        Draft
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', fontWeight: 700, background: '#DCFCE7', color: '#16A34A', padding: '2px 8px', borderRadius: '999px' }}>
                        Published
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>
                    {act.responses}
                  </td>
                  <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      {act.isSession && act.status !== 'cancelled' && (
                        <button
                          onClick={() => setCancelSessionModal(act.raw)}
                          className="btn btn-outline"
                          style={{ padding: '4px 10px', fontSize: '11px', color: '#DC2626', borderColor: '#FCA5A5' }}
                        >
                          Cancel
                        </button>
                      )}
                      {act.isSession && act.status === 'cancelled' && (
                        <button
                          onClick={() => handleReinstate(act.raw)}
                          className="btn btn-outline"
                          style={{ padding: '4px 10px', fontSize: '11px', color: '#16A34A', borderColor: '#BBF7D0' }}
                        >
                          Reinstate
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEntityForm({ ...act.raw });
                          setActiveItemModal({ mode: 'edit', tab: act.isSession ? 'training' : 'events', data: act.raw });
                        }}
                        className="btn btn-outline"
                        style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px' }}
                      >
                        Manage event
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ padding: '14px 20px', background: '#FFFFFF', borderTop: '1px solid #F1F5F9', fontSize: '12px', color: '#64748B' }}>
            One linked event record. Updates also appear in My Teams and Calendar.
          </div>
        </div>
      )}

      {/* ─── TAB: DUTIES & TASKS (IMAGE 2) ───────────────────────────────────── */}
      {activeTab === 'tasks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Top Counters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '14px 18px' }}>
              <span style={{ fontSize: '12px', color: '#64748B' }}>Open duties</span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#F59E0B', marginTop: '2px' }}>
                {dutyMetrics.open}
              </div>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '14px 18px' }}>
              <span style={{ fontSize: '12px', color: '#64748B' }}>Assigned duties</span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#10B981', marginTop: '2px' }}>
                {dutyMetrics.assigned}
              </div>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '14px 18px' }}>
              <span style={{ fontSize: '12px', color: '#64748B' }}>Event tasks</span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#3B82F6', marginTop: '2px' }}>
                {dutyMetrics.eventTasks}
              </div>
            </div>
          </div>

          {/* Subtabs: Upcoming / Completed */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setDutiesSubTab('upcoming')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                background: dutiesSubTab === 'upcoming' ? '#0F172A' : '#FFFFFF',
                color: dutiesSubTab === 'upcoming' ? '#FFFFFF' : '#64748B',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Upcoming
            </button>
            <button
              onClick={() => setDutiesSubTab('completed')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                background: dutiesSubTab === 'completed' ? '#0F172A' : '#FFFFFF',
                color: dutiesSubTab === 'completed' ? '#FFFFFF' : '#64748B',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Completed
            </button>
          </div>

          {/* Duties Table */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>
                Duties • Sat 6 Feb 2027
              </h3>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: '#64748B' }}>
                  <th style={{ padding: '12px 18px' }}>Duty</th>
                  <th style={{ padding: '12px 14px' }}>Time</th>
                  <th style={{ padding: '12px 14px' }}>Location</th>
                  <th style={{ padding: '12px 14px' }}>Owner</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayTasks.length > 0 ? (
                  displayTasks.map(d => {
                    const isAssigned = !!d.assignedTo;
                    return (
                      <tr key={d.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px 18px', fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                          {d.title || d.name}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '12px', color: '#334155' }}>
                          {d.time || d.timeSlot || '—'}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>
                          {d.location || '—'}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '12px', color: '#0F172A' }}>
                          {d.assignedToName || d.assignedName || (isAssigned ? (d.assignedMemberName || 'Assigned member') : 'Unassigned')}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {isAssigned ? (
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#0D9488', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0D9488' }} /> Assigned
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B' }} /> Unfilled
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <button
                            onClick={() => {
                              setEntityForm({ ...d });
                              setActiveItemModal({ mode: 'edit', tab: 'tasks', data: d });
                            }}
                            className="btn btn-outline"
                            style={{ padding: '4px 10px', fontSize: '11px' }}
                          >
                            {isAssigned ? 'Reassign' : 'Assign'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                      No duties or tasks scheduled for this team yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Event Tasks Card */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 800 }}>Event tasks</h3>
            {displayTasks.filter(t => t.type === 'event_task' || t.eventId || t.source || t.checklistId).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {displayTasks.filter(t => t.type === 'event_task' || t.eventId || t.source || t.checklistId).map(t => (
                  <div key={t.id} style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>{t.title || t.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                        {t.source ? `Source: ${t.source}` : 'Event task'} {t.assignedToName ? `• ${t.assignedToName}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.status === 'completed' ? '#10B981' : '#94A3B8' }} /> {t.status === 'completed' ? 'Completed' : 'Not started'}
                      </span>
                      <button className="btn btn-outline" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setActiveTab('matches')}>
                        View event
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: '#64748B', textAlign: 'center', padding: '16px' }}>
                No event tasks created for this team yet.
              </div>
            )}
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px' }}>
              Edit event checklist items on their event.
            </div>
          </div>

        </div>
      )}

      {/* ─── TAB: UPDATES (IMAGE 1) ─────────────────────────────────────────── */}
      {activeTab === 'posts' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Left Column: Updates List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Subtabs: Published / Drafts */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setUpdatesSubTab('published')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  background: updatesSubTab === 'published' ? '#0F172A' : '#FFFFFF',
                  color: updatesSubTab === 'published' ? '#FFFFFF' : '#64748B',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Published
              </button>
              <button
                onClick={() => setUpdatesSubTab('drafts')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  background: updatesSubTab === 'drafts' ? '#0F172A' : '#FFFFFF',
                  color: updatesSubTab === 'drafts' ? '#FFFFFF' : '#64748B',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Drafts
              </button>
            </div>

            {/* List of update cards */}
            {displayAdminPosts.map(p => (
                <div
                  key={p.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '16px',
                    padding: '18px 20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                      {p.title || 'Team update'}
                    </h4>
                    <button
                      onClick={() => handleTogglePin(p)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: p.pinned ? '#0F172A' : '#94A3B8' }}
                      title={p.pinned ? 'Unpin' : 'Pin to top'}
                    >
                      <Pin size={16} fill={p.pinned ? '#0F172A' : 'none'} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                    {p.pinned && (
                      <span style={{ fontSize: '10px', fontWeight: 700, background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '4px' }}>
                        Pinned
                      </span>
                    )}
                    <span style={{ fontSize: '10px', fontWeight: 700, background: '#DCFCE7', color: '#16A34A', padding: '2px 8px', borderRadius: '4px' }}>
                      {p.status === 'draft' ? 'Draft' : 'Published'}
                    </span>
                  </div>

                  <p style={{ margin: '0 0 10px 0', fontSize: '13px', lineHeight: 1.5, color: '#334155' }}>
                    {p.content || p.body}
                  </p>

                  <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '12px' }}>
                    {p.authorName || 'Coach'} • {p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString() : 'Recent'}
                    <div style={{ marginTop: '2px' }}>
                      Audience: {p.audience || `${item.name} members and authorised guardians`}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={() => {
                        setEntityForm({ ...p });
                        setActiveItemModal({ mode: 'edit', tab: 'posts', data: p });
                      }}
                      style={{ background: 'none', border: 'none', padding: 0, color: '#0D9488', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleTogglePin(p)}
                      style={{ background: 'none', border: 'none', padding: 0, color: '#64748B', fontSize: '12px', cursor: 'pointer' }}
                    >
                      {p.pinned ? 'Unpin' : 'Pin'}
                    </button>
                  </div>
                </div>
              ))}
          </div>

          {/* Right Column: "New update" Form (Image 1) */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
              New update
            </h3>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 700 }}>Title</label>
              <input
                className="form-control"
                placeholder="e.g. Training reminder"
                value={newUpdateForm.title}
                onChange={e => setNewUpdateForm({ ...newUpdateForm, title: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 700 }}>Body</label>
              <textarea
                className="form-control"
                rows={4}
                placeholder="Please bring water and arrive 10 minutes early."
                value={newUpdateForm.body}
                onChange={e => setNewUpdateForm({ ...newUpdateForm, body: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 700 }}>Audience</label>
              <select
                className="form-control"
                value={newUpdateForm.audience}
                onChange={e => setNewUpdateForm({ ...newUpdateForm, audience: e.target.value })}
              >
                <option value={`${item.name} — members and authorised guardians`}>
                  {item.name} — members and authorised guardians
                </option>
                <option value={`${item.name} Staff Only`}>
                  {item.name} Staff Only
                </option>
                <option value="Club-Wide">Club-Wide</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <input
                type="checkbox"
                id="notifyAudience"
                checked={newUpdateForm.notifyAudience}
                onChange={e => setNewUpdateForm({ ...newUpdateForm, notifyAudience: e.target.checked })}
              />
              <label htmlFor="notifyAudience" style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', cursor: 'pointer' }}>
                Notify audience
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn btn-outline"
                onClick={() => handlePublishUpdate(true)}
                disabled={postingUpdate}
                style={{ borderRadius: '10px' }}
              >
                Save draft
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handlePublishUpdate(false)}
                disabled={postingUpdate}
                style={{ background: DESIGN_TOKENS.primaryTeal, borderColor: DESIGN_TOKENS.primaryTeal, borderRadius: '10px' }}
              >
                Publish
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ─── MODAL: BULK TRAINING CANCELLATION (ADMIN TOOL) ──────────────────── */}
      <Modal
        open={bulkCancelModalOpen}
        onClose={() => setBulkCancelModalOpen(false)}
        title="Bulk Training Cancellation"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>
            Cancel multiple scheduled training sessions for <strong>{item.name}</strong> due to adverse weather or ground closures.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 700 }}>Window Start</label>
              <input
                type="date"
                className="form-control"
                value={bulkCancelForm.startDate}
                onChange={e => {
                  setBulkCancelForm({ ...bulkCancelForm, startDate: e.target.value });
                  setTimeout(handlePreviewBulkCancel, 50);
                }}
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 700 }}>Window End</label>
              <input
                type="date"
                className="form-control"
                value={bulkCancelForm.endDate}
                onChange={e => {
                  setBulkCancelForm({ ...bulkCancelForm, endDate: e.target.value });
                  setTimeout(handlePreviewBulkCancel, 50);
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ fontSize: '12px', fontWeight: 700 }}>Venue Filter (Optional)</label>
            <input
              className="form-control"
              placeholder="e.g. Main Oval (leave blank for all venues)"
              value={bulkCancelForm.venue}
              onChange={e => {
                setBulkCancelForm({ ...bulkCancelForm, venue: e.target.value });
                setTimeout(handlePreviewBulkCancel, 50);
              }}
            />
          </div>

          <div className="form-group">
            <label style={{ fontSize: '12px', fontWeight: 700 }}>Cancellation Reason (Required)</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="e.g. Severe storm warning / council ground closure..."
              value={bulkCancelForm.reason}
              onChange={e => setBulkCancelForm({ ...bulkCancelForm, reason: e.target.value })}
            />
          </div>

          {/* Affected Session Preview */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px' }}>
            <div style={{ fontWeight: 700, fontSize: '12px', color: '#0F172A', marginBottom: '6px' }}>
              Preview Affected Occurrences ({bulkPreviewSessions.length})
            </div>
            {bulkPreviewSessions.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>
                No active training occurrences found in this window. Matches and general events are excluded.
              </div>
            ) : (
              <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {bulkPreviewSessions.map(s => (
                  <div key={s.id} style={{ fontSize: '11px', color: '#334155', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{s.scheduledAt?.replace('T', ' ')}</span>
                    <span style={{ color: '#64748B' }}>{s.location || 'Main oval'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button className="btn btn-outline" onClick={() => setBulkCancelModalOpen(false)} disabled={executingBulkCancel}>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={handleExecuteBulkCancel}
              disabled={executingBulkCancel || bulkPreviewSessions.length === 0 || !bulkCancelForm.reason.trim()}
              style={{ background: '#DC2626', color: '#fff', border: 'none' }}
            >
              {executingBulkCancel ? 'Processing...' : `Confirm Cancellation (${bulkPreviewSessions.length})`}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── MODAL: CANCEL SESSION (SINGLE WITH REASON) ──────────────────────── */}
      <Modal
        open={!!cancelSessionModal}
        onClose={() => setCancelSessionModal(null)}
        title="Cancel Training Session"
      >
        {cancelSessionModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>
              Cancel training on <strong>{cancelSessionModal.scheduledAt}</strong>?
            </p>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 700 }}>Reason for cancellation</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="e.g. Ground waterlogged / coach illness..."
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
              />
            </div>

            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => setCancelSessionModal(null)} disabled={cancellingSession}>
                Back
              </button>
              <button
                className="btn btn-danger"
                onClick={handleCancelSession}
                disabled={cancellingSession || !cancelReason.trim()}
                style={{ background: '#DC2626', color: '#fff', border: 'none' }}
              >
                {cancellingSession ? 'Cancelling...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── MODAL: ASSIGN TEAM STAFF ────────────────────────────────────────── */}
      <Modal
        open={staffModalOpen}
        onClose={() => setStaffModalOpen(false)}
        title={`Assign Team Staff — ${currentItem?.name || 'Team'}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '12px', fontWeight: 700 }}>Filter Club Members</label>
            <input
              className="form-control"
              placeholder="Search member by name or email..."
              value={staffSearch}
              onChange={(e) => setStaffSearch(e.target.value)}
            />
          </div>

          {allClubMembers.length === 0 ? (
            <p className="text-sm text-muted">No club members found in this club yet.</p>
          ) : (
            STAFF_ROLES.map((sr) => {
              const q = staffSearch.trim().toLowerCase();
              const filteredStaffOptions = allClubMembers.filter((m) => {
                if (!q || staffForm[sr.key] === m.id) return true;
                const label = `${m.displayName || m.name || ''} ${m.email || ''} ${m.role || ''}`.toLowerCase();
                return label.includes(q);
              });
              const isFocused = focusedStaffRole === sr.role;
              return (
                <div
                  key={sr.key}
                  className="form-group"
                  style={{
                    marginBottom: 0,
                    padding: isFocused ? '10px 12px' : 0,
                    borderRadius: isFocused ? '10px' : 0,
                    background: isFocused ? 'rgba(16, 185, 129, 0.06)' : 'transparent',
                    border: isFocused ? '1px solid rgba(16, 185, 129, 0.35)' : 'none',
                  }}
                >
                  <label style={{ fontSize: '12px', fontWeight: 700 }}>{sr.role}</label>
                  <select
                    className="form-control"
                    value={staffForm[sr.key] || ''}
                    onChange={(e) => setStaffForm(prev => ({ ...prev, [sr.key]: e.target.value }))}
                  >
                    <option value="">— Not assigned —</option>
                    {filteredStaffOptions.map((m) => {
                      const label = m.displayName || m.name || m.email || 'Unnamed Member';
                      const roleTag = (Array.isArray(m.roles) && m.roles.length > 0 ? m.roles.join(', ') : m.role) || '';
                      return (
                        <option key={m.id} value={m.id}>
                          {roleTag ? `${label} (${roleTag})` : label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              );
            })
          )}

          <div className="form-actions" style={{ marginTop: 8 }}>
            <button className="btn btn-outline" onClick={() => setStaffModalOpen(false)} disabled={savingStaff}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSaveStaff}
              disabled={savingStaff || allClubMembers.length === 0}
            >
              {savingStaff ? 'Saving...' : 'Save Staff Assignments'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── MODAL: ADD MEMBERS ──────────────────────────────────────────────── */}
      <Modal open={addModalOpen} onClose={() => { setAddModalOpen(false); setSelectedNewMembers([]); }} title={`Add Members to ${itemType === 'team' ? 'Team' : 'Group'}`}>
        <div className="form-group">
          <label>Select Members</label>
          <MultiSelect
            options={unassignedMembers}
            selectedValues={selectedNewMembers}
            onChange={setSelectedNewMembers}
            placeholder="Search and select members..."
          />
          {unassignedMembers.length === 0 && (
            <p className="text-sm text-muted" style={{ marginTop: 8 }}>
              All club members ({members.length}) are already assigned to this {itemType}.
              {itemType === 'team' && ' Use "Assign staff" to appoint a Coach, Trainer, First Aid Officer, or Manager.'}
            </p>
          )}
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => { setAddModalOpen(false); setSelectedNewMembers([]); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAddMembers} disabled={savingMembers || selectedNewMembers.length === 0}>
            {savingMembers ? 'Adding...' : 'Add Selected Members'}
          </button>
        </div>
      </Modal>

    </div>
  );
}
