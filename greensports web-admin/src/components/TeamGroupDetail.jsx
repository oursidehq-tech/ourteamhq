import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  addDoc,
  updateDoc, 
  deleteDoc,
  doc, 
  arrayRemove, 
  arrayUnion, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  ArrowLeft, 
  Users, 
  FileText, 
  CheckSquare, 
  Calendar, 
  ClipboardList, 
  TrendingUp, 
  Plus, 
  Edit2, 
  Trash2, 
  Eye, 
  CheckCircle, 
  Clock, 
  MapPin, 
  Trophy, 
  RefreshCw 
} from 'lucide-react';
import DataTable from './DataTable';
import Modal from './Modal';
import MultiSelect from './MultiSelect';

export default function TeamGroupDetail({ item, itemType, selectedClubId, onClose }) {
  const [activeTab, setActiveTab] = useState('members');
  const [members, setMembers] = useState([]);
  const [allClubMembers, setAllClubMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tab Data States
  const [tabData, setTabData] = useState({
    posts: [],
    matches: [],
    tasks: [],
    checklists: [],
    training: [],
    events: [],
    shifts: [],
  });
  const [loadingTab, setLoadingTab] = useState(false);

  // Add Member Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);
  const [savingMembers, setSavingMembers] = useState(false);

  // Entity Modal (Add or Edit for current active tab)
  const [activeItemModal, setActiveItemModal] = useState(null); // { mode: 'add' | 'edit' | 'view', tab: string, data: object }
  const [entityForm, setEntityForm] = useState({});
  const [savingEntity, setSavingEntity] = useState(false);

  // Universal tabs list for both Teams and Groups
  const tabs = [
    { id: 'members', label: 'Members', icon: <Users size={16} /> },
    { id: 'shifts', label: 'Shifts', icon: <Calendar size={16} /> },
    { id: 'posts', label: itemType === 'team' ? 'Posts / Updates' : 'Updates', icon: <FileText size={16} /> },
    ...(itemType === 'team' ? [{ id: 'matches', label: 'Matches', icon: <Calendar size={16} /> }] : []),
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={16} /> },
    { id: 'checklists', label: 'Checklists', icon: <ClipboardList size={16} /> },
    { id: 'training', label: 'Training Plans', icon: <TrendingUp size={16} /> },
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
          return m.teamIds?.includes(item.id);
        } else {
          return m.groupIds?.includes(item.id);
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
    if (activeTab === 'members') return;
    setLoadingTab(true);
    try {
      let collectionName = '';
      switch (activeTab) {
        case 'posts': collectionName = 'posts'; break;
        case 'matches': collectionName = 'leagueFixtures'; break;
        case 'tasks': collectionName = 'tasks'; break;
        case 'checklists': collectionName = 'checklists'; break;
        case 'training': collectionName = 'trainingPlans'; break;
        case 'events': collectionName = 'events'; break;
        case 'shifts': collectionName = 'rosters'; break;
        default: break;
      }

      if (!collectionName) { setLoadingTab(false); return; }

      const snap = await getDocs(collection(db, 'clubs', selectedClubId, collectionName));
      const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const filtered = allDocs.filter(d => {
        if (activeTab === 'posts') {
          return (d.teamIds?.includes(item.id) || d.groupIds?.includes(item.id) || d.teamId === item.id || d.groupId === item.id);
        }
        if (activeTab === 'matches') {
          return d.teamId === item.id || d.homeTeamId === item.id || d.awayTeamId === item.id || (d.teamIds && d.teamIds.includes(item.id)) || d.homeTeam === item.name || d.awayTeam === item.name;
        }
        if (activeTab === 'tasks') {
          return d.assignedTeamIds?.includes(item.id) || d.assignedGroupIds?.includes(item.id) || d.teamId === item.id || d.assignedGroupId === item.id;
        }
        if (activeTab === 'checklists') {
          return d.teamId === item.id || d.groupId === item.id || d.assignedTeamIds?.includes(item.id) || d.assignedGroupIds?.includes(item.id);
        }
        if (activeTab === 'training') {
          return d.teamIds?.includes(item.id) || d.groupIds?.includes(item.id) || d.teamId === item.id || d.groupId === item.id;
        }
        if (activeTab === 'events') {
          return (
            d.teamIds?.includes(item.id) || 
            d.groupIds?.includes(item.id) || 
            d.teamId === item.id || 
            d.groupId === item.id || 
            d.assignedGroupId === item.id ||
            (d.assignedGroupIds && d.assignedGroupIds.includes(String(item.id).toLowerCase()))
          );
        }
        if (activeTab === 'shifts') {
          return (
            (d.shifts && d.shifts.some(s => 
              (s.assignedIds && (s.assignedIds.includes(`team_${item.id}`) || s.assignedIds.includes(`group_${item.id}`) || s.assignedIds.includes(item.id))) ||
              (s.filledByName && (s.filledByName.toLowerCase().includes((item.name || item.groupName || '').toLowerCase())))
            )) ||
            d.groupId === item.id || d.teamId === item.id ||
            (d.assignedGroupIds && d.assignedGroupIds.includes(String(item.id).toLowerCase()))
          );
        }
        return false;
      });

      setTabData(prev => ({ ...prev, [activeTab]: filtered }));
    } catch (err) {
      console.error(`Error fetching ${activeTab} data:`, err);
    } finally {
      setLoadingTab(false);
    }
  };

  useEffect(() => {
    fetchTabData();
  }, [activeTab, item.id, selectedClubId]);

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm(`Remove this member from the ${itemType}?`)) return;
    try {
      const memberRef = doc(db, 'clubs', selectedClubId, 'members', memberId);
      if (itemType === 'team') {
        await updateDoc(memberRef, { teamIds: arrayRemove(item.id), updatedAt: serverTimestamp() });
      } else {
        await updateDoc(memberRef, { groupIds: arrayRemove(item.id), updatedAt: serverTimestamp() });
      }
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (err) {
      alert('Error removing member: ' + err.message);
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

  // Generic Delete for tab item
  const handleDeleteItem = async (row) => {
    if (!window.confirm(`Delete this ${activeTab.slice(0, -1) || 'item'}?`)) return;
    try {
      let collectionName = '';
      switch (activeTab) {
        case 'posts': collectionName = 'posts'; break;
        case 'matches': collectionName = 'leagueFixtures'; break;
        case 'tasks': collectionName = 'tasks'; break;
        case 'checklists': collectionName = 'checklists'; break;
        case 'training': collectionName = 'trainingPlans'; break;
        case 'events': collectionName = 'events'; break;
        case 'shifts': collectionName = 'rosters'; break;
        default: break;
      }
      if (!collectionName) return;

      await deleteDoc(doc(db, 'clubs', selectedClubId, collectionName, row.id));
      setTabData(prev => ({
        ...prev,
        [activeTab]: prev[activeTab].filter(d => d.id !== row.id)
      }));
      if (activeItemModal?.data?.id === row.id) setActiveItemModal(null);
    } catch (err) {
      alert('Error deleting: ' + err.message);
    }
  };

  // Generic Open Edit Modal for tab item
  const openEditItem = (row) => {
    setEntityForm({ ...row });
    setActiveItemModal({ mode: 'edit', tab: activeTab, data: row });
  };

  // Open Add Modal for tab item
  const openAddItem = () => {
    const today = new Date().toISOString().split('T')[0];
    let initial = {};
    if (activeTab === 'posts') {
      initial = { content: '', visibility: 'Club-Only', authorName: 'Coach / Admin' };
    } else if (activeTab === 'matches') {
      initial = { homeTeam: item.name || '', awayTeam: '', date: today, venue: 'Home Ground', competitionName: 'League' };
    } else if (activeTab === 'tasks') {
      initial = { title: '', description: '', priority: 'medium', dueDate: today, status: 'pending' };
    } else if (activeTab === 'checklists') {
      initial = { 
        name: `${item.name || item.groupName} Matchday Checklist`, 
        dueDate: today, 
        items: [
          { title: 'Equipment & Supplies Checked', completed: false },
          { title: 'Attendance Marked', completed: false },
          { title: 'Safety & Facility Inspection', completed: false }
        ] 
      };
    } else if (activeTab === 'training') {
      initial = { name: `${item.name || item.groupName} Training Session`, coachName: 'Head Coach', date: today, focusArea: 'Tactics & Passing', description: '' };
    } else if (activeTab === 'events') {
      initial = { title: `${item.name || item.groupName} Event`, type: 'training', startDate: today, endDate: today, time: '18:00 - 19:30', location: 'Clubhouse', description: '' };
    } else if (activeTab === 'shifts') {
      initial = { 
        title: `${item.name || item.groupName} Shift Roster`, 
        date: today, 
        shifts: [
          { role: 'Shift Leader / Coordinator', startTime: '09:00', endTime: '12:00', filledByName: '' },
          { role: 'Duty Staff / Helper', startTime: '12:00', endTime: '15:00', filledByName: '' }
        ] 
      };
    }

    setEntityForm(initial);
    setActiveItemModal({ mode: 'add', tab: activeTab, data: null });
  };

  // Save Add/Edit for current tab with mobile sync alignment
  const handleSaveEntity = async (e) => {
    e.preventDefault();
    setSavingEntity(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      let collectionName = '';
      let payload = {};

      switch (activeTab) {
        case 'posts':
          collectionName = 'posts';
          payload = {
            clubId: selectedClubId,
            authorId: 'admin',
            authorName: entityForm.authorName || 'Coach / Admin',
            content: entityForm.content?.trim(),
            visibility: entityForm.visibility || (itemType === 'team' ? 'Team-Only' : 'Club-Only'),
            teamId: itemType === 'team' ? item.id : null,
            teamIds: itemType === 'team' ? [item.id] : [],
            groupId: itemType === 'group' ? item.id : null,
            groupIds: itemType === 'group' ? [item.id] : [],
            assignedGroupId: item.id,
            assignedGroupIds: [String(item.id).toLowerCase()],
            type: 'update',
            category: 'Updates',
            isPinned: false,
            likedBy: [],
            comments: [],
          };
          break;
        case 'matches':
          collectionName = 'leagueFixtures';
          payload = {
            homeTeam: entityForm.homeTeam?.trim(),
            awayTeam: entityForm.awayTeam?.trim(),
            date: entityForm.date,
            venue: entityForm.venue || 'Home Ground',
            competitionName: entityForm.competitionName || 'League',
            score: entityForm.score || '',
            status: entityForm.status || 'Upcoming',
            teamId: item.id,
            teamIds: [item.id],
            teamName: item.name || '',
            assignedGroupId: item.id,
            assignedGroupIds: [String(item.id).toLowerCase()],
          };
          break;
        case 'tasks': {
          collectionName = 'tasks';
          const taskDate = entityForm.dueDate || today;
          payload = {
            title: entityForm.title?.trim(),
            description: entityForm.description || '',
            priority: entityForm.priority || 'medium',
            status: entityForm.status || 'pending',
            date: taskDate,
            dueDate: taskDate,
            startDate: taskDate,
            endDate: taskDate,
            teamId: itemType === 'team' ? item.id : null,
            teamIds: itemType === 'team' ? [item.id] : [],
            groupId: itemType === 'group' ? item.id : null,
            groupIds: itemType === 'group' ? [item.id] : [],
            assignedTeamIds: itemType === 'team' ? [item.id] : [],
            assignedTeamName: itemType === 'team' ? (item.name || '') : '',
            assignedGroupId: item.id,
            assignedGroupIds: [String(item.id).toLowerCase()],
            assignedGroupName: item.name || item.groupName || '',
          };
          break;
        }
        case 'checklists':
          collectionName = 'checklists';
          payload = {
            name: entityForm.name?.trim(),
            dueDate: entityForm.dueDate || today,
            items: entityForm.items || [],
            teamId: itemType === 'team' ? item.id : null,
            teamName: itemType === 'team' ? (item.name || '') : '',
            groupId: itemType === 'group' ? item.id : null,
            groupName: itemType === 'group' ? (item.groupName || item.name || '') : '',
            assignedGroupId: item.id,
            assignedGroupIds: [String(item.id).toLowerCase()],
          };
          break;
        case 'training':
          collectionName = 'trainingPlans';
          payload = {
            name: entityForm.name?.trim(),
            coachName: entityForm.coachName || '',
            date: entityForm.date || today,
            focusArea: entityForm.focusArea || '',
            description: entityForm.description || '',
            teamId: itemType === 'team' ? item.id : null,
            groupId: itemType === 'group' ? item.id : null,
            teamIds: itemType === 'team' ? [item.id] : [],
            groupIds: itemType === 'group' ? [item.id] : [],
            assignedGroupId: item.id,
            assignedGroupIds: [String(item.id).toLowerCase()],
          };
          break;
        case 'events': {
          collectionName = 'events';
          const eventDate = entityForm.startDate || entityForm.date || today;
          payload = {
            title: entityForm.title?.trim(),
            description: entityForm.description || '',
            date: eventDate,
            startDate: eventDate,
            endDate: entityForm.endDate || eventDate,
            time: entityForm.time || '',
            startTime: entityForm.time ? entityForm.time.split('-')[0].trim() : '',
            endTime: entityForm.time && entityForm.time.includes('-') ? entityForm.time.split('-')[1].trim() : '',
            isAllDay: !!entityForm.isAllDay,
            location: entityForm.location || 'Clubhouse',
            type: entityForm.type || 'training',
            category: entityForm.type || 'training',
            teamId: itemType === 'team' ? item.id : null,
            teamIds: itemType === 'team' ? [item.id] : [],
            groupId: itemType === 'group' ? item.id : null,
            groupIds: itemType === 'group' ? [item.id] : [],
            assignedGroupId: item.id,
            assignedGroupIds: [String(item.id).toLowerCase()],
            assignedGroupName: item.name || item.groupName || '',
            groupType: itemType === 'team' ? 'Team' : 'Group',
            openToAll: false,
            rsvps: entityForm.rsvps || entityForm.rsvp || {},
            rsvp: entityForm.rsvps || entityForm.rsvp || {},
          };
          break;
        }
        case 'shifts': {
          collectionName = 'rosters';
          const shiftDate = entityForm.date || entityForm.startDate || today;
          payload = {
            title: entityForm.title?.trim() || `${item.name || item.groupName} Shift Roster`,
            date: shiftDate,
            startDate: shiftDate,
            endDate: entityForm.endDate || shiftDate,
            groupId: itemType === 'group' ? item.id : null,
            teamId: itemType === 'team' ? item.id : null,
            assignedGroupId: item.id,
            assignedGroupIds: [String(item.id).toLowerCase()],
            shifts: (entityForm.shifts || []).map(s => ({
              role: s.role || 'Duty',
              startTime: s.startTime || '09:00',
              endTime: s.endTime || '12:00',
              assignedIds: [`group_${item.id}`, `team_${item.id}`, item.id, String(item.id).toLowerCase()],
              filledByName: s.filledByName || '',
            })),
          };
          break;
        }
        default:
          break;
      }

      if (!collectionName) return;

      if (activeItemModal.mode === 'edit' && activeItemModal.data?.id) {
        await updateDoc(doc(db, 'clubs', selectedClubId, collectionName, activeItemModal.data.id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        alert('Updated successfully!');
      } else {
        await addDoc(collection(db, 'clubs', selectedClubId, collectionName), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        alert('Created successfully!');
      }

      setActiveItemModal(null);
      fetchTabData();
    } catch (err) {
      alert('Error saving: ' + err.message);
    } finally {
      setSavingEntity(false);
    }
  };

  // Toggle task status
  const handleToggleTaskStatus = async (task, e) => {
    if (e) e.stopPropagation();
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await updateDoc(doc(db, 'clubs', selectedClubId, 'tasks', task.id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      setTabData(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t)
      }));
    } catch (err) {
      alert('Error updating status: ' + err.message);
    }
  };

  const unassignedMembers = allClubMembers
    .filter(m => !members.some(assigned => assigned.id === m.id))
    .map(m => ({ id: m.id, name: m.displayName || m.name || m.email || 'Unnamed Member' }));

  // Column definitions for different tabs
  const tabColumns = {
    members: [
      { header: 'Name', accessor: 'displayName', render: (val, r) => <strong>{val || r.name || r.email}</strong> },
      { header: 'Role', accessor: 'role', render: val => <span className="badge badge-info">{val || 'Member'}</span> },
      { header: 'Email', accessor: 'email' },
    ],
    posts: [
      { 
        header: 'Content', 
        accessor: 'content',
        render: (val) => <span className="text-truncate" style={{ fontWeight: 500, display: 'block', maxWidth: '300px' }}>{val || '—'}</span> 
      },
      { header: 'Visibility', accessor: 'visibility', render: val => <span className="badge badge-default">{val || 'Club-Only'}</span> },
      { header: 'Author', accessor: 'authorName' },
      { header: 'Date', accessor: (row) => row.createdAt?.toDate?.().toLocaleDateString() || '—' },
    ],
    matches: [
      { header: 'Competition', accessor: 'competitionName', render: val => <strong>{val || 'League Match'}</strong> },
      { header: 'Home Team', accessor: 'homeTeam' },
      { header: 'Away Team', accessor: 'awayTeam' },
      { header: 'Date', accessor: 'date' },
      { header: 'Result / Status', accessor: 'status', render: (val, r) => r.score ? <span className="badge badge-info">{r.score}</span> : <span className="badge badge-warning">{val || 'Upcoming'}</span> },
    ],
    tasks: [
      { 
        header: 'Title', 
        accessor: 'title', 
        render: (val, r) => (
          <div className="flex-center gap-sm">
            <button 
              className="btn-icon" 
              onClick={(e) => handleToggleTaskStatus(r, e)} 
              style={{ border: 'none', padding: '2px' }}
              title="Click to toggle status"
            >
              <CheckCircle size={16} color={r.status === 'completed' ? 'var(--success)' : 'var(--text-secondary)'} />
            </button>
            <span style={{ textDecoration: r.status === 'completed' ? 'line-through' : 'none', fontWeight: 600 }}>{val}</span>
          </div>
        )
      },
      { 
        header: 'Priority', 
        accessor: 'priority', 
        render: val => <span className={`badge ${val === 'high' ? 'badge-danger' : val === 'medium' ? 'badge-warning' : 'badge-default'}`}>{val || 'medium'}</span> 
      },
      { header: 'Due Date', accessor: 'dueDate' },
      { 
        header: 'Status', 
        accessor: 'status', 
        render: (val, r) => (
          <span 
            className={`badge ${val === 'completed' ? 'badge-success' : 'badge-warning'}`}
            style={{ cursor: 'pointer' }}
            onClick={(e) => handleToggleTaskStatus(r, e)}
          >
            {val || 'pending'}
          </span>
        ) 
      },
    ],
    checklists: [
      { header: 'Checklist Name', accessor: 'name', render: val => <strong>{val}</strong> },
      { header: 'Due Date', accessor: 'dueDate' },
      { 
        header: 'Completed Items', 
        accessor: 'items', 
        render: (val) => {
          const total = val?.length || 0;
          const completed = val?.filter(i => i.completed).length || 0;
          return (
            <span className={`badge ${completed === total && total > 0 ? 'badge-success' : 'badge-info'}`}>
              {completed} / {total} done
            </span>
          );
        } 
      },
    ],
    training: [
      { header: 'Plan Name', accessor: 'name', render: val => <strong>{val}</strong> },
      { header: 'Coach', accessor: 'coachName' },
      { header: 'Date', accessor: 'date' },
      { header: 'Focus Area', accessor: 'focusArea', render: val => <span className="badge badge-info">{val || 'Tactics'}</span> },
    ],
    events: [
      { header: 'Event Title', accessor: 'title', render: val => <strong>{val}</strong> },
      { header: 'Type', accessor: 'type', render: val => <span className="badge badge-info">{val || 'event'}</span> },
      { header: 'Start Date', accessor: (row) => row.startDate || row.date },
      { header: 'Location', accessor: 'location', render: val => val || 'Clubhouse' },
    ],
    shifts: [
      { header: 'Roster Title', accessor: 'title', render: val => <strong>{val}</strong> },
      { header: 'Scheduled Date', accessor: (row) => `${row.startDate || row.date || '—'}` },
      { 
        header: 'Shifts & Duties', 
        accessor: 'shifts', 
        render: (val) => {
          const count = val?.length || 0;
          return <span className="badge badge-default">{count} {count === 1 ? 'shift' : 'shifts'}</span>;
        } 
      },
    ],
  };

  const currentColumns = tabColumns[activeTab] || [];
  const currentData = activeTab === 'members' ? members : tabData[activeTab] || [];
  
  const actions = activeTab === 'members' ? [
    {
      label: 'Remove',
      onClick: (row) => handleRemoveMember(row.id),
      style: { color: 'var(--danger)' }
    }
  ] : [
    {
      label: 'View / Edit',
      icon: <Edit2 size={15} />,
      onClick: (row) => openEditItem(row)
    },
    {
      label: 'Delete',
      icon: <Trash2 size={15} />,
      variant: 'danger',
      onClick: (row) => handleDeleteItem(row)
    }
  ];

  return (
    <div className="team-group-detail" style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <button className="btn btn-outline" onClick={onClose} style={{ padding: '6px 12px', fontSize: '13px', marginBottom: 12 }}>
            <ArrowLeft size={14} style={{ marginRight: 6 }} /> Back to {itemType === 'team' ? 'Teams' : 'Groups'}
          </button>
          <h1>{item.name || item.groupName}</h1>
          <p>{itemType === 'team' ? 'Team' : 'Group'} Details and Management</p>
        </div>

        <div className="page-actions flex gap-sm">
          {activeTab === 'members' ? (
            <button className="btn btn-primary" onClick={() => setAddModalOpen(true)}>
              <Plus size={16} /> Add Members
            </button>
          ) : (
            <button className="btn btn-primary" onClick={openAddItem}>
              <Plus size={16} /> Add {tabs.find(t => t.id === activeTab)?.label.replace(' / Updates', '').slice(0, -1) || 'Item'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="tabs-container mb-md">
        <div className="tabs" style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '4px' }}>
          {tabs.map(tab => (
            <button 
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`} 
              onClick={() => setActiveTab(tab.id)}
            >
              <span style={{ marginRight: 6, display: 'inline-flex' }}>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="detail-content">
        <div className="card glass-card">
          <div className="card-header" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>
              {activeTab === 'members' 
                ? `${members.length} Assigned Members` 
                : `${currentData.length} Linked ${tabs.find(t => t.id === activeTab)?.label}`
              }
            </h3>
            <div className="flex gap-sm">
              <button 
                className="btn btn-outline btn-sm" 
                onClick={activeTab === 'members' ? fetchMembers : fetchTabData}
                title="Refresh tab data"
              >
                <RefreshCw size={14} className={loadingTab ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <DataTable 
            columns={currentColumns}
            data={currentData}
            loading={activeTab === 'members' ? loading : loadingTab}
            actions={actions}
            onRowClick={(row) => {
              if (activeTab !== 'members') openEditItem(row);
            }}
            emptyMessage={`No ${tabs.find(t => t.id === activeTab)?.label || 'items'} linked to this ${itemType}. Click '+ Add' to create one.`}
          />
        </div>
      </div>

      {/* Add Members Modal */}
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
            <p className="text-sm text-muted" style={{ marginTop: 8 }}>All club members are already assigned to this {itemType}.</p>
          )}
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => { setAddModalOpen(false); setSelectedNewMembers([]); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAddMembers} disabled={savingMembers || selectedNewMembers.length === 0}>
            {savingMembers ? 'Adding...' : 'Add Selected Members'}
          </button>
        </div>
      </Modal>

      {/* Edit / View Modal for Specific Tab Item */}
      <Modal 
        open={!!activeItemModal} 
        onClose={() => setActiveItemModal(null)} 
        title={`${activeItemModal?.mode === 'add' ? 'Add' : 'Edit'} ${tabs.find(t => t.id === activeTab)?.label.replace(' / Updates', '') || 'Item'}`}
        wide={activeTab === 'checklists' || activeTab === 'tasks' || activeTab === 'events' || activeTab === 'shifts'}
      >
        {activeItemModal && (
          <form onSubmit={handleSaveEntity}>
            
            {/* POSTS TAB */}
            {activeTab === 'posts' && (
              <>
                <div className="form-group">
                  <label>Post Content <span className="text-danger">*</span></label>
                  <textarea 
                    rows={4} 
                    className="form-control" 
                    value={entityForm.content || ''} 
                    onChange={e => setEntityForm({ ...entityForm, content: e.target.value })} 
                    placeholder="Write an announcement or update for this team/group..."
                    required 
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Visibility</label>
                    <select 
                      className="form-control" 
                      value={entityForm.visibility || 'Club-Only'} 
                      onChange={e => setEntityForm({ ...entityForm, visibility: e.target.value })}
                    >
                      <option value="Club-Only">Club-Only</option>
                      <option value="Team-Only">Team/Group Only</option>
                      <option value="Public">Public</option>
                      <option value="Network">Network</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Author Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={entityForm.authorName || 'Coach / Admin'} 
                      onChange={e => setEntityForm({ ...entityForm, authorName: e.target.value })} 
                    />
                  </div>
                </div>
              </>
            )}

            {/* MATCHES TAB */}
            {activeTab === 'matches' && (
              <>
                <div className="form-group">
                  <label>Competition Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={entityForm.competitionName || ''} 
                    onChange={e => setEntityForm({ ...entityForm, competitionName: e.target.value })} 
                    placeholder="e.g. Junior Regional League" 
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Home Team <span className="text-danger">*</span></label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={entityForm.homeTeam || ''} 
                      onChange={e => setEntityForm({ ...entityForm, homeTeam: e.target.value })} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Away Team <span className="text-danger">*</span></label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={entityForm.awayTeam || ''} 
                      onChange={e => setEntityForm({ ...entityForm, awayTeam: e.target.value })} 
                      required 
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Match Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={entityForm.date || ''} 
                      onChange={e => setEntityForm({ ...entityForm, date: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Venue / Ground</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={entityForm.venue || ''} 
                      onChange={e => setEntityForm({ ...entityForm, venue: e.target.value })} 
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Score / Result (Optional)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. 3 - 1" 
                      value={entityForm.score || ''} 
                      onChange={e => setEntityForm({ ...entityForm, score: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select 
                      className="form-control" 
                      value={entityForm.status || 'Upcoming'} 
                      onChange={e => setEntityForm({ ...entityForm, status: e.target.value })}
                    >
                      <option value="Upcoming">Upcoming</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Postponed">Postponed</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* TASKS TAB */}
            {activeTab === 'tasks' && (
              <>
                <div className="form-group">
                  <label>Task Title <span className="text-danger">*</span></label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={entityForm.title || ''} 
                    onChange={e => setEntityForm({ ...entityForm, title: e.target.value })} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea 
                    rows={3} 
                    className="form-control" 
                    value={entityForm.description || ''} 
                    onChange={e => setEntityForm({ ...entityForm, description: e.target.value })} 
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Priority</label>
                    <select 
                      className="form-control" 
                      value={entityForm.priority || 'medium'} 
                      onChange={e => setEntityForm({ ...entityForm, priority: e.target.value })}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Due Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={entityForm.dueDate || ''} 
                      onChange={e => setEntityForm({ ...entityForm, dueDate: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select 
                      className="form-control" 
                      value={entityForm.status || 'pending'} 
                      onChange={e => setEntityForm({ ...entityForm, status: e.target.value })}
                    >
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* CHECKLISTS TAB */}
            {activeTab === 'checklists' && (
              <>
                <div className="form-group">
                  <label>Checklist Name <span className="text-danger">*</span></label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={entityForm.name || ''} 
                    onChange={e => setEntityForm({ ...entityForm, name: e.target.value })} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Due Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={entityForm.dueDate || ''} 
                    onChange={e => setEntityForm({ ...entityForm, dueDate: e.target.value })} 
                  />
                </div>

                <div className="card mb-md" style={{ background: 'var(--bg)', padding: '16px' }}>
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>Checklist Items</label>
                  {(entityForm.items || []).map((it, idx) => (
                    <div key={idx} className="flex gap-sm mb-xs items-center">
                      <input 
                        type="checkbox" 
                        checked={it.completed || false} 
                        onChange={() => {
                          const updated = [...(entityForm.items || [])];
                          updated[idx] = { ...updated[idx], completed: !updated[idx].completed };
                          setEntityForm({ ...entityForm, items: updated });
                        }} 
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <input 
                        type="text" 
                        className="form-control" 
                        value={it.title || ''} 
                        onChange={e => {
                          const updated = [...(entityForm.items || [])];
                          updated[idx] = { ...updated[idx], title: e.target.value };
                          setEntityForm({ ...entityForm, items: updated });
                        }}
                        style={{ fontSize: '13px' }}
                      />
                      <button 
                        type="button" 
                        className="btn-icon danger" 
                        onClick={() => {
                          const updated = (entityForm.items || []).filter((_, i) => i !== idx);
                          setEntityForm({ ...entityForm, items: updated });
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button 
                    type="button" 
                    className="btn btn-outline btn-sm mt-sm" 
                    onClick={() => {
                      setEntityForm({
                        ...entityForm,
                        items: [...(entityForm.items || []), { title: '', completed: false }]
                      });
                    }}
                  >
                    <Plus size={14} /> Add Item
                  </button>
                </div>
              </>
            )}

            {/* TRAINING PLANS TAB */}
            {activeTab === 'training' && (
              <>
                <div className="form-group">
                  <label>Training Plan Name <span className="text-danger">*</span></label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={entityForm.name || ''} 
                    onChange={e => setEntityForm({ ...entityForm, name: e.target.value })} 
                    required 
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Coach Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={entityForm.coachName || ''} 
                      onChange={e => setEntityForm({ ...entityForm, coachName: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Session Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={entityForm.date || ''} 
                      onChange={e => setEntityForm({ ...entityForm, date: e.target.value })} 
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Focus Area</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. Offensive Transitions, High Press, Set Pieces" 
                    value={entityForm.focusArea || ''} 
                    onChange={e => setEntityForm({ ...entityForm, focusArea: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label>Plan Details & Drills</label>
                  <textarea 
                    rows={4} 
                    className="form-control" 
                    value={entityForm.description || ''} 
                    onChange={e => setEntityForm({ ...entityForm, description: e.target.value })} 
                    placeholder="Outline the drills and schedule for this session..." 
                  />
                </div>
              </>
            )}

            {/* EVENTS TAB */}
            {activeTab === 'events' && (
              <>
                <div className="form-group">
                  <label>Event Title <span className="text-danger">*</span></label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={entityForm.title || ''} 
                    onChange={e => setEntityForm({ ...entityForm, title: e.target.value })} 
                    required 
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Event Type</label>
                    <select 
                      className="form-control" 
                      value={entityForm.type || 'training'} 
                      onChange={e => setEntityForm({ ...entityForm, type: e.target.value })}
                    >
                      <option value="training">Training</option>
                      <option value="match">Match</option>
                      <option value="social">Social / Presentation</option>
                      <option value="meeting">Team Meeting</option>
                      <option value="event">General Event</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Location</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={entityForm.location || ''} 
                      onChange={e => setEntityForm({ ...entityForm, location: e.target.value })} 
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Start Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={entityForm.startDate || entityForm.date || ''} 
                      onChange={e => setEntityForm({ ...entityForm, startDate: e.target.value, date: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Time</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. 18:00 - 19:30" 
                      value={entityForm.time || ''} 
                      onChange={e => setEntityForm({ ...entityForm, time: e.target.value })} 
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Event Description</label>
                  <textarea 
                    rows={3} 
                    className="form-control" 
                    value={entityForm.description || ''} 
                    onChange={e => setEntityForm({ ...entityForm, description: e.target.value })} 
                  />
                </div>
              </>
            )}

            {/* SHIFTS TAB */}
            {activeTab === 'shifts' && (
              <>
                <div className="form-group">
                  <label>Roster Title <span className="text-danger">*</span></label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={entityForm.title || ''} 
                    onChange={e => setEntityForm({ ...entityForm, title: e.target.value })} 
                    placeholder="e.g. Canteen Saturday Duty"
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Scheduled Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={entityForm.date || entityForm.startDate || ''} 
                    onChange={e => setEntityForm({ ...entityForm, date: e.target.value, startDate: e.target.value })} 
                  />
                </div>

                <div className="card mb-md" style={{ background: 'var(--bg)', padding: '16px' }}>
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>Shifts & Duties</label>
                  {(entityForm.shifts || []).map((sh, idx) => (
                    <div key={idx} className="card mb-sm" style={{ padding: '10px', background: '#fff', border: '1px solid var(--border)' }}>
                      <div className="form-row" style={{ alignItems: 'center', marginBottom: 0 }}>
                        <div className="form-group" style={{ marginBottom: 0, flex: 2 }}>
                          <label style={{ fontSize: '11px' }}>Role / Duty</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            placeholder="e.g. Cook, Cashier"
                            value={sh.role || ''} 
                            onChange={e => {
                              const updated = [...(entityForm.shifts || [])];
                              updated[idx] = { ...updated[idx], role: e.target.value };
                              setEntityForm({ ...entityForm, shifts: updated });
                            }}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                          <label style={{ fontSize: '11px' }}>Time</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            placeholder="09:00 - 12:00"
                            value={sh.startTime && sh.endTime ? `${sh.startTime} - ${sh.endTime}` : (sh.time || '')} 
                            onChange={e => {
                              const updated = [...(entityForm.shifts || [])];
                              const parts = e.target.value.split('-');
                              updated[idx] = { 
                                ...updated[idx], 
                                time: e.target.value,
                                startTime: parts[0]?.trim() || '09:00',
                                endTime: parts[1]?.trim() || '12:00'
                              };
                              setEntityForm({ ...entityForm, shifts: updated });
                            }}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, flex: 2 }}>
                          <label style={{ fontSize: '11px' }}>Assigned Person</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            placeholder="Member name"
                            value={sh.filledByName || ''} 
                            onChange={e => {
                              const updated = [...(entityForm.shifts || [])];
                              updated[idx] = { ...updated[idx], filledByName: e.target.value };
                              setEntityForm({ ...entityForm, shifts: updated });
                            }}
                          />
                        </div>
                        <button 
                          type="button" 
                          className="btn-icon danger mt-md" 
                          onClick={() => {
                            const updated = (entityForm.shifts || []).filter((_, i) => i !== idx);
                            setEntityForm({ ...entityForm, shifts: updated });
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button 
                    type="button" 
                    className="btn btn-outline btn-sm mt-xs" 
                    onClick={() => {
                      setEntityForm({
                        ...entityForm,
                        shifts: [...(entityForm.shifts || []), { role: '', startTime: '09:00', endTime: '12:00', filledByName: '' }]
                      });
                    }}
                  >
                    <Plus size={14} /> Add Shift Slot
                  </button>
                </div>
              </>
            )}

            {/* Modal Actions */}
            <div className="form-actions mt-md" style={{ display: 'flex', justifyContent: 'space-between' }}>
              {activeItemModal.mode === 'edit' ? (
                <button 
                  type="button" 
                  className="btn btn-outline danger" 
                  onClick={() => handleDeleteItem(activeItemModal.data)}
                >
                  <Trash2 size={15} /> Delete
                </button>
              ) : <div />}

              <div className="flex gap-sm">
                <button type="button" className="btn btn-outline" onClick={() => setActiveItemModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingEntity}>
                  {savingEntity ? 'Saving...' : activeItemModal.mode === 'edit' ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
