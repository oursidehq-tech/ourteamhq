import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, arrayRemove, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ArrowLeft, Users, FileText, CheckSquare, Calendar, ClipboardList, TrendingUp, Plus } from 'lucide-react';
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

  const tabs = itemType === 'team' ? [
    { id: 'members', label: 'Members', icon: <Users size={16} /> },
    { id: 'posts', label: 'Posts / Updates', icon: <FileText size={16} /> },
    { id: 'matches', label: 'Matches', icon: <Calendar size={16} /> },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={16} /> },
    { id: 'checklists', label: 'Checklists', icon: <ClipboardList size={16} /> },
    { id: 'training', label: 'Training Plans', icon: <TrendingUp size={16} /> },
    { id: 'events', label: 'Events', icon: <Calendar size={16} /> },
  ] : [
    { id: 'members', label: 'Members', icon: <Users size={16} /> },
    { id: 'shifts', label: 'Shifts', icon: <Calendar size={16} /> },
    { id: 'posts', label: 'Updates', icon: <FileText size={16} /> },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={16} /> },
    { id: 'checklists', label: 'Checklists', icon: <ClipboardList size={16} /> },
    { id: 'training', label: 'Training Plans', icon: <TrendingUp size={16} /> },
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

  useEffect(() => {
    if (activeTab === 'members') return;

    const fetchTabData = async () => {
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
            return d.teamId === item.id || d.homeTeamId === item.id || d.awayTeamId === item.id || (d.teamIds && d.teamIds.includes(item.id));
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
            return d.teamIds?.includes(item.id) || d.groupIds?.includes(item.id) || d.teamId === item.id || d.groupId === item.id;
          }
          if (activeTab === 'shifts') {
             return d.shifts && d.shifts.some(s => s.assignedIds && (s.assignedIds.includes(`team_${item.id}`) || s.assignedIds.includes(`group_${item.id}`)));
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

  const unassignedMembers = allClubMembers
    .filter(m => !members.some(assigned => assigned.id === m.id))
    .map(m => ({ id: m.id, name: m.displayName || m.name || m.email || 'Unnamed Member' }));

  // Column definitions for different tabs
  const tabColumns = {
    members: [
      { header: 'Name', accessor: 'displayName' },
      { header: 'Role', accessor: 'role' },
      { header: 'Email', accessor: 'email' },
    ],
    posts: [
      { header: 'Content', accessor: (row) => row.content?.substring(0, 50) + (row.content?.length > 50 ? '...' : '') },
      { header: 'Visibility', accessor: 'visibility' },
      { header: 'Author', accessor: 'authorName' },
      { header: 'Date', accessor: (row) => row.createdAt?.toDate?.().toLocaleDateString() || '—' },
    ],
    matches: [
      { header: 'Competition', accessor: 'competitionName' },
      { header: 'Home', accessor: 'homeTeamName' },
      { header: 'Away', accessor: 'awayTeamName' },
      { header: 'Date', accessor: 'date' },
      { header: 'Status', accessor: 'status' },
    ],
    tasks: [
      { header: 'Title', accessor: 'title' },
      { header: 'Priority', accessor: 'priority' },
      { header: 'Due Date', accessor: 'dueDate' },
      { header: 'Status', accessor: 'status' },
    ],
    checklists: [
      { header: 'Name', accessor: 'name' },
      { header: 'Due', accessor: 'dueDate' },
      { header: 'Items', accessor: (row) => `${row.items?.filter(i => i.completed).length || 0}/${row.items?.length || 0}` },
    ],
    training: [
      { header: 'Plan Name', accessor: 'name' },
      { header: 'Coach', accessor: 'coachName' },
      { header: 'Date', accessor: 'date' },
      { header: 'Focus', accessor: 'focusArea' },
    ],
    events: [
      { header: 'Title', accessor: 'title' },
      { header: 'Type', accessor: 'type' },
      { header: 'Start Date', accessor: 'startDate' },
      { header: 'Location', accessor: 'location' },
    ],
    shifts: [
      { header: 'Roster Title', accessor: 'title' },
      { header: 'Scheduled Period', accessor: (row) => `${row.startDate || row.date}` },
      { header: 'Shifts', accessor: (row) => row.shifts?.length || 0 },
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
  ] : null;

  return (
    <div className="team-group-detail" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <button className="btn btn-outline" onClick={onClose} style={{ padding: '6px 12px', fontSize: '13px', marginBottom: 12 }}>
            <ArrowLeft size={14} style={{ marginRight: 6 }} /> Back
          </button>
          <h1>{item.name || item.groupName}</h1>
          <p>{itemType === 'team' ? 'Team' : 'Group'} Details and Management</p>
        </div>
        {activeTab === 'members' && (
          <div className="page-actions">
             <button className="btn btn-primary" onClick={() => setAddModalOpen(true)}>
               <Plus size={16} /> Add Members
             </button>
          </div>
        )}
      </div>

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

      <div className="detail-content">
        <div className="card glass-card">
          <div className="card-header" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>
              {activeTab === 'members' ? `${members.length} Assigned Members` : `${currentData.length} Linked ${tabs.find(t => t.id === activeTab)?.label}`}
            </h3>
          </div>
          <DataTable 
            columns={currentColumns}
            data={currentData}
            loading={activeTab === 'members' ? loading : loadingTab}
            actions={actions}
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
    </div>
  );
}
