import {
  collection, addDoc, getDocs, getDoc, query, where, orderBy,
  doc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, writeBatch, setDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Design Tokens (Section 10) ───────────────────────────────────────────────
export const DESIGN_TOKENS = {
  primaryTeal: '#0D9488',
  successGreen: '#10B981',
  warningOrange: '#F59E0B',
  sessionBlue: '#3B82F6',
};

// ─── Domain Constants ─────────────────────────────────────────────────────────
export const CONTENT_CATEGORIES = [
  'Warm-Up', 'Tactics', 'Technique', 'Physical',
  'Psychological', 'Goal Keeping', 'Set Pieces', 'General'
];

export const PLAN_SECTIONS = [
  { id: 'warmup',   label: 'Warm-up',         color: '#F59E0B', defaultMins: 10 },
  { id: 'skill',    label: 'Skill Focus',     color: '#3B82F6', defaultMins: 20 },
  { id: 'game',     label: 'Game / Activity', color: '#10B981', defaultMins: 20 },
  { id: 'cooldown', label: 'Cool-down',       color: '#8B5CF6', defaultMins: 5 }
];

export const PLAN_STATUSES = ['draft', 'active'];

// ─── Plan Access Control Helpers (Coach-Only & Private by Default) ───────────
/**
 * Evaluates whether a user can access a training plan.
 * Strict rules per brief:
 * 1. User must hold a current Coach role (or Admin/Owner). Multi-role Coach + Parent is eligible as Coach.
 * 2. Plans default Private to creator/admin.
 * 3. Shared only with explicitly selected coach USERS or existing GROUPS (intersected with eligible coaches).
 * 4. teamId is a session logistics reference ONLY and NEVER grants plan access.
 */
export const isUserEligibleCoach = (user, memberRecord, profile, clubId) => {
  if (!user) return false;
  const roles = new Set();
  (memberRecord?.roles || []).forEach(r => roles.add(String(r).trim().toLowerCase()));
  if (memberRecord?.role) roles.add(String(memberRecord.role).trim().toLowerCase());
  
  const membership = profile?.clubMemberships?.find(m => m.clubId === clubId);
  if (membership) {
    (membership.roles || []).forEach(r => roles.add(String(r).trim().toLowerCase()));
    if (membership.role) roles.add(String(membership.role).trim().toLowerCase());
  }
  if (profile?.role) roles.add(String(profile.role).trim().toLowerCase());

  return roles.has('coach') || roles.has('owner') || roles.has('admin');
};

export const canUserAccessPlan = (user, plan, { isCoach = false, isAdmin = false, userGroupIds = [] } = {}) => {
  if (!user || !plan) return false;
  if (isAdmin) return true;
  if (!isCoach) return false; // Non-coaches are strictly denied

  // Creator has full access
  if (plan.createdBy === user.uid) return true;

  // Explicit user share
  if (Array.isArray(plan.sharedWithUserIds) && plan.sharedWithUserIds.includes(user.uid)) {
    return true;
  }

  // Explicit group share (user must be a member of the group AND isCoach is true)
  if (Array.isArray(plan.sharedWithGroupIds) && Array.isArray(userGroupIds)) {
    const hasGroupMatch = plan.sharedWithGroupIds.some(gId => userGroupIds.includes(gId));
    if (hasGroupMatch) return true;
  }

  return false;
};

export const getPlanAccessLabel = (plan) => {
  if (!plan) return 'Private';
  const userCount = Array.isArray(plan.sharedWithUserIds) ? plan.sharedWithUserIds.length : 0;
  const groupCount = Array.isArray(plan.sharedWithGroupIds) ? plan.sharedWithGroupIds.length : 0;
  const total = userCount + groupCount;
  return total > 0 ? `Shared (${total})` : 'Private';
};

// ─── Collection helpers ──────────────────────────────────────────────────────
const drillsCol      = (clubId) => collection(db, 'clubs', clubId, 'drills');
const plansCol       = (clubId) => collection(db, 'clubs', clubId, 'trainingPlans');
const sessionsCol    = (clubId) => collection(db, 'clubs', clubId, 'trainingSessions');
const eventsCol      = (clubId) => collection(db, 'clubs', clubId, 'events');
const notifsCol      = (clubId) => collection(db, 'clubs', clubId, 'notifications');

// ─── Domain & Application Logic (Testable & Independent of UI) ────────────────
export const parseDurationToMins = (str) => {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const clean = String(str).trim();
  if (clean.includes(':')) {
    const [m, s] = clean.split(':').map(Number);
    return (m || 0) + Math.round((s || 0) / 60);
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

export const formatMins = (mins) => {
  const m = Math.floor(mins || 0);
  return m > 0 ? `${m} min` : '—';
};

export const getYoutubeId = (url) => {
  if (!url) return null;
  const m = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return (m && m[2].length === 11) ? m[2] : null;
};

export const getYoutubeThumbnail = (url, quality = 'mqdefault') => {
  const id = getYoutubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/${quality}.jpg` : null;
};

/**
 * Calculates live total duration for plan items respecting item duration overrides.
 */
export const calculatePlanTotalDuration = (planItems = [], drillMap = {}) => {
  return (planItems || []).reduce((sum, item) => {
    const drill = drillMap[item.drillId];
    const duration = item.durationOverride != null && item.durationOverride !== ''
      ? Number(item.durationOverride)
      : (drill?.durationMins || parseDurationToMins(drill?.duration) || 0);
    return sum + (isNaN(duration) ? 0 : duration);
  }, 0);
};

/**
 * Groups plan items by section (warmup, skill, game, cooldown).
 */
export const groupPlanItemsBySection = (planItems = []) => {
  const grouped = {};
  PLAN_SECTIONS.forEach(s => { grouped[s.id] = []; });
  (planItems || []).forEach(item => {
    const sec = item.section || 'skill';
    if (!grouped[sec]) grouped[sec] = [];
    grouped[sec].push(item);
  });
  return grouped;
};

/**
 * Reorders plan items array and normalizes explicit sort_order integer for each.
 */
export const reorderPlanItems = (items = [], fromIndex, toIndex) => {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next.map((item, idx) => ({ ...item, sortOrder: idx }));
};

/**
 * Filter library content by text query, category, and content type.
 */
export const filterContent = (drills = [], { query = '', category = 'all', type = 'all' } = {}) => {
  const q = (query || '').toLowerCase().trim();
  const cat = (category || 'all').toLowerCase();
  const t = (type || 'all').toLowerCase();

  return (drills || []).filter(drill => {
    if (drill.isDeleted === true) return false;

    // Text match: title, category, description
    const matchText = !q ||
      (drill.title || '').toLowerCase().includes(q) ||
      (drill.category || '').toLowerCase().includes(q) ||
      (drill.description || '').toLowerCase().includes(q);
    if (!matchText) return false;

    // Category match
    if (cat !== 'all' && (drill.category || '').toLowerCase() !== cat) {
      return false;
    }

    // Type match
    if (t === 'videos') {
      const isVideo = drill.type === 'Video' || drill.type === 'Youtube' || Boolean(drill.youtubeUrl) || Boolean(drill.videoUrl);
      if (!isVideo) return false;
    } else if (t === 'docs') {
      if (drill.type !== 'Document') return false;
    }

    return true;
  });
};

// ─── TrainingService (API / Application Layer) ────────────────────────────────
export const trainingService = {

  // ---------- Library CRUD ----------
  getDrills: async (clubId) => {
    const q = query(drillsCol(clubId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.isDeleted !== true);
  },

  subscribeToDrills: (clubId, callback) => {
    const q = query(drillsCol(clubId), orderBy('createdAt', 'desc'));
    return onSnapshot(q,
      snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.isDeleted !== true)),
      () => callback([])
    );
  },

  addContent: async (clubId, data) => {
    const durationMins = data.durationMins || parseDurationToMins(data.duration);
    return await addDoc(drillsCol(clubId), {
      ...data,
      durationMins: durationMins || 10,
      clubId,
      views: 0,
      isDeleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  },

  updateContent: async (clubId, id, data) => {
    const ref = doc(drillsCol(clubId), id);
    const durationMins = data.durationMins !== undefined
      ? data.durationMins
      : (data.duration ? parseDurationToMins(data.duration) : undefined);
    const payload = { ...data, updatedAt: serverTimestamp() };
    if (durationMins !== undefined) payload.durationMins = durationMins;
    return await updateDoc(ref, payload);
  },

  // Soft-delete content that is used in plans with warning check
  deleteContent: async (clubId, id) => {
    const ref = doc(drillsCol(clubId), id);
    return await updateDoc(ref, {
      isDeleted: true,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  },

  hardDeleteContent: async (clubId, id) => {
    return await deleteDoc(doc(drillsCol(clubId), id));
  },

  // Check how many plans use this drill
  getDrillPlanUsageCount: async (clubId, drillId) => {
    try {
      const q = query(plansCol(clubId), where('drillIds', 'array-contains', drillId));
      const snap = await getDocs(q);
      return snap.docs.filter(d => d.data().isDeleted !== true).length;
    } catch {
      return 0;
    }
  },

  // ─── Training Plans ────────────────────────────────────────────────────────
  getPlans: async (clubId) => {
    const q = query(plansCol(clubId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.isDeleted !== true);
  },

  subscribePlans: (clubId, callback) => {
    const q = query(plansCol(clubId), orderBy('createdAt', 'desc'));
    return onSnapshot(q,
      snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.isDeleted !== true)),
      () => callback([])
    );
  },

  getPlan: async (clubId, planId) => {
    const snap = await getDoc(doc(plansCol(clubId), planId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  createPlan: async (clubId, data) => {
    // Ensure explicit sort_order integer is present on plan items
    const normalizedItems = (data.planItems || []).map((item, idx) => ({
      ...item,
      sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : idx,
      durationOverride: item.durationOverride != null && item.durationOverride !== ''
        ? Number(item.durationOverride)
        : null
    }));

    const drillIds = normalizedItems.map(i => i.drillId);

    const ref = await addDoc(plansCol(clubId), {
      ...data,
      clubId,
      drillIds,
      planItems: normalizedItems,
      durationMins: data.durationMins || 0,
      isTemplate: Boolean(data.isTemplate),
      status: data.status || 'draft',
      isDeleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return ref.id;
  },

  updatePlan: async (clubId, planId, data) => {
    const ref = doc(plansCol(clubId), planId);
    let payload = { ...data, updatedAt: serverTimestamp() };

    if (Array.isArray(data.planItems)) {
      const normalizedItems = data.planItems.map((item, idx) => ({
        ...item,
        sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : idx,
        durationOverride: item.durationOverride != null && item.durationOverride !== ''
          ? Number(item.durationOverride)
          : null
      }));
      payload.planItems = normalizedItems;
      payload.drillIds = normalizedItems.map(i => i.drillId);
    }

    return await updateDoc(ref, payload);
  },

  deletePlan: async (clubId, planId) => {
    const ref = doc(plansCol(clubId), planId);
    return await updateDoc(ref, { isDeleted: true, deletedAt: serverTimestamp() });
  },

  duplicatePlan: async (clubId, plan) => {
    const { id, createdAt, updatedAt, ...rest } = plan;
    const ref = await addDoc(plansCol(clubId), {
      ...rest,
      title: `${rest.title || 'Training Plan'} (Copy)`,
      status: 'draft',
      isTemplate: false,
      isDeleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return ref.id;
  },

  // ─── Training Sessions (SessionService + Calendar + Notifications) ──────────
  getSessions: async (clubId) => {
    const q = query(sessionsCol(clubId), orderBy('scheduledAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.isDeleted !== true);
  },

  subscribeSessions: (clubId, callback) => {
    const q = query(sessionsCol(clubId), orderBy('scheduledAt', 'desc'));
    return onSnapshot(q,
      snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.isDeleted !== true)),
      () => callback([])
    );
  },

  /**
   * Schedule Session:
   * 1. Creates TrainingSession record
   * 2. Pushes to Team Calendar in `clubs/{clubId}/events` (no private plan leak)
   * 3. Pushes notification to team members in `clubs/{clubId}/notifications`
   */
  createSession: async (clubId, {
    planId,
    planTitle = '',
    teamId = '',
    teamName = '',
    scheduledAt = '', // ISO or "YYYY-MM-DDTHH:mm"
    location = '',
    createdBy = '',
    locked = false,
  }) => {
    // 1. Create TrainingSession doc
    const sessionRef = doc(sessionsCol(clubId));
    const sessionId = sessionRef.id;

    const sessionPayload = {
      planId,
      planTitle: planTitle || 'Training Session',
      teamId: teamId || null,
      teamName: teamName || 'Club Wide',
      scheduledAt: scheduledAt || new Date().toISOString(),
      location: location || '',
      status: 'scheduled',
      attendance: [],
      locked: Boolean(locked),
      isDeleted: false,
      createdBy: createdBy || '',
      history: [{
        action: 'scheduled',
        by: createdBy || 'Coach',
        timestamp: new Date().toISOString()
      }],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(sessionRef, sessionPayload);

    // Parse date & time for calendar event
    let eventDate = '';
    let eventStartTime = '';
    if (scheduledAt) {
      if (scheduledAt.includes('T')) {
        const [d, t] = scheduledAt.split('T');
        eventDate = d;
        eventStartTime = t.slice(0, 5);
      } else {
        eventDate = scheduledAt.slice(0, 10);
      }
    }

    // 2. Push to Calendar events collection (Strictly logistics only — no private plan title or drills)
    let eventId = null;
    try {
      const eventRef = doc(eventsCol(clubId));
      eventId = eventRef.id;
      await setDoc(eventRef, {
        title: `Training: ${teamName || 'Team Training'}`,
        description: `Training session at ${location || 'Club Ground'}.`,
        date: eventDate || new Date().toISOString().slice(0, 10),
        startTime: eventStartTime || '18:00',
        endTime: '',
        location: location || 'Club Ground',
        type: 'training',
        category: 'training',
        status: 'scheduled',
        teamId: teamId || null,
        assignedGroupId: teamId || null,
        assignedGroupIds: teamId ? [teamId, teamId.toLowerCase()] : [],
        assignedGroupName: teamName || 'Club',
        groupType: teamId ? 'Team' : 'Club',
        openToAll: !teamId,
        trainingSessionId: sessionId,
        createdBy: createdBy || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update session with linked eventId
      await updateDoc(sessionRef, { calendarEventId: eventId });
    } catch (e) {
      console.warn('Failed to push training session to calendar:', e);
    }

    // 3. Push notifications for players / parents (Logistics only)
    try {
      const notifRef = doc(notifsCol(clubId));
      const prettyDate = eventDate ? `${eventDate} ${eventStartTime ? 'at ' + eventStartTime : ''}` : 'Upcoming date';
      await setDoc(notifRef, {
        title: `${teamName || 'Team'} — training scheduled`,
        message: `Training scheduled for ${prettyDate} at ${location || 'Club Ground'}. Check session logistics in My Teams.`,
        body: `Training scheduled for ${prettyDate} at ${location || 'Club Ground'}. Check session logistics in My Teams.`,
        recipientId: teamId || 'all',
        category: 'teams',
        clubId,
        read: false,
        type: 'training',
        meta: {
          trainingSessionId: sessionId,
          teamId: teamId || null
        },
        sentBy: 'coach',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('Failed to dispatch training notification:', e);
    }

    return sessionId;
  },

  updateSession: async (clubId, sessionId, data) => {
    const ref = doc(sessionsCol(clubId), sessionId);
    return await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  },

  /**
   * Update session logistics (date, time, venue, notes) without touching coaching plan.
   * Syncs linked calendar event and notifies affected members.
   */
  updateSessionLogistics: async (clubId, sessionId, {
    scheduledAt,
    location,
    logisticsNotes = '',
    updatedBy = '',
    updatedByName = 'Coach',
    updatedByRole = 'Coach'
  }) => {
    const sessionRef = doc(sessionsCol(clubId), sessionId);
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) throw new Error('Session not found');
    const session = snap.data();

    let eventDate = '';
    let eventStartTime = '';
    if (scheduledAt) {
      if (scheduledAt.includes('T')) {
        const [d, t] = scheduledAt.split('T');
        eventDate = d;
        eventStartTime = t.slice(0, 5);
      } else {
        eventDate = scheduledAt.slice(0, 10);
      }
    }

    const nextHistory = Array.isArray(session.history) ? [...session.history] : [];
    nextHistory.push({
      action: 'logistics_updated',
      by: updatedByName,
      role: updatedByRole,
      details: `Rescheduled to ${scheduledAt} at ${location}`,
      timestamp: new Date().toISOString()
    });

    await updateDoc(sessionRef, {
      scheduledAt: scheduledAt || session.scheduledAt,
      location: location != null ? location : session.location,
      logisticsNotes,
      history: nextHistory,
      updatedAt: serverTimestamp()
    });

    // Sync linked calendar event
    if (session.calendarEventId) {
      try {
        await updateDoc(doc(eventsCol(clubId), session.calendarEventId), {
          date: eventDate || session.scheduledAt?.slice(0, 10),
          startTime: eventStartTime || '18:00',
          location: location != null ? location : session.location,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn('Error syncing calendar event logistics:', err);
      }
    }

    // Dispatch update notification
    try {
      const notifRef = doc(notifsCol(clubId));
      const prettyDate = eventDate ? `${eventDate} ${eventStartTime ? 'at ' + eventStartTime : ''}` : 'Upcoming date';
      await setDoc(notifRef, {
        title: `${session.teamName || 'Team'} — training updated`,
        message: `Tuesday training now starts at ${prettyDate} at ${location || session.location}.`,
        body: `Tuesday training now starts at ${prettyDate} at ${location || session.location}.`,
        recipientId: session.teamId || 'all',
        category: 'teams',
        clubId,
        read: false,
        type: 'training',
        meta: {
          trainingSessionId: sessionId,
          teamId: session.teamId || null
        },
        sentBy: updatedByRole,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('Failed to send logistics update notification:', e);
    }
  },

  /**
   * Cancel an individual training session with a reason.
   * Keeps session visible, syncs calendar event, notifies team.
   */
  cancelSession: async (clubId, sessionId, {
    reason = '',
    cancelledBy = '',
    cancelledByName = 'Coach',
    cancelledByRole = 'Coach'
  }) => {
    const sessionRef = doc(sessionsCol(clubId), sessionId);
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) throw new Error('Session not found');
    const session = snap.data();

    const nextHistory = Array.isArray(session.history) ? [...session.history] : [];
    nextHistory.push({
      action: 'cancelled',
      reason,
      by: cancelledByName,
      role: cancelledByRole,
      timestamp: new Date().toISOString()
    });

    await updateDoc(sessionRef, {
      status: 'cancelled',
      cancellationReason: reason,
      cancelledAt: serverTimestamp(),
      cancelledBy: { uid: cancelledBy, name: cancelledByName, role: cancelledByRole },
      history: nextHistory,
      updatedAt: serverTimestamp()
    });

    // Update linked calendar event
    if (session.calendarEventId) {
      try {
        await updateDoc(doc(eventsCol(clubId), session.calendarEventId), {
          status: 'cancelled',
          cancellationReason: reason,
          title: `[Cancelled] Training: ${session.teamName || 'Team'}`,
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.warn('Failed to update calendar event cancellation:', e);
      }
    }

    // Dispatch cancellation notification
    try {
      const notifRef = doc(notifsCol(clubId));
      await setDoc(notifRef, {
        title: `${session.teamName || 'Team'} — training cancelled`,
        message: `Training on ${session.scheduledAt?.replace('T', ' ')} has been cancelled. Reason: ${reason || 'Unspecified'}`,
        body: `Training on ${session.scheduledAt?.replace('T', ' ')} has been cancelled. Reason: ${reason || 'Unspecified'}`,
        recipientId: session.teamId || 'all',
        category: 'teams',
        clubId,
        read: false,
        type: 'training_cancellation',
        meta: {
          trainingSessionId: sessionId,
          teamId: session.teamId || null,
          reason
        },
        sentBy: cancelledByRole,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('Failed to dispatch cancellation notification:', e);
    }
  },

  /**
   * Reinstate a previously cancelled training session.
   * Restores status, updates calendar event, sends fresh notification.
   */
  reinstateSession: async (clubId, sessionId, {
    reinstatedBy = '',
    reinstatedByName = 'Coach',
    reinstatedByRole = 'Coach'
  }) => {
    const sessionRef = doc(sessionsCol(clubId), sessionId);
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) throw new Error('Session not found');
    const session = snap.data();

    const nextHistory = Array.isArray(session.history) ? [...session.history] : [];
    nextHistory.push({
      action: 'reinstated',
      by: reinstatedByName,
      role: reinstatedByRole,
      timestamp: new Date().toISOString()
    });

    await updateDoc(sessionRef, {
      status: 'scheduled',
      cancellationReason: null,
      cancelledAt: null,
      reinstatedAt: serverTimestamp(),
      reinstatedBy: { uid: reinstatedBy, name: reinstatedByName, role: reinstatedByRole },
      history: nextHistory,
      updatedAt: serverTimestamp()
    });

    if (session.calendarEventId) {
      try {
        await updateDoc(doc(eventsCol(clubId), session.calendarEventId), {
          status: 'scheduled',
          cancellationReason: null,
          title: `Training: ${session.teamName || 'Team'}`,
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.warn('Failed to reinstate calendar event:', e);
      }
    }

    // Fresh notification
    try {
      const notifRef = doc(notifsCol(clubId));
      await setDoc(notifRef, {
        title: `${session.teamName || 'Team'} — training reinstated`,
        message: `Training on ${session.scheduledAt?.replace('T', ' ')} at ${session.location} has been reinstated.`,
        body: `Training on ${session.scheduledAt?.replace('T', ' ')} at ${session.location} has been reinstated.`,
        recipientId: session.teamId || 'all',
        category: 'teams',
        clubId,
        read: false,
        type: 'training',
        meta: {
          trainingSessionId: sessionId,
          teamId: session.teamId || null
        },
        sentBy: reinstatedByRole,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('Failed to dispatch reinstatement notification:', e);
    }
  },

  /**
   * Admin Bulk Training Cancellation:
   * Select date/time window, optional team and venue filters.
   * Cancels individual occurrences without touching recurring definitions or matches/events.
   */
  bulkCancelTrainingSessions: async (clubId, {
    startDate,
    endDate,
    teamId = '',
    venue = '',
    reason = '',
    cancelledBy = '',
    cancelledByName = 'Administrator',
    cancelledByRole = 'Admin'
  }) => {
    const q = query(sessionsCol(clubId), where('isDeleted', '==', false));
    const snap = await getDocs(q);
    const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const matching = sessions.filter(s => {
      if (s.status === 'cancelled') return false;
      const at = s.scheduledAt || '';
      if (startDate && at < startDate) return false;
      if (endDate && at > endDate) return false;
      if (teamId && s.teamId !== teamId) return false;
      if (venue && !(s.location || '').toLowerCase().includes(venue.toLowerCase())) return false;
      return true;
    });

    if (matching.length === 0) {
      return { count: 0, affectedSessions: [] };
    }

    const teamsNotified = new Set();

    for (const session of matching) {
      const nextHistory = Array.isArray(session.history) ? [...session.history] : [];
      nextHistory.push({
        action: 'bulk_cancelled',
        reason,
        by: cancelledByName,
        role: cancelledByRole,
        timestamp: new Date().toISOString()
      });

      await updateDoc(doc(sessionsCol(clubId), session.id), {
        status: 'cancelled',
        cancellationReason: reason,
        cancelledAt: serverTimestamp(),
        cancelledBy: { uid: cancelledBy, name: cancelledByName, role: cancelledByRole },
        history: nextHistory,
        updatedAt: serverTimestamp()
      });

      if (session.calendarEventId) {
        try {
          await updateDoc(doc(eventsCol(clubId), session.calendarEventId), {
            status: 'cancelled',
            cancellationReason: reason,
            title: `[Cancelled] Training: ${session.teamName || 'Team'}`,
            updatedAt: serverTimestamp()
          });
        } catch {
          // ignore
        }
      }

      // Group notifications by team to prevent duplicate spam
      const tKey = session.teamId || 'all';
      if (!teamsNotified.has(tKey)) {
        teamsNotified.add(tKey);
        try {
          const notifRef = doc(notifsCol(clubId));
          await setDoc(notifRef, {
            title: `${session.teamName || 'Club'} — training cancelled`,
            message: `Training between ${startDate ? startDate.slice(0, 10) : ''} and ${endDate ? endDate.slice(0, 10) : ''} has been cancelled. Reason: ${reason || 'Adverse weather / ground closure'}`,
            body: `Training between ${startDate ? startDate.slice(0, 10) : ''} and ${endDate ? endDate.slice(0, 10) : ''} has been cancelled. Reason: ${reason || 'Adverse weather / ground closure'}`,
            recipientId: session.teamId || 'all',
            category: 'teams',
            clubId,
            read: false,
            type: 'training_cancellation',
            meta: {
              bulkCancellation: true,
              teamId: session.teamId || null,
              reason
            },
            sentBy: cancelledByRole,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } catch (e) {
          console.warn('Bulk cancellation notification error:', e);
        }
      }
    }

    return { count: matching.length, affectedSessions: matching };
  },

  deleteSession: async (clubId, sessionId) => {
    const ref = doc(sessionsCol(clubId), sessionId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const sess = snap.data();
      // If linked to a calendar event, remove or mark event deleted too
      if (sess.calendarEventId) {
        try {
          await updateDoc(doc(eventsCol(clubId), sess.calendarEventId), {
            isDeleted: true,
            deletedAt: serverTimestamp()
          });
        } catch {
          // ignore
        }
      }
    }
    return await updateDoc(ref, { isDeleted: true, deletedAt: serverTimestamp() });
  }
};
