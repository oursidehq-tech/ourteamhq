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
   * 2. Pushes to Team Calendar in `clubs/{clubId}/events`
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

    // 2. Push to Calendar events collection
    let eventId = null;
    try {
      const eventRef = doc(eventsCol(clubId));
      eventId = eventRef.id;
      await setDoc(eventRef, {
        title: `Training: ${planTitle || 'Team Session'}`,
        description: `Training session scheduled from plan "${planTitle}". Location: ${location || 'Club Ground'}.`,
        date: eventDate || new Date().toISOString().slice(0, 10),
        startTime: eventStartTime || '18:00',
        endTime: '',
        location: location || 'Club Ground',
        type: 'training',
        category: 'training',
        teamId: teamId || null,
        assignedGroupId: teamId || null,
        assignedGroupIds: teamId ? [teamId, teamId.toLowerCase()] : [],
        assignedGroupName: teamName || 'Club',
        groupType: teamId ? 'Team' : 'Club',
        openToAll: !teamId,
        trainingSessionId: sessionId,
        planId: planId,
        createdBy: createdBy || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update session with linked eventId
      await updateDoc(sessionRef, { calendarEventId: eventId });
    } catch (e) {
      console.warn('Failed to push training session to calendar:', e);
    }

    // 3. Push notifications for players / parents
    try {
      const notifRef = doc(notifsCol(clubId));
      const prettyDate = eventDate ? `${eventDate} ${eventStartTime ? 'at ' + eventStartTime : ''}` : 'Upcoming date';
      await setDoc(notifRef, {
        title: `New Training: ${planTitle || 'Team Session'}`,
        message: `A training session has been scheduled for ${prettyDate} at ${location || 'Club Ground'}. Open to view drills.`,
        body: `A training session has been scheduled for ${prettyDate} at ${location || 'Club Ground'}. Open to view drills.`,
        recipientId: teamId || 'all',
        clubId,
        read: false,
        type: 'training',
        meta: {
          trainingSessionId: sessionId,
          planId: planId,
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
