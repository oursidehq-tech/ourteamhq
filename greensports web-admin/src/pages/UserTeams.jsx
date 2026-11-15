import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, getDocs, doc, query, where, orderBy, updateDoc, serverTimestamp, arrayUnion 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import { 
  UsersRound, Trophy, Shield, User, Mail, Calendar, Clock, 
  MapPin, AlertTriangle, CheckCircle2, AlertCircle, XCircle, 
  ChevronRight, ArrowRight, Bell, Edit3, X, RotateCcw, ListChecks,
  FileText, Pin
} from 'lucide-react';
import Modal from '../components/Modal';
import { trainingService, DESIGN_TOKENS } from '../services/trainingService';
import { complianceService } from '../services/complianceService';

const STAFF_ROLES = [
  'Coach',
  'Assistant Coach',
  'Trainer',
  'First Aid Officer',
  'Team Manager'
];

export default function UserTeams() {
  const { selectedClubId, selectedClub } = useClub();
  const { user, profile } = useAuth();
  
  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [trainingSessions, setTrainingSessions] = useState([]);
  const [events, setEvents] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [duties, setDuties] = useState([]);
  const [complianceRecords, setComplianceRecords] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'updates' | 'matches' | 'duties' | 'squad'
  
  // Modals state
  const [sessionDetailModal, setSessionDetailModal] = useState(null);
  const [cancelModalSession, setCancelModalSession] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  
  const [editLogisticsSession, setEditLogisticsSession] = useState(null);
  const [logisticsForm, setLogisticsForm] = useState({ scheduledAt: '', location: '', notes: '' });
  const [savingLogistics, setSavingLogistics] = useState(false);

  const [reinstateSession, setReinstateSession] = useState(null);
  const [reinstating, setReinstating] = useState(false);

  const loadData = async () => {
    if (!selectedClubId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [
        teamsSnap, 
        membersSnap, 
        sessionsSnap, 
        eventsSnap, 
        postsSnap, 
        tasksSnap,
        complianceData
      ] = await Promise.all([
        getDocs(collection(db, 'clubs', selectedClubId, 'teams')),
        getDocs(collection(db, 'clubs', selectedClubId, 'members')),
        getDocs(query(collection(db, 'clubs', selectedClubId, 'trainingSessions'), orderBy('scheduledAt', 'desc'))).catch(() => getDocs(collection(db, 'clubs', selectedClubId, 'trainingSessions'))),
        getDocs(query(collection(db, 'clubs', selectedClubId, 'events'), orderBy('date', 'desc'))).catch(() => getDocs(collection(db, 'clubs', selectedClubId, 'events'))),
        getDocs(query(collection(db, 'clubs', selectedClubId, 'posts'), orderBy('createdAt', 'desc'))).catch(() => getDocs(collection(db, 'clubs', selectedClubId, 'posts'))),
        getDocs(collection(db, 'clubs', selectedClubId, 'tasks')).catch(() => ({ docs: [] })),
        complianceService.getStaffCompliance(selectedClubId).catch(() => [])
      ]);

      setTeams(teamsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setMembers(membersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTrainingSessions(sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.isDeleted !== true));
      setEvents(eventsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.isDeleted !== true));
      setUpdates(postsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setDuties(tasksSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setComplianceRecords(complianceData || []);
    } catch (err) {
      console.error('Error fetching team portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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

  // Authorised teams: only teams the user or their child is assigned to
  const myTeams = useMemo(() => {
    return teams.filter(t => {
      const isMember = 
        t.memberIds?.includes(user?.uid) || 
        (clubMemberRecord && (
          t.memberIds?.includes(clubMemberRecord.id) ||
          (clubMemberRecord.uid && t.memberIds?.includes(clubMemberRecord.uid)) ||
          (clubMemberRecord.userId && t.memberIds?.includes(clubMemberRecord.userId)) ||
          (clubMemberRecord.email && t.memberIds?.some(id => id?.toLowerCase().trim() === clubMemberRecord.email?.toLowerCase().trim()))
        ));
      const isAssigned = clubMemberRecord?.teamIds?.includes(t.id);
      
      // Also check if user is a designated staff member on the team object
      const isStaffOnTeam = 
        t.coachId === user?.uid || 
        t.managerId === user?.uid ||
        t.assistantCoachId === user?.uid ||
        (t.staffAssignments && Object.values(t.staffAssignments).some(arr => Array.isArray(arr) && arr.includes(user?.uid)));

      return isMember || isAssigned || isStaffOnTeam;
    });
  }, [teams, user, clubMemberRecord]);

  // Auto-select the first team if none is selected
  useEffect(() => {
    if (myTeams.length > 0 && (!selectedTeamId || !myTeams.some(t => t.id === selectedTeamId))) {
      setSelectedTeamId(myTeams[0].id);
    }
  }, [myTeams, selectedTeamId]);

  // Currently selected team object
  const activeTeam = useMemo(() => {
    return teams.find(t => t.id === selectedTeamId);
  }, [teams, selectedTeamId]);

  // Check if current user is an authorised Coach or Manager for active team
  const isTeamStaffLeader = useMemo(() => {
    if (!activeTeam || !user) return false;
    // Check admin / club owner
    const roleLower = String(profile?.role || '').toLowerCase();
    if (roleLower === 'owner' || roleLower === 'admin') return true;

    // Check team direct appointments
    if (activeTeam.coachId === user.uid || activeTeam.managerId === user.uid) return true;
    if (activeTeam.coachName && activeTeam.coachName === profile?.displayName) return true;

    // Check staffAssignments map on team
    const staffMap = activeTeam.staffAssignments || {};
    const coachIds = staffMap['Coach'] || [];
    const mgrIds = staffMap['Team Manager'] || [];
    if (coachIds.includes(user.uid) || mgrIds.includes(user.uid)) return true;

    // Check user's member role in club
    const mRoles = (clubMemberRecord?.roles || [clubMemberRecord?.role]).map(r => String(r).toLowerCase());
    if (mRoles.includes('coach') || mRoles.includes('manager')) {
      const inTeam = clubMemberRecord?.teamIds?.includes(activeTeam.id);
      if (inTeam) return true;
    }

    return false;
  }, [activeTeam, user, profile, clubMemberRecord]);

  // Team members belonging to active team
  const teamMembers = useMemo(() => {
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

  // Team Staff Assignment mapping (separate appointments from membership roles)
  const staffByRole = useMemo(() => {
    if (!activeTeam) return {};
    const map = {};
    STAFF_ROLES.forEach(r => { map[r] = []; });

    // 1. Team document explicit staff fields
    if (activeTeam.coachName) {
      map['Coach'].push({ name: activeTeam.coachName, id: activeTeam.coachId || null });
    }
    if (activeTeam.assistantCoachName) {
      map['Assistant Coach'].push({ name: activeTeam.assistantCoachName, id: activeTeam.assistantCoachId || null });
    }
    if (activeTeam.trainerName) {
      map['Trainer'].push({ name: activeTeam.trainerName, id: activeTeam.trainerId || null });
    }
    if (activeTeam.firstAidName) {
      map['First Aid Officer'].push({ name: activeTeam.firstAidName, id: activeTeam.firstAidId || null });
    }
    if (activeTeam.managerName) {
      map['Team Manager'].push({ name: activeTeam.managerName, id: activeTeam.managerId || null });
    }

    // 2. Team staffAssignments map (if configured)
    if (activeTeam.staffAssignments && typeof activeTeam.staffAssignments === 'object') {
      Object.entries(activeTeam.staffAssignments).forEach(([role, userIds]) => {
        if (map[role] && Array.isArray(userIds)) {
          userIds.forEach(uid => {
            const memberObj = members.find(m => m.id === uid || m.uid === uid || m.userId === uid);
            const name = memberObj?.displayName || memberObj?.name || 'Staff Member';
            if (!map[role].some(s => s.name === name)) {
              map[role].push({ name, id: uid, memberObj });
            }
          });
        }
      });
    }

    // 3. Match explicit staff appointments from teamMembers where appointment is specifically set
    teamMembers.forEach(m => {
      const appts = m.teamAppointments?.[selectedTeamId] || m.teamRole;
      if (appts) {
        const apptList = Array.isArray(appts) ? appts : [appts];
        apptList.forEach(r => {
          if (map[r] && !map[r].some(s => s.id === m.id || s.name === m.displayName)) {
            map[r].push({ name: m.displayName || m.name, id: m.id, memberObj: m });
          }
        });
      }
    });

    return map;
  }, [activeTeam, teamMembers, selectedTeamId, members]);

  // Helper to compute staff compliance status: returns 'green' | 'amber' | 'red'
  const getStaffComplianceIndicator = (staffItem) => {
    if (!staffItem || !staffItem.name || staffItem.name === 'To be assigned') return null;
    const uid = staffItem.id;
    if (!uid) return 'green'; // Default compliant if assigned by name
    const records = complianceRecords.filter(c => c.uid === uid || c.memberId === uid || c.userId === uid);
    if (records.length === 0) return 'amber'; // Pending verification

    const statuses = records.map(r => complianceService.calculateStatus(r, r));
    if (statuses.includes('Expired') || statuses.includes('Missing') || statuses.includes('Rejected')) {
      return 'red';
    }
    if (statuses.includes('Expiring soon') || statuses.includes('Pending review')) {
      return 'amber';
    }
    return 'green';
  };

  // Squad Players (Excluding appointed staff members)
  const squadPlayers = useMemo(() => {
    return teamMembers.filter(m => {
      // Exclude pure coaches/managers who don't play
      const roles = (m.roles || [m.role]).map(r => String(r).toLowerCase());
      const isStaffOnly = roles.some(r => ['coach', 'manager'].includes(r)) && !roles.includes('player');
      return !isStaffOnly;
    });
  }, [teamMembers]);

  // Sessions for active team
  const teamSessions = useMemo(() => {
    if (!selectedTeamId) return [];
    return trainingSessions
      .filter(s => s.teamId === selectedTeamId || (!s.teamId && s.teamName === activeTeam?.name))
      .sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''));
  }, [trainingSessions, selectedTeamId, activeTeam]);

  // Next upcoming training session
  const nextSession = useMemo(() => {
    const nowIso = new Date().toISOString();
    // Prefer upcoming scheduled or cancelled sessions
    const upcoming = teamSessions.filter(s => (s.scheduledAt || '') >= nowIso.slice(0, 10));
    return upcoming.length > 0 ? upcoming[0] : teamSessions[0] || null;
  }, [teamSessions]);

  // Matches & fixtures for active team
  const teamMatches = useMemo(() => {
    if (!selectedTeamId || !activeTeam) return [];
    return events.filter(e => {
      const matchTeam = 
        e.teamId === selectedTeamId || 
        e.assignedGroupId === selectedTeamId ||
        (Array.isArray(e.assignedGroupIds) && e.assignedGroupIds.includes(selectedTeamId)) ||
        e.homeTeamId === selectedTeamId || 
        e.awayTeamId === selectedTeamId ||
        (e.title && e.title.toLowerCase().includes(activeTeam.name.toLowerCase()));
      const isMatch = e.type === 'match' || e.category === 'match' || e.category === 'fixture';
      return matchTeam && isMatch;
    }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [events, selectedTeamId, activeTeam]);

  // Next upcoming match
  const nextMatch = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = teamMatches.filter(m => (m.date || '') >= today);
    return upcoming.length > 0 ? upcoming[0] : teamMatches[0] || null;
  }, [teamMatches]);

  // All team activities (fixtures + training + club events)
  const teamActivities = useMemo(() => {
    if (!selectedTeamId || !activeTeam) return [];
    const sessionItems = teamSessions.map(s => ({
      id: s.id,
      title: 'Team training',
      type: 'Training',
      date: s.scheduledAt?.slice(0, 10) || '',
      time: s.scheduledAt?.includes('T') ? s.scheduledAt.split('T')[1].slice(0, 5) : '18:00',
      venue: s.location || 'Main Oval',
      visibility: 'Published',
      status: s.status || 'scheduled',
      cancellationReason: s.cancellationReason || '',
      cancelledBy: s.cancelledBy,
      rawSession: s,
      responses: '—'
    }));

    const eventItems = events
      .filter(e => 
        e.teamId === selectedTeamId || 
        e.assignedGroupId === selectedTeamId ||
        (Array.isArray(e.assignedGroupIds) && e.assignedGroupIds.includes(selectedTeamId)) ||
        e.homeTeamId === selectedTeamId ||
        e.awayTeamId === selectedTeamId ||
        (e.title && e.title.toLowerCase().includes(activeTeam.name.toLowerCase()))
      )
      .map(e => ({
        id: e.id,
        title: e.title || 'Team Event',
        type: e.type === 'match' || e.category === 'match' ? 'Match' : 'Event',
        date: e.date || '',
        time: e.startTime || '',
        venue: e.location || 'Club Ground',
        visibility: e.status === 'draft' ? 'Draft' : 'Published',
        status: e.status || 'scheduled',
        cancellationReason: e.cancellationReason || '',
        rawEvent: e,
        responses: e.type === 'match' ? '12 available • 3 awaiting • 1 unavailable' : '—'
      }));

    return [...sessionItems, ...eventItems].sort((a, b) => {
      const dateA = a.date || '9999';
      const dateB = b.date || '9999';
      return dateA.localeCompare(dateB);
    });
  }, [teamSessions, events, selectedTeamId, activeTeam]);

  // Team updates & announcements (published)
  const teamUpdates = useMemo(() => {
    if (!selectedTeamId || !activeTeam) return [];
    return updates
      .filter(p => {
        const matchesTeam = 
          p.teamId === selectedTeamId || 
          p.groupId === selectedTeamId ||
          p.assignedGroupId === selectedTeamId ||
          (Array.isArray(p.teamIds) && p.teamIds.includes(selectedTeamId)) ||
          p.audience?.includes(activeTeam.name);
        const isPublished = p.status !== 'draft';
        return matchesTeam && isPublished;
      })
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  }, [updates, selectedTeamId, activeTeam]);

  // Current user's duties for this team
  const myDuties = useMemo(() => {
    if (!user) return [];
    return duties.filter(d => {
      const isAssigned = 
        d.assignedTo === user.uid || 
        d.assignedUserId === user.uid || 
        d.ownerId === user.uid ||
        (clubMemberRecord && (d.assignedTo === clubMemberRecord.id || d.assignedMemberId === clubMemberRecord.id));
      const forTeam = 
        !d.teamId || 
        d.teamId === selectedTeamId || 
        d.assignedTeamId === selectedTeamId;
      return isAssigned && forTeam;
    });
  }, [duties, user, clubMemberRecord, selectedTeamId]);

  // Urgent Notice / Cancellation banner
  const urgentAlert = useMemo(() => {
    const cancelled = teamSessions.find(s => s.status === 'cancelled');
    if (cancelled) {
      return {
        type: 'cancelled_session',
        title: 'Training Cancelled',
        message: `Training scheduled for ${formatPrettyDate(cancelled.scheduledAt)} has been cancelled. Reason: ${cancelled.cancellationReason || 'Adverse conditions / ground closure'}.`,
        session: cancelled
      };
    }
    const cancelledMatch = teamMatches.find(m => m.status === 'cancelled');
    if (cancelledMatch) {
      return {
        type: 'cancelled_match',
        title: 'Match Postponed / Cancelled',
        message: `${cancelledMatch.title} on ${cancelledMatch.date} has been cancelled. Reason: ${cancelledMatch.cancellationReason || 'Ground unavailable'}.`,
        match: cancelledMatch
      };
    }
    return null;
  }, [teamSessions, teamMatches]);

  // ── Handlers for Coaches & Managers (Logistics & Cancellation) ──────────────
  const handleCancelSessionSubmit = async () => {
    if (!cancelModalSession) return;
    if (!cancelReason.trim()) {
      alert('Please enter a cancellation reason to notify affected players and staff.');
      return;
    }
    setCancelling(true);
    try {
      await trainingService.cancelSession(selectedClubId, cancelModalSession.id, {
        reason: cancelReason.trim(),
        cancelledBy: user.uid,
        cancelledByName: profile?.displayName || 'Coach',
        cancelledByRole: 'Coach'
      });
      alert('Training session has been cancelled. Affected players, parents, and staff have been notified.');
      setCancelModalSession(null);
      setCancelReason('');
      await loadData();
    } catch (err) {
      alert('Error cancelling session: ' + err.message);
    } finally {
      setCancelling(false);
    }
  };

  const handleReinstateSubmit = async () => {
    if (!reinstateSession) return;
    setReinstating(true);
    try {
      await trainingService.reinstateSession(selectedClubId, reinstateSession.id, {
        reinstatedBy: user.uid,
        reinstatedByName: profile?.displayName || 'Coach',
        reinstatedByRole: 'Coach'
      });
      alert('Training session has been reinstated. Updated notifications have been sent.');
      setReinstateSession(null);
      await loadData();
    } catch (err) {
      alert('Error reinstating session: ' + err.message);
    } finally {
      setReinstating(false);
    }
  };

  const handleSaveLogisticsSubmit = async () => {
    if (!editLogisticsSession) return;
    setSavingLogistics(true);
    try {
      await trainingService.updateSessionLogistics(selectedClubId, editLogisticsSession.id, {
        scheduledAt: logisticsForm.scheduledAt,
        location: logisticsForm.location,
        logisticsNotes: logisticsForm.notes,
        updatedBy: user.uid,
        updatedByName: profile?.displayName || 'Coach',
        updatedByRole: 'Coach'
      });
      alert('Session logistics updated successfully!');
      setEditLogisticsSession(null);
      await loadData();
    } catch (err) {
      alert('Error updating session logistics: ' + err.message);
    } finally {
      setSavingLogistics(false);
    }
  };

  function formatPrettyDate(isoStr) {
    if (!isoStr) return 'To be confirmed';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const dayName = d.toLocaleDateString(undefined, { weekday: 'long' });
      const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
      return `${dayName} • ${timeStr}`;
    } catch {
      return isoStr;
    }
  }

  function formatMatchDate(dateStr, timeStr) {
    if (!dateStr) return 'Date to be confirmed';
    try {
      const [y, m, d] = dateStr.split('-');
      const dt = new Date(Number(y), Number(m) - 1, Number(d));
      const dayName = dt.toLocaleDateString(undefined, { weekday: 'long' });
      return `${dayName}${timeStr ? ` • ${timeStr}` : ''}`;
    } catch {
      return `${dateStr} ${timeStr || ''}`;
    }
  }

  return (
    <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '24px', fontFamily: 'Arial, sans-serif' }}>
      
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px 0', color: '#0F172A' }}>My Teams</h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>
            Your team updates, people and upcoming activities
          </p>
        </div>
      </div>

      {!selectedClubId ? (
        <div className="card text-center" style={{ padding: '60px 20px', border: '1px solid #E2E8F0', background: '#ffffff', borderRadius: '16px' }}>
          <Shield size={44} style={{ color: DESIGN_TOKENS.primaryTeal, marginBottom: '16px', opacity: 0.8 }} />
          <h3 style={{ margin: 0, color: '#0F172A' }}>No Club Selected</h3>
          <p style={{ color: '#64748B', fontSize: '14px', marginTop: '8px', maxWidth: '460px', marginInline: 'auto' }}>
            Please select a club from the top-right context switcher.
          </p>
        </div>
      ) : loading ? (
        <div className="card text-center" style={{ padding: '60px 20px', border: '1px solid #E2E8F0', background: '#ffffff', borderRadius: '16px' }}>
          <p style={{ textAlign: 'center', color: '#64748B', margin: 0 }}>Loading your team workspace...</p>
        </div>
      ) : myTeams.length === 0 ? (
        <div className="card text-center" style={{ padding: '60px 20px', border: '1px solid #E2E8F0', background: '#ffffff', borderRadius: '16px' }}>
          <UsersRound size={40} style={{ color: '#94A3B8', marginBottom: '16px' }} />
          <h3 style={{ margin: 0, color: '#0F172A' }}>No Teams Assigned</h3>
          <p style={{ color: '#64748B', fontSize: '13px', marginTop: '6px', maxWidth: '420px', marginInline: 'auto' }}>
            You haven't been assigned to any teams yet in {selectedClub?.name}. Please contact your club administrator or coach to add you to a team roster.
          </p>
        </div>
      ) : (
        <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Left Column: Team Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              SELECT TEAM
            </span>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {myTeams.map(t => {
                const isSelected = t.id === selectedTeamId;
                return (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedTeamId(t.id); }}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '14px',
                      border: isSelected ? `2px solid ${DESIGN_TOKENS.primaryTeal}` : '1px solid #E2E8F0',
                      background: isSelected ? '#F0FDF4' : '#FFFFFF',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 1px 3px rgba(13,148,136,0.15)' : 'none'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '14px', color: isSelected ? DESIGN_TOKENS.primaryTeal : '#0F172A', marginBottom: '3px' }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ opacity: 0.7 }}>⚑</span> {t.ageGroup || t.division || t.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Main Column: Team Header, Tabs, & Content */}
          {activeTeam && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Header Card with Navigation Tabs */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px 24px 0 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>
                      {activeTeam.name}
                    </h2>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748B', fontWeight: 500 }}>
                      {selectedClub?.name || 'Club'} • {activeTeam.ageGroup || activeTeam.division || 'Under 17'}
                    </p>
                  </div>
                  {isTeamStaffLeader && (
                    <span style={{ fontSize: '11px', fontWeight: 700, background: '#E0F2FE', color: '#0369A1', padding: '4px 10px', borderRadius: '999px' }}>
                      Coach / Manager Access
                    </span>
                  )}
                </div>

                {/* Team Tabs Navigation */}
                <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid #E2E8F0', marginTop: '12px' }}>
                  {[
                    { id: 'overview', label: 'Overview' },
                    { id: 'updates', label: 'Updates' },
                    { id: 'matches', label: 'Matches & Events' },
                    { id: 'duties', label: 'My Duties' },
                    { id: 'squad', label: 'Squad' },
                  ].map(tab => {
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
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ─── TAB 1: OVERVIEW ─────────────────────────────────────────── */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  
                  {/* Urgent Changes / Notification Banner First */}
                  {urgentAlert && (
                    <div style={{
                      background: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      borderRadius: '14px',
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '14px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <AlertTriangle size={20} color="#DC2626" style={{ flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '13px', color: '#991B1B' }}>
                            {urgentAlert.title}
                          </div>
                          <div style={{ fontSize: '12px', color: '#7F1D1D', marginTop: '2px' }}>
                            {urgentAlert.message}
                          </div>
                        </div>
                      </div>
                      {isTeamStaffLeader && urgentAlert.type === 'cancelled_session' && (
                        <button
                          onClick={() => setReinstateSession(urgentAlert.session)}
                          className="btn btn-outline"
                          style={{ borderColor: '#DC2626', color: '#DC2626', fontSize: '11px', padding: '4px 10px', height: 'auto', background: '#fff' }}
                        >
                          Reinstate
                        </button>
                      )}
                    </div>
                  )}

                  {/* Team Staff Card (5 Columns) */}
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                      Team Staff
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                      {STAFF_ROLES.map(role => {
                        const assigned = staffByRole[role] || [];
                        const isAssigned = assigned.length > 0;
                        const complianceStatus = isAssigned ? getStaffComplianceIndicator(assigned[0]) : null;

                        return (
                          <div
                            key={role}
                            style={{
                              border: '1px solid #E2E8F0',
                              borderRadius: '12px',
                              padding: '12px',
                              background: '#FAFAFA',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px'
                            }}
                          >
                            <div style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '50%',
                              backgroundColor: '#E2E8F0',
                              color: '#64748B',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <User size={18} />
                            </div>

                            <div style={{ overflow: 'hidden', flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ fontWeight: 700, fontSize: '12px', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {role}
                                </span>
                                {complianceStatus === 'green' && (
                                  <span title="Compliance status: Current" style={{ display: 'inline-flex', alignItems: 'center' }}>
                                    <CheckCircle2 size={12} color="#10B981" />
                                  </span>
                                )}
                                {complianceStatus === 'amber' && (
                                  <span title="Compliance status: Pending review or expiring soon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                                    <Clock size={12} color="#F59E0B" />
                                  </span>
                                )}
                                {complianceStatus === 'red' && (
                                  <span title="Compliance status: Action required" style={{ display: 'inline-flex', alignItems: 'center' }}>
                                    <AlertCircle size={12} color="#EF4444" />
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '11px', color: isAssigned ? '#475569' : '#94A3B8', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {isAssigned ? assigned.map(a => a.name).join(', ') : 'To be assigned'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2-Column Row: Next Training Session & Next Match */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
                    
                    {/* Next Training Session Card */}
                    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                          Next Training Session
                        </h3>
                        {nextSession?.status === 'cancelled' && (
                          <span style={{ fontSize: '10px', fontWeight: 800, background: '#FEE2E2', color: '#DC2626', padding: '2px 8px', borderRadius: '999px' }}>
                            CANCELLED
                          </span>
                        )}
                      </div>

                      {nextSession ? (
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                            {formatPrettyDate(nextSession.scheduledAt)}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px' }}>
                            <MapPin size={12} /> {nextSession.location || 'Main oval'}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => setSessionDetailModal(nextSession)}
                              style={{ background: 'none', border: 'none', padding: 0, color: DESIGN_TOKENS.primaryTeal, fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                            >
                              View details
                            </button>

                            {/* Authorised Coach / Manager Logistics Controls */}
                            {isTeamStaffLeader && (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={() => {
                                    setEditLogisticsSession(nextSession);
                                    setLogisticsForm({
                                      scheduledAt: nextSession.scheduledAt || '',
                                      location: nextSession.location || '',
                                      notes: nextSession.logisticsNotes || ''
                                    });
                                  }}
                                  style={{ background: 'none', border: 'none', padding: 0, color: '#0369A1', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                                >
                                  Edit logistics
                                </button>
                                {nextSession.status !== 'cancelled' ? (
                                  <button
                                    onClick={() => setCancelModalSession(nextSession)}
                                    style={{ background: 'none', border: 'none', padding: 0, color: '#DC2626', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                                  >
                                    Cancel session
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setReinstateSession(nextSession)}
                                    style={{ background: 'none', border: 'none', padding: 0, color: '#16A34A', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                                  >
                                    Reinstate
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>
                            No upcoming training sessions scheduled.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Next Match Card */}
                    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                        Next Match
                      </h3>

                      {nextMatch ? (
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                            {formatMatchDate(nextMatch.date, nextMatch.startTime)}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px' }}>
                            <MapPin size={12} /> {nextMatch.location || nextMatch.venue || 'Opponent and venue to be confirmed'}
                          </div>

                          <button
                            onClick={() => setActiveTab('matches')}
                            style={{ background: 'none', border: 'none', padding: 0, color: DESIGN_TOKENS.primaryTeal, fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                          >
                            View fixture
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                            Saturday • 10:00 am
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>
                            Opponent and venue to be confirmed
                          </div>
                          <button
                            onClick={() => setActiveTab('matches')}
                            style={{ background: 'none', border: 'none', padding: 0, color: DESIGN_TOKENS.primaryTeal, fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                          >
                            View fixture
                          </button>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Team Updates Card */}
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                        Team Updates
                      </h3>
                      {teamUpdates.length > 0 && (
                        <button
                          onClick={() => setActiveTab('updates')}
                          style={{ background: 'none', border: 'none', padding: 0, color: DESIGN_TOKENS.primaryTeal, fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                        >
                          View all updates
                        </button>
                      )}
                    </div>

                    {teamUpdates.length > 0 ? (
                      <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 16px', background: '#FAFAFA' }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {teamUpdates[0].pinned && <Pin size={12} color={DESIGN_TOKENS.primaryTeal} />}
                          {teamUpdates[0].title}
                        </div>
                        <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5, marginBottom: '10px' }}>
                          {teamUpdates[0].body || teamUpdates[0].content}
                        </div>
                        <button
                          onClick={() => setActiveTab('updates')}
                          style={{ background: 'none', border: 'none', padding: 0, color: DESIGN_TOKENS.primaryTeal, fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                        >
                          View all updates
                        </button>
                      </div>
                    ) : (
                      <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 16px', background: '#FAFAFA' }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A', marginBottom: '4px' }}>
                          Training reminder
                        </div>
                        <div style={{ fontSize: '12px', color: '#475569', marginBottom: '10px' }}>
                          Bring your boots, mouthguard and water bottle.
                        </div>
                        <button
                          onClick={() => setActiveTab('updates')}
                          style={{ background: 'none', border: 'none', padding: 0, color: DESIGN_TOKENS.primaryTeal, fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                        >
                          View all updates
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* ─── TAB 2: UPDATES ─────────────────────────────────────────── */}
              {activeTab === 'updates' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {teamUpdates.length === 0 ? (
                    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '40px 20px', textAlign: 'center' }}>
                      <FileText size={32} color="#94A3B8" style={{ marginBottom: '12px' }} />
                      <h4 style={{ margin: '0 0 6px 0', color: '#0F172A' }}>No Team Updates</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                        No announcements published for {activeTeam.name} yet.
                      </p>
                    </div>
                  ) : (
                    teamUpdates.map(u => (
                      <div
                        key={u.id}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          borderRadius: '16px',
                          padding: '18px 20px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {u.pinned && <Pin size={14} color={DESIGN_TOKENS.primaryTeal} />}
                            {u.title}
                          </h4>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>
                            {u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : 'Recent'}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 12px 0', fontSize: '13px', lineHeight: 1.6, color: '#334155', whiteSpace: 'pre-wrap' }}>
                          {u.body || u.content}
                        </p>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                          Audience: {u.audience || `${activeTeam.name} members and authorised guardians`}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ─── TAB 3: MATCHES & EVENTS ─────────────────────────────────── */}
              {activeTab === 'matches' && (
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                      Upcoming Activities & Fixtures
                    </h3>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>
                      One linked event record • Synced with Calendar
                    </span>
                  </div>

                  {teamActivities.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B' }}>
                      No matches or training scheduled for this team.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: '#64748B' }}>
                          <th style={{ padding: '12px 18px' }}>Activity</th>
                          <th style={{ padding: '12px 14px' }}>Type</th>
                          <th style={{ padding: '12px 14px' }}>Date & time</th>
                          <th style={{ padding: '12px 14px' }}>Venue</th>
                          <th style={{ padding: '12px 14px' }}>Status</th>
                          <th style={{ padding: '12px 18px', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamActivities.map(item => {
                          const isCancelled = item.status === 'cancelled';
                          return (
                            <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '12px 18px', fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                                {item.title}
                                {isCancelled && item.cancellationReason && (
                                  <div style={{ fontSize: '11px', color: '#DC2626', fontWeight: 500, marginTop: '2px' }}>
                                    Reason: {item.cancellationReason}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>
                                {item.type}
                              </td>
                              <td style={{ padding: '12px 14px', fontSize: '12px', color: '#334155' }}>
                                {item.date ? `${item.date} ${item.time ? '• ' + item.time : ''}` : 'Needs date'}
                              </td>
                              <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>
                                {item.venue}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {isCancelled ? (
                                  <span style={{ fontSize: '11px', fontWeight: 700, background: '#FEE2E2', color: '#DC2626', padding: '2px 8px', borderRadius: '999px' }}>
                                    Cancelled
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '11px', fontWeight: 700, background: '#DCFCE7', color: '#16A34A', padding: '2px 8px', borderRadius: '999px' }}>
                                    {item.visibility || 'Published'}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                                {item.type === 'Training' && item.rawSession ? (
                                  <div style={{ display: 'inline-flex', gap: '8px' }}>
                                    <button
                                      onClick={() => setSessionDetailModal(item.rawSession)}
                                      className="btn btn-outline"
                                      style={{ padding: '4px 10px', fontSize: '11px', height: 'auto' }}
                                    >
                                      Details
                                    </button>
                                    {isTeamStaffLeader && !isCancelled && (
                                      <button
                                        onClick={() => setCancelModalSession(item.rawSession)}
                                        className="btn btn-outline"
                                        style={{ padding: '4px 10px', fontSize: '11px', height: 'auto', color: '#DC2626', borderColor: '#FCA5A5' }}
                                      >
                                        Cancel
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '12px', color: '#94A3B8' }}>—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* ─── TAB 4: MY DUTIES ────────────────────────────────────────── */}
              {activeTab === 'duties' && (
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                    My Assigned Duties ({myDuties.length})
                  </h3>

                  {myDuties.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 20px', color: '#64748B' }}>
                      <ListChecks size={36} color="#94A3B8" style={{ marginBottom: '10px' }} />
                      <p style={{ margin: '0 0 4px 0', fontWeight: 600 }}>No duties currently rostered to you</p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
                        When you are rostered for canteen, field setup, or timekeeping duties, they will appear here.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {myDuties.map(d => (
                        <div
                          key={d.id}
                          style={{
                            border: '1px solid #E2E8F0',
                            borderRadius: '12px',
                            padding: '14px 16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: '#FAFAFA'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                              {d.title || d.name || 'Volunteer Duty'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                              <span>{d.date || d.scheduledDate || 'Upcoming'}</span>
                              <span>•</span>
                              <span>{d.time || d.timeSlot || 'Check roster'}</span>
                              <span>•</span>
                              <span>{d.location || 'Clubhouse'}</span>
                            </div>
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 700, background: '#DCFCE7', color: '#16A34A', padding: '2px 8px', borderRadius: '999px' }}>
                            {d.status || 'Assigned'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ─── TAB 5: SQUAD ────────────────────────────────────────────── */}
              {activeTab === 'squad' && (
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                      Squad Roster ({squadPlayers.length} Players)
                    </h3>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>
                      {activeTeam.name}
                    </span>
                  </div>

                  {squadPlayers.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B' }}>
                      No players currently listed on this squad roster.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: '#64748B' }}>
                          <th style={{ padding: '12px 18px' }}>Player</th>
                          <th style={{ padding: '12px 14px' }}>Position</th>
                          <th style={{ padding: '12px 14px' }}>Jersey #</th>
                          <th style={{ padding: '12px 18px', textAlign: 'right' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {squadPlayers.map(p => (
                          <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                backgroundColor: '#E2E8F0',
                                color: DESIGN_TOKENS.primaryTeal,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '12px'
                              }}>
                                {p.displayName?.charAt(0).toUpperCase() || 'P'}
                              </div>
                              <span style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                                {p.displayName || p.name}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>
                              {p.position || '—'}
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>
                              {p.jerseyNumber || p.number || '—'}
                            </td>
                            <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                              <span style={{ fontSize: '11px', fontWeight: 600, background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '999px' }}>
                                Active
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* ─── MODAL: SESSION DETAILS (STRICTLY LOGISTICS ONLY — NO PLANS/DRILLS) ─── */}
      <Modal
        open={!!sessionDetailModal}
        onClose={() => setSessionDetailModal(null)}
        title="Training Session Details"
      >
        {sessionDetailModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '2px' }}>Team</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                {sessionDetailModal.teamName || activeTeam?.name}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '2px' }}>Date & Time</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                  {formatPrettyDate(sessionDetailModal.scheduledAt)}
                </div>
              </div>

              <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '2px' }}>Venue / Field</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                  {sessionDetailModal.location || 'Main Oval'}
                </div>
              </div>
            </div>

            {sessionDetailModal.status === 'cancelled' && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', padding: '14px', borderRadius: '12px' }}>
                <div style={{ fontWeight: 800, fontSize: '13px', color: '#991B1B', marginBottom: '2px' }}>
                  Session Cancelled
                </div>
                <div style={{ fontSize: '12px', color: '#7F1D1D' }}>
                  Reason: {sessionDetailModal.cancellationReason || 'Ground unavailable'}
                </div>
                {sessionDetailModal.cancelledBy?.name && (
                  <div style={{ fontSize: '11px', color: '#991B1B', marginTop: '4px' }}>
                    Cancelled by: {sessionDetailModal.cancelledBy.name} ({sessionDetailModal.cancelledBy.role || 'Staff'})
                  </div>
                )}
              </div>
            )}

            {sessionDetailModal.logisticsNotes && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '14px', borderRadius: '12px' }}>
                <div style={{ fontWeight: 700, fontSize: '12px', color: '#166534', marginBottom: '2px' }}>
                  Logistics Notes
                </div>
                <div style={{ fontSize: '12px', color: '#15803D' }}>
                  {sessionDetailModal.logisticsNotes}
                </div>
              </div>
            )}

            <div style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic', textAlign: 'center' }}>
              Coaching drills and training plans are maintained in the Coach workspace.
            </div>

            <div className="form-actions" style={{ marginTop: '8px' }}>
              <button className="btn btn-primary" onClick={() => setSessionDetailModal(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── MODAL: CANCEL SESSION (WITH REASON) ──────────────────────────────── */}
      <Modal
        open={!!cancelModalSession}
        onClose={() => setCancelModalSession(null)}
        title="Cancel Training Session"
      >
        {cancelModalSession && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>
              Cancel training for <strong>{activeTeam.name}</strong> on {formatPrettyDate(cancelModalSession.scheduledAt)}?
            </p>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                Cancellation Reason (Required)
              </label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="e.g. Extreme weather / pitch waterlogged / coach unavailable..."
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
              />
              <span style={{ fontSize: '11px', color: '#64748B' }}>
                This reason will be recorded in the audit log and broadcast in-app to players and guardians.
              </span>
            </div>

            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => setCancelModalSession(null)} disabled={cancelling}>
                Go Back
              </button>
              <button 
                className="btn btn-danger" 
                onClick={handleCancelSessionSubmit} 
                disabled={cancelling || !cancelReason.trim()}
                style={{ background: '#DC2626', color: '#fff', border: 'none' }}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── MODAL: EDIT SESSION LOGISTICS ───────────────────────────────────── */}
      <Modal
        open={!!editLogisticsSession}
        onClose={() => setEditLogisticsSession(null)}
        title="Edit Training Logistics"
      >
        {editLogisticsSession && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 700 }}>Date & Time</label>
              <input
                type="datetime-local"
                className="form-control"
                value={logisticsForm.scheduledAt}
                onChange={e => setLogisticsForm({ ...logisticsForm, scheduledAt: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 700 }}>Venue / Location</label>
              <input
                className="form-control"
                placeholder="e.g. Main Oval / Field 2"
                value={logisticsForm.location}
                onChange={e => setLogisticsForm({ ...logisticsForm, location: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 700 }}>Logistics Note (Optional)</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="e.g. Bring running shoes for indoor work..."
                value={logisticsForm.notes}
                onChange={e => setLogisticsForm({ ...logisticsForm, notes: e.target.value })}
              />
            </div>

            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => setEditLogisticsSession(null)} disabled={savingLogistics}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveLogisticsSubmit} disabled={savingLogistics}>
                {savingLogistics ? 'Saving...' : 'Update Logistics'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── MODAL: REINSTATE SESSION ────────────────────────────────────────── */}
      <Modal
        open={!!reinstateSession}
        onClose={() => setReinstateSession(null)}
        title="Reinstate Training Session"
      >
        {reinstateSession && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>
              Are you sure you want to reinstate training for <strong>{activeTeam.name}</strong> on {formatPrettyDate(reinstateSession.scheduledAt)}?
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
              The session status will return to Scheduled and players, parents and staff will receive a fresh reinstatement update.
            </p>

            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => setReinstateSession(null)} disabled={reinstating}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleReinstateSubmit} disabled={reinstating}>
                {reinstating ? 'Reinstating...' : 'Confirm Reinstatement'}
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
