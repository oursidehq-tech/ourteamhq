import React, { useState, useEffect } from 'react';
import { 
  collection, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { 
  ListChecks, Plus, Copy, Archive, Check, GripVertical, Trash2, 
  AlertCircle, Shield, RefreshCw 
} from 'lucide-react';
import { DESIGN_TOKENS } from '../services/trainingService';

const DEFAULT_TEMPLATES = [
  {
    id: 'tpl-registration-day',
    name: 'Registration Day',
    description: 'Tasks for preseason registration',
    type: 'Registration',
    tasks: [
      { id: 't1', step: 1, title: 'Book venue', description: 'Confirm date and hall booking' },
      { id: 't2', step: 2, title: 'Set up online registration', description: 'Open form and fee setup' },
      { id: 't3', step: 3, title: 'Organise volunteers', description: 'Roster helpers for the day' },
      { id: 't4', step: 4, title: 'Prepare player packs', description: 'Shirts, info sheets, forms' },
      { id: 't5', step: 5, title: 'Confirm first aid cover', description: 'Book qualified first aider' }
    ]
  },
  {
    id: 'tpl-presentation-day',
    name: 'Presentation Day',
    description: 'End of season awards & presentation day logistics',
    type: 'Presentation',
    tasks: [
      { id: 'tp1', step: 1, title: 'Order trophies and awards', description: 'Finalise recipient list and order engraving' },
      { id: 'tp2', step: 2, title: 'Book presentation hall', description: 'Confirm AV setup, projector and seating' },
      { id: 'tp3', step: 3, title: 'Arrange catering & refreshments', description: 'Book food trucks or volunteer canteen prep' },
      { id: 'tp4', step: 4, title: 'Print program and certificates', description: 'Collate team photo booklets and speeches' }
    ]
  },
  {
    id: 'tpl-working-bee',
    name: 'Working Bee',
    description: 'Facility cleanup, grounds maintenance and safety setup',
    type: 'Working Bee',
    tasks: [
      { id: 'tw1', step: 1, title: 'Inspect playing surfaces & goal posts', description: 'Check turf condition and net fixings' },
      { id: 'tw2', step: 2, title: 'Clubhouse and shed cleanup', description: 'Organise training gear, cones and match balls' },
      { id: 'tw3', step: 3, title: 'Line marking machine check', description: 'Test paint spray and measure field markings' },
      { id: 'tw4', step: 4, title: 'Restock first aid supplies', description: 'Audit ice packs, tape and medical supplies' }
    ]
  }
];

export default function EventChecklists() {
  const { selectedClubId, selectedClub } = useClub();
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [selectedId, setSelectedId] = useState('tpl-registration-day');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Current active template form
  const [formData, setFormData] = useState({
    name: 'Registration Day',
    description: 'Tasks for preseason registration',
    type: 'Registration',
    tasks: DEFAULT_TEMPLATES[0].tasks
  });

  const loadTemplates = async () => {
    if (!selectedClubId) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'clubs', selectedClubId, 'checklistTemplates'));
      if (!snap.empty) {
        const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setTemplates(loaded);
        if (!loaded.some(t => t.id === selectedId)) {
          setSelectedId(loaded[0].id);
        }
      } else {
        setTemplates(DEFAULT_TEMPLATES);
      }
    } catch (err) {
      console.warn('Could not load checklist templates from db, using defaults:', err);
      setTemplates(DEFAULT_TEMPLATES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [selectedClubId]);

  // Sync form when selectedId changes
  useEffect(() => {
    const cur = templates.find(t => t.id === selectedId) || templates[0];
    if (cur) {
      setFormData({
        name: cur.name || '',
        description: cur.description || '',
        type: cur.type || 'Registration',
        tasks: Array.isArray(cur.tasks) ? JSON.parse(JSON.stringify(cur.tasks)) : []
      });
    }
  }, [selectedId, templates]);

  const handleTaskChange = (index, field, value) => {
    const nextTasks = [...formData.tasks];
    nextTasks[index] = { ...nextTasks[index], [field]: value };
    setFormData({ ...formData, tasks: nextTasks });
  };

  const handleAddTask = () => {
    const nextStep = formData.tasks.length + 1;
    const newTask = {
      id: `task-${Date.now()}`,
      step: nextStep,
      title: 'New checklist task',
      description: 'Task details or instructions'
    };
    setFormData({ ...formData, tasks: [...formData.tasks, newTask] });
  };

  const handleDeleteTask = (index) => {
    const nextTasks = formData.tasks.filter((_, idx) => idx !== index).map((t, idx) => ({
      ...t,
      step: idx + 1
    }));
    setFormData({ ...formData, tasks: nextTasks });
  };

  const handleCreateTemplate = () => {
    const newId = `tpl-${Date.now()}`;
    const newTemplate = {
      id: newId,
      name: 'New Event Checklist',
      description: 'Checklist tasks for event',
      type: 'General',
      tasks: [
        { id: `t1`, step: 1, title: 'Initial setup', description: 'Confirm event requirements' }
      ]
    };
    setTemplates(prev => [newTemplate, ...prev]);
    setSelectedId(newId);
  };

  const handleDuplicateTemplate = () => {
    const newId = `tpl-copy-${Date.now()}`;
    const duplicated = {
      ...formData,
      id: newId,
      name: `${formData.name} (Copy)`
    };
    setTemplates(prev => [...prev, duplicated]);
    setSelectedId(newId);
    alert('Template duplicated!');
  };

  const handleArchiveTemplate = async () => {
    if (!window.confirm(`Archive "${formData.name}"?`)) return;
    try {
      if (selectedClubId) {
        await deleteDoc(doc(db, 'clubs', selectedClubId, 'checklistTemplates', selectedId)).catch(() => {});
      }
      const remaining = templates.filter(t => t.id !== selectedId);
      setTemplates(remaining.length > 0 ? remaining : DEFAULT_TEMPLATES);
      if (remaining.length > 0) {
        setSelectedId(remaining[0].id);
      }
      alert('Template archived.');
    } catch (e) {
      alert('Error archiving: ' + e.message);
    }
  };

  const handleSaveTemplate = async () => {
    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim() || 'Untitled Checklist',
        description: formData.description.trim() || '',
        type: formData.type || 'General',
        tasks: formData.tasks,
        updatedAt: serverTimestamp()
      };

      if (selectedClubId) {
        await setDoc(doc(db, 'clubs', selectedClubId, 'checklistTemplates', selectedId), payload, { merge: true });
      }

      setTemplates(prev => prev.map(t => (t.id === selectedId ? { ...t, ...payload } : t)));
      alert('Template saved successfully!');
    } catch (err) {
      alert('Error saving template: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '24px', fontFamily: 'Arial, sans-serif' }}>
      
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>
            Checklist Templates
          </h1>
        </div>

        <button
          onClick={handleCreateTemplate}
          style={{
            background: DESIGN_TOKENS.primaryTeal,
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '10px',
            padding: '9px 18px',
            fontWeight: 700,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          <Plus size={16} /> Create Template
        </button>
      </div>

      {!selectedClubId ? (
        <div className="card text-center" style={{ padding: '60px 20px', border: '1px solid #E2E8F0', background: '#ffffff', borderRadius: '16px' }}>
          <Shield size={44} style={{ color: DESIGN_TOKENS.primaryTeal, marginBottom: '16px', opacity: 0.8 }} />
          <h3 style={{ margin: 0, color: '#0F172A' }}>No Club Selected</h3>
          <p style={{ color: '#64748B', fontSize: '14px', marginTop: '8px', maxWidth: '460px', marginInline: 'auto' }}>
            Please select a club from the top-right context switcher.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Left Column: List of Checklist Templates */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {templates.map(tpl => {
              const isSelected = tpl.id === selectedId;
              return (
                <button
                  key={tpl.id}
                  onClick={() => setSelectedId(tpl.id)}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: isSelected ? `2px solid ${DESIGN_TOKENS.primaryTeal}` : '1px solid #E2E8F0',
                    background: isSelected ? '#F0FDF4' : '#FFFFFF',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 1px 3px rgba(13,148,136,0.15)' : 'none'
                  }}
                >
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '4px',
                    backgroundColor: isSelected ? DESIGN_TOKENS.primaryTeal : '#F1F5F9',
                    color: isSelected ? '#FFFFFF' : '#94A3B8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {isSelected ? <Check size={14} strokeWidth={3} /> : <div style={{ width: '8px', height: '8px', border: '1px solid #CBD5E1', borderRadius: '2px' }} />}
                  </div>
                  <span style={{ fontWeight: isSelected ? 700 : 600, fontSize: '14px', color: isSelected ? DESIGN_TOKENS.primaryTeal : '#0F172A' }}>
                    {tpl.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Main Column: Template Editor Card */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            
            {/* Template Name */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Name
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Registration Day"
                style={{ fontSize: '14px', fontWeight: 600 }}
              />
            </div>

            {/* Template Description */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Description
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g. Tasks for preseason registration"
                style={{ fontSize: '13px' }}
              />
            </div>

            {/* Template Type Pill */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Type
              </label>
              <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  background: '#0D9488',
                  color: '#FFFFFF',
                  padding: '4px 12px',
                  borderRadius: '6px'
                }}>
                  {formData.type || 'Registration'}
                </span>
              </div>
            </div>

            {/* Info notice */}
            <div style={{
              background: '#F0F9FF',
              border: '1px solid #BAE6FD',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '12px',
              color: '#0369A1',
              fontWeight: 500,
              marginBottom: '20px'
            }}>
              Reusable tasks only. Assign people after applying to an event.
            </div>

            {/* Tasks Table */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
                Tasks
              </label>

              <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
                {formData.tasks.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                    No tasks added yet. Click "+ Add task" below.
                  </div>
                ) : (
                  formData.tasks.map((task, idx) => (
                    <div
                      key={task.id || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        borderBottom: idx === formData.tasks.length - 1 ? 'none' : '1px solid #F1F5F9',
                        background: '#FFFFFF'
                      }}
                    >
                      <div style={{ color: '#94A3B8', cursor: 'grab', fontSize: '12px', letterSpacing: '2px', display: 'flex', alignItems: 'center' }}>
                        ••••••
                      </div>
                      
                      <div style={{ width: '24px', fontSize: '13px', fontWeight: 700, color: '#64748B' }}>
                        {task.step || idx + 1}
                      </div>

                      <div style={{ flex: 1, minWidth: '160px' }}>
                        <input
                          type="text"
                          value={task.title}
                          onChange={e => handleTaskChange(idx, 'title', e.target.value)}
                          placeholder="Task title"
                          style={{
                            width: '100%',
                            border: '1px solid transparent',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '13px',
                            fontWeight: 700,
                            color: '#0F172A',
                            background: '#F8FAFC'
                          }}
                        />
                      </div>

                      <div style={{ flex: 1.5, minWidth: '220px' }}>
                        <input
                          type="text"
                          value={task.description}
                          onChange={e => handleTaskChange(idx, 'description', e.target.value)}
                          placeholder="Task details or notes"
                          style={{
                            width: '100%',
                            border: '1px solid transparent',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '12px',
                            color: '#475569',
                            background: '#F8FAFC'
                          }}
                        />
                      </div>

                      <button
                        onClick={() => handleDeleteTask(idx)}
                        style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
                        title="Delete task"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={handleAddTask}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '8px 0',
                  marginTop: '8px',
                  color: DESIGN_TOKENS.primaryTeal,
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                + Add task
              </button>
            </div>

            <p style={{ margin: '0 0 20px 0', fontSize: '12px', color: '#64748B', fontStyle: 'italic' }}>
              Editing a template does not change existing event checklists.
            </p>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <button
                onClick={handleSaveTemplate}
                disabled={saving}
                style={{
                  background: DESIGN_TOKENS.primaryTeal,
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 24px',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {saving ? 'Saving...' : 'Save Template'}
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleDuplicateTemplate}
                  className="btn btn-outline"
                  style={{ borderRadius: '10px', fontSize: '13px', padding: '9px 16px' }}
                >
                  Duplicate
                </button>
                <button
                  onClick={handleArchiveTemplate}
                  className="btn btn-outline"
                  style={{ borderRadius: '10px', fontSize: '13px', padding: '9px 16px', color: '#64748B' }}
                >
                  Archive
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
