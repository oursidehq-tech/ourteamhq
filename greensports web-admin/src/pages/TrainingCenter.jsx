import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Library, Video, FileText, Plus, Search, Folder, Youtube, RefreshCw,
  Trash2, Globe, Edit2, Play, ExternalLink, Clock, Eye, Download,
  CheckCircle, ClipboardList, GripVertical, X, ChevronDown, ChevronUp,
  Copy, CalendarDays, Users, Save, Layers, ArrowLeft, BookOpen,
  AlertTriangle, Tag, Timer, StickyNote, PlusCircle, Zap, LayoutList,
  Lock, ArrowUp, ArrowDown, CheckSquare, Square
} from 'lucide-react';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import {
  trainingService,
  DESIGN_TOKENS,
  CONTENT_CATEGORIES,
  PLAN_SECTIONS,
  PLAN_STATUSES,
  parseDurationToMins,
  formatMins,
  getYoutubeId,
  getYoutubeThumbnail,
  calculatePlanTotalDuration,
  groupPlanItemsBySection,
  reorderPlanItems,
  filterContent
} from '../services/trainingService';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import Modal from '../components/Modal';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const sectionColor = (sectionId) =>
  PLAN_SECTIONS.find(s => s.id === sectionId)?.color || DESIGN_TOKENS.sessionBlue;

const sectionLabel = (sectionId) =>
  PLAN_SECTIONS.find(s => s.id === sectionId)?.label || sectionId || 'General';

// ─── Thumbnail Component ─────────────────────────────────────────────────────
function DrillThumbnail({ drill, size = 160, style = {} }) {
  const ytId = getYoutubeId(drill?.youtubeUrl);
  const isDoc = drill?.type === 'Document';
  const imageUrl = (Array.isArray(drill?.imageUrls) && drill?.imageUrls[0]) || drill?.imageUrl || null;

  return (
    <div style={{
      height: size, background: '#0F172A',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', position: 'relative', overflow: 'hidden', ...style
    }}>
      {ytId ? (
        <img
          src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
          alt={drill?.title || 'Drill'}
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.88 }}
        />
      ) : imageUrl ? (
        <img
          src={imageUrl}
          alt={drill?.title || 'Drill'}
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.88 }}
        />
      ) : isDoc ? (
        <FileText size={Math.min(size * 0.45, 48)} style={{ opacity: 0.6 }} />
      ) : (
        <Video size={Math.min(size * 0.45, 48)} style={{ opacity: 0.6 }} />
      )}

      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center'
      }}>
        {ytId ? (
          <div style={{
            width: Math.min(size * 0.35, 42), height: Math.min(size * 0.35, 42),
            borderRadius: '50%', background: 'rgba(255,0,0,0.85)',
            display: 'grid', placeItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}>
            <Play size={16} color="#fff" style={{ marginLeft: 2 }} />
          </div>
        ) : isDoc ? (
          <div style={{
            width: Math.min(size * 0.35, 36), height: Math.min(size * 0.35, 36),
            borderRadius: '50%', background: 'rgba(0,0,0,0.55)',
            display: 'grid', placeItems: 'center'
          }}>
            <FileText size={16} color="#fff" />
          </div>
        ) : (
          <div style={{
            width: Math.min(size * 0.35, 36), height: Math.min(size * 0.35, 36),
            borderRadius: '50%', background: 'rgba(0,0,0,0.55)',
            display: 'grid', placeItems: 'center'
          }}>
            <Play size={15} color="#fff" style={{ marginLeft: 2 }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Library Card with Add to Plan & Multi-Select ─────────────────────────────
function LibraryCard({
  drill, onView, onEdit, onDelete, onAddToPlan,
  selected, onToggleSelect, isMultiSelectMode
}) {
  const dur = drill.durationMins || parseDurationToMins(drill.duration) || 10;

  return (
    <div
      className="card"
      style={{
        padding: 0, overflow: 'hidden',
        border: selected ? `2px solid ${DESIGN_TOKENS.primaryTeal}` : '1px solid var(--border)',
        cursor: 'pointer', transition: 'all 0.18s ease',
        boxShadow: selected ? `0 0 0 3px rgba(13,148,136,0.18)` : undefined,
        position: 'relative'
      }}
      onClick={() => isMultiSelectMode ? onToggleSelect(drill) : onView(drill)}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{ position: 'relative' }}>
        <DrillThumbnail drill={drill} size={150} />

        {/* Category Badge */}
        <span
          className="badge"
          style={{
            position: 'absolute', top: 8, left: 8,
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            background: 'rgba(15,23,42,0.85)', color: '#fff', border: 'none'
          }}
        >
          {drill.category || 'General'}
        </span>

        {/* Duration badge */}
        <span
          className="badge"
          style={{
            position: 'absolute', bottom: 8, right: 8,
            background: 'rgba(0,0,0,0.75)', color: '#fff', border: 'none',
            fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3
          }}
        >
          {drill.type === 'Document' ? 'Doc' : <><Clock size={10} /> {dur} min</>}
        </span>

        {/* Multi-Select Checkbox Trigger */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(drill); }}
          title={selected ? 'Deselect drill' : 'Select drill'}
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 28, height: 28, borderRadius: 6,
            background: selected ? DESIGN_TOKENS.primaryTeal : 'rgba(15,23,42,0.7)',
            border: selected ? `2px solid #fff` : '1px solid rgba(255,255,255,0.4)',
            color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)', transition: 'all 0.15s'
          }}
        >
          {selected ? <CheckCircle size={16} /> : <Plus size={16} />}
        </button>
      </div>

      <div style={{ padding: '12px 14px' }}>
        <div className="flex justify-between items-start" style={{ marginBottom: 6 }}>
          <div style={{ flex: 1, paddingRight: 6 }}>
            <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>
              {drill.title}
            </h4>
            {drill.description && (
              <p
                className="text-muted text-xs"
                style={{
                  margin: 0, display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden'
                }}
              >
                {drill.description}
              </p>
            )}
          </div>

          <div className="flex gap-xs" onClick={e => e.stopPropagation()}>
            <button
              className="btn-icon"
              onClick={e => { e.stopPropagation(); onEdit(drill); }}
              title="Edit drill"
              style={{ color: 'var(--text)' }}
            >
              <Edit2 size={13} />
            </button>
            <button
              className="btn-icon danger"
              onClick={e => { e.stopPropagation(); onDelete(drill); }}
              title="Delete drill"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Direct Action Button: Add to Plan */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, marginTop: 10 }}>
          <button
            className="btn btn-outline"
            style={{
              padding: '6px 10px', fontSize: 12,
              color: DESIGN_TOKENS.primaryTeal, borderColor: DESIGN_TOKENS.primaryTeal
            }}
            onClick={e => { e.stopPropagation(); onAddToPlan(drill); }}
          >
            <PlusCircle size={13} /> Add to Plan
          </button>
          <button
            className="btn btn-outline"
            style={{ padding: '6px 10px', fontSize: 12 }}
            onClick={e => { e.stopPropagation(); onView(drill); }}
            title="Preview drill"
          >
            <Eye size={13} /> View
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Plan Item Row in Builder (Drag/Drop + Ordering + Section Grouping) ────────
function PlanItemRow({
  item, drill, index, totalItems,
  onRemove, onUpdateItem, onMoveUp, onMoveDown,
  dragHandlers
}) {
  const [expanded, setExpanded] = useState(false);
  const color = sectionColor(item.section);
  const dur = item.durationOverride || drill?.durationMins || parseDurationToMins(drill?.duration) || 10;

  return (
    <div
      style={{
        border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8,
        background: 'var(--surface)', overflow: 'hidden',
        borderLeft: `4px solid ${color}`,
        transition: 'all 0.15s ease'
      }}
      draggable
      onDragStart={() => dragHandlers?.handleDragStart(index)}
      onDragEnter={() => dragHandlers?.handleDragEnter(index)}
      onDragEnd={dragHandlers?.handleDragEnd}
    >
      <div className="flex-center gap-sm" style={{ padding: '10px 12px' }}>
        {/* Grip handle */}
        <div
          title="Drag to reorder"
          style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
        >
          <GripVertical size={16} />
        </div>

        {/* Sort Index */}
        <div
          style={{
            width: 22, height: 22, borderRadius: '50%',
            background: color + '22', color: color,
            fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center'
          }}
        >
          {index + 1}
        </div>

        {/* Thumbnail */}
        <div style={{ width: 44, height: 44, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
          <DrillThumbnail drill={drill} size={44} />
        </div>

        {/* Details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {drill?.title || 'Unknown Drill'}
          </div>
          <div className="flex-center gap-xs text-xs text-muted" style={{ marginTop: 2 }}>
            <span
              style={{
                background: color + '22', color, padding: '1px 8px',
                borderRadius: 999, fontSize: 10, fontWeight: 700
              }}
            >
              {sectionLabel(item.section)}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Clock size={10} /> {dur} min
            </span>
            {item.durationOverride != null && (
              <span className="badge" style={{ fontSize: 9, background: '#FEF3C7', color: '#B45309' }}>
                overridden
              </span>
            )}
          </div>
        </div>

        {/* Step ordering buttons */}
        <div className="flex gap-xs" style={{ flexShrink: 0 }}>
          <button
            type="button"
            className="btn-icon"
            disabled={index === 0}
            onClick={() => onMoveUp(index)}
            title="Move up"
            style={{ opacity: index === 0 ? 0.3 : 1 }}
          >
            <ArrowUp size={13} />
          </button>
          <button
            type="button"
            className="btn-icon"
            disabled={index === totalItems - 1}
            onClick={() => onMoveDown(index)}
            title="Move down"
            style={{ opacity: index === totalItems - 1 ? 0.3 : 1 }}
          >
            <ArrowDown size={13} />
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={() => setExpanded(e => !e)}
            title="Configure item"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            type="button"
            className="btn-icon danger"
            onClick={() => onRemove(item)}
            title="Remove from plan"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 14px 12px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 12, marginTop: 10 }}>
            {/* Section selector */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 11, fontWeight: 600 }}>Section</label>
              <select
                className="form-control"
                style={{ fontSize: 12 }}
                value={item.section || 'skill'}
                onChange={e => onUpdateItem(item, { section: e.target.value })}
              >
                {PLAN_SECTIONS.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Duration override */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 11, fontWeight: 600 }}>Duration Override</label>
              <input
                type="number"
                className="form-control"
                style={{ fontSize: 12 }}
                placeholder={`${drill?.durationMins || 10} min`}
                value={item.durationOverride || ''}
                min={1} max={180}
                onChange={e => onUpdateItem(item, {
                  durationOverride: e.target.value ? Number(e.target.value) : null
                })}
              />
            </div>
          </div>

          {/* Coaching notes */}
          <div className="form-group" style={{ margin: '10px 0 0' }}>
            <label style={{ fontSize: 11, fontWeight: 600 }}>Coach Notes for this Plan Step</label>
            <textarea
              rows={2}
              className="form-control"
              style={{ fontSize: 12, resize: 'vertical' }}
              placeholder="Specific focus points, reps, setup variations for this team..."
              value={item.notes || ''}
              onChange={e => onUpdateItem(item, { notes: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Plan Builder View (Focused Editor + Side Panel) ──────────────────────────
function PlanBuilder({
  drills, teams, clubId, user, editingPlan,
  initialSelectedDrills = [], onSaved, onBack
}) {
  const blankForm = {
    title: '', description: '', teamId: '', status: 'draft', isTemplate: false
  };

  const [form, setForm] = useState(blankForm);
  const [planItems, setPlanItems] = useState([]); // { drillId, sortOrder, section, durationOverride, notes }
  const [librarySearch, setLibrarySearch] = useState('');
  const [libCategory, setLibCategory] = useState('all');
  const [isSaving, setIsSaving] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    teamId: '', scheduledAt: '', location: '', locked: false
  });

  const drillMap = useMemo(() => {
    return Object.fromEntries(drills.map(d => [d.id, d]));
  }, [drills]);

  // Drag-and-drop refs
  const dragItemIndex = useRef(null);
  const dragOverIndex = useRef(null);

  const handleDragStart = (i) => { dragItemIndex.current = i; };
  const handleDragEnter = (i) => { dragOverIndex.current = i; };
  const handleDragEnd = () => {
    if (dragItemIndex.current === null || dragOverIndex.current === null) return;
    if (dragItemIndex.current === dragOverIndex.current) return;
    setPlanItems(prev => reorderPlanItems(prev, dragItemIndex.current, dragOverIndex.current));
    dragItemIndex.current = null;
    dragOverIndex.current = null;
  };

  const dragHandlers = { handleDragStart, handleDragEnter, handleDragEnd };

  // Move buttons
  const moveItemUp = (idx) => {
    if (idx <= 0) return;
    setPlanItems(prev => reorderPlanItems(prev, idx, idx - 1));
  };

  const moveItemDown = (idx) => {
    if (idx >= planItems.length - 1) return;
    setPlanItems(prev => reorderPlanItems(prev, idx, idx + 1));
  };

  // Populate form when editing or initialized with selected drills
  useEffect(() => {
    if (editingPlan) {
      setForm({
        title: editingPlan.title || '',
        description: editingPlan.description || editingPlan.objective || '',
        teamId: editingPlan.teamId || '',
        status: editingPlan.status || 'draft',
        isTemplate: !!editingPlan.isTemplate
      });
      if (Array.isArray(editingPlan.planItems) && editingPlan.planItems.length > 0) {
        const sorted = [...editingPlan.planItems].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        setPlanItems(sorted);
      } else if (Array.isArray(editingPlan.drillIds)) {
        setPlanItems(editingPlan.drillIds.map((drillId, idx) => ({
          drillId, sortOrder: idx, section: 'skill', durationOverride: null, notes: ''
        })));
      }
    } else {
      setForm(blankForm);
      if (initialSelectedDrills.length > 0) {
        const items = initialSelectedDrills.map((drill, idx) => {
          let section = 'skill';
          if (drill.category?.toLowerCase().includes('warm')) section = 'warmup';
          else if (drill.category?.toLowerCase().includes('cool')) section = 'cooldown';
          return {
            drillId: drill.id,
            sortOrder: idx,
            section,
            durationOverride: null,
            notes: ''
          };
        });
        setPlanItems(items);
      } else {
        setPlanItems([]);
      }
    }
  }, [editingPlan, initialSelectedDrills]);

  // Live total duration calculation (Domain logic)
  const totalDurationMins = useMemo(() => {
    return calculatePlanTotalDuration(planItems, drillMap);
  }, [planItems, drillMap]);

  // Grouped items by section
  const groupedSections = useMemo(() => {
    return groupPlanItemsBySection(planItems);
  }, [planItems]);

  const isInPlan = (drillId) => planItems.some(i => i.drillId === drillId);

  const addDrillToPlan = (drill) => {
    if (isInPlan(drill.id)) return;
    let section = 'skill';
    const cat = (drill.category || '').toLowerCase();
    if (cat.includes('warm')) section = 'warmup';
    else if (cat.includes('cool')) section = 'cooldown';
    else if (cat.includes('game') || cat.includes('tactic')) section = 'game';

    setPlanItems(prev => [
      ...prev,
      {
        drillId: drill.id,
        sortOrder: prev.length,
        section,
        durationOverride: null,
        notes: ''
      }
    ]);
  };

  const removeDrillFromPlan = (item) => {
    setPlanItems(prev => prev.filter(i => i.drillId !== item.drillId).map((i, idx) => ({
      ...i, sortOrder: idx
    })));
  };

  const updatePlanItem = (item, patch) => {
    setPlanItems(prev => prev.map(i => i.drillId === item.drillId ? { ...i, ...patch } : i));
  };

  // Filter library side panel
  const filteredLibrary = useMemo(() => {
    return filterContent(drills, { query: librarySearch, category: libCategory, type: 'all' });
  }, [drills, librarySearch, libCategory]);

  const handleSave = async (saveAsTemplate = false, andSchedule = false) => {
    if (!form.title.trim()) {
      alert('Plan title is required.');
      return;
    }
    if (planItems.length === 0) {
      alert('Add at least one drill to the plan.');
      return;
    }

    setIsSaving(true);
    try {
      const selectedTeam = teams.find(t => t.id === form.teamId);
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        objective: form.description.trim(),
        teamId: form.teamId || '',
        teamName: selectedTeam?.name || '',
        status: saveAsTemplate ? 'active' : form.status,
        isTemplate: saveAsTemplate || form.isTemplate,
        drillIds: planItems.map(i => i.drillId),
        planItems: planItems.map((i, idx) => ({ ...i, sortOrder: idx })),
        durationMins: totalDurationMins,
        createdBy: user?.uid || '',
        assignedGroupId: form.teamId || null,
        assignedGroupIds: form.teamId ? [form.teamId, form.teamId.toLowerCase()] : [],
        groupType: form.teamId ? 'Team' : 'Club'
      };

      let targetPlanId = editingPlan?.id;

      if (targetPlanId) {
        await trainingService.updatePlan(clubId, targetPlanId, payload);
      } else {
        targetPlanId = await trainingService.createPlan(clubId, payload);
      }

      if (andSchedule) {
        await trainingService.createSession(clubId, {
          planId: targetPlanId,
          planTitle: payload.title,
          teamId: scheduleForm.teamId || form.teamId,
          teamName: (teams.find(t => t.id === (scheduleForm.teamId || form.teamId))?.name) || payload.teamName,
          scheduledAt: scheduleForm.scheduledAt,
          location: scheduleForm.location,
          locked: scheduleForm.locked,
          createdBy: user?.uid || ''
        });
      }

      alert(editingPlan ? 'Training plan updated successfully!' : 'Training plan saved successfully!');
      onSaved();
    } catch (err) {
      alert('Error saving plan: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      {/* Top Header Bar */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="flex-center gap-md">
          <button className="btn btn-outline" onClick={onBack} style={{ flexShrink: 0 }}>
            <ArrowLeft size={16} /> Back to Plans
          </button>
          <div>
            <h2 style={{ margin: 0 }}>{editingPlan ? 'Edit Training Plan' : 'Plan Builder'}</h2>
            <p className="text-muted text-sm" style={{ margin: '2px 0 0' }}>
              Create an ordered, structured session and schedule it for your team.
            </p>
          </div>
        </div>

        {/* Live Total Duration Badge */}
        <div className="flex gap-sm items-center">
          <span
            className="badge"
            style={{
              fontSize: 14, padding: '7px 16px',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: DESIGN_TOKENS.primaryTeal, color: '#fff',
              boxShadow: '0 2px 8px rgba(13,148,136,0.25)'
            }}
          >
            <Timer size={16} /> Live Total: {formatMins(totalDurationMins)}
          </span>
        </div>
      </div>

      {/* Editor Grid: 1fr left (Builder) / 380px right (Library Panel) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT: Plan Form & Ordered Items ── */}
        <div>
          {/* Plan Details Card */}
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <div className="flex justify-between items-center mb-md">
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Plan Details</h4>
              {form.isTemplate && (
                <span className="badge" style={{ background: '#DBEAFE', color: DESIGN_TOKENS.sessionBlue, fontWeight: 700 }}>
                  TEMPLATE
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                <label>Plan Title <span className="text-danger">*</span></label>
                <input
                  type="text" className="form-control"
                  placeholder="e.g. 60-min High Press & Transition Session"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Target Team</label>
                <select
                  className="form-control"
                  value={form.teamId}
                  onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))}
                >
                  <option value="">— Club Wide / All Teams —</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Status</label>
                <select
                  className="form-control"
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                <label>Session Objective & Tactical Notes</label>
                <textarea
                  rows={2} className="form-control"
                  placeholder="Key coaching points, principles of play, goals for this session..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          {/* Ordered Plan Items Card */}
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <div className="flex justify-between items-center mb-md">
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                  Session Progression
                  <span className="badge badge-default" style={{ marginLeft: 8, fontSize: 12 }}>
                    {planItems.length} drill{planItems.length !== 1 ? 's' : ''}
                  </span>
                </h4>
                <p className="text-muted text-xs" style={{ margin: '3px 0 0' }}>
                  Items run in ordered sequence. Drag or use arrows to reorder.
                </p>
              </div>

              <span className="text-muted text-xs flex-center gap-xs">
                <GripVertical size={13} /> Drag to Reorder
              </span>
            </div>

            {/* Section Duration Breakdown Badges */}
            {planItems.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {PLAN_SECTIONS.map(s => {
                  const items = groupedSections[s.id] || [];
                  const mins = items.reduce((sum, it) => {
                    const drill = drillMap[it.drillId];
                    return sum + (it.durationOverride || drill?.durationMins || parseDurationToMins(drill?.duration) || 0);
                  }, 0);
                  if (items.length === 0) return null;

                  return (
                    <span
                      key={s.id}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 11, fontWeight: 700, padding: '4px 10px',
                        borderRadius: 999, background: s.color + '1A', color: s.color,
                        border: `1px solid ${s.color}33`
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                      {s.label}: {items.length} drill{items.length !== 1 ? 's' : ''} ({formatMins(mins)})
                    </span>
                  );
                })}
              </div>
            )}

            {planItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                <Layers size={40} style={{ opacity: 0.3, marginBottom: 10 }} />
                <h5 style={{ margin: '0 0 6px', color: 'var(--text)' }}>Your session plan is empty</h5>
                <p style={{ margin: 0, fontSize: 13 }}>
                  Select drills from the library panel on the right to start building.
                </p>
              </div>
            ) : (
              <div>
                {planItems.map((item, idx) => (
                  <PlanItemRow
                    key={item.drillId}
                    item={item}
                    drill={drillMap[item.drillId]}
                    index={idx}
                    totalItems={planItems.length}
                    onRemove={removeDrillFromPlan}
                    onUpdateItem={updatePlanItem}
                    onMoveUp={moveItemUp}
                    onMoveDown={moveItemDown}
                    dragHandlers={dragHandlers}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Bottom Actions Bar */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                className="btn btn-outline"
                onClick={() => handleSave(false, false)}
                disabled={isSaving}
              >
                <Save size={15} /> Save as Draft
              </button>

              <button
                className="btn btn-primary"
                onClick={() => handleSave(false, false)}
                disabled={isSaving}
                style={{ background: DESIGN_TOKENS.primaryTeal, borderColor: DESIGN_TOKENS.primaryTeal }}
              >
                <CheckCircle size={15} /> {isSaving ? 'Saving...' : 'Save Plan'}
              </button>

              <button
                className="btn btn-outline"
                onClick={() => setShowScheduleModal(true)}
                disabled={isSaving}
                style={{ borderColor: DESIGN_TOKENS.sessionBlue, color: DESIGN_TOKENS.sessionBlue }}
              >
                <CalendarDays size={15} /> Schedule Session
              </button>

              <button
                className="btn btn-outline"
                onClick={() => handleSave(true, false)}
                disabled={isSaving}
                title="Save this plan as a club template for other coaches"
              >
                <Copy size={15} /> Save as Template
              </button>

              <label className="flex-center gap-xs text-sm" style={{ marginLeft: 'auto', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.isTemplate}
                  onChange={e => setForm(f => ({ ...f, isTemplate: e.target.checked }))}
                />
                Reusable Template
              </label>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Drill Library Side Panel ── */}
        <div style={{ position: 'sticky', top: 90 }}>
          <div className="card" style={{ padding: 16 }}>
            <div className="flex justify-between items-center mb-sm">
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Library size={16} color={DESIGN_TOKENS.primaryTeal} /> Drill Library
              </h4>
              <span className="text-muted text-xs">{filteredLibrary.length} available</span>
            </div>

            {/* Search Box */}
            <div className="search-box" style={{ marginBottom: 10 }}>
              <Search size={14} />
              <input
                type="text"
                placeholder="Search drills..."
                value={librarySearch}
                onChange={e => setLibrarySearch(e.target.value)}
              />
            </div>

            {/* Category Chips */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
              {['all', ...CONTENT_CATEGORIES].map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`tab ${libCategory === cat.toLowerCase() ? 'active' : ''}`}
                  style={{ fontSize: 10, padding: '3px 8px' }}
                  onClick={() => setLibCategory(cat === 'all' ? 'all' : cat.toLowerCase())}
                >
                  {cat === 'all' ? 'All' : cat}
                </button>
              ))}
            </div>

            {/* Drill List */}
            <div style={{ maxHeight: 520, overflowY: 'auto', paddingRight: 2 }}>
              {filteredLibrary.length === 0 ? (
                <p className="text-muted text-xs" style={{ textAlign: 'center', padding: '24px 0' }}>
                  No drills matching search.
                </p>
              ) : (
                filteredLibrary.map(drill => {
                  const inPlan = isInPlan(drill.id);
                  const dur = drill.durationMins || parseDurationToMins(drill.duration) || 10;

                  return (
                    <div
                      key={drill.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 10px', borderRadius: 8, marginBottom: 6,
                        background: inPlan ? 'rgba(13,148,136,0.08)' : 'var(--bg)',
                        border: inPlan ? `1px solid ${DESIGN_TOKENS.primaryTeal}55` : '1px solid var(--border)',
                        cursor: inPlan ? 'default' : 'pointer',
                        transition: 'all 0.15s'
                      }}
                      onClick={() => !inPlan && addDrillToPlan(drill)}
                    >
                      <div style={{ width: 42, height: 42, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                        <DrillThumbnail drill={drill} size={42} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {drill.title}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          {drill.category || 'Drill'} · {dur} min
                        </div>
                      </div>

                      {inPlan ? (
                        <span title="Already in plan" style={{ color: DESIGN_TOKENS.primaryTeal }}>
                          <CheckCircle size={16} />
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn-icon"
                          style={{ color: 'var(--text-muted)' }}
                          title="Add to plan"
                        >
                          <Plus size={16} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Session Modal */}
      <Modal
        title="Schedule Training Session"
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
      >
        <div>
          <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
            Schedule this training plan on the team calendar and dispatch notifications to players & parents.
          </p>

          <div className="form-group">
            <label>Team <span className="text-danger">*</span></label>
            <select
              className="form-control"
              value={scheduleForm.teamId || form.teamId}
              onChange={e => setScheduleForm(f => ({ ...f, teamId: e.target.value }))}
            >
              <option value="">— Select a team —</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Session Date & Time <span className="text-danger">*</span></label>
            <input
              type="datetime-local"
              className="form-control"
              value={scheduleForm.scheduledAt}
              onChange={e => setScheduleForm(f => ({ ...f, scheduledAt: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label>Location / Pitch</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Oval 2, Main Pitch, Training Ground"
              value={scheduleForm.location}
              onChange={e => setScheduleForm(f => ({ ...f, location: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="flex-center gap-xs text-sm" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={scheduleForm.locked}
                onChange={e => setScheduleForm(f => ({ ...f, locked: e.target.checked }))}
              />
              <Lock size={13} /> Lock this session (prevent future plan changes from updating this scheduled instance)
            </label>
          </div>

          <div className="form-actions mt-md">
            <button className="btn btn-outline" onClick={() => setShowScheduleModal(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              style={{ background: DESIGN_TOKENS.sessionBlue, borderColor: DESIGN_TOKENS.sessionBlue }}
              onClick={() => {
                if (!scheduleForm.scheduledAt) {
                  alert('Please enter a session date and time.');
                  return;
                }
                setShowScheduleModal(false);
                handleSave(false, true);
              }}
            >
              <CalendarDays size={15} /> Save & Schedule
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Plans List & Scheduled Sessions View ─────────────────────────────────────
function PlansList({
  plans, drills, sessions, teams, clubId, user,
  onEdit, onDelete, onDuplicate, onCreateNew, onDeleteSession
}) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, active, templates, draft
  const [viewingPlan, setViewingPlan] = useState(null);
  const [quickSchedulePlan, setQuickSchedulePlan] = useState(null);
  const [quickScheduleForm, setQuickScheduleForm] = useState({
    teamId: '', scheduledAt: '', location: '', locked: false
  });
  const [isScheduling, setIsScheduling] = useState(false);

  const drillMap = useMemo(() => {
    return Object.fromEntries(drills.map(d => [d.id, d]));
  }, [drills]);

  const filteredPlans = useMemo(() => {
    const q = search.toLowerCase().trim();
    return plans.filter(p => {
      const matchQ = !q || p.title?.toLowerCase().includes(q) || p.teamName?.toLowerCase().includes(q);
      if (filterType === 'templates') return matchQ && p.isTemplate;
      if (filterType === 'active') return matchQ && p.status === 'active';
      if (filterType === 'draft') return matchQ && p.status === 'draft';
      return matchQ;
    });
  }, [plans, search, filterType]);

  const handleQuickSchedule = async () => {
    if (!quickSchedulePlan) return;
    if (!quickScheduleForm.scheduledAt) {
      alert('Please enter a scheduled date and time.');
      return;
    }
    setIsScheduling(true);
    try {
      const selectedTeam = teams.find(t => t.id === quickScheduleForm.teamId);
      await trainingService.createSession(clubId, {
        planId: quickSchedulePlan.id,
        planTitle: quickSchedulePlan.title,
        teamId: quickScheduleForm.teamId || quickSchedulePlan.teamId || '',
        teamName: selectedTeam?.name || quickSchedulePlan.teamName || '',
        scheduledAt: quickScheduleForm.scheduledAt,
        location: quickScheduleForm.location,
        locked: quickScheduleForm.locked,
        createdBy: user?.uid || ''
      });
      alert(`Session scheduled for "${quickSchedulePlan.title}"! Added to team calendar and notifications sent.`);
      setQuickSchedulePlan(null);
      setQuickScheduleForm({ teamId: '', scheduledAt: '', location: '', locked: false });
    } catch (e) {
      alert('Failed to schedule session: ' + e.message);
    } finally {
      setIsScheduling(false);
    }
  };

  const [selectedPlanForAccess, setSelectedPlanForAccess] = useState(null);

  useEffect(() => {
    if (filteredPlans.length > 0 && !selectedPlanForAccess) {
      setSelectedPlanForAccess(filteredPlans[0]);
    }
  }, [filteredPlans]);

  return (
    <div>
      {/* Information Banner matching Image 5 */}
      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '12px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <AlertCircle size={18} color="#2563EB" />
        <span style={{ fontSize: '13px', color: '#1E40AF', fontWeight: 600 }}>
          Players and parents cannot access Training Center or plan content.
        </span>
      </div>

      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>Training Plans</h2>
          <p className="text-muted text-sm" style={{ margin: '4px 0 0' }}>
            {plans.length} plan{plans.length !== 1 ? 's' : ''} · Manage coaching access, private plans and team sessions
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={onCreateNew}
          style={{ background: DESIGN_TOKENS.primaryTeal, borderColor: DESIGN_TOKENS.primaryTeal, borderRadius: '10px' }}
        >
          <Plus size={16} /> Create Plan
        </button>
      </div>

      {/* Main Split Grid: Table of Plans + Side Access Panel (Image 5) */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedPlanForAccess ? '1.5fr 1fr' : '1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left: Table of Plans */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden' }}>
          <div className="table-toolbar" style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', padding: '12px 16px', display: 'flex', justifyContent: 'space-between' }}>
            <div className="flex gap-sm">
              {[['all', 'All Plans'], ['active', 'Active'], ['templates', 'Templates'], ['draft', 'Drafts']].map(([val, lbl]) => (
                <button
                  key={val}
                  className={`tab ${filterType === val ? 'active' : ''}`}
                  onClick={() => setFilterType(val)}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <div className="search-box" style={{ maxWidth: 220, height: 32 }}>
              <Search size={14} />
              <input
                placeholder="Search plans..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ fontSize: 12 }}
              />
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: '#64748B' }}>
                <th style={{ padding: '12px 16px' }}>Plan</th>
                <th style={{ padding: '12px 12px' }}>Owner</th>
                <th style={{ padding: '12px 12px' }}>Access</th>
                <th style={{ padding: '12px 12px' }}>Status</th>
                <th style={{ padding: '12px 12px' }}>Session team</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8' }}>
                    No training plans found. Click "+ Create Plan" to start.
                  </td>
                </tr>
              ) : filteredPlans.map(p => {
                const isSelected = selectedPlanForAccess?.id === p.id;
                const isShared = (p.sharedWithUserIds?.length || 0) + (p.sharedWithGroupIds?.length || 0) > 0;
                const accessText = isShared 
                  ? `Shared (${(p.sharedWithUserIds?.length || 0) + (p.sharedWithGroupIds?.length || 0)})` 
                  : '• Private';

                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedPlanForAccess(p)}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      background: isSelected ? '#F0FDF4' : 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                      {p.title}
                    </td>
                    <td style={{ padding: '12px 12px', fontSize: '12px', color: '#64748B' }}>
                      {p.createdByName || 'Example Coach A'}
                    </td>
                    <td style={{ padding: '12px 12px', fontSize: '12px', color: isShared ? '#0D9488' : '#64748B', fontWeight: isShared ? 700 : 500 }}>
                      {accessText}
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      {p.isTemplate ? (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#3B82F6' }}>Template</span>
                      ) : p.status === 'active' ? (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A' }} /> Scheduled
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>Draft</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 12px', fontSize: '12px', color: '#334155' }}>
                      {p.sessionTeamName || p.teamName || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlanForAccess(p);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#0D9488',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ padding: '12px 16px', borderTop: '1px solid #E2E8F0', fontSize: '12px', color: '#64748B', background: '#FAFAFA' }}>
            Linking a session to a team does not share its plan.
          </div>
        </div>

        {/* Right: Side Panel (Plan access & Session team details matching Image 5) */}
        {selectedPlanForAccess && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
              Plan access — {selectedPlanForAccess.title}
            </h3>

            <div style={{ marginBottom: '14px' }}>
              <span style={{ fontSize: '12px', color: '#64748B' }}>Owner: </span>
              <strong style={{ fontSize: '13px', color: '#0F172A' }}>
                {selectedPlanForAccess.createdByName || 'Example Coach A'}
              </strong>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                Shared with
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {(selectedPlanForAccess.sharedWithLabels || ['Example Coach D', 'U17 Coaching Group']).map((lbl, idx) => (
                  <span
                    key={idx}
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
                    {lbl}
                    <X size={12} style={{ cursor: 'pointer', color: '#64748B' }} onClick={() => alert('Removed share')} />
                  </span>
                ))}
              </div>

              <button
                onClick={() => alert('Coach or group selector opened')}
                style={{ background: 'none', border: 'none', padding: 0, color: '#0D9488', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
              >
                + Add coach or group
              </button>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                Coach role required. Non-coaches in a group cannot access.
              </div>
            </div>

            {/* Session Team (scheduling only) */}
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px', marginTop: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                Session team (scheduling only):
              </div>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#0D9488', marginBottom: '4px' }}>
                {selectedPlanForAccess.sessionTeamName || selectedPlanForAccess.teamName || 'U17 Nev Blair'}
              </div>
              <div style={{ fontSize: '12px', color: '#334155', marginBottom: '2px' }}>
                Tue 10 Nov 2026 • 5:00 pm
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '14px' }}>
                Main Oval
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => onEdit(selectedPlanForAccess)}
                  style={{ flex: 1, fontSize: '12px' }}
                >
                  Edit in Builder
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setQuickSchedulePlan(selectedPlanForAccess);
                    setQuickScheduleForm({
                      teamId: selectedPlanForAccess.teamId || '',
                      scheduledAt: '',
                      location: '',
                      locked: false
                    });
                  }}
                  style={{ flex: 1, background: DESIGN_TOKENS.primaryTeal, borderColor: DESIGN_TOKENS.primaryTeal, fontSize: '12px' }}
                >
                  Schedule
                </button>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Scheduled Sessions List */}
      <div style={{ marginTop: 36 }}>
        <div className="flex justify-between items-center mb-md">
          <div>
            <h3 style={{ margin: 0 }}>Scheduled Sessions</h3>
            <p className="text-muted text-sm" style={{ margin: '2px 0 0' }}>
              Training sessions pushed to team calendars and player mobile feeds.
            </p>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="card" style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <CalendarDays size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 13 }}>No training sessions scheduled yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {sessions.map(session => {
              const plan = plans.find(p => p.id === session.planId);
              const dt = session.scheduledAt ? new Date(session.scheduledAt) : null;

              return (
                <div
                  key={session.id}
                  className="card shadow-sm"
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    padding: 14,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div className="flex justify-between items-start gap-sm">
                    <div>
                      <div className="flex gap-xs items-center" style={{ marginBottom: 4 }}>
                        <span className="badge" style={{ fontSize: 9, background: '#DBEAFE', color: DESIGN_TOKENS.sessionBlue }}>
                          SCHEDULED
                        </span>
                        {session.locked && (
                          <span className="badge" style={{ fontSize: 9, background: '#F3F4F6', color: '#4B5563' }} title="Session locked">
                            <Lock size={9} /> LOCKED
                          </span>
                        )}
                      </div>
                      <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>
                        {session.planTitle || plan?.title || 'Training Session'}
                      </h4>
                      {session.teamName && (
                        <p className="text-muted text-xs flex-center gap-xs" style={{ margin: '2px 0' }}>
                          <Users size={11} /> {session.teamName}
                        </p>
                      )}
                      {dt && (
                        <p className="text-muted text-xs flex-center gap-xs" style={{ margin: '2px 0' }}>
                          <CalendarDays size={11} /> {dt.toLocaleDateString()} at {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      {session.location && (
                        <p className="text-muted text-xs flex-center gap-xs" style={{ margin: '2px 0' }}>
                          <Tag size={11} /> {session.location}
                        </p>
                      )}
                    </div>

                    <button
                      className="btn-icon danger"
                      onClick={() => onDeleteSession(session)}
                      title="Cancel this session"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Plan Detail Viewer Modal */}
      <Modal
        title={viewingPlan?.title || 'Training Plan'}
        open={!!viewingPlan}
        onClose={() => setViewingPlan(null)}
        wide={true}
      >
        {viewingPlan && (
          <div>
            <div className="flex gap-sm items-center mb-md flex-wrap">
              {viewingPlan.isTemplate && <span className="badge badge-info">TEMPLATE</span>}
              <span
                className="badge badge-default"
                style={{
                  background: viewingPlan.status === 'active' ? '#D1FAE5' : '#FEF3C7',
                  color: viewingPlan.status === 'active' ? '#065F46' : '#92400E',
                  border: 'none', fontWeight: 700
                }}
              >
                {(viewingPlan.status || 'draft').toUpperCase()}
              </span>
              {viewingPlan.teamName && (
                <span className="badge badge-default"><Users size={11} /> {viewingPlan.teamName}</span>
              )}
              <span className="badge badge-default">
                <Timer size={11} /> {formatMins(viewingPlan.durationMins || 0)}
              </span>
            </div>

            {viewingPlan.description && (
              <div className="card" style={{ background: 'var(--bg)', padding: '12px 14px', marginBottom: 16 }}>
                <h5 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700 }}>Objective & Tactical Notes</h5>
                <p style={{ margin: 0, lineHeight: 1.6, fontSize: 13 }}>{viewingPlan.description}</p>
              </div>
            )}

            {/* Section Breakdown of Items */}
            {PLAN_SECTIONS.map(s => {
              const items = (viewingPlan.planItems || []).filter(i => (i.section || 'skill') === s.id);
              if (items.length === 0) return null;

              return (
                <div key={s.id} style={{ marginBottom: 16 }}>
                  <h5 style={{ margin: '0 0 8px', fontSize: 13, color: s.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                    {s.label} ({items.length})
                  </h5>

                  {items.map((item, idx) => {
                    const drill = drillMap[item.drillId];
                    if (!drill) return null;
                    const dur = item.durationOverride || drill.durationMins || parseDurationToMins(drill.duration) || 10;
                    return (
                      <div
                        key={item.drillId}
                        style={{
                          display: 'flex', gap: 10, alignItems: 'center',
                          padding: '8px 10px', borderRadius: 8, marginBottom: 6,
                          background: 'var(--bg)', border: '1px solid var(--border)',
                          borderLeft: `3px solid ${s.color}`
                        }}
                      >
                        <div style={{ width: 44, height: 44, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                          <DrillThumbnail drill={drill} size={44} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{drill.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {drill.category} · {formatMins(dur)}
                          </div>
                          {item.notes && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                              Note: {item.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            <div className="form-actions mt-lg">
              <button
                className="btn btn-outline"
                onClick={() => {
                  const p = viewingPlan;
                  setViewingPlan(null);
                  onEdit(p);
                }}
              >
                <Edit2 size={14} /> Edit Plan
              </button>
              <button
                className="btn btn-primary"
                style={{ background: DESIGN_TOKENS.sessionBlue, borderColor: DESIGN_TOKENS.sessionBlue }}
                onClick={() => {
                  const p = viewingPlan;
                  setViewingPlan(null);
                  setQuickSchedulePlan(p);
                  setQuickScheduleForm({
                    teamId: p.teamId || '',
                    scheduledAt: '',
                    location: '',
                    locked: false
                  });
                }}
              >
                <CalendarDays size={14} /> Schedule Session
              </button>
              <button className="btn btn-outline" onClick={() => setViewingPlan(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Quick Schedule Modal */}
      <Modal
        title={`Schedule: ${quickSchedulePlan?.title || 'Training Session'}`}
        open={!!quickSchedulePlan}
        onClose={() => setQuickSchedulePlan(null)}
      >
        {quickSchedulePlan && (
          <div>
            <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
              Push this plan to the team calendar and notify players & parents.
            </p>

            <div className="form-group">
              <label>Team</label>
              <select
                className="form-control"
                value={quickScheduleForm.teamId}
                onChange={e => setQuickScheduleForm(f => ({ ...f, teamId: e.target.value }))}
              >
                <option value="">— Select team —</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Session Date & Time <span className="text-danger">*</span></label>
              <input
                type="datetime-local"
                className="form-control"
                value={quickScheduleForm.scheduledAt}
                onChange={e => setQuickScheduleForm(f => ({ ...f, scheduledAt: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Location / Pitch</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Field 1, Training Ground"
                value={quickScheduleForm.location}
                onChange={e => setQuickScheduleForm(f => ({ ...f, location: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="flex-center gap-xs text-sm" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={quickScheduleForm.locked}
                  onChange={e => setQuickScheduleForm(f => ({ ...f, locked: e.target.checked }))}
                />
                <Lock size={13} /> Lock this session instance against future plan edits
              </label>
            </div>

            <div className="form-actions mt-md">
              <button className="btn btn-outline" onClick={() => setQuickSchedulePlan(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ background: DESIGN_TOKENS.sessionBlue, borderColor: DESIGN_TOKENS.sessionBlue }}
                onClick={handleQuickSchedule}
                disabled={isScheduling}
              >
                <CalendarDays size={15} /> {isScheduling ? 'Scheduling...' : 'Confirm & Schedule'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Main TrainingCenter Component ────────────────────────────────────────────
export default function TrainingCenter() {
  const { selectedClubId } = useClub();
  const { user } = useAuth();

  // Top-level tab: 'library' | 'plans'
  const [mainTab, setMainTab] = useState('library');

  // Library state
  const [drills, setDrills] = useState([]);
  const [loadingDrills, setLoadingDrills] = useState(true);
  const [activeLibTab, setActiveLibTab] = useState('all'); // all, videos, docs
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedDrills, setSelectedDrills] = useState([]); // Array of drill objects for bulk selection
  const [showUpload, setShowUpload] = useState(false);
  const [editingDrill, setEditingDrill] = useState(null);
  const [viewingDrill, setViewingDrill] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [drillForm, setDrillForm] = useState({
    title: '', category: 'Warm-Up', type: 'Youtube',
    youtubeUrl: '', fileUrl: '', description: '', duration: '10'
  });

  // Plans state
  const [plans, setPlans] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [teams, setTeams] = useState([]);
  const [planView, setPlanView] = useState('list'); // 'list' | 'builder'
  const [editingPlan, setEditingPlan] = useState(null);
  const [pendingDrillsForBuilder, setPendingDrillsForBuilder] = useState([]);

  // Load club drills, plans, sessions, and teams
  useEffect(() => {
    if (!selectedClubId) {
      setLoadingDrills(false);
      setLoadingPlans(false);
      return;
    }

    setLoadingDrills(true);
    const unsubDrills = trainingService.subscribeToDrills(selectedClubId, (data) => {
      setDrills(data);
      setLoadingDrills(false);
    });

    setLoadingPlans(true);
    const unsubPlans = trainingService.subscribePlans(selectedClubId, (data) => {
      setPlans(data);
      setLoadingPlans(false);
    });

    const unsubSessions = trainingService.subscribeSessions(selectedClubId, setSessions);

    // Fetch teams
    getDocs(query(collection(db, 'clubs', selectedClubId, 'teams'), orderBy('name'))).then(snap => {
      if (!snap.empty) {
        setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        // Fallback to groups if teams collection is empty
        getDocs(query(collection(db, 'clubs', selectedClubId, 'groups'), orderBy('name'))).then(gSnap => {
          setTeams(gSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
      }
    }).catch(() => {
      getDocs(collection(db, 'clubs', selectedClubId, 'groups')).then(gSnap => {
        setTeams(gSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }).catch(() => setTeams([]));
    });

    return () => {
      unsubDrills?.();
      unsubPlans?.();
      unsubSessions?.();
    };
  }, [selectedClubId]);

  // Library Handlers
  const openAddDrillModal = () => {
    setEditingDrill(null);
    setDrillForm({
      title: '', category: 'Warm-Up', type: 'Youtube',
      youtubeUrl: '', fileUrl: '', description: '', duration: '10'
    });
    setShowUpload(true);
  };

  const openEditDrillModal = (drill, e) => {
    if (e) e.stopPropagation();
    setEditingDrill(drill);
    setDrillForm({
      title: drill.title || '',
      category: drill.category || 'Warm-Up',
      type: drill.type || (drill.youtubeUrl ? 'Youtube' : 'Video'),
      youtubeUrl: drill.youtubeUrl || '',
      fileUrl: drill.fileUrl || '',
      description: drill.description || '',
      duration: String(drill.durationMins || drill.duration || '10')
    });
    setViewingDrill(null);
    setShowUpload(true);
  };

  const handleDeleteDrill = async (drill, e) => {
    if (e) e.stopPropagation();
    const usageCount = await trainingService.getDrillPlanUsageCount(selectedClubId, drill.id);
    const confirmMsg = usageCount > 0
      ? `"${drill.title}" is used in ${usageCount} plan(s). It will be soft-deleted and hidden from future plan creation, but existing plans will preserve it. Proceed?`
      : `Are you sure you want to delete "${drill.title}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await trainingService.deleteContent(selectedClubId, drill.id);
      if (viewingDrill?.id === drill.id) setViewingDrill(null);
      setSelectedDrills(prev => prev.filter(d => d.id !== drill.id));
    } catch (err) {
      alert('Error deleting drill: ' + err.message);
    }
  };

  const handleSaveDrill = async (e) => {
    e.preventDefault();
    if (!drillForm.title.trim()) {
      alert('Content title is required.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        title: drillForm.title.trim(),
        category: drillForm.category,
        type: drillForm.type,
        youtubeUrl: drillForm.youtubeUrl.trim(),
        fileUrl: drillForm.fileUrl.trim(),
        description: drillForm.description.trim(),
        duration: drillForm.duration || '10:00',
        durationMins: parseDurationToMins(drillForm.duration) || 10
      };

      if (editingDrill) {
        await trainingService.updateContent(selectedClubId, editingDrill.id, payload);
      } else {
        await trainingService.addContent(selectedClubId, payload);
      }
      setShowUpload(false);
      setEditingDrill(null);
    } catch (err) {
      alert('Failed to save drill: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Multi-select toggle
  const toggleSelectDrill = (drill) => {
    setSelectedDrills(prev => {
      const exists = prev.some(d => d.id === drill.id);
      if (exists) return prev.filter(d => d.id !== drill.id);
      return [...prev, drill];
    });
  };

  // Add single drill to Plan Builder
  const handleAddSingleToPlan = (drill) => {
    setPendingDrillsForBuilder([drill]);
    setEditingPlan(null);
    setMainTab('plans');
    setPlanView('builder');
  };

  // Add multiple selected drills to Plan Builder
  const handleAddSelectedToPlan = () => {
    if (selectedDrills.length === 0) return;
    setPendingDrillsForBuilder(selectedDrills);
    setSelectedDrills([]);
    setEditingPlan(null);
    setMainTab('plans');
    setPlanView('builder');
  };

  // Plans Handlers
  const handleDeletePlan = async (plan) => {
    if (!window.confirm(`Delete plan "${plan.title}"? Sessions referencing this plan will remain.`)) return;
    try {
      await trainingService.deletePlan(selectedClubId, plan.id);
    } catch (err) {
      alert('Error deleting plan: ' + err.message);
    }
  };

  const handleDuplicatePlan = async (plan) => {
    try {
      await trainingService.duplicatePlan(selectedClubId, plan);
      alert(`"${plan.title}" duplicated as a new draft plan.`);
    } catch (err) {
      alert('Error duplicating plan: ' + err.message);
    }
  };

  const handleDeleteSession = async (session) => {
    if (!window.confirm('Cancel this scheduled training session?')) return;
    try {
      await trainingService.deleteSession(selectedClubId, session.id);
    } catch (err) {
      alert('Error canceling session: ' + err.message);
    }
  };

  // Filtered drills for the Library tab
  const filteredDrills = useMemo(() => {
    return filterContent(drills, {
      query: search,
      category: activeCategory,
      type: activeLibTab
    });
  }, [drills, search, activeCategory, activeLibTab]);

  return (
    <div className="dashboard-container">
      {/* Top Page Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1>Training Center</h1>
          <p className="text-muted text-sm">
            Drill library · Training plan builder · Session scheduler
          </p>
        </div>

        <div className="flex gap-sm">
          {mainTab === 'library' && (
            <>
              <button
                className="btn btn-outline"
                onClick={() => trainingService.subscribeToDrills(selectedClubId, setDrills)}
                title="Refresh library"
              >
                <RefreshCw size={16} />
              </button>
              <button
                className="btn btn-primary"
                onClick={openAddDrillModal}
                style={{ background: DESIGN_TOKENS.primaryTeal, borderColor: DESIGN_TOKENS.primaryTeal }}
              >
                <Plus size={16} /> Add Training Content
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Mode Tabs */}
      <div
        className="table-toolbar"
        style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', margin: '16px 0 24px' }}
      >
        <div className="flex gap-md">
          <button
            className={`tab ${mainTab === 'library' ? 'active' : ''}`}
            onClick={() => setMainTab('library')}
          >
            <Library size={14} style={{ marginRight: 6 }} />
            Drill Library ({drills.length})
          </button>

          <button
            className={`tab ${mainTab === 'plans' ? 'active' : ''}`}
            onClick={() => {
              setMainTab('plans');
              if (planView === 'builder' && !editingPlan && pendingDrillsForBuilder.length === 0) {
                setPlanView('list');
              }
            }}
          >
            <ClipboardList size={14} style={{ marginRight: 6 }} />
            Training Plans ({plans.length})
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          LIBRARY TAB (Grid + Tabs + Search + Multi-Select + Bulk Bar)
         ══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'library' && (
        <>
          {/* Sub Tabs: All / Videos & Drills / Documents + Search */}
          <div
            className="table-toolbar"
            style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', marginBottom: 14 }}
          >
            <div className="flex gap-md flex-wrap">
              <button
                className={`tab ${activeLibTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveLibTab('all')}
              >
                All Content ({drills.length})
              </button>
              <button
                className={`tab ${activeLibTab === 'videos' ? 'active' : ''}`}
                onClick={() => setActiveLibTab('videos')}
              >
                Videos & Drills ({drills.filter(d => d.type === 'Video' || d.type === 'Youtube' || !!d.youtubeUrl).length})
              </button>
              <button
                className={`tab ${activeLibTab === 'docs' ? 'active' : ''}`}
                onClick={() => setActiveLibTab('docs')}
              >
                Documents ({drills.filter(d => d.type === 'Document').length})
              </button>
            </div>

            <div className="search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search by title, description or category..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Category Chips Filter */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
            {['all', ...CONTENT_CATEGORIES].map(cat => (
              <button
                key={cat}
                type="button"
                className={`tab ${activeCategory === cat.toLowerCase() ? 'active' : ''}`}
                style={{ fontSize: 11, padding: '4px 12px', borderRadius: 999 }}
                onClick={() => setActiveCategory(cat === 'all' ? 'all' : cat.toLowerCase())}
              >
                {cat === 'all' ? 'All Categories' : cat}
              </button>
            ))}
          </div>

          {/* Drills Grid */}
          {loadingDrills ? (
            <div className="flex-center justify-center" style={{ minHeight: 300 }}>
              <RefreshCw className="animate-spin text-primary" size={32} />
            </div>
          ) : (
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
              {filteredDrills.map(drill => {
                const isSelected = selectedDrills.some(d => d.id === drill.id);
                return (
                  <LibraryCard
                    key={drill.id}
                    drill={drill}
                    onView={d => setViewingDrill(d)}
                    onEdit={d => openEditDrillModal(d)}
                    onDelete={d => handleDeleteDrill(d)}
                    onAddToPlan={d => handleAddSingleToPlan(d)}
                    selected={isSelected}
                    onToggleSelect={toggleSelectDrill}
                    isMultiSelectMode={selectedDrills.length > 0}
                  />
                );
              })}

              {filteredDrills.length === 0 && (
                <div className="card" style={{ padding: '60px 20px', textAlign: 'center', gridColumn: '1/-1' }}>
                  <Library size={48} style={{ opacity: 0.25, margin: '0 auto 12px', display: 'block' }} />
                  <h3>No Training Content Found</h3>
                  <p className="text-muted" style={{ maxWidth: 380, margin: '0 auto 16px' }}>
                    {search ? `No drills matching "${search}"` : 'Add drills and tactical guides to build your club library.'}
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={openAddDrillModal}
                    style={{ background: DESIGN_TOKENS.primaryTeal, borderColor: DESIGN_TOKENS.primaryTeal }}
                  >
                    <Plus size={15} /> Add First Drill
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Sticky Bulk Selection Bar (Section 8: Bulk Selection Bar) */}
          {selectedDrills.length > 0 && (
            <div
              style={{
                position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                background: '#0F172A', color: '#fff', padding: '12px 24px',
                borderRadius: 999, display: 'flex', alignItems: 'center', gap: 18,
                boxShadow: '0 8px 30px rgba(0,0,0,0.35)', zIndex: 900
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                {selectedDrills.length} drill{selectedDrills.length !== 1 ? 's' : ''} selected
              </span>

              <button
                className="btn btn-primary"
                style={{
                  background: DESIGN_TOKENS.primaryTeal, borderColor: DESIGN_TOKENS.primaryTeal,
                  padding: '6px 16px', fontSize: 13
                }}
                onClick={handleAddSelectedToPlan}
              >
                <PlusCircle size={15} /> Add Selected to Plan
              </button>

              <button
                type="button"
                onClick={() => setSelectedDrills([])}
                style={{
                  background: 'none', border: 'none', color: '#94A3B8',
                  cursor: 'pointer', fontSize: 12, padding: '4px'
                }}
              >
                Clear
              </button>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PLANS TAB (List View vs Plan Builder)
         ══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'plans' && (
        <>
          {planView === 'list' && (
            <PlansList
              plans={plans}
              drills={drills}
              sessions={sessions}
              teams={teams}
              clubId={selectedClubId}
              user={user}
              onEdit={plan => {
                setEditingPlan(plan);
                setPendingDrillsForBuilder([]);
                setPlanView('builder');
              }}
              onDelete={handleDeletePlan}
              onDuplicate={handleDuplicatePlan}
              onCreateNew={() => {
                setEditingPlan(null);
                setPendingDrillsForBuilder([]);
                setPlanView('builder');
              }}
              onDeleteSession={handleDeleteSession}
            />
          )}

          {planView === 'builder' && (
            <PlanBuilder
              drills={drills}
              teams={teams}
              clubId={selectedClubId}
              user={user}
              editingPlan={editingPlan}
              initialSelectedDrills={pendingDrillsForBuilder}
              onBack={() => {
                setPlanView('list');
                setEditingPlan(null);
                setPendingDrillsForBuilder([]);
              }}
              onSaved={() => {
                setPlanView('list');
                setEditingPlan(null);
                setPendingDrillsForBuilder([]);
              }}
            />
          )}
        </>
      )}

      {/* ── Drill Viewer Modal ── */}
      <Modal
        title={viewingDrill?.title || 'Training Content'}
        open={!!viewingDrill}
        onClose={() => setViewingDrill(null)}
        wide={true}
      >
        {viewingDrill && (
          <div>
            <div className="flex justify-between items-center mb-md flex-wrap gap-sm">
              <div className="flex gap-sm items-center flex-wrap">
                <span className="badge badge-info" style={{ textTransform: 'uppercase', fontWeight: 700 }}>
                  {viewingDrill.category || 'Warm-Up'}
                </span>
                <span className="badge badge-default">{viewingDrill.type || 'Drill'}</span>
                <span className="badge badge-default flex-center gap-xs">
                  <Clock size={11} /> {viewingDrill.durationMins || parseDurationToMins(viewingDrill.duration) || 10} min
                </span>
              </div>

              <div className="flex gap-sm">
                <button className="btn btn-outline" onClick={e => openEditDrillModal(viewingDrill, e)}>
                  <Edit2 size={14} /> Edit
                </button>
                <button className="btn btn-outline danger" onClick={e => handleDeleteDrill(viewingDrill, e)}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>

            {/* Video / Content Player Container */}
            <div style={{ background: '#0F172A', borderRadius: 12, overflow: 'hidden', marginBottom: 18 }}>
              {getYoutubeId(viewingDrill.youtubeUrl) ? (
                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${getYoutubeId(viewingDrill.youtubeUrl)}?rel=0`}
                    title={viewingDrill.title}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                    allowFullScreen
                  />
                </div>
              ) : viewingDrill.fileUrl && (viewingDrill.fileUrl.endsWith('.mp4') || viewingDrill.type === 'Video') ? (
                <video controls src={viewingDrill.fileUrl} style={{ width: '100%', maxHeight: 440, display: 'block' }} />
              ) : (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#fff' }}>
                  <FileText size={56} style={{ margin: '0 auto 12px', opacity: 0.7 }} />
                  <h4>{viewingDrill.title}</h4>
                  {(viewingDrill.fileUrl || viewingDrill.youtubeUrl) && (
                    <a
                      href={viewingDrill.fileUrl || viewingDrill.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary mt-sm"
                    >
                      <Download size={14} /> Open Document / Link
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Tactical Notes Card */}
            <div className="card" style={{ background: 'var(--bg)', padding: '14px 16px' }}>
              <h5 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700 }}>Description & Tactical Notes</h5>
              <p style={{ margin: 0, lineHeight: 1.6, whiteSpace: 'pre-line', fontSize: 13 }}>
                {viewingDrill.description || 'No description provided.'}
              </p>
            </div>

            <div className="form-actions mt-lg">
              <button
                className="btn btn-primary"
                style={{ background: DESIGN_TOKENS.primaryTeal, borderColor: DESIGN_TOKENS.primaryTeal }}
                onClick={() => {
                  const d = viewingDrill;
                  setViewingDrill(null);
                  handleAddSingleToPlan(d);
                }}
              >
                <PlusCircle size={14} /> Add to New Plan
              </button>
              <button className="btn btn-outline" onClick={() => setViewingDrill(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Add / Edit Drill Content Modal ── */}
      <Modal
        title={editingDrill ? 'Edit Training Content' : 'Add Training Content'}
        open={showUpload}
        onClose={() => setShowUpload(false)}
        wide={true}
      >
        <form onSubmit={handleSaveDrill}>
          <div className="form-group">
            <label>Content Title <span className="text-danger">*</span></label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. 1v1 Attacking & Overlap Drill"
              value={drillForm.title}
              onChange={e => setDrillForm({ ...drillForm, title: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Category</label>
              <select
                className="form-control"
                value={drillForm.category}
                onChange={e => setDrillForm({ ...drillForm, category: e.target.value })}
              >
                {CONTENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label>Content Type</label>
              <select
                className="form-control"
                value={drillForm.type}
                onChange={e => setDrillForm({ ...drillForm, type: e.target.value })}
              >
                <option value="Youtube">YouTube Video</option>
                <option value="Video">Video File (MP4)</option>
                <option value="Document">Document / PDF Guide</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label>Duration (mins)</label>
              <input
                type="number"
                className="form-control"
                placeholder="10"
                min={1} max={180}
                value={drillForm.duration}
                onChange={e => setDrillForm({ ...drillForm, duration: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>YouTube URL {drillForm.type === 'Youtube' ? <span className="text-danger">*</span> : '(Optional)'}</label>
            <input
              type="url"
              className="form-control"
              placeholder="https://www.youtube.com/watch?v=..."
              value={drillForm.youtubeUrl}
              onChange={e => setDrillForm({ ...drillForm, youtubeUrl: e.target.value })}
              required={drillForm.type === 'Youtube'}
            />
            {drillForm.youtubeUrl && getYoutubeId(drillForm.youtubeUrl) && (
              <p className="text-xs mt-xs" style={{ color: DESIGN_TOKENS.successGreen }}>
                ✓ Valid YouTube Video ID: <strong>{getYoutubeId(drillForm.youtubeUrl)}</strong>
              </p>
            )}
          </div>

          <div className="form-group">
            <label>Document / Media File URL (Optional)</label>
            <input
              type="text"
              className="form-control"
              placeholder="https://.../guide.pdf or direct media link"
              value={drillForm.fileUrl}
              onChange={e => setDrillForm({ ...drillForm, fileUrl: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Description & Tactical Notes</label>
            <textarea
              rows={4}
              className="form-control"
              placeholder="Setup, field dimensions, equipment, tactical coaching points, progression rules..."
              value={drillForm.description}
              onChange={e => setDrillForm({ ...drillForm, description: e.target.value })}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={() => setShowUpload(false)}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
              style={{ background: DESIGN_TOKENS.primaryTeal, borderColor: DESIGN_TOKENS.primaryTeal }}
            >
              {isSaving ? 'Saving...' : editingDrill ? 'Save Changes' : 'Save to Library'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
