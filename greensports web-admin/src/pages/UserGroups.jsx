import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import { Users, ShieldCheck, User, Mail, Award } from 'lucide-react';

export default function UserGroups() {
  const { selectedClubId, selectedClub } = useClub();
  const { user } = useAuth();
  
  const [groups, setGroups] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  const fetchGroupData = async () => {
    if (!selectedClubId) return;
    setLoading(true);
    try {
      const [groupsSnap, membersSnap] = await Promise.all([
        getDocs(collection(db, 'clubs', selectedClubId, 'groups')),
        getDocs(collection(db, 'clubs', selectedClubId, 'members'))
      ]);

      setGroups(groupsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setMembers(membersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching groups:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGroupData();
  }, [selectedClubId]);

  // We filter out team-groups in this tab to keep My Groups focused on committees and custom groups!
  const clubGroups = useMemo(() => {
    return groups.filter(g => g.groupType !== 'Team' && g.source !== 'team');
  }, [groups]);

  // Find user's member record in this club to check their groupIds
  const clubMemberRecord = useMemo(() => {
    if (!user) return null;
    const emailLower = user.email?.toLowerCase().trim();
    return members.find(m => 
      m.id === user.uid || 
      m.uid === user.uid || 
      m.userId === user.uid || 
      (m.email && m.email.toLowerCase().trim() === emailLower)
    );
  }, [members, user]);

  // Groups the user belongs to (or all groups in the club to let them view contact directories)
  const myGroups = useMemo(() => {
    return clubGroups.map(g => {
      const isMember = 
        clubMemberRecord?.groupIds?.includes(g.id) || 
        clubMemberRecord?.groupIds?.includes(`group:${g.id}`) || 
        g.memberIds?.includes(user?.uid) ||
        (clubMemberRecord && (
          g.memberIds?.includes(clubMemberRecord.id) ||
          (clubMemberRecord.uid && g.memberIds?.includes(clubMemberRecord.uid)) ||
          (clubMemberRecord.userId && g.memberIds?.includes(clubMemberRecord.userId)) ||
          (clubMemberRecord.email && g.memberIds?.some(id => id?.toLowerCase().trim() === clubMemberRecord.email?.toLowerCase().trim()))
        ));
      return { ...g, isMember };
    });
  }, [clubGroups, clubMemberRecord, user]);

  // Set initial selected group
  useEffect(() => {
    if (myGroups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(myGroups[0].id);
    }
  }, [myGroups, selectedGroupId]);

  const activeGroup = useMemo(() => {
    return myGroups.find(g => g.id === selectedGroupId);
  }, [myGroups, selectedGroupId]);

  // Roster of members belonging to this group
  const activeRoster = useMemo(() => {
    if (!selectedGroupId) return [];
    return members.filter(m => {
      const inGroupIds = m.groupIds?.includes(selectedGroupId) || m.groupIds?.includes(`group:${selectedGroupId}`);
      const inGroupMemberIds = 
        activeGroup?.memberIds?.includes(m.id) ||
        (m.uid && activeGroup?.memberIds?.includes(m.uid)) ||
        (m.userId && activeGroup?.memberIds?.includes(m.userId)) ||
        (m.email && activeGroup?.memberIds?.some(id => id?.toLowerCase().trim() === m.email?.toLowerCase().trim()));
      return inGroupIds || inGroupMemberIds;
    });
  }, [members, selectedGroupId, activeGroup]);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1>My Groups & Committees</h1>
          <p className="subtitle">Explore active committees, operational groups, and contact boards inside {selectedClub?.name}</p>
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>Loading groups...</p>
      ) : myGroups.length === 0 ? (
        <div className="card text-center" style={{ padding: '60px 20px', border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px' }}>
          <Users size={40} style={{ color: 'var(--text-lighter)', marginBottom: '16px' }} />
          <h3 style={{ margin: 0, color: 'var(--text)' }}>No Groups Listed</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px', maxWidth: '400px', marginInline: 'auto' }}>
            There are no custom groups or committee boards set up in this club yet.
          </p>
        </div>
      ) : (
        <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px' }}>
          
          {/* Left Column: Groups Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Club Directories ({myGroups.length})
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {myGroups.map(g => {
                const isActive = g.id === selectedGroupId;
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGroupId(g.id)}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border-light, #f1f5f9)'}`,
                      background: isActive ? 'rgba(16, 185, 129, 0.06)' : '#ffffff',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: isActive ? 'none' : '0 2px 4px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '14px', color: isActive ? 'var(--primary)' : 'var(--text)', marginBottom: '4px' }}>
                      {g.groupName}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Type: {g.groupType || 'Committee'}
                      </span>
                      {g.isMember && (
                        <span style={{ fontSize: '9px', background: '#d1fae5', color: '#065f46', fontWeight: 700, padding: '1px 5px', borderRadius: '4px' }}>
                          My Group
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Group Details & Directory Roster */}
          {activeGroup && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Group Metadata */}
              <div className="card shadow-sm" style={{ border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 800, color: 'var(--text)' }}>
                      {activeGroup.groupName}
                    </h2>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--primary)', fontWeight: 600 }}>
                      Classification: {activeGroup.groupType || 'General Board'} • {activeRoster.length} Member{activeRoster.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {activeGroup.system && (
                    <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', fontWeight: 700, padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      System Admin Group
                    </span>
                  )}
                </div>
              </div>

              {/* Members Directory */}
              <div className="card shadow-sm" style={{ border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px', padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} color="var(--primary)" /> Member Directory
                </h3>

                {activeRoster.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-lighter)' }}>
                    <User size={24} style={{ marginBottom: '8px' }} />
                    <p style={{ margin: 0, fontSize: '12px' }}>No members are currently mapped to this group registry.</p>
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border-light, #f1f5f9)', borderRadius: '12px', overflow: 'hidden' }}>
                    <table style={{ margin: 0, border: 'none', background: 'transparent' }}>
                      <thead style={{ background: '#f8fafc' }}>
                        <tr>
                          <th style={{ padding: '10px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Member</th>
                          <th style={{ padding: '10px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Email Context</th>
                          <th style={{ padding: '10px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'right' }}>Club Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeRoster.map(m => (
                          <tr key={m.id} style={{ borderBottom: '1px solid var(--border-light, #f1f5f9)' }}>
                            <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px' }}>
                                {m.displayName?.charAt(0).toUpperCase() || 'M'}
                              </div>
                              <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '13px' }}>{m.displayName}</span>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {m.email ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Mail size={12} /> {m.email}
                                </span>
                              ) : '—'}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>
                              <span className="badge badge-info" style={{ padding: '2px 8px', fontSize: '10px' }}>
                                {m.role || 'Member'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}

    </div>
  );
}
