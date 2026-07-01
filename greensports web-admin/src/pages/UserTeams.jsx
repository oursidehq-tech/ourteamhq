import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import { UsersRound, Trophy, Shield, User, Mail } from 'lucide-react';

export default function UserTeams() {
  const { selectedClubId, selectedClub } = useClub();
  const { user } = useAuth();
  
  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState(null);

  const fetchTeamData = async () => {
    if (!selectedClubId) return;
    setLoading(true);
    try {
      const [teamsSnap, membersSnap] = await Promise.all([
        getDocs(collection(db, 'clubs', selectedClubId, 'teams')),
        getDocs(collection(db, 'clubs', selectedClubId, 'members'))
      ]);

      setTeams(teamsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setMembers(membersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching teams:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTeamData();
  }, [selectedClubId]);

  // Find the member record for the logged-in user in this club
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

  // My Teams: teams that the user is assigned to
  const myTeams = useMemo(() => {
    return teams.filter(t => {
      // Check if team memberIds contains user's uid OR if user member record's teamIds contains team id
      const isMember = 
        t.memberIds?.includes(user?.uid) || 
        (clubMemberRecord && (
          t.memberIds?.includes(clubMemberRecord.id) ||
          (clubMemberRecord.uid && t.memberIds?.includes(clubMemberRecord.uid)) ||
          (clubMemberRecord.userId && t.memberIds?.includes(clubMemberRecord.userId)) ||
          (clubMemberRecord.email && t.memberIds?.some(id => id?.toLowerCase().trim() === clubMemberRecord.email?.toLowerCase().trim()))
        ));
      const isAssigned = clubMemberRecord?.teamIds?.includes(t.id);
      return isMember || isAssigned;
    });
  }, [teams, user, clubMemberRecord]);

  // Auto-select the first team if none is selected
  useEffect(() => {
    if (myTeams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(myTeams[0].id);
    }
  }, [myTeams, selectedTeamId]);

  // Currently selected team object
  const activeTeam = useMemo(() => {
    return teams.find(t => t.id === selectedTeamId);
  }, [teams, selectedTeamId]);

  // Roster for the active team
  const activeRoster = useMemo(() => {
    if (!selectedTeamId) return [];
    return members.filter(m => {
      const inTeamIds = m.teamIds?.includes(selectedTeamId);
      const inTeamMemberIds = 
        activeTeam?.memberIds?.includes(m.id) ||
        (m.uid && activeTeam?.memberIds?.includes(m.uid)) ||
        (m.userId && activeTeam?.memberIds?.includes(m.userId)) ||
        (m.email && activeTeam?.memberIds?.some(id => id?.toLowerCase().trim() === m.email?.toLowerCase().trim()));
      return inTeamIds || inTeamMemberIds;
    });
  }, [members, selectedTeamId, activeTeam]);

  // Split roster into coaches/staff and players
  const coaches = useMemo(() => {
    return activeRoster.filter(m => {
      const roles = m.roles || [m.role];
      return roles.some(r => ['Coach', 'Manager', 'Owner', 'Admin'].includes(r));
    });
  }, [activeRoster]);

  const players = useMemo(() => {
    return activeRoster.filter(m => {
      const roles = m.roles || [m.role];
      return !roles.some(r => ['Coach', 'Manager', 'Owner', 'Admin'].includes(r));
    });
  }, [activeRoster]);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1>My Teams</h1>
          <p className="subtitle">View your active team assignments, division rankings, and connect with teammates inside {selectedClub?.name}</p>
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>Loading teams...</p>
      ) : myTeams.length === 0 ? (
        <div className="card text-center" style={{ padding: '60px 20px', border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px' }}>
          <UsersRound size={40} style={{ color: 'var(--text-lighter)', marginBottom: '16px' }} />
          <h3 style={{ margin: 0, color: 'var(--text)' }}>No Teams Assigned</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px', maxWidth: '400px', marginInline: 'auto' }}>
            You haven't been assigned to any teams yet. Please contact your club administrator or coach to add you to a team roster.
          </p>
        </div>
      ) : (
        <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px' }}>
          
          {/* Left Column: Teams List Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Select Team ({myTeams.length})
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {myTeams.map(t => {
                const isActive = t.id === selectedTeamId;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTeamId(t.id)}
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
                      {t.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Trophy size={10} /> {t.ageGroup || 'General Squad'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Team Details & Roster */}
          {activeTeam && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Team Information Card */}
              <div className="card shadow-sm" style={{ border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 800, color: 'var(--text)' }}>
                      {activeTeam.name}
                    </h2>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--primary)', fontWeight: 600 }}>
                      {activeTeam.ageGroup || 'General'} Squad • {activeRoster.length} Member{activeRoster.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {activeTeam.coachName && (
                    <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-light, #f1f5f9)', fontSize: '12px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Head Coach:</span>{' '}
                      <strong style={{ color: 'var(--text)' }}>{activeTeam.coachName}</strong>
                    </div>
                  )}
                </div>

                {activeTeam.description && (
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: 'var(--text-secondary)', borderTop: '1px solid var(--border-light, #f1f5f9)', paddingTop: '12px' }}>
                    {activeTeam.description}
                  </p>
                )}
              </div>

              {/* Roster Card */}
              <div className="card shadow-sm" style={{ border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px', padding: '24px' }}>
                
                {/* 1. Coaching & Management Staff */}
                <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={16} color="var(--primary)" /> Staff & Leadership
                </h3>

                {coaches.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--text-lighter)', fontStyle: 'italic', marginBottom: '24px' }}>No staff members assigned.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginBottom: '28px' }}>
                    {coaches.map(c => (
                      <div key={c.id} style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--border-light, #f1f5f9)', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px' }}>
                          {c.displayName?.charAt(0).toUpperCase() || 'S'}
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.displayName}</div>
                          <div style={{ fontSize: '10px', color: '#d97706', fontWeight: 700 }}>{c.role || 'Coach'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 2. Players Squad Roster */}
                <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={16} color="var(--primary)" /> Players Squad
                </h3>

                {players.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--text-lighter)', fontStyle: 'italic' }}>No player records linked to this team roster.</p>
                ) : (
                  <div style={{ border: '1px solid var(--border-light, #f1f5f9)', borderRadius: '12px', overflow: 'hidden' }}>
                    <table style={{ margin: 0, border: 'none', background: 'transparent' }}>
                      <thead style={{ background: '#f8fafc' }}>
                        <tr>
                          <th style={{ padding: '10px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Player Name</th>
                          <th style={{ padding: '10px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Email</th>
                          <th style={{ padding: '10px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'right' }}>Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {players.map(p => (
                          <tr key={p.id} style={{ borderBottom: '1px solid var(--border-light, #f1f5f9)' }}>
                            <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px' }}>
                                {p.displayName?.charAt(0).toUpperCase() || 'P'}
                              </div>
                              <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '13px' }}>{p.displayName}</span>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {p.email ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Mail size={12} /> {p.email}
                                </span>
                              ) : '—'}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>
                              <span className="badge badge-default" style={{ padding: '2px 8px', fontSize: '10px' }}>
                                {p.role || 'Player'}
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
