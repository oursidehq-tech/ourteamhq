import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ArrowLeft, Users, FileText, CheckSquare, Calendar, ClipboardList, TrendingUp } from 'lucide-react';
import DataTable from './DataTable';

export default function TeamGroupDetail({ item, itemType, selectedClubId, onClose }) {
  const [activeTab, setActiveTab] = useState('members');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Define tabs based on itemType
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
      const allMembers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const filtered = allMembers.filter(m => {
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

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Remove this member from the ' + itemType + '?')) return;
    try {
      const memberRef = doc(db, 'clubs', selectedClubId, 'members', memberId);
      if (itemType === 'team') {
        await updateDoc(memberRef, {
          teamIds: arrayRemove(item.id),
          updatedAt: serverTimestamp()
        });
      } else {
        await updateDoc(memberRef, {
          groupIds: arrayRemove(item.id),
          updatedAt: serverTimestamp()
        });
      }
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (err) {
      alert('Error removing member: ' + err.message);
    }
  };

  const columns = [
    { header: 'Name', accessor: 'displayName' },
    { header: 'Role', accessor: 'role' },
    { header: 'Email', accessor: 'email' },
  ];

  const actions = [
    {
      label: 'Remove',
      onClick: (row) => handleRemoveMember(row.id),
      style: { color: 'var(--danger)' }
    }
  ];

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
        {activeTab === 'members' && (
          <div className="card glass-card">
            <div className="card-header" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{members.length} Assigned Members</h3>
              <p className="text-sm text-muted" style={{ margin: 0 }}>To add members, go to the Members page and edit their roles.</p>
            </div>
            <DataTable 
              columns={columns}
              data={members}
              loading={loading}
              actions={actions}
            />
          </div>
        )}

        {activeTab !== 'members' && (
          <div className="card glass-card" style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ opacity: 0.5 }}>
              <FileText size={48} style={{ margin: '0 auto 16px auto' }} />
              <h3>{tabs.find(t => t.id === activeTab)?.label}</h3>
              <p>This view displays records filtered for {item.name || item.groupName}.<br/>Detailed integration for this tab is under development.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
