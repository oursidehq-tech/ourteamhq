import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, updateDoc, increment, query, orderBy, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import {
  Library, Video, FileText, Search, Folder, Youtube, Globe, BookOpen,
  ClipboardList, Clock, Users, Timer, ChevronDown, ChevronUp, Play, Tag,
  CalendarDays, Download, CheckCircle, ExternalLink, Shield
} from 'lucide-react';
import Modal from '../components/Modal';
import {
  DESIGN_TOKENS,
  PLAN_SECTIONS,
  CONTENT_CATEGORIES,
  parseDurationToMins,
  formatMins,
  getYoutubeId,
  getYoutubeThumbnail
} from '../services/trainingService';

const sectionColor = (id) => PLAN_SECTIONS.find(s => s.id === id)?.color || DESIGN_TOKENS.sessionBlue;
const sectionLabel = (id) => PLAN_SECTIONS.find(s => s.id === id)?.label || id || 'General';

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

// ─── Plan Card (Player / Parent Read-Only View) ────────────────────────────────
function PlanCard({ plan, drillMap, onSelectDrill }) {
  const [expanded, setExpanded] = useState(false);

  const planItems = Array.isArray(plan.planItems) && plan.planItems.length > 0
    ? [...plan.planItems].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    : (plan.drillIds || []).map((id, idx) => ({ drillId: id, sortOrder: idx, section: 'skill' }));

  const totalMins = plan.durationMins || planItems.reduce((sum, item) => {
    const drill = drillMap[item.drillId];
    return sum + (item.durationOverride || drill?.durationMins || parseDurationToMins(drill?.duration) || 0);
  }, 0);

  return (
    <div
      style={{
        border: '1px solid var(--border)', borderRadius: 16,
        overflow: 'hidden', background: '#ffffff', marginBottom: 14,
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}
    >
      <div
        style={{
          padding: '16px 18px', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12
        }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {plan.isTemplate && (
              <span
                style={{
                  fontSize: 10, fontWeight: 800, padding: '2px 8px',
                  borderRadius: 999, background: '#DBEAFE', color: DESIGN_TOKENS.sessionBlue
                }}
              >
                TEMPLATE
              </span>
            )}
            <span
              style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px',
                borderRadius: 999, background: '#D1FAE5', color: DESIGN_TOKENS.successGreen
              }}
            >
              {(plan.status || 'active').toUpperCase()}
            </span>
          </div>

          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
            {plan.title}
          </h3>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }}>
            {plan.teamName && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={12} /> {plan.teamName}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ClipboardList size={12} /> {planItems.length} drill{planItems.length !== 1 ? 's' : ''}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Timer size={12} /> {formatMins(totalMins)}
            </span>
          </div>

          {plan.description && (
            <p
              style={{
                margin: '8px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5,
                display: expanded ? 'block' : '-webkit-box', WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical', overflow: 'hidden'
              }}
            >
              {plan.description}
            </p>
          )}
        </div>

        <div style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px', background: 'var(--bg, #f8fafc)' }}>
          {PLAN_SECTIONS.map(section => {
            const sectionItems = planItems.filter(i => (i.section || 'skill') === section.id);
            if (sectionItems.length === 0) return null;

            return (
              <div key={section.id} style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 12, fontWeight: 800, color: section.color,
                    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: section.color, display: 'inline-block' }} />
                  {section.label}
                </div>

                {sectionItems.map((item, idx) => {
                  const drill = drillMap[item.drillId];
                  if (!drill) return null;
                  const dur = item.durationOverride || drill.durationMins || parseDurationToMins(drill.duration) || 10;
                  const ytId = getYoutubeId(drill.youtubeUrl);

                  return (
                    <div
                      key={item.drillId + idx}
                      style={{
                        display: 'flex', gap: 10, alignItems: 'center',
                        padding: '8px 10px', borderRadius: 10, marginBottom: 6,
                        background: '#ffffff', border: '1px solid var(--border)',
                        borderLeft: `4px solid ${section.color}`
                      }}
                    >
                      <div
                        style={{
                          width: 44, height: 44, borderRadius: 8,
                          overflow: 'hidden', flexShrink: 0, background: '#0F172A',
                          cursor: 'pointer'
                        }}
                        onClick={() => onSelectDrill(drill)}
                      >
                        {ytId ? (
                          <img
                            src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                            alt={drill.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
                            <Video size={18} color="#94a3b8" />
                          </div>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700, fontSize: 13,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            cursor: 'pointer'
                          }}
                          onClick={() => onSelectDrill(drill)}
                        >
                          {drill.title}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {drill.category || 'Drill'} · {formatMins(dur)}
                          {item.notes && <span style={{ fontStyle: 'italic', marginLeft: 6 }}>— {item.notes}</span>}
                        </div>
                      </div>

                      <div className="flex gap-xs" style={{ flexShrink: 0 }}>
                        {drill.youtubeUrl && (
                          <a
                            href={drill.youtubeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '5px 10px', background: 'rgba(255,0,0,0.1)',
                              borderRadius: 8, fontSize: 11, color: '#DC2626',
                              fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4
                            }}
                          >
                            <Play size={11} /> Watch
                          </a>
                        )}
                        <button
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={() => onSelectDrill(drill)}
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main UserTraining Component ──────────────────────────────────────────────
export default function UserTraining() {
  const { selectedClubId, selectedClub } = useClub();
  const { user } = useAuth();

  // Primary Tab for members: 'sessions' | 'plans' | 'library'
  const [activeTab, setActiveTab] = useState('sessions');

  // Library state
  const [drills, setDrills] = useState([]);
  const [libLoading, setLibLoading] = useState(true);
  const [libSearch, setLibSearch] = useState('');
  const [libFilter, setLibFilter] = useState('all');
  const [selectedDrill, setSelectedDrill] = useState(null);

  // Plans state
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [planSearch, setPlanSearch] = useState('');

  // Sessions state
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionPlanModal, setSessionPlanModal] = useState(null); // { session, plan }

  useEffect(() => {
    if (!selectedClubId) {
      setLibLoading(false);
      setPlansLoading(false);
      setSessionsLoading(false);
      return;
    }

    setLibLoading(true);
    getDocs(query(collection(db, 'clubs', selectedClubId, 'drills'), orderBy('createdAt', 'desc'))).then(snap => {
      setDrills(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.isDeleted !== true));
      setLibLoading(false);
    }).catch(() => setLibLoading(false));

    setPlansLoading(true);
    getDocs(query(collection(db, 'clubs', selectedClubId, 'trainingPlans'), orderBy('createdAt', 'desc'))).then(snap => {
      setPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.isDeleted !== true && d.status !== 'draft'));
      setPlansLoading(false);
    }).catch(() => setPlansLoading(false));

    setSessionsLoading(true);
    getDocs(query(collection(db, 'clubs', selectedClubId, 'trainingSessions'), orderBy('scheduledAt', 'desc'))).then(snap => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.isDeleted !== true));
      setSessionsLoading(false);
    }).catch(() => setSessionsLoading(false));
  }, [selectedClubId]);

  const drillMap = useMemo(() => {
    return Object.fromEntries(drills.map(d => [d.id, d]));
  }, [drills]);

  const handleViewDrill = async (drill) => {
    setSelectedDrill(drill);
    try {
      await updateDoc(doc(db, 'clubs', selectedClubId, 'drills', drill.id), { views: increment(1) });
      setDrills(prev => prev.map(d => d.id === drill.id ? { ...d, views: (d.views || 0) + 1 } : d));
    } catch {
      // ignore
    }
  };

  const filteredDrills = useMemo(() => drills.filter(d => {
    const q = libSearch.toLowerCase().trim();
    const matchQ = !q || d.title?.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q) || d.category?.toLowerCase().includes(q);
    if (!matchQ) return false;
    if (libFilter === 'videos') return d.type === 'Video' || d.type === 'Youtube' || !!d.youtubeUrl;
    if (libFilter === 'docs') return d.type === 'Document';
    return true;
  }), [drills, libSearch, libFilter]);

  const filteredPlans = useMemo(() => plans.filter(p => {
    const q = planSearch.toLowerCase().trim();
    return !q || p.title?.toLowerCase().includes(q) || p.teamName?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
  }), [plans, planSearch]);

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => new Date(b.scheduledAt || 0) - new Date(a.scheduledAt || 0));
  }, [sessions]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800 }}>Training Hub</h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
          Scheduled team training sessions, structured drill plans, and coaching guides for {selectedClub?.name || 'your club'}.
        </p>
      </div>

      {/* Main Tabs: Sessions (first!) / Plans / Library */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '2px solid var(--border)' }}>
        {[
          ['sessions', 'Scheduled Sessions', CalendarDays, sortedSessions.length],
          ['plans', 'Training Plans', ClipboardList, plans.length],
          ['library', 'Drill Library', Library, drills.length]
        ].map(([val, lbl, Icon, count]) => {
          const active = activeTab === val;
          return (
            <button
              key={val}
              onClick={() => setActiveTab(val)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 18px', borderRadius: '10px 10px 0 0',
                border: 'none',
                borderBottom: active ? `3px solid ${DESIGN_TOKENS.primaryTeal}` : '3px solid transparent',
                background: active ? 'rgba(13,148,136,0.08)' : 'transparent',
                color: active ? DESIGN_TOKENS.primaryTeal : 'var(--text-secondary)',
                fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: -2
              }}
            >
              <Icon size={16} />
              {lbl}
              {typeof count === 'number' && (
                <span
                  style={{
                    fontSize: 11, padding: '1px 7px', borderRadius: 999,
                    background: active ? DESIGN_TOKENS.primaryTeal : 'var(--border)',
                    color: active ? '#fff' : 'var(--text-secondary)'
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── 1. SCHEDULED SESSIONS TAB (Primary for Players / Parents) ── */}
      {activeTab === 'sessions' && (
        <div>
          {sessionsLoading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>
              Loading sessions...
            </p>
          ) : sortedSessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: 16, border: '1px solid var(--border)' }}>
              <CalendarDays size={44} style={{ color: 'var(--text-muted)', marginBottom: 12, opacity: 0.35 }} />
              <h3 style={{ margin: '0 0 6px' }}>No Sessions Scheduled</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
                Your coaches have not scheduled any upcoming training sessions yet.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {sortedSessions.map(session => {
                const plan = plans.find(p => p.id === session.planId);
                const dt = session.scheduledAt ? new Date(session.scheduledAt) : null;
                const isUpcoming = dt && dt.getTime() >= Date.now();

                return (
                  <div
                    key={session.id}
                    style={{
                      border: '1px solid var(--border)', borderRadius: 16,
                      background: '#ffffff', overflow: 'hidden',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      borderTop: `4px solid ${isUpcoming ? DESIGN_TOKENS.sessionBlue : 'var(--border)'}`,
                      padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                        <span
                          className="badge"
                          style={{
                            fontSize: 10, fontWeight: 700,
                            background: isUpcoming ? '#DBEAFE' : 'var(--bg)',
                            color: isUpcoming ? DESIGN_TOKENS.sessionBlue : 'var(--text-secondary)'
                          }}
                        >
                          {isUpcoming ? 'UPCOMING' : 'COMPLETED / PAST'}
                        </span>

                        {session.teamName && (
                          <span className="text-muted text-xs flex-center gap-xs">
                            <Users size={11} /> {session.teamName}
                          </span>
                        )}
                      </div>

                      <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800 }}>
                        {session.planTitle || plan?.title || 'Training Session'}
                      </h3>

                      {dt && (
                        <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                          <CalendarDays size={14} color={DESIGN_TOKENS.primaryTeal} />
                          {dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                          {' · '}
                          {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}

                      {session.location && (
                        <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Tag size={13} /> {session.location}
                        </p>
                      )}

                      {plan?.description && (
                        <p
                          style={{
                            margin: '0 0 12px', fontSize: 12, color: 'var(--text-secondary)',
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                          }}
                        >
                          {plan.description}
                        </p>
                      )}
                    </div>

                    <button
                      className="btn btn-primary"
                      style={{
                        width: '100%', marginTop: 8,
                        background: DESIGN_TOKENS.primaryTeal, borderColor: DESIGN_TOKENS.primaryTeal,
                        fontSize: 13
                      }}
                      onClick={() => setSessionPlanModal({ session, plan })}
                    >
                      <ClipboardList size={14} /> Open Training Plan
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 2. TRAINING PLANS TAB ── */}
      {activeTab === 'plans' && (
        <div>
          {/* Search bar */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#ffffff', border: '1px solid var(--border)',
              borderRadius: 12, padding: '10px 14px', marginBottom: 20
            }}
          >
            <Search size={16} color="var(--text-secondary)" />
            <input
              placeholder="Search plans by title or team..."
              value={planSearch}
              onChange={e => setPlanSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14, color: 'var(--text)' }}
            />
          </div>

          {plansLoading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>
              Loading plans...
            </p>
          ) : filteredPlans.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: 16, border: '1px solid var(--border)' }}>
              <ClipboardList size={40} style={{ color: 'var(--text-muted)', marginBottom: 12, opacity: 0.4 }} />
              <h3 style={{ margin: '0 0 6px' }}>No Training Plans Found</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
                {planSearch ? `No plans matching "${planSearch}"` : 'Your coaches have not published any training plans yet.'}
              </p>
            </div>
          ) : (
            filteredPlans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                drillMap={drillMap}
                onSelectDrill={d => handleViewDrill(d)}
              />
            ))
          )}
        </div>
      )}

      {/* ── 3. DRILL LIBRARY TAB ── */}
      {activeTab === 'library' && (
        <div>
          <div
            style={{
              background: '#ffffff', borderRadius: 14, border: '1px solid var(--border)',
              padding: '14px 16px', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12
            }}
          >
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                ['all', 'All Tactics & Drills'],
                ['videos', 'Videos & Drills'],
                ['docs', 'Technical Guides']
              ].map(([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => setLibFilter(val)}
                  style={{
                    padding: '7px 14px', borderRadius: 10, border: 'none',
                    background: libFilter === val ? 'rgba(13,148,136,0.1)' : 'transparent',
                    color: libFilter === val ? DESIGN_TOKENS.primaryTeal : 'var(--text-secondary)',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer'
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>

            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--bg, #f8fafc)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '8px 12px', width: 280
              }}
            >
              <Search size={14} color="var(--text-secondary)" />
              <input
                placeholder="Search drills, categories..."
                value={libSearch}
                onChange={e => setLibSearch(e.target.value)}
                style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13, background: 'transparent', color: 'var(--text)' }}
              />
            </div>
          </div>

          {libLoading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>
              Loading drills...
            </p>
          ) : filteredDrills.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: 16, border: '1px solid var(--border)' }}>
              <Library size={40} style={{ color: 'var(--text-muted)', marginBottom: 12, opacity: 0.4 }} />
              <h3 style={{ margin: '0 0 6px' }}>No Drills Found</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                {libSearch ? `No matches for "${libSearch}"` : 'Check back later!'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
              {filteredDrills.map(drill => (
                <div
                  key={drill.id}
                  style={{
                    padding: 0, overflow: 'hidden', border: '1px solid var(--border)',
                    background: '#ffffff', borderRadius: 16, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', transition: 'all 0.18s ease'
                  }}
                  onClick={() => handleViewDrill(drill)}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <DrillThumb drill={drill} size={160} />
                  <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontSize: 10, color: DESIGN_TOKENS.primaryTeal, fontWeight: 800, textTransform: 'uppercase' }}>
                        {drill.category || 'General'}
                      </span>
                      <h4 style={{ margin: '4px 0 6px', fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                        {drill.title}
                      </h4>
                      {drill.description && (
                        <p
                          style={{
                            margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4,
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                          }}
                        >
                          {drill.description}
                        </p>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 8,
                        fontSize: 11, color: 'var(--text-secondary)'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Eye size={12} /> {drill.views || 0} views
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Folder size={12} /> {drill.type || 'Drill'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Session Plan Modal (Read-Only Simple & Fast for Players / Parents) ── */}
      <Modal
        title={sessionPlanModal?.session.planTitle || 'Scheduled Session Plan'}
        open={!!sessionPlanModal}
        onClose={() => setSessionPlanModal(null)}
        wide={true}
      >
        {sessionPlanModal && (
          <div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
              <span className="badge" style={{ background: '#DBEAFE', color: DESIGN_TOKENS.sessionBlue, fontWeight: 700 }}>
                SCHEDULED SESSION
              </span>
              {sessionPlanModal.session.teamName && (
                <span className="badge badge-default">
                  <Users size={12} /> {sessionPlanModal.session.teamName}
                </span>
              )}
              {sessionPlanModal.session.scheduledAt && (
                <span className="badge badge-default">
                  <CalendarDays size={12} /> {new Date(sessionPlanModal.session.scheduledAt).toLocaleString()}
                </span>
              )}
              {sessionPlanModal.session.location && (
                <span className="badge badge-default">
                  <Tag size={12} /> {sessionPlanModal.session.location}
                </span>
              )}
            </div>

            {sessionPlanModal.plan?.description && (
              <div className="card" style={{ background: 'var(--bg)', padding: '12px 14px', marginBottom: 16 }}>
                <h5 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700 }}>Coach Session Objective</h5>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{sessionPlanModal.plan.description}</p>
              </div>
            )}

            {/* Drills in Session Plan */}
            <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800 }}>Drill Progression</h4>
            {PLAN_SECTIONS.map(s => {
              const items = (sessionPlanModal.plan?.planItems || []).filter(i => (i.section || 'skill') === s.id);
              if (items.length === 0) return null;

              return (
                <div key={s.id} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: s.color, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                    {s.label}
                  </div>

                  {items.map((item, idx) => {
                    const drill = drillMap[item.drillId];
                    if (!drill) return null;
                    const dur = item.durationOverride || drill.durationMins || parseDurationToMins(drill.duration) || 10;
                    const ytId = getYoutubeId(drill.youtubeUrl);

                    return (
                      <div
                        key={item.drillId + idx}
                        style={{
                          display: 'flex', gap: 12, alignItems: 'center',
                          padding: '10px 12px', borderRadius: 10, marginBottom: 8,
                          background: 'var(--bg, #f8fafc)', border: '1px solid var(--border)',
                          borderLeft: `4px solid ${s.color}`
                        }}
                      >
                        <div
                          style={{
                            width: 52, height: 52, borderRadius: 8,
                            overflow: 'hidden', flexShrink: 0, background: '#0F172A',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            setSessionPlanModal(null);
                            handleViewDrill(drill);
                          }}
                        >
                          <DrillThumb drill={drill} size={52} />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{ fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
                            onClick={() => {
                              setSessionPlanModal(null);
                              handleViewDrill(drill);
                            }}
                          >
                            {drill.title}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {drill.category} · {formatMins(dur)}
                            {item.notes && <span style={{ fontStyle: 'italic', marginLeft: 6 }}>— {item.notes}</span>}
                          </div>
                        </div>

                        {drill.youtubeUrl && (
                          <a
                            href={drill.youtubeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '6px 12px', background: 'rgba(255,0,0,0.1)',
                              borderRadius: 8, fontSize: 12, color: '#DC2626',
                              fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4
                            }}
                          >
                            <Play size={13} /> Watch Video
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            <div className="form-actions mt-lg">
              <button className="btn btn-outline" onClick={() => setSessionPlanModal(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Single Drill Video / Guide Viewer Modal ── */}
      <Modal open={!!selectedDrill} onClose={() => setSelectedDrill(null)} title={selectedDrill?.category || 'Training Guide'}>
        {selectedDrill && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 12px', color: 'var(--text)' }}>
              {selectedDrill.title}
            </h2>

            {selectedDrill.youtubeUrl && getYoutubeId(selectedDrill.youtubeUrl) ? (
              <div style={{ width: '100%', height: 280, borderRadius: 12, overflow: 'hidden', background: '#000', marginBottom: 16 }}>
                <iframe
                  width="100%" height="100%"
                  src={`https://www.youtube.com/embed/${getYoutubeId(selectedDrill.youtubeUrl)}?rel=0`}
                  title={selectedDrill.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : selectedDrill.fileUrl && (selectedDrill.fileUrl.endsWith('.mp4') || selectedDrill.type === 'Video') ? (
              <video controls src={selectedDrill.fileUrl} style={{ width: '100%', maxHeight: 280, borderRadius: 12, marginBottom: 16, display: 'block', background: '#000' }} />
            ) : null}

            {selectedDrill.description && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 6px', color: 'var(--text)' }}>
                  Instructions & Tactical Notes
                </h4>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {selectedDrill.description}
                </p>
              </div>
            )}

            <div
              style={{
                display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-secondary)',
                borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 16, flexWrap: 'wrap'
              }}
            >
              <span>Category: <strong>{selectedDrill.category || 'General'}</strong></span>
              <span>·</span>
              <span>Duration: <strong>{selectedDrill.durationMins || 10} min</strong></span>
              <span>·</span>
              <span>Views: <strong>{selectedDrill.views || 0}</strong></span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              {selectedDrill.youtubeUrl && (
                <button
                  className="btn btn-primary"
                  onClick={() => window.open(selectedDrill.youtubeUrl, '_blank')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: DESIGN_TOKENS.primaryTeal, borderColor: DESIGN_TOKENS.primaryTeal
                  }}
                >
                  <Globe size={14} /> Open in YouTube
                </button>
              )}
              {selectedDrill.fileUrl && !selectedDrill.youtubeUrl && (
                <a
                  href={selectedDrill.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                >
                  <Download size={14} /> Open Resource
                </a>
              )}
              <button className="btn btn-outline" onClick={() => setSelectedDrill(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
