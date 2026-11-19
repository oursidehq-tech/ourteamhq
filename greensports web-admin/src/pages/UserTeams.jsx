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
  const [availabilityResponses, setAvailabilityResponses] = useState({
    'sample-match-1': 'available',
    'sample-match-2': null
  });
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

  // Fallback to approved example team if user has no assigned teams yet
  const teamsToDisplay = useMemo(() => {
    if (myTeams.length > 0) return myTeams;
    if (teams.length > 0) return teams;
    return [
      { id: 'u17-nev-blair', name: 'U17 Nev Blair', ageGroup: 'Under 17', division: 'Under 17', season: '2027 season' }
    ];
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

  // Squad 16 players matching approved concept mockup (Image 7)
  const allSquad16 = useMemo(() => {
    if (squadPlayers.length > 0) {
      return squadPlayers.map((p, idx) => ({
        id: p.id,
        name: p.displayName || p.name,
        initials: (p.displayName || p.name || 'P').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
        isYourChild: idx === 0 || p.displayName === profile?.displayName || p.id === user?.uid
      }));
    }
    // High-fidelity fallback concept data
    return [
      { id: 'p1', name: profile?.displayName || 'Example Player', initials: 'EP', isYourChild: true },
      { id: 'p2', name: 'Example Player 02', initials: 'EP', isYourChild: false },
      { id: 'p3', name: 'Example Player 03', initials: 'EP', isYourChild: false },
      { id: 'p4', name: 'Example Player 04', initials: 'EP', isYourChild: false },
      { id: 'p5', name: 'Example Player 05', initials: 'EP', isYourChild: false },
      { id: 'p6', name: 'Example Player 06', initials: 'EP', isYourChild: false },
      { id: 'p7', name: 'Example Player 07', initials: 'EP', isYourChild: false },
      { id: 'p8', name: 'Example Player 08', initials: 'EP', isYourChild: false },
      { id: 'p9', name: 'Example Player 09', initials: 'EP', isYourChild: false },
      { id: 'p10', name: 'Example Player 10', initials: 'EP', isYourChild: false },
      { id: 'p11', name: 'Example Player 11', initials: 'EP', isYourChild: false },
      { id: 'p12', name: 'Example Player 12', initials: 'EP', isYourChild: false },
      { id: 'p13', name: 'Example Player 13', initials: 'EP', isYourChild: false },
      { id: 'p14', name: 'Example Player 14', initials: 'EP', isYourChild: false },
      { id: 'p15', name: 'Example Player 15', initials: 'EP', isYourChild: false },
      { id: 'p16', name: 'Example Player 16', initials: 'EP', isYourChild: false },
    ];
  }, [squadPlayers, profile, user]);

  const displaySquadPlayers = showAllSquad ? allSquad16 : allSquad16.slice(0, 6);

  // Updates list matching approved concept mockup (Image 6)
  const displayUpdatesList = useMemo(() => {
    let list = [];
    if (teamUpdates.length > 0) {
      list = teamUpdates.map(u => ({
        id: u.id,
        title: u.title,
        body: u.body || u.content,
        authorInfo: `${u.authorName || 'Example Coach'} • ${u.authorRole || 'Coach'} • ${u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '5 Feb 2027'}`,
        pinned: !!u.pinned,
        isNew: true,
        hasSessionLink: (u.title || '').toLowerCase().includes('training')
      }));
    } else {
      list = [
        {
          id: 'sample-update-1',
          title: 'Training time changed',
          body: 'Training on Tuesday 9 Feb is now 5:30 pm at Main Oval.',
          authorInfo: 'Example Coach • Coach • 5 Feb 2027',
          pinned: true,
          isNew: true,
          hasSessionLink: true
        },
        {
          id: 'sample-update-2',
          title: 'Matchday reminder',
          body: 'Bring boots, mouthguard and water. Arrive 8:15 am on Sat 6 Feb.',
          authorInfo: 'Example Manager • Team Manager • 4 Feb 2027',
          pinned: false,
          isNew: false,
          hasSessionLink: false
        }
      ];
    }

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

  // Display staff list with compliance status matching approved concepts
  const staffListDisplay = useMemo(() => {
    const list = [
      { role: 'Coach', fallbackName: 'Example Coach', fallbackColor: '#10B981', fallbackLabel: 'Current' },
      { role: 'Assistant Coach', fallbackName: 'Example Assistant', fallbackColor: '#10B981', fallbackLabel: 'Current' },
      { role: 'Trainer', fallbackName: 'Example Trainer', fallbackColor: '#F59E0B', fallbackLabel: 'Action needed' },
      { role: 'First Aid Officer', fallbackName: 'Example First Aider', fallbackColor: '#10B981', fallbackLabel: 'Current' },
      { role: 'Team Manager', fallbackName: 'Example Manager', fallbackColor: '#EF4444', fallbackLabel: 'Not compliant' }
    ];

    return list.map(item => {
      const assigned = staffByRole[item.role] || [];
      if (assigned.length > 0) {
        const staffMember = assigned[0];
        const ind = getStaffComplianceIndicator(staffMember);
        let statusColor = '#10B981';
        let statusLabel = 'Current';
        if (ind === 'amber') {
          statusColor = '#F59E0B';
          statusLabel = 'Action needed';
        } else if (ind === 'red') {
          statusColor = '#EF4444';
          statusLabel = 'Not compliant';
        }
        return {
          role: item.role,
          name: staffMember.name,
          statusColor,
          statusLabel
        };
      }
      return {
        role: item.role,
        name: item.fallbackName,
        statusColor: item.fallbackColor,
        statusLabel: item.fallbackLabel
      };
    });
  }, [staffByRole, complianceRecords]);

  // Fallback activities for preview concept
  const activitiesToDisplay = useMemo(() => {
    if (teamActivities.length > 0) return teamActivities;
    return [
      {
        id: 'sample-match-1',
        title: `${activeTeam?.name || 'U17 Nev Blair'} vs Norths Juniors`,
        type: 'Match',
        dateTime: 'Sat 6 Feb 2027 • Arrive 8:15 am • Kick-off 9:00 am • Main Oval',
        date: '2027-02-06',
        time: '9:00 am',
        venue: 'Main Oval',
        status: 'scheduled',
        responseNeeded: false
      },
      {
        id: 'sample-training-1',
        title: 'Team training',
        type: 'Training',
        dateTime: 'Tue 9 Feb 2027 • 5:30 pm • Main Oval',
        date: '2027-02-09',
        time: '5:30 pm',
        venue: 'Main Oval',
        badge: 'Time changed',
        status: 'scheduled'
      },
      {
        id: 'sample-match-2',
        title: `${activeTeam?.name || 'U17 Nev Blair'} vs Redcliffe Dolphins`,
        type: 'Match',
        dateTime: 'Sat 13 Feb 2027 • Kick-off 9:00 am • WJ Scott Park',
        date: '2027-02-13',
        time: '9:00 am',
        venue: 'WJ Scott Park',
        status: 'scheduled',
        responseNeeded: true
      }
    ];
  }, [teamActivities, activeTeam]);

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Top Header Card matching Concept */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px 0 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            
            {/* Title & Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: '#0F172A' }}>My Teams</h1>
              <span style={{ fontSize: '11px', fontWeight: 800, background: '#1E3A8A', color: '#FFFFFF', padding: '3px 10px', borderRadius: '999px', letterSpacing: '0.05em' }}>
                USER SPACE
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600, background: '#0D9488', color: '#FFFFFF', padding: '3px 10px', borderRadius: '999px' }}>
                Concept • Example data
              </span>
            </div>

            {/* Team Dropdown & Viewing For Pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <select
                  value={activeTeam?.id || ''}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  style={{
                    padding: '8px 34px 8px 14px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '14px',
                    color: '#0F172A',
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none'
                  }}
                >
                  {teamsToDisplay.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} color="#64748B" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>

              <div style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                fontSize: '13px',
                color: '#334155',
                fontWeight: 500
              }}>
                Viewing for: <strong style={{ color: '#0F172A' }}>{profile?.displayName || 'Example Player'}</strong>
              </div>

              {isTeamStaffLeader && (
                <span style={{ fontSize: '11px', fontWeight: 700, background: '#E0F2FE', color: '#0369A1', padding: '4px 10px', borderRadius: '999px' }}>
                  Coach / Manager Access
                </span>
              )}
            </div>

            {/* Subtitle */}
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748B' }}>
              {activeTeam?.season || '2027 season'} • {activeTeam?.ageGroup || activeTeam?.division || 'Under 17'} • {selectedClub?.name || 'Easts Tigers'}
            </p>

            {/* Navigation Tabs */}
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

          {/* Urgent Changes / Notification Banner */}
          <div style={{
            background: '#FEF9C3',
            border: '1px solid #FDE68A',
            borderRadius: '12px',
            padding: '12px 18px',
            fontSize: '13px',
            color: '#854D0E',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div>
              Training time changed: Tuesday now 5:30 pm (was 5:00 pm) •{' '}
              <button
                onClick={() => setActiveTab('updates')}
                style={{ background: 'none', border: 'none', padding: 0, color: '#0284C7', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
              >
                View update
              </button>
            </div>
            {isTeamStaffLeader && urgentAlert?.type === 'cancelled_session' && (
              <button
                onClick={() => setReinstateSession(urgentAlert.session)}
                className="btn btn-outline"
                style={{ borderColor: '#DC2626', color: '#DC2626', fontSize: '11px', padding: '3px 8px', height: 'auto', background: '#fff' }}
              >
                Reinstate
              </button>
            )}
          </div>

          {/* ─── TAB 1: OVERVIEW ─────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', alignItems: 'start' }}>
              
              {/* Left Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Next up Card */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                    Next up
                  </h3>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
                    Next match • {nextMatch?.opponent ? `${activeTeam?.name} vs ${nextMatch.opponent}` : `${activeTeam?.name || 'U17 Nev Blair'} vs Norths Juniors`}
                  </div>
                  <div style={{ fontSize: '13px', color: '#475569', marginBottom: '4px' }}>
                    {nextMatch?.dateStr || 'Sat 6 Feb 2027'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#475569', marginBottom: '4px' }}>
                    Arrive 8:15 am • Kick-off 9:00 am
                  </div>
                  <div style={{ fontSize: '13px', color: '#475569', marginBottom: '18px' }}>
                    {nextMatch?.venue || 'Main Oval'} •{' '}
                    <span 
                      onClick={() => alert(`Directions: Main Oval, Easts Sports Ground`)}
                      style={{ color: '#0D9488', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}
                    >
                      View directions
                    </span>
                  </div>

                  {/* Availability action buttons */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      onClick={() => setAvailabilityResponses(prev => ({ ...prev, 'sample-match-1': 'available' }))}
                      style={{
                        background: availabilityResponses['sample-match-1'] === 'available' ? '#0D9488' : '#F1F5F9',
                        color: availabilityResponses['sample-match-1'] === 'available' ? '#FFFFFF' : '#334155',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 16px',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      + Available
                    </button>
                    <button
                      onClick={() => setAvailabilityResponses(prev => ({ ...prev, 'sample-match-1': 'unavailable' }))}
                      style={{
                        background: availabilityResponses['sample-match-1'] === 'unavailable' ? '#FEE2E2' : '#FFFFFF',
                        color: availabilityResponses['sample-match-1'] === 'unavailable' ? '#DC2626' : '#475569',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        padding: '8px 16px',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Can't attend
                    </button>
                  </div>
                </div>

                {/* Team updates Card */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ margin: '0 0 14px 0', fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                    Team updates
                  </h3>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                    {teamUpdates[0]?.title || 'Bring boots, mouthguard and water'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    {teamUpdates[0]?.authorName ? `${teamUpdates[0].authorName} • Recent` : 'Example • 2 days ago'}
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* My duties Card */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                    My duties
                  </h3>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                    {myDuties[0]?.title || 'Canteen helper'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#475569', marginBottom: '16px' }}>
                    {myDuties[0]?.date ? `${myDuties[0].date} • ${myDuties[0].time || ''} • ${myDuties[0].location || 'Clubhouse'}` : 'Sat 6 Feb • 10:30–11:00 am • Clubhouse'}
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      onClick={() => setViewDutyModal(myDuties[0] || { title: 'Canteen helper', time: '10:30–11:00 am', location: 'Clubhouse', instructions: 'Assist with counter service, drinks and snacks in the main clubhouse canteen.' })}
                      style={{
                        background: '#0D9488',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 16px',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      View duty
                    </button>
                    <button
                      onClick={() => alert("Marked duty as unavailable. Team manager has been informed.")}
                      style={{
                        background: '#FFFFFF',
                        color: '#475569',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        padding: '8px 16px',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      Can't attend
                    </button>
                  </div>
                </div>

                {/* Next training Card */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                    Next training
                  </h3>
                  <div style={{ fontSize: '13px', color: '#334155', fontWeight: 500 }}>
                    {nextSession ? `${formatPrettyDate(nextSession.scheduledAt)} • ${nextSession.location || 'Main Oval'}` : 'Tue 9 Feb • 5:30 pm • Main Oval'}
                  </div>
                </div>

                {/* Team staff Card */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                    Team staff
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                    {staffListDisplay.map(st => (
                      <div key={st.role} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <div style={{ color: '#0F172A' }}>
                          <strong>{st.role}</strong> • <span style={{ color: st.name ? '#334155' : '#94A3B8' }}>{st.name || 'Not assigned'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, color: st.statusColor }}>
                          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: st.statusColor }} />
                          {st.statusLabel}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '14px', borderTop: '1px solid #F1F5F9', flexWrap: 'wrap', gap: '10px' }}>
                    <button
                      onClick={() => setContactManagerModal(true)}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#334155',
                        cursor: 'pointer'
                      }}
                    >
                      Contact manager
                    </button>

                    {/* Legend */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '11px', color: '#64748B' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} /> Current
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#F59E0B' }} /> Action needed
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#EF4444' }} /> Not compliant
                      </span>
                    </div>
                  </div>
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
                      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                          My duties
                        </h3>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                          {myDuties[0]?.title || 'Canteen helper'}
                        </div>
                        <div style={{ fontSize: '13px', color: '#475569', marginBottom: '4px' }}>
                          {myDuties[0]?.date ? `${myDuties[0].date} • ${myDuties[0].time || ''} • ${myDuties[0].location || 'Clubhouse'}` : 'Sat 6 Feb 2027 • 10:30–11:00 am • Clubhouse'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>
                          Role: Volunteer • Assigned via {activeTeam?.name || 'U17 Nev Blair'}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                          <button
                            onClick={() => setViewDutyModal(myDuties[0] || { title: 'Canteen helper', time: '10:30–11:00 am', location: 'Clubhouse', instructions: 'Assist with counter service, drinks and snacks in the main clubhouse canteen.' })}
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

                      {/* Card 2: My event tasks */}
                      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                          My event tasks
                        </h3>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                          Bring equipment bag
                        </div>
                        <div style={{ fontSize: '13px', color: '#475569', marginBottom: '4px' }}>
                          For: {activeTeam?.name || 'U17 Nev Blair'} vs Norths Juniors • Sat 6 Feb 2027
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px' }}>
                          Assigned via {activeTeam?.name || 'U17 Nev Blair'} (team)
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: taskCompletedState ? '#10B981' : '#94A3B8' }} />
                          {taskCompletedState ? 'Completed' : 'Not started'}
                        </div>

                        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                          <button
                            onClick={() => {
                              setTaskCompletedState(!taskCompletedState);
                              alert(taskCompletedState ? 'Marked task as not started.' : 'Task marked as complete! Thank you.');
                            }}
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
                            {taskCompletedState ? 'Completed ✓' : 'Mark complete'}
                          </button>
                          <button
                            onClick={() => setActiveTab('matches')}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: '#0369A1',
                              fontWeight: 600,
                              fontSize: '13px',
                              cursor: 'pointer'
                            }}
                          >
                            View event
                          </button>
                        </div>
                      </div>

                      {/* Completed row summary at bottom */}
                      <div style={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '12px',
                        padding: '12px 18px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px',
                        color: '#334155'
                      }}>
                        <div>
                          Confirm equipment collection • Completed 5 Feb by Example Parent
                        </div>
                        <CheckCircle2 size={18} color="#10B981" />
                      </div>
                    </>
                  ) : (
                    /* Completed Subtab Content */
                    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 0',
                        borderBottom: '1px solid #F1F5F9'
                      }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                            Confirm equipment collection
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748B' }}>
                            Completed 5 Feb 2027 by Example Parent
                          </div>
                        </div>
                        <CheckCircle2 size={18} color="#10B981" />
                      </div>
                      {taskCompletedState && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 0',
                          borderBottom: '1px solid #F1F5F9'
                        }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                              Bring equipment bag
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748B' }}>
                              Completed by {profile?.displayName || 'Example Player'}
                            </div>
                          </div>
                          <CheckCircle2 size={18} color="#10B981" />
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
                      Squad • 16 players
                    </h3>

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
                              {p.initials || 'EP'}
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

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
                      <button
                        onClick={() => setShowAllSquad(!showAllSquad)}
                        style={{ background: 'none', border: 'none', padding: 0, color: '#0F172A', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
                      >
                        {showAllSquad ? 'Showing all 16 • Show less' : 'Showing 6 of 16 • Show all'}
                      </button>
                    </div>

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
                      Team Manager • <strong>{staffListDisplay.find(s => s.role === 'Team Manager')?.name || 'Example Manager'}</strong>
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
            <input className="form-control" readOnly value={staffListDisplay.find(s => s.role === 'Team Manager')?.name || 'Example Manager'} />
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
