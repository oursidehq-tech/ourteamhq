import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, getDocs, doc, query, orderBy, updateDoc, 
  increment, addDoc, serverTimestamp, setDoc 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import {
  Library, Video, FileText, Search, Folder, Youtube, Globe, BookOpen,
  ClipboardList, Clock, Users, Timer, ChevronDown, ChevronUp, Play, Tag,
  CalendarDays, Download, CheckCircle, ExternalLink, Shield, Plus,
  ArrowUp, ArrowDown, HelpCircle, X, Lock, Share2, AlertCircle, Save
} from 'lucide-react';
import Modal from '../components/Modal';
import {
  trainingService,
  DESIGN_TOKENS,
  PLAN_SECTIONS,
  CONTENT_CATEGORIES,
  parseDurationToMins,
  formatMins,
  getYoutubeId,
  getYoutubeThumbnail,
  isUserEligibleCoach,
  canUserAccessPlan,
  getPlanAccessLabel,
  calculatePlanTotalDuration
} from '../services/trainingService';

// ─── Drill Thumbnail Component ────────────────────────────────────────────────
function DrillThumb({ drill, size = 150 }) {
  const ytId = getYoutubeId(drill?.youtubeUrl);
  const isDoc = drill?.type === 'Document';
  const imageUrl = (Array.isArray(drill?.imageUrls) && drill?.imageUrls[0]) || drill?.imageUrl || null;

  return (
    <div
      style={{
        height: size, background: '#0F172A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', position: 'relative', width: '100%', overflow: 'hidden'
      }}
    >
      {ytId ? (
        <img
          src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
          alt={drill.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
        />
      ) : imageUrl ? (
        <img
          src={imageUrl}
          alt={drill.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
        />
      ) : null}

      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {ytId ? (
          <div style={{
            width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,0,0,0.85)',
            display: 'grid', placeItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}>
            <Play size={16} color="#fff" style={{ marginLeft: 2 }} />
          </div>
        ) : isDoc ? (
          <FileText size={32} style={{ opacity: 0.6 }} />
        ) : (
          <Video size={32} style={{ opacity: 0.6 }} />
        )}
      </div>

      <span
        style={{
          position: 'absolute', bottom: 8, right: 8,
          background: 'rgba(0,0,0,0.75)', color: '#fff',
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999
        }}
      >
        {drill?.durationMins ? `${drill.durationMins} min` : (drill?.duration || (isDoc ? 'GUIDE' : 'VIDEO'))}
      </span>
    </div>
  );
}

export default function UserTraining() {
  const { selectedClubId, selectedClub } = useClub();
  const { user, profile } = useAuth();

  // Data states
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [teams, setTeams] = useState([]);
  const [drills, setDrills] = useState([]);
  const [plans, setPlans] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active top tab: 'plans' | 'builder' | 'library' | 'sessions'
  const [activeTab, setActiveTab] = useState('builder');

  // Drill library filters
  const [drillSearch, setDrillSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDrillDetail, setSelectedDrillDetail] = useState(null);

  // ── Plan Builder Form State (Image 4 Concept) ───────────────────────────────
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [planTitle, setPlanTitle] = useState('U17 Skills Session');
  const [planItems, setPlanItems] = useState([
    { drillId: 'drill-1', title: 'Warm-up', durationMins: 10, section: 'warmup', notes: '' },
    { drillId: 'drill-2', title: 'Skill Focus', durationMins: 20, section: 'skill', notes: '' },
    { drillId: 'drill-3', title: 'Game', durationMins: 20, section: 'game', notes: '' },
    { drillId: 'drill-4', title: 'Cool-down', durationMins: 10, section: 'cooldown', notes: '' },
  ]);
  const [sharedUsers, setSharedUsers] = useState(['Example Coach A']); // array of strings or { id, name }
  const [sharedGroups, setSharedGroups] = useState(['U17 Coaching Group']);
  const [selectedSessionTeamId, setSelectedSessionTeamId] = useState('');

  // Modals
  const [sharePickerOpen, setSharePickerOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    time: '17:30',
    location: 'Main Oval'
  });
  const [savingPlan, setSavingPlan] = useState(false);

  // Note editor modal for (?) button
  const [noteModalItemIndex, setNoteModalItemIndex] = useState(null);
  const [noteModalText, setNoteModalText] = useState('');

  const loadData = async () => {
    if (!selectedClubId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [mSnap, gSnap, tSnap, dSnap, pSnap, sSnap] = await Promise.all([
        getDocs(collection(db, 'clubs', selectedClubId, 'members')),
        getDocs(collection(db, 'clubs', selectedClubId, 'groups')),
        getDocs(collection(db, 'clubs', selectedClubId, 'teams')),
        getDocs(query(collection(db, 'clubs', selectedClubId, 'drills'), orderBy('createdAt', 'desc'))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'clubs', selectedClubId, 'trainingPlans'), orderBy('createdAt', 'desc'))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'clubs', selectedClubId, 'trainingSessions'), orderBy('scheduledAt', 'desc'))).catch(() => ({ docs: [] }))
      ]);

      setMembers(mSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setGroups(gSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const teamList = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTeams(teamList);
      if (teamList.length > 0 && !selectedSessionTeamId) {
        setSelectedSessionTeamId(teamList[0].id);
      }
      setDrills(dSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.isDeleted !== true));
      setPlans(pSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.isDeleted !== true));
      setSessions(sSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.isDeleted !== true));
    } catch (err) {
      console.error('Error loading training center data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedClubId]);

  // Find user's member record in this club
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

  // Check Coach Eligibility Gate (Strictly restricted to Coaches and Club Admins)
  const isEligibleCoach = useMemo(() => {
    return isUserEligibleCoach(user, clubMemberRecord, profile, selectedClubId);
  }, [user, clubMemberRecord, profile, selectedClubId]);

  // Groups user belongs to
  const userGroupIds = useMemo(() => {
    const list = [];
    if (clubMemberRecord?.groupIds) list.push(...clubMemberRecord.groupIds);
    groups.forEach(g => {
      if (g.memberIds?.includes(user?.uid) || (clubMemberRecord && g.memberIds?.includes(clubMemberRecord.id))) {
        list.push(g.id);
      }
    });
    return [...new Set(list)];
  }, [clubMemberRecord, groups, user]);

  // Eligible coaches in this club for sharing
  const eligibleCoachesList = useMemo(() => {
    return members.filter(m => {
      const roles = (m.roles || [m.role]).map(r => String(r).toLowerCase());
      return roles.includes('coach') || roles.includes('owner') || roles.includes('admin');
    });
  }, [members]);

  // Filtered plans accessible to this coach
  const accessiblePlans = useMemo(() => {
    return plans.filter(p => {
      return canUserAccessPlan(user, p, {
        isCoach: isEligibleCoach,
        isAdmin: String(profile?.role || '').toLowerCase() === 'owner' || String(profile?.role || '').toLowerCase() === 'admin',
        userGroupIds
      });
    });
  }, [plans, user, isEligibleCoach, profile, userGroupIds]);

  // Total duration live calculation for builder
  const totalBuilderDuration = useMemo(() => {
    return planItems.reduce((acc, item) => acc + (Number(item.durationMins) || 0), 0);
  }, [planItems]);

  // Filtered drills in library side panel
  const filteredDrills = useMemo(() => {
    return drills.filter(d => {
      const q = drillSearch.toLowerCase().trim();
      const matchQ = !q || d.title?.toLowerCase().includes(q) || d.category?.toLowerCase().includes(q);
      const matchCat = selectedCategory === 'all' || d.category?.toLowerCase() === selectedCategory.toLowerCase();
      return matchQ && matchCat;
    });
  }, [drills, drillSearch, selectedCategory]);

  // ── Plan Builder Operations ────────────────────────────────────────────────
  const handleAddDrillToPlan = (drill) => {
    const dur = drill.durationMins || parseDurationToMins(drill.duration) || 15;
    setPlanItems(prev => [
      ...prev,
      {
        drillId: drill.id,
        title: drill.title,
        durationMins: dur,
        section: 'skill',
        notes: ''
      }
    ]);
  };

  const handleMoveItem = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= planItems.length) return;
    const next = [...planItems];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    setPlanItems(next);
  };

  const handleRemoveItem = (index) => {
    setPlanItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSavePlan = async (asDraft = false, asTemplate = false) => {
    if (!planTitle.trim()) {
      alert('Plan title is required.');
      return;
    }
    setSavingPlan(true);
    try {
      const selectedTeam = teams.find(t => t.id === selectedSessionTeamId);
      const payload = {
        title: planTitle.trim(),
        durationMins: totalBuilderDuration,
        status: asDraft ? 'draft' : 'active',
        isTemplate: asTemplate,
        planItems: planItems.map((item, idx) => ({ ...item, sortOrder: idx })),
        drillIds: planItems.map(item => item.drillId),
        sharedWithUserIds: sharedUsers.filter(u => typeof u === 'object' ? u.id : false).map(u => u.id),
        sharedWithGroupIds: sharedGroups.filter(g => typeof g === 'object' ? g.id : false).map(g => g.id),
        sharedWithLabels: [...sharedUsers.map(u => typeof u === 'object' ? u.name : u), ...sharedGroups.map(g => typeof g === 'object' ? g.name : g)],
        sessionTeamId: selectedSessionTeamId || null,
        sessionTeamName: selectedTeam?.name || 'U17 Nev Blair',
        createdBy: user.uid,
        createdByName: profile?.displayName || 'Coach',
        updatedAt: serverTimestamp()
      };

      if (editingPlanId) {
        await updateDoc(doc(db, 'clubs', selectedClubId, 'trainingPlans', editingPlanId), payload);
        alert('Plan updated successfully!');
      } else {
        payload.createdAt = serverTimestamp();
        const ref = await addDoc(collection(db, 'clubs', selectedClubId, 'trainingPlans'), payload);
        setEditingPlanId(ref.id);
        alert(asTemplate ? 'Plan saved as template!' : asDraft ? 'Plan saved as draft!' : 'Plan saved successfully!');
      }
      loadData();
    } catch (err) {
      alert('Error saving plan: ' + err.message);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleConfirmSchedule = async () => {
    if (!selectedSessionTeamId) {
      alert('Please select a team for session logistics.');
      return;
    }
    const selectedTeam = teams.find(t => t.id === selectedSessionTeamId);
    setSavingPlan(true);
    try {
      // 1. Ensure plan is saved
      let targetPlanId = editingPlanId;
      if (!targetPlanId) {
        const planRef = await addDoc(collection(db, 'clubs', selectedClubId, 'trainingPlans'), {
          title: planTitle.trim(),
          durationMins: totalBuilderDuration,
          status: 'active',
          isTemplate: false,
          planItems: planItems.map((item, idx) => ({ ...item, sortOrder: idx })),
          drillIds: planItems.map(item => item.drillId),
          sharedWithUserIds: [],
          sharedWithGroupIds: [],
          sessionTeamId: selectedSessionTeamId,
          sessionTeamName: selectedTeam?.name || '',
          createdBy: user.uid,
          createdByName: profile?.displayName || 'Coach',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        targetPlanId = planRef.id;
        setEditingPlanId(targetPlanId);
      }

      // 2. Create Training Session record (Strictly logistics only — no plan leak!)
      const scheduledDateTime = `${scheduleForm.date}T${scheduleForm.time}`;
      await trainingService.createSession(selectedClubId, {
        planId: targetPlanId,
        planTitle: planTitle.trim(),
        teamId: selectedSessionTeamId,
        teamName: selectedTeam?.name || 'U17 Nev Blair',
        scheduledAt: scheduledDateTime,
        location: scheduleForm.location,
        createdBy: user.uid
      });

      alert(`Training session scheduled for ${selectedTeam?.name} on ${scheduleForm.date}! Synced with team calendar.`);
      setScheduleModalOpen(false);
      loadData();
    } catch (err) {
      alert('Error scheduling session: ' + err.message);
    } finally {
      setSavingPlan(false);
    }
  };

  // ── Access Denied Gate for Non-Coaches (Parents, Players, Committee) ────────
  if (!loading && !isEligibleCoach) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '24px', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '48px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Lock size={28} color="#DC2626" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>
            Access Restricted: Coaches Only
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '480px', margin: '0 auto 20px', lineHeight: 1.6 }}>
            Training Center and coaching drills are restricted to appointed Coaches and Club Administrators.
            Players and parents can access published session dates, venues, and match fixtures on their <strong>My Teams</strong> page.
          </p>
          <a
            href="/user-teams"
            className="btn btn-primary"
            style={{ background: DESIGN_TOKENS.primaryTeal, borderColor: DESIGN_TOKENS.primaryTeal, textDecoration: 'none', display: 'inline-flex', padding: '10px 20px' }}
          >
            Go to My Teams
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px', fontFamily: 'Arial, sans-serif' }}>
      
      {/* Top Header Bar matching Concept */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>
              Training Center
            </h1>
            <span style={{ fontSize: '11px', fontWeight: 600, background: '#0D9488', color: '#FFFFFF', padding: '3px 10px', borderRadius: '999px' }}>
              Concept • Example data
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
            Coach workspace
          </p>
        </div>

        {/* Top Tab Switcher */}
        <div style={{ display: 'flex', gap: '10px', background: '#FFFFFF', padding: '4px', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
          {[
            { id: 'builder', label: 'My Plans' },
            { id: 'library', label: 'Drill Library' },
            { id: 'sessions', label: 'Scheduled Sessions' },
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: isActive ? '#F0FDF4' : 'transparent',
                  border: isActive ? `1.5px solid ${DESIGN_TOKENS.primaryTeal}` : '1.5px solid transparent',
                  borderRadius: '8px',
                  padding: '6px 16px',
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

      {/* ─── TAB: PLAN BUILDER (IMAGE 4 CONCEPT) ────────────────────────────── */}
      {activeTab === 'builder' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Left Column: Plan Builder */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            
            {/* Title & Live Duration Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <input
                value={planTitle}
                onChange={e => setPlanTitle(e.target.value)}
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  color: '#0F172A',
                  border: 'none',
                  borderBottom: '2px dashed #E2E8F0',
                  padding: '4px 0',
                  outline: 'none',
                  width: '70%'
                }}
                placeholder="Plan title..."
              />
              <span style={{ fontSize: '13px', fontWeight: 800, background: '#0D9488', color: '#FFFFFF', padding: '6px 14px', borderRadius: '8px' }}>
                Total {totalBuilderDuration} min
              </span>
            </div>

            {/* Ordered Drills List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {planItems.map((item, idx) => (
                <div
                  key={`${item.drillId}-${idx}`}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#FAFAFA'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: '#94A3B8', letterSpacing: '2px', cursor: 'grab' }}>••••••</span>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>
                      {item.title}
                    </span>
                    <span style={{ fontSize: '13px', color: '#64748B' }}>
                      • {item.durationMins} min
                    </span>
                    {item.notes && (
                      <span style={{ fontSize: '11px', color: '#0D9488', fontStyle: 'italic' }}>
                        ({item.notes})
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Notes accessible button (?) */}
                    <button
                      onClick={() => {
                        setNoteModalItemIndex(idx);
                        setNoteModalText(item.notes || '');
                      }}
                      title="Item notes / coach instructions"
                      aria-label="Item notes"
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        color: '#64748B',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center'
                      }}
                    >
                      ?
                    </button>

                    <button
                      onClick={() => handleMoveItem(idx, -1)}
                      disabled={idx === 0}
                      className="btn-icon"
                      style={{ opacity: idx === 0 ? 0.3 : 1 }}
                      title="Move up"
                    >
                      <ArrowUp size={14} />
                    </button>

                    <button
                      onClick={() => handleMoveItem(idx, 1)}
                      disabled={idx === planItems.length - 1}
                      className="btn-icon"
                      style={{ opacity: idx === planItems.length - 1 ? 0.3 : 1 }}
                      title="Move down"
                    >
                      <ArrowDown size={14} />
                    </button>

                    <button
                      onClick={() => handleRemoveItem(idx)}
                      className="btn-icon danger"
                      title="Remove drill"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Plan Access Section */}
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '18px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontWeight: 800, fontSize: '14px', color: '#0F172A' }}>
                  Plan access
                </div>
                <button
                  onClick={() => setSharePickerOpen(true)}
                  style={{ background: 'none', border: 'none', color: '#0D9488', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                >
                  + Add coach or group
                </button>
              </div>

              <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '10px' }}>
                Shared with {sharedUsers.length + sharedGroups.length} selections
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                {sharedUsers.map((u, i) => (
                  <span
                    key={`u-${i}`}
                    style={{
                      background: '#F1F5F9',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {typeof u === 'object' ? u.name : u}
                    <X size={12} style={{ cursor: 'pointer' }} onClick={() => setSharedUsers(prev => prev.filter((_, idx) => idx !== i))} />
                  </span>
                ))}
                {sharedGroups.map((g, i) => (
                  <span
                    key={`g-${i}`}
                    style={{
                      background: '#F1F5F9',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {typeof g === 'object' ? g.name : g}
                    <X size={12} style={{ cursor: 'pointer' }} onClick={() => setSharedGroups(prev => prev.filter((_, idx) => idx !== i))} />
                  </span>
                ))}
              </div>

              <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                New plans start private. Only eligible coaches can access.
              </div>
            </div>

            {/* Session Team Section */}
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '18px', marginBottom: '24px' }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#0F172A', marginBottom: '8px' }}>
                Session team
              </div>

              <select
                className="form-control"
                value={selectedSessionTeamId}
                onChange={e => setSelectedSessionTeamId(e.target.value)}
                style={{ fontSize: '13px', maxWidth: '320px', marginBottom: '6px' }}
              >
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.ageGroup || 'General'})</option>
                ))}
              </select>

              <div style={{ fontSize: '11px', color: '#64748B' }}>
                Scheduling only — does not share this plan. Players and parents see session time and location only.
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-outline"
                onClick={() => handleSavePlan(true, false)}
                disabled={savingPlan}
                style={{ borderRadius: '10px', fontSize: '13px' }}
              >
                Save Draft
              </button>
              <button
                className="btn btn-outline"
                onClick={() => handleSavePlan(false, true)}
                disabled={savingPlan}
                style={{ borderRadius: '10px', fontSize: '13px' }}
              >
                Save Template
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setScheduleModalOpen(true)}
                disabled={savingPlan}
                style={{ background: DESIGN_TOKENS.primaryTeal, borderColor: DESIGN_TOKENS.primaryTeal, borderRadius: '10px', fontSize: '13px' }}
              >
                Schedule Session
              </button>
            </div>

          </div>

          {/* Right Column: Drill Library Side Panel */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
              Drill Library
            </h3>

            {/* Search Placeholder: "Search drills" */}
            <div className="search-box" style={{ marginBottom: '16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0 10px', height: '40px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={15} color="#94A3B8" />
              <input
                placeholder="Search drills..."
                value={drillSearch}
                onChange={e => setDrillSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '100%' }}
              />
            </div>

            {/* Drills List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '560px', overflowY: 'auto', paddingRight: '4px' }}>
              {filteredDrills.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94A3B8', fontSize: '12px' }}>
                  No drills found matching search.
                </div>
              ) : filteredDrills.map(drill => (
                <div
                  key={drill.id}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: '#FAFAFA'
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#0F172A' }}>
                    <DrillThumb drill={drill} size={44} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {drill.title}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', gap: '6px', marginTop: '2px' }}>
                      <span>{drill.durationMins || parseDurationToMins(drill.duration) || 10} min</span>
                      <span>•</span>
                      <span style={{ color: '#0D9488', fontWeight: 600 }}>{drill.category || 'General'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAddDrillToPlan(drill)}
                    title="Add to plan"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#0F172A',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              ))}
            </div>

          </div>

        </div>
      )}

      {/* ─── TAB: DRILL LIBRARY (FULL VIEW) ─────────────────────────────────── */}
      {activeTab === 'library' && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Coaching Drill Library ({drills.length})</h3>
            <div className="search-box" style={{ maxWidth: 300, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0 10px', height: '38px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={15} color="#94A3B8" />
              <input
                placeholder="Search drills..."
                value={drillSearch}
                onChange={e => setDrillSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
            {filteredDrills.map(d => (
              <div
                key={d.id}
                style={{ border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden', background: '#FAFAFA' }}
              >
                <DrillThumb drill={d} size={140} />
                <div style={{ padding: '12px' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{d.title}</div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '10px' }}>
                    {d.category || 'General'} • {d.durationMins || parseDurationToMins(d.duration) || 10} min
                  </div>
                  <button
                    onClick={() => {
                      handleAddDrillToPlan(d);
                      setActiveTab('builder');
                    }}
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%', fontSize: '12px' }}
                  >
                    + Add to Plan
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB: SCHEDULED SESSIONS ────────────────────────────────────────── */}
      {activeTab === 'sessions' && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Scheduled Team Training Sessions</h3>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: '#64748B' }}>
                <th style={{ padding: '12px 18px' }}>Team</th>
                <th style={{ padding: '12px 14px' }}>Date & Time</th>
                <th style={{ padding: '12px 14px' }}>Venue</th>
                <th style={{ padding: '12px 14px' }}>Status</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>No training sessions scheduled.</td></tr>
              ) : sessions.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 18px', fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                    {s.teamName || 'Club Team'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '12px', color: '#334155' }}>
                    {s.scheduledAt?.replace('T', ' ')}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748B' }}>
                    {s.location || 'Main Oval'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {s.status === 'cancelled' ? (
                      <span style={{ fontSize: '11px', fontWeight: 700, background: '#FEE2E2', color: '#DC2626', padding: '2px 8px', borderRadius: '999px' }}>
                        Cancelled
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', fontWeight: 700, background: '#DCFCE7', color: '#16A34A', padding: '2px 8px', borderRadius: '999px' }}>
                        Scheduled
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>
                      {s.planTitle ? `Linked: ${s.planTitle}` : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── MODAL: SCHEDULE SESSION ─────────────────────────────────────────── */}
      <Modal
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title="Schedule Training Session"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label style={{ fontSize: '12px', fontWeight: 700 }}>Select Team (Logistics Reference)</label>
            <select
              className="form-control"
              value={selectedSessionTeamId}
              onChange={e => setSelectedSessionTeamId(e.target.value)}
            >
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.ageGroup || 'General'})</option>
              ))}
            </select>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              Players and parents will see the session time and location on My Teams and Calendar. Private drills stay protected.
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 700 }}>Date</label>
              <input
                type="date"
                className="form-control"
                value={scheduleForm.date}
                onChange={e => setScheduleForm({ ...scheduleForm, date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 700 }}>Start Time</label>
              <input
                type="time"
                className="form-control"
                value={scheduleForm.time}
                onChange={e => setScheduleForm({ ...scheduleForm, time: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ fontSize: '12px', fontWeight: 700 }}>Location / Venue</label>
            <input
              className="form-control"
              placeholder="e.g. Main Oval / Pitch 2"
              value={scheduleForm.location}
              onChange={e => setScheduleForm({ ...scheduleForm, location: e.target.value })}
            />
          </div>

          <div className="form-actions">
            <button className="btn btn-outline" onClick={() => setScheduleModalOpen(false)} disabled={savingPlan}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleConfirmSchedule} disabled={savingPlan} style={{ background: DESIGN_TOKENS.primaryTeal, borderColor: DESIGN_TOKENS.primaryTeal }}>
              {savingPlan ? 'Scheduling...' : 'Confirm Schedule'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── MODAL: DRILL NOTE / INSTRUCTION MODAL (?) ───────────────────────── */}
      <Modal
        open={noteModalItemIndex !== null}
        onClose={() => setNoteModalItemIndex(null)}
        title="Drill Notes & Focus Points"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
            Add coach notes or key focus cues for: <strong>{planItems[noteModalItemIndex]?.title}</strong>
          </p>
          <textarea
            className="form-control"
            rows={3}
            placeholder="e.g. Focus on high press intensity and quick transition..."
            value={noteModalText}
            onChange={e => setNoteModalText(e.target.value)}
          />
          <div className="form-actions">
            <button className="btn btn-outline" onClick={() => setNoteModalItemIndex(null)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (noteModalItemIndex !== null) {
                  const next = [...planItems];
                  next[noteModalItemIndex].notes = noteModalText.trim();
                  setPlanItems(next);
                }
                setNoteModalItemIndex(null);
              }}
            >
              Save Note
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── MODAL: SHARE PICKER ─────────────────────────────────────────────── */}
      <Modal
        open={sharePickerOpen}
        onClose={() => setSharePickerOpen(false)}
        title="Share Plan with Coaches or Groups"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
            Select eligible coaches or groups to grant read access. Non-coach group members cannot bypass the coach gate.
          </p>

          <div className="form-group">
            <label style={{ fontSize: '12px', fontWeight: 700 }}>Eligible Coaches</label>
            <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px' }}>
              {eligibleCoachesList.map(c => {
                const name = c.displayName || c.name || c.email;
                const isSelected = sharedUsers.some(u => (typeof u === 'object' ? u.id === c.id : u === name));
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      if (isSelected) {
                        setSharedUsers(prev => prev.filter(u => (typeof u === 'object' ? u.id !== c.id : u !== name)));
                      } else {
                        setSharedUsers(prev => [...prev, { id: c.id, name }]);
                      }
                    }}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: isSelected ? '#F0FDF4' : 'transparent',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '13px'
                    }}
                  >
                    <span>{name}</span>
                    {isSelected && <CheckCircle size={16} color="#10B981" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" onClick={() => setSharePickerOpen(false)}>
              Done
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
