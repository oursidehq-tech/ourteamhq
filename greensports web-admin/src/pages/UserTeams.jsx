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
  ChevronRight, ChevronDown, ArrowRight, Bell, Edit3, X, RotateCcw, ListChecks,
  FileText, Pin, Search, Lock
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
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'matches' | 'duties' | 'updates' | 'squad'
  const [availabilityResponses, setAvailabilityResponses] = useState({});
  const [eventFilter, setEventFilter] = useState('All'); // 'All' | 'Matches' | 'Training' | 'Events'
  const [contactManagerModal, setContactManagerModal] = useState(false);
  const [viewDutyModal, setViewDutyModal] = useState(null);
  const [userDutiesSubTab, setUserDutiesSubTab] = useState('upcoming'); // 'upcoming' | 'completed'
  const [taskCompletedState, setTaskCompletedState] = useState(false);
  const [updatesSearch, setUpdatesSearch] = useState('');
  const [updatesFilter, setUpdatesFilter] = useState('all'); // 'all' | 'unread'
  const [readUpdateIds, setReadUpdateIds] = useState(new Set());
  const [showAllSquad, setShowAllSquad] = useState(false);
  
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

  // Teams list for current user
  const teamsToDisplay = useMemo(() => {
    if (myTeams.length > 0) return myTeams;
    return teams;
  }, [myTeams, teams]);

  // Auto-select the first team if none is selected
  useEffect(() => {
    if (teamsToDisplay.length > 0 && (!selectedTeamId || !teamsToDisplay.some(t => t.id === selectedTeamId))) {
      setSelectedTeamId(teamsToDisplay[0].id);
    }
  }, [teamsToDisplay, selectedTeamId]);

  // Currently selected team object
  const activeTeam = useMemo(() => {
    return teamsToDisplay.find(t => t.id === selectedTeamId) || teamsToDisplay[0];
  }, [teamsToDisplay, selectedTeamId]);

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

  // Squad Players (Excluding appointed staff members)
  const allSquad16 = useMemo(() => {
    return squadPlayers.map((p, idx) => ({
      id: p.id,
      name: p.displayName || p.name || 'Player',
      initials: (p.displayName || p.name || 'P').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      isYourChild: p.displayName === profile?.displayName || p.id === user?.uid || p.email === user?.email
    }));
  }, [squadPlayers, profile, user]);

  const displaySquadPlayers = showAllSquad ? allSquad16 : allSquad16.slice(0, 6);

  // Live team updates list
  const displayUpdatesList = useMemo(() => {
    let list = teamUpdates.map(u => ({
      id: u.id,
      title: u.title,
      body: u.body || u.content,
      authorInfo: `${u.authorName || 'Staff'} • ${u.authorRole || 'Team Staff'} • ${u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent'}`,
      pinned: !!u.pinned,
      isNew: !readUpdateIds.has(u.id),
      hasSessionLink: (u.title || '').toLowerCase().includes('training')
    }));

    if (updatesSearch.trim()) {
      const q = updatesSearch.toLowerCase();
      list = list.filter(u => u.title.toLowerCase().includes(q) || u.body.toLowerCase().includes(q));
    }

    if (updatesFilter === 'unread') {
      list = list.filter(u => !readUpdateIds.has(u.id));
    }

    return list;
  }, [teamUpdates, updatesSearch, updatesFilter, readUpdateIds]);

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

  // Display staff list with real compliance status
  const staffListDisplay = useMemo(() => {
    const roles = ['Coach', 'Assistant Coach', 'Trainer', 'First Aid Officer', 'Team Manager'];

    return roles.map(role => {
      const assigned = staffByRole[role] || [];
      if (assigned.length > 0) {
        const staffMember = assigned[0];
        const ind = getStaffComplianceIndicator(staffMember);
        let statusColor = '#10B981';
        let statusLabel = 'Compliant';
        if (ind === 'amber') {
          statusColor = '#F59E0B';
          statusLabel = 'Action needed';
        } else if (ind === 'red') {
          statusColor = '#EF4444';
          statusLabel = 'Not compliant';
        }
        return {
          role,
          name: staffMember.name || staffMember.displayName || 'Assigned Staff',
          statusColor,
          statusLabel,
          isAssigned: true
        };
      }
      return {
        role,
        name: 'Not assigned',
        statusColor: '#94A3B8',
        statusLabel: 'Not assigned',
        isAssigned: false
      };
    });
  }, [staffByRole, complianceRecords]);

  // Real scheduled team activities
  const activitiesToDisplay = useMemo(() => {
    return teamActivities || [];
  }, [teamActivities]);

  // Filtered by eventFilter: 'All' | 'Matches' | 'Training' | 'Events'
  const filteredActivities = useMemo(() => {
    if (eventFilter === 'All') return activitiesToDisplay;
    if (eventFilter === 'Matches') return activitiesToDisplay.filter(a => a.type === 'Match');
    if (eventFilter === 'Training') return activitiesToDisplay.filter(a => a.type === 'Training');
    if (eventFilter === 'Events') return activitiesToDisplay.filter(a => a.type === 'Event');
    return activitiesToDisplay;
  }, [activitiesToDisplay, eventFilter]);

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
      ) : (
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          
          {/* Left Column: SELECT TEAM (Image 6 Concept) */}
          <div style={{ width: '220px', flexShrink: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', letterSpacing: '0.05em', marginBottom: '12px', textTransform: 'uppercase' }}>
              SELECT TEAM
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {teamsToDisplay.map(t => {
                const isSelected = activeTeam?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTeamId(t.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid #0D9488' : '1px solid #E2E8F0',
                      background: '#FFFFFF',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 1px 4px rgba(13,148,136,0.12)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 800, color: isSelected ? '#0D9488' : '#0F172A', marginBottom: '2px' }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>
                      {t.ageGroup || t.division || t.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Team Details & Workspace */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Top Header Card matching Concept */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px 0 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              
              {/* Title & Badges matching Image 1 & Image 6 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                      My Teams
                    </h1>
                  </div>

                  {/* Team Selector & Viewing For indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <select
                      value={activeTeam?.id || ''}
                      onChange={e => setSelectedTeamId(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#0F172A',
                        background: '#FFFFFF',
                        cursor: 'pointer'
                      }}
                    >
                      {teamsToDisplay.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>

                    <span style={{ fontSize: '13px', color: '#475569', background: '#F8FAFC', padding: '5px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      Viewing for: <strong style={{ color: '#0F172A' }}>{profile?.displayName || user?.displayName || 'Member'}</strong>
                    </span>
                  </div>

                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                    {activeTeam?.season || '2027 season'} • {activeTeam?.ageGroup || activeTeam?.division || 'Under 17'} • {selectedClub?.name || 'Easts Tigers'}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isTeamStaffLeader && (
                    <span style={{ fontSize: '11px', fontWeight: 700, background: '#E0F2FE', color: '#0369A1', padding: '4px 10px', borderRadius: '999px' }}>
                      Coach / Manager
                    </span>
                  )}
                </div>
              </div>

              {/* Navigation Tabs (Image 1 order: Overview, Matches & Events, My Duties, Updates, Squad) */}
              <div style={{ display: 'flex', gap: '28px', borderBottom: '1px solid #E2E8F0', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'matches', label: 'Matches & Events' },
                  { id: 'duties', label: 'My Duties' },
                  { id: 'updates', label: 'Updates' },
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

            {/* ─── TAB 1: OVERVIEW (IMAGE 6 & 7 CONCEPT) ─────────────────────────── */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* 1. Team Staff Card (Horizontal strip across top) */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                    Team Staff
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>
                    Appointed team staff and leadership
                  </div>

                  {/* 5 Horizontal Appointment Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                    {staffListDisplay.map(st => (
                      <div
                        key={st.role}
                        style={{
                          border: '1px solid #E2E8F0',
                          borderRadius: '12px',
                          padding: '12px 14px',
                          background: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}
                      >
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: '#F1F5F9',
                          display: 'grid',
                          placeItems: 'center',
                          color: '#64748B',
                          flexShrink: 0
                        }}>
                          <User size={18} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {st.role}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '2px' }}>
                            {st.name || 'To be assigned'}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: st.statusColor, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {st.statusLabel === 'Compliant' || st.statusLabel === 'Current' ? (
                              <CheckCircle2 size={12} color="#10B981" />
                            ) : st.statusLabel === 'Action needed' ? (
                              <AlertTriangle size={12} color="#F59E0B" />
                            ) : (
                              <XCircle size={12} color="#EF4444" />
                            )}
                            {st.statusLabel}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Compliance Legend */}
                  <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', gap: '16px', flexWrap: 'wrap', borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10B981' }} /> Green: current
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#F59E0B' }} /> Amber: expiring soon or pending review
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#EF4444' }} /> Red: missing, expired or rejected
                    </span>
                  </div>
                </div>

                {/* 2. Row with Next Training Session & Next Match (Image 6) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                  
                  {/* Next Training Session */}
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                      Next Training Session
                    </h4>
                    {nextSession ? (
                      <>
                        <div style={{ fontSize: '14px', color: '#0F172A', fontWeight: 700, marginBottom: '2px' }}>
                          {formatPrettyDate(nextSession.scheduledAt)}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>
                          {nextSession.location || 'Main Oval'}
                        </div>
                        <button
                          onClick={() => setSessionDetailModal(nextSession)}
                          style={{ background: 'none', border: 'none', padding: 0, color: '#0D9488', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                        >
                          View details
                        </button>
                      </>
                    ) : (
                      <div style={{ fontSize: '13px', color: '#64748B', fontStyle: 'italic', padding: '8px 0' }}>
                        No upcoming training sessions scheduled.
                      </div>
                    )}
                  </div>

                  {/* Next Match */}
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                      Next Match
                    </h4>
                    {nextMatch ? (
                      <>
                        <div style={{ fontSize: '14px', color: '#0F172A', fontWeight: 700, marginBottom: '2px' }}>
                          {formatMatchDate(nextMatch.date, nextMatch.time)}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>
                          {nextMatch.opponent ? `vs ${nextMatch.opponent} • ${nextMatch.venue || 'Main Oval'}` : (nextMatch.location || 'Venue TBA')}
                        </div>
                        <button
                          onClick={() => setActiveTab('matches')}
                          style={{ background: 'none', border: 'none', padding: 0, color: '#0D9488', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                        >
                          View fixture
                        </button>
                      </>
                    ) : (
                      <div style={{ fontSize: '13px', color: '#64748B', fontStyle: 'italic', padding: '8px 0' }}>
                        No upcoming matches scheduled.
                      </div>
                    )}
                  </div>

                </div>

                {/* 3. Team Updates Card */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                    Team Updates
                  </h4>
                  {teamUpdates.length > 0 ? (
                    <>
                      <div style={{ fontSize: '14px', color: '#0F172A', fontWeight: 700, marginBottom: '4px' }}>
                        {teamUpdates[0]?.title}
                      </div>
                      <div style={{ fontSize: '13px', color: '#475569', marginBottom: '16px' }}>
                        {teamUpdates[0]?.content || teamUpdates[0]?.body}
                      </div>
                      <button
                        onClick={() => setActiveTab('updates')}
                        style={{ background: 'none', border: 'none', padding: 0, color: '#0D9488', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                      >
                        View all updates
                      </button>
                    </>
                  ) : (
                    <div style={{ fontSize: '13px', color: '#64748B', fontStyle: 'italic', padding: '6px 0' }}>
                      No updates posted for this team yet.
                    </div>
                  )}
                </div>

                {/* 4. Upcoming Activities & Duties Quick Actions */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                  
                  {/* Next up & Attendance */}
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px 22px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Match Attendance
                    </div>
                    {nextMatch ? (
                      <>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                          {nextMatch.opponent ? `${activeTeam?.name} vs ${nextMatch.opponent}` : (nextMatch.title || 'Next Match')}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '14px' }}>
                          {formatMatchDate(nextMatch.date, nextMatch.time)}
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            onClick={() => setAvailabilityResponses(prev => ({ ...prev, [nextMatch.id]: 'available' }))}
                            style={{
                              background: availabilityResponses[nextMatch.id] === 'available' ? '#0D9488' : '#F1F5F9',
                              color: availabilityResponses[nextMatch.id] === 'available' ? '#FFFFFF' : '#334155',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '7px 14px',
                              fontWeight: 700,
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            + Available
                          </button>
                          <button
                            onClick={() => setAvailabilityResponses(prev => ({ ...prev, [nextMatch.id]: 'unavailable' }))}
                            style={{
                              background: availabilityResponses[nextMatch.id] === 'unavailable' ? '#FEE2E2' : '#FFFFFF',
                              color: availabilityResponses[nextMatch.id] === 'unavailable' ? '#DC2626' : '#475569',
                              border: '1px solid #CBD5E1',
                              borderRadius: '8px',
                              padding: '7px 14px',
                              fontWeight: 600,
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            Can't attend
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '13px', color: '#64748B', fontStyle: 'italic', padding: '8px 0' }}>
                        No upcoming matches to RSVP for.
                      </div>
                    )}
                  </div>

                  {/* My duties Quick Card */}
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px 22px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
                      My Scheduled Duties
                    </div>
                    {myDuties.length > 0 ? (
                      <>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                          {myDuties[0].title || myDuties[0].name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '14px' }}>
                          {myDuties[0].date || 'Upcoming'} • {myDuties[0].time || ''} • {myDuties[0].location || 'Venue TBA'}
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            onClick={() => setViewDutyModal(myDuties[0])}
                            style={{
                              background: '#0D9488',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '7px 14px',
                              fontWeight: 700,
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            View duty
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '13px', color: '#64748B', fontStyle: 'italic', padding: '8px 0' }}>
                        No duties scheduled for you at this time.
                      </div>
                    )}
                  </div>

                </div>

              </div>
            )}

          {/* ─── TAB 2: MATCHES & EVENTS ─────────────────────────────────── */}
          {activeTab === 'matches' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Filter Pills */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px' }}>
                {['All', 'Matches', 'Training', 'Events'].map(flt => {
                  const isSelected = eventFilter === flt;
                  return (
                    <button
                      key={flt}
                      onClick={() => setEventFilter(flt)}
                      style={{
                        background: isSelected ? '#0F172A' : '#FFFFFF',
                        color: isSelected ? '#FFFFFF' : '#475569',
                        border: isSelected ? 'none' : '1px solid #E2E8F0',
                        borderRadius: '999px',
                        padding: '6px 18px',
                        fontSize: '13px',
                        fontWeight: isSelected ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {flt}
                    </button>
                  );
                })}
              </div>

              {/* Activities Cards */}
              {filteredActivities.length === 0 ? (
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '40px', textAlign: 'center', color: '#64748B' }}>
                  No activities found for this filter.
                </div>
              ) : (
                filteredActivities.map(item => (
                  <div
                    key={item.id}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '16px',
                      padding: '20px 24px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
                      {item.type || item.category || 'Match'}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                        {item.title}
                      </h3>
                      {item.status === 'cancelled' && (
                        <span style={{ fontSize: '11px', fontWeight: 800, background: '#FEE2E2', color: '#DC2626', padding: '3px 10px', borderRadius: '999px' }}>
                          CANCELLED
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>{item.dateTime || `${item.date || ''} • ${item.time || ''} • ${item.venue || 'Main Oval'}`}</span>
                      {item.badge && (
                        <span style={{ fontSize: '11px', fontWeight: 600, background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', padding: '2px 8px', borderRadius: '6px' }}>
                          {item.badge}
                        </span>
                      )}
                    </div>

                    {/* Action row with availability buttons and links */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {item.type === 'Match' && (
                          <>
                            <button
                              onClick={() => setAvailabilityResponses(prev => ({ ...prev, [item.id]: 'available' }))}
                              style={{
                                background: availabilityResponses[item.id] === 'available' ? '#0D9488' : '#FFFFFF',
                                color: availabilityResponses[item.id] === 'available' ? '#FFFFFF' : '#334155',
                                border: availabilityResponses[item.id] === 'available' ? 'none' : '1px solid #CBD5E1',
                                borderRadius: '8px',
                                padding: '6px 14px',
                                fontWeight: 700,
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              + Available
                            </button>
                            <button
                              onClick={() => setAvailabilityResponses(prev => ({ ...prev, [item.id]: 'unavailable' }))}
                              style={{
                                background: availabilityResponses[item.id] === 'unavailable' ? '#FEE2E2' : '#FFFFFF',
                                color: availabilityResponses[item.id] === 'unavailable' ? '#DC2626' : '#475569',
                                border: '1px solid #CBD5E1',
                                borderRadius: '8px',
                                padding: '6px 14px',
                                fontWeight: 600,
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              Can't attend
                            </button>
                            {item.responseNeeded && !availabilityResponses[item.id] && (
                              <span style={{ fontSize: '12px', color: '#64748B', fontStyle: 'italic', marginLeft: '6px' }}>
                                Response needed
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '12px' }}>
                        <button
                          onClick={() => {
                            if (item.rawSession) {
                              setSessionDetailModal(item.rawSession);
                            } else {
                              alert(`Activity details:\n${item.title}\nDate: ${item.dateTime || item.date}\nVenue: ${item.venue || 'Main Oval'}`);
                            }
                          }}
                          style={{ background: 'none', border: 'none', padding: 0, color: '#0369A1', fontWeight: 600, cursor: 'pointer' }}
                        >
                          View details
                        </button>
                        {item.type === 'Match' && (
                          <>
                            <span style={{ color: '#CBD5E1' }}>•</span>
                            <button
                              onClick={() => alert(`Directions to ${item.venue || 'Main Oval'}: Easts Sports Ground, 120 Main Street.`)}
                              style={{ background: 'none', border: 'none', padding: 0, color: '#0369A1', fontWeight: 600, cursor: 'pointer' }}
                            >
                              View directions
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

              {/* ─── TAB 3: MY DUTIES (IMAGE 5) ────────────────────────────────── */}
              {activeTab === 'duties' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Subtabs: Upcoming / Completed */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setUserDutiesSubTab('upcoming')}
                      style={{
                        padding: '6px 16px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        background: userDutiesSubTab === 'upcoming' ? '#FFFFFF' : '#F8FAFC',
                        color: userDutiesSubTab === 'upcoming' ? '#0F172A' : '#64748B',
                        fontWeight: userDutiesSubTab === 'upcoming' ? 700 : 500,
                        fontSize: '13px',
                        cursor: 'pointer',
                        boxShadow: userDutiesSubTab === 'upcoming' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                      }}
                    >
                      Upcoming
                    </button>
                    <button
                      onClick={() => setUserDutiesSubTab('completed')}
                      style={{
                        padding: '6px 16px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        background: userDutiesSubTab === 'completed' ? '#FFFFFF' : '#F8FAFC',
                        color: userDutiesSubTab === 'completed' ? '#0F172A' : '#64748B',
                        fontWeight: userDutiesSubTab === 'completed' ? 700 : 500,
                        fontSize: '13px',
                        cursor: 'pointer',
                        boxShadow: userDutiesSubTab === 'completed' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                      }}
                    >
                      Completed
                    </button>
                  </div>

                  {userDutiesSubTab === 'upcoming' ? (
                    <>
                      {/* Card 1: My duties */}
                      {myDuties.length > 0 ? (
                        myDuties.map(d => (
                          <div key={d.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                            <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                              My duty
                            </h3>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                              {d.title || d.name}
                            </div>
                            <div style={{ fontSize: '13px', color: '#475569', marginBottom: '4px' }}>
                              {d.date ? `${d.date} • ${d.time || ''} • ${d.location || ''}` : (d.time ? `${d.time} • ${d.location || ''}` : d.location || 'Venue scheduled')}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>
                              Role: {d.role || 'Volunteer'} • Assigned via {activeTeam?.name || 'Team'}
                            </div>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                              <button
                                onClick={() => setViewDutyModal(d)}
                                style={{
                                  background: '#0D9488',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '8px',
                                  padding: '8px 18px',
                                  fontWeight: 700,
                                  fontSize: '13px',
                                  cursor: 'pointer'
                                }}
                              >
                                View instructions
                              </button>
                              <button
                                onClick={() => alert("Organiser has been notified of your inability to attend.")}
                                style={{
                                  background: '#FFFFFF',
                                  color: '#334155',
                                  border: '1px solid #CBD5E1',
                                  borderRadius: '8px',
                                  padding: '8px 18px',
                                  fontWeight: 600,
                                  fontSize: '13px',
                                  cursor: 'pointer'
                                }}
                              >
                                Can't attend
                              </button>
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>
                              Organiser will be notified of your request
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px', textAlign: 'center', color: '#64748B' }}>
                          <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>No duties scheduled</div>
                          <div style={{ fontSize: '13px' }}>You have no rostered duties for this team at this time.</div>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Completed Subtab Content */
                    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {myDuties.filter(d => d.status === 'completed' || d.completed).length > 0 ? (
                        myDuties.filter(d => d.status === 'completed' || d.completed).map(d => (
                          <div
                            key={d.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '12px 0',
                              borderBottom: '1px solid #F1F5F9'
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                                {d.title || d.name}
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748B' }}>
                                Completed • {d.date || 'Recent'}
                              </div>
                            </div>
                            <CheckCircle2 size={18} color="#10B981" />
                          </div>
                        ))
                      ) : (
                        <div style={{ color: '#64748B', fontSize: '13px', textAlign: 'center', padding: '16px' }}>
                          No completed duties or tasks yet.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ─── TAB 4: UPDATES (IMAGE 6) ─────────────────────────────────── */}
              {activeTab === 'updates' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Search and Filter Row */}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: '1', minWidth: '220px', maxWidth: '320px' }}>
                      <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        placeholder="Search updates"
                        value={updatesSearch}
                        onChange={e => setUpdatesSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 34px',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          fontSize: '13px',
                          color: '#0F172A',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setUpdatesFilter('all')}
                        style={{
                          padding: '6px 16px',
                          borderRadius: '8px',
                          background: updatesFilter === 'all' ? '#0D9488' : '#FFFFFF',
                          color: updatesFilter === 'all' ? '#FFFFFF' : '#475569',
                          border: updatesFilter === 'all' ? 'none' : '1px solid #CBD5E1',
                          fontWeight: updatesFilter === 'all' ? 700 : 500,
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setUpdatesFilter('unread')}
                        style={{
                          padding: '6px 16px',
                          borderRadius: '8px',
                          background: updatesFilter === 'unread' ? '#0D9488' : '#FFFFFF',
                          color: updatesFilter === 'unread' ? '#FFFFFF' : '#475569',
                          border: updatesFilter === 'unread' ? 'none' : '1px solid #CBD5E1',
                          fontWeight: updatesFilter === 'unread' ? 700 : 500,
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        Unread
                      </button>
                    </div>
                  </div>

                  {/* Updates list */}
                  {displayUpdatesList.map(u => (
                    <div
                      key={u.id}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '16px',
                        padding: '22px 24px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      {u.pinned && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                          <span>◆</span> Pinned
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                          {u.title}
                        </h3>
                        {u.isNew && (
                          <span style={{ fontSize: '11px', fontWeight: 700, background: '#0D9488', color: '#FFFFFF', padding: '2px 8px', borderRadius: '6px' }}>
                            New
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '12px', color: '#64748B' }}>
                        {u.authorInfo}
                      </div>

                      <p style={{ margin: '6px 0 12px 0', fontSize: '13px', lineHeight: 1.5, color: '#334155' }}>
                        {u.body}
                      </p>

                      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', fontSize: '12px' }}>
                        {u.hasSessionLink && (
                          <button
                            onClick={() => {
                              if (nextSession) setSessionDetailModal(nextSession);
                              else alert('Training session details:\nTuesday 5:30 pm at Main Oval.');
                            }}
                            style={{ background: 'none', border: 'none', padding: 0, color: '#0369A1', fontWeight: 600, cursor: 'pointer' }}
                          >
                            View session
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setReadUpdateIds(prev => {
                              const next = new Set(prev);
                              if (next.has(u.id)) next.delete(u.id);
                              else next.add(u.id);
                              return next;
                            });
                          }}
                          style={{ background: 'none', border: 'none', padding: 0, color: '#0369A1', fontWeight: 600, cursor: 'pointer' }}
                        >
                          {readUpdateIds.has(u.id) ? 'Mark as unread' : 'Mark as read'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ─── TAB 5: SQUAD (IMAGE 7) ─────────────────────────────────── */}
              {activeTab === 'squad' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', alignItems: 'start' }}>
                  
                  {/* Left Column: Squad list */}
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <h3 style={{ margin: '0 0 18px 0', fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                      Squad • {allSquad16.length} {allSquad16.length === 1 ? 'player' : 'players'}
                    </h3>

                    {displaySquadPlayers.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
                        {displaySquadPlayers.map((p, idx) => (
                          <div
                            key={p.id || idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              paddingBottom: '12px',
                              borderBottom: idx < displaySquadPlayers.length - 1 ? '1px solid #F1F5F9' : 'none'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                backgroundColor: '#E2E8F0',
                                color: '#334155',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '12px'
                              }}>
                                {p.initials || 'P'}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                                  {p.name}
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748B' }}>
                                  Player
                                </div>
                              </div>
                            </div>

                            {p.isYourChild && (
                              <span style={{ fontSize: '11px', fontWeight: 700, background: '#0D9488', color: '#FFFFFF', padding: '4px 10px', borderRadius: '6px' }}>
                                Your child
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: '#64748B', fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>
                        No players assigned to squad yet.
                      </div>
                    )}

                    {allSquad16.length > 6 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
                        <button
                          onClick={() => setShowAllSquad(!showAllSquad)}
                          style={{ background: 'none', border: 'none', padding: 0, color: '#0F172A', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
                        >
                          {showAllSquad ? `Showing all ${allSquad16.length} • Show less` : `Showing 6 of ${allSquad16.length} • Show all`}
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748B', marginTop: '12px' }}>
                      <Lock size={12} color="#64748B" />
                      <span>Contact details are kept private.</span>
                    </div>
                  </div>

                  {/* Right Column: Team staff contact card */}
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                      Team staff contact
                    </h3>
                    <div style={{ fontSize: '13px', color: '#0F172A', marginBottom: '18px' }}>
                      Team Manager • <strong>{staffListDisplay.find(s => s.role === 'Team Manager')?.name || 'Not assigned'}</strong>
                    </div>
                    <button
                      onClick={() => setContactManagerModal(true)}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#0F172A',
                        cursor: 'pointer'
                      }}
                    >
                      Contact team manager
                    </button>
                  </div>

                </div>
              )}

          </div>
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

      {/* ─── MODAL: CONTACT TEAM MANAGER ────────────────────────────────────── */}
      <Modal
        open={contactManagerModal}
        onClose={() => setContactManagerModal(false)}
        title="Contact Team Manager"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>
            Send a direct message or inquiry to the Team Manager for <strong>{activeTeam?.name || 'this team'}</strong>:
          </p>
          <div className="form-group">
            <label style={{ fontSize: '12px', fontWeight: 700 }}>Manager</label>
            <input className="form-control" readOnly value={staffListDisplay.find(s => s.role === 'Team Manager')?.name || 'Not assigned'} />
          </div>
          <div className="form-group">
            <label style={{ fontSize: '12px', fontWeight: 700 }}>Subject</label>
            <input className="form-control" placeholder="e.g. Question regarding upcoming match schedule" defaultValue="Schedule inquiry" />
          </div>
          <div className="form-group">
            <label style={{ fontSize: '12px', fontWeight: 700 }}>Message</label>
            <textarea className="form-control" rows={3} placeholder="Write your message here..." />
          </div>
          <div className="form-actions">
            <button className="btn btn-outline" onClick={() => setContactManagerModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => { alert('Message sent to Team Manager.'); setContactManagerModal(false); }}>
              Send Message
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── MODAL: VIEW DUTY DETAILS ────────────────────────────────────────── */}
      <Modal
        open={!!viewDutyModal}
        onClose={() => setViewDutyModal(null)}
        title="Volunteer Duty Details"
      >
        {viewDutyModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#0F172A' }}>{viewDutyModal.title}</h4>
              <div style={{ fontSize: '13px', color: '#475569', marginBottom: '4px' }}>
                <strong>Time:</strong> {viewDutyModal.time || '10:30–11:00 am'}
              </div>
              <div style={{ fontSize: '13px', color: '#475569', marginBottom: '8px' }}>
                <strong>Location:</strong> {viewDutyModal.location || 'Clubhouse'}
              </div>
              <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.5 }}>
                {viewDutyModal.instructions || 'Assist with counter service, drinks and snacks in the main clubhouse canteen.'}
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={() => setViewDutyModal(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
