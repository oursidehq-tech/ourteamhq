import React, { useState, useEffect } from 'react';
import { 
  Library, 
  Video, 
  FileText, 
  Plus, 
  Search, 
  Folder, 
  Youtube, 
  RefreshCw, 
  Trash2, 
  Globe, 
  Edit2, 
  Play, 
  ExternalLink, 
  Clock, 
  Eye, 
  Download, 
  CheckCircle 
} from 'lucide-react';
import { useClub } from '../context/ClubContext';
import { trainingService } from '../services/trainingService';
import FileUpload from '../components/FileUpload';
import Modal from '../components/Modal';

const CATEGORIES = [
  'Warm-Up',
  'Tactics',
  'Technique',
  'Physical',
  'Psychological',
  'Goal Keeping',
  'Set Pieces',
  'General'
];

const TrainingCenter = () => {
  const { selectedClubId } = useClub();
  const [showUpload, setShowUpload] = useState(false);
  const [editingDrill, setEditingDrill] = useState(null); // drill object or null
  const [viewingDrill, setViewingDrill] = useState(null); // drill object or null
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [drills, setDrills] = useState([]);
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Form state for add / edit
  const [form, setForm] = useState({
    title: '',
    category: 'Warm-Up',
    type: 'Youtube',
    youtubeUrl: '',
    fileUrl: '',
    description: '',
    duration: '10:00'
  });

  useEffect(() => {
    if (selectedClubId) {
      loadDrills();
    }
  }, [selectedClubId]);

  const loadDrills = async () => {
    setLoading(true);
    try {
      const data = await trainingService.getDrills(selectedClubId);
      setDrills(data);
    } catch (error) {
      console.error('Error loading drills:', error);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingDrill(null);
    setForm({
      title: '',
      category: 'Warm-Up',
      type: 'Youtube',
      youtubeUrl: '',
      fileUrl: '',
      description: '',
      duration: '10:00'
    });
    setShowUpload(true);
  };

  const openEditModal = (drill, e) => {
    if (e) e.stopPropagation();
    setEditingDrill(drill);
    setForm({
      title: drill.title || '',
      category: drill.category || 'Warm-Up',
      type: drill.type || (drill.youtubeUrl ? 'Youtube' : 'Video'),
      youtubeUrl: drill.youtubeUrl || '',
      fileUrl: drill.fileUrl || '',
      description: drill.description || '',
      duration: drill.duration || '10:00'
    });
    setViewingDrill(null);
    setShowUpload(true);
  };

  const handleDelete = async (drill, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${drill.title}"?`)) return;
    try {
      await trainingService.deleteContent(selectedClubId, drill.id);
      if (viewingDrill?.id === drill.id) setViewingDrill(null);
      await loadDrills();
    } catch (error) {
      alert('Error deleting drill: ' + error.message);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedClubId) {
      alert('Please select a club first.');
      return;
    }
    if (!form.title.trim()) {
      alert('Content title is required.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        category: form.category,
        type: form.type,
        youtubeUrl: form.youtubeUrl.trim(),
        fileUrl: form.fileUrl.trim(),
        description: form.description.trim(),
        duration: form.duration || '10:00',
      };

      if (editingDrill) {
        await trainingService.updateContent(selectedClubId, editingDrill.id, payload);
        alert('Training content updated successfully!');
      } else {
        await trainingService.addContent(selectedClubId, payload);
        alert('Training content added to library!');
      }

      setShowUpload(false);
      setEditingDrill(null);
      loadDrills();
    } catch (error) {
      console.error('Error saving content:', error);
      alert('Failed to save content: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const filteredDrills = drills.filter(d => {
    const matchesSearch = (d.title || '').toLowerCase().includes(search.toLowerCase()) ||
                          (d.category || '').toLowerCase().includes(search.toLowerCase()) ||
                          (d.description || '').toLowerCase().includes(search.toLowerCase());
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'videos') return matchesSearch && (d.type === 'Video' || d.type === 'Youtube' || !!d.youtubeUrl);
    if (activeTab === 'docs') return matchesSearch && d.type === 'Document';
    return matchesSearch;
  });

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1>Training & Drill Library</h1>
          <p>Upload videos, YouTube drills, and technical documents for your players and coaches.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={loadDrills}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={18} />
            <span>Add Training Content</span>
          </button>
        </div>
      </div>

      <div className="table-toolbar" style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', marginBottom: '24px' }}>
        <div className="flex gap-md">
          <button 
            className={`tab ${activeTab === 'all' ? 'active' : ''}`} 
            onClick={() => setActiveTab('all')}
          >
            All Content ({drills.length})
          </button>
          <button 
            className={`tab ${activeTab === 'videos' ? 'active' : ''}`} 
            onClick={() => setActiveTab('videos')}
          >
            Videos & Drills ({drills.filter(d => d.type === 'Video' || d.type === 'Youtube' || d.youtubeUrl).length})
          </button>
          <button 
            className={`tab ${activeTab === 'docs' ? 'active' : ''}`} 
            onClick={() => setActiveTab('docs')}
          >
            Documents ({drills.filter(d => d.type === 'Document').length})
          </button>
        </div>
        <div className="search-box">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Search library..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
      </div>

      {loading ? (
        <div className="flex-center justify-center py-xl" style={{ minHeight: '300px' }}>
          <RefreshCw className="animate-spin text-primary" size={32} />
        </div>
      ) : (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {filteredDrills.map(drill => {
            const ytId = getYoutubeId(drill.youtubeUrl);
            const isDoc = drill.type === 'Document';

            return (
              <div 
                key={drill.id} 
                className="card" 
                style={{ 
                  padding: '0', 
                  overflow: 'hidden', 
                  border: '1px solid var(--border)', 
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
                onClick={() => setViewingDrill(drill)}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                {/* Thumbnail Header */}
                <div style={{ height: '180px', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', position: 'relative' }}>
                  {ytId ? (
                    <img 
                      src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} 
                      alt={drill.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }}
                    />
                  ) : isDoc ? (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
                      <FileText size={56} style={{ margin: '0 auto 8px', display: 'block' }} />
                      <span style={{ fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>PDF Document</span>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
                      <Video size={56} style={{ margin: '0 auto 8px', display: 'block' }} />
                      <span style={{ fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>Video Drill</span>
                    </div>
                  )}

                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
                    {ytId ? (
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,0,0,0.9)', display: 'grid', placeItems: 'center' }}>
                        <Play size={24} color="#fff" style={{ marginLeft: '3px' }} />
                      </div>
                    ) : isDoc ? (
                      <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center' }}>
                        <FileText size={22} color="#fff" />
                      </div>
                    ) : (
                      <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center' }}>
                        <Play size={22} color="#fff" style={{ marginLeft: '2px' }} />
                      </div>
                    )}
                  </div>

                  {/* Duration / Tag badge */}
                  <span className="badge badge-default" style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.75)', color: '#fff', border: 'none', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {isDoc ? 'Doc' : <><Clock size={11} /> {drill.duration || 'Video'}</>}
                  </span>

                  <span className="badge badge-info" style={{ position: 'absolute', top: '10px', left: '10px', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>
                    {drill.category || 'Warm-Up'}
                  </span>
                </div>

                {/* Card Body */}
                <div style={{ padding: '16px' }}>
                  <div className="flex justify-between items-start">
                    <div style={{ flex: 1, paddingRight: '8px' }}>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600, lineHeight: 1.3 }}>
                        {drill.title}
                      </h4>
                      {drill.description && (
                        <p className="text-muted text-xs" style={{ margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {drill.description}
                        </p>
                      )}
                    </div>
                    {/* Action buttons */}
                    <div className="flex gap-xs" onClick={e => e.stopPropagation()}>
                      <button 
                        className="btn-icon" 
                        onClick={(e) => openEditModal(drill, e)} 
                        title="Edit Drill"
                        style={{ color: 'var(--text)' }}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button 
                        className="btn-icon danger" 
                        onClick={(e) => handleDelete(drill, e)} 
                        title="Delete Drill"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-center justify-between mt-md pt-sm text-muted text-xs" style={{ borderTop: '1px solid var(--border)' }}>
                    <span className="flex-center gap-xs">
                      <Eye size={13} /> Click to View / Play
                    </span>
                    <span className="flex-center gap-xs">
                      <Folder size={13} /> {drill.type || 'Drill'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredDrills.length === 0 && (
            <div className="col-span-full py-xl text-center card" style={{ padding: '60px 20px' }}>
              <Library size={48} className="text-muted mb-md opacity-30" style={{ margin: '0 auto 16px' }} />
              <h3>No Training Content Found</h3>
              <p className="text-muted" style={{ maxWidth: '400px', margin: '0 auto 16px' }}>
                {search ? `No drills matching "${search}"` : 'Your library is empty. Click "Add Training Content" to create video drills and documents.'}
              </p>
              <button className="btn btn-primary" onClick={openAddModal}>
                <Plus size={16} /> Add First Drill
              </button>
            </div>
          )}
        </div>
      )}

      {/* View / Media Player Modal */}
      <Modal 
        title={viewingDrill?.title || 'Training Content'} 
        open={!!viewingDrill} 
        onClose={() => setViewingDrill(null)}
        wide={true}
      >
        {viewingDrill && (
          <div>
            {/* Header info */}
            <div className="flex justify-between items-center mb-md">
              <div className="flex gap-sm items-center">
                <span className="badge badge-info" style={{ textTransform: 'uppercase', fontWeight: 700 }}>
                  {viewingDrill.category || 'Warm-Up'}
                </span>
                <span className="badge badge-default">
                  {viewingDrill.type || 'Drill'}
                </span>
                {viewingDrill.duration && (
                  <span className="badge badge-default" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} /> {viewingDrill.duration}
                  </span>
                )}
              </div>
              <div className="flex gap-sm">
                <button className="btn btn-outline" onClick={(e) => openEditModal(viewingDrill, e)}>
                  <Edit2 size={15} /> Edit
                </button>
                <button className="btn btn-outline danger" onClick={(e) => handleDelete(viewingDrill, e)}>
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            </div>

            {/* Media Player Container */}
            <div style={{ background: '#0F172A', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
              {getYoutubeId(viewingDrill.youtubeUrl) ? (
                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
                  <iframe 
                    src={`https://www.youtube.com/embed/${getYoutubeId(viewingDrill.youtubeUrl)}?autoplay=0&rel=0`} 
                    title={viewingDrill.title} 
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen 
                  />
                </div>
              ) : viewingDrill.fileUrl && (viewingDrill.fileUrl.endsWith('.mp4') || viewingDrill.type === 'Video') ? (
                <video 
                  controls 
                  src={viewingDrill.fileUrl} 
                  style={{ width: '100%', maxHeight: '420px', display: 'block' }} 
                />
              ) : (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#fff' }}>
                  <FileText size={64} style={{ margin: '0 auto 16px', opacity: 0.8 }} />
                  <h4>{viewingDrill.title}</h4>
                  <p className="text-muted" style={{ maxWidth: '400px', margin: '0 auto 20px', color: '#94a3b8' }}>
                    {viewingDrill.type === 'Document' ? 'PDF Tactical Documentation' : 'Training Resource'}
                  </p>
                  {(viewingDrill.fileUrl || viewingDrill.youtubeUrl) && (
                    <a 
                      href={viewingDrill.fileUrl || viewingDrill.youtubeUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn btn-primary"
                    >
                      <Download size={16} /> Open Document / Link
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Description & Coaching Points */}
            <div className="card" style={{ background: 'var(--bg)', padding: '16px' }}>
              <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Description & Coaching Notes</h5>
              <p style={{ margin: 0, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                {viewingDrill.description || 'No description provided for this drill.'}
              </p>
            </div>

            <div className="form-actions mt-lg">
              <button className="btn btn-primary" onClick={() => setViewingDrill(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add / Edit Training Content Modal */}
      <Modal 
        title={editingDrill ? "Edit Training Content" : "Add Training Content"} 
        open={showUpload} 
        onClose={() => setShowUpload(false)}
        wide={true}
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Content Title <span className="text-danger">*</span></label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. 4 Pass - Block, Face, Double X Y" 
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required 
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select 
                className="form-control"
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Content Type</label>
              <select 
                className="form-control"
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
              >
                <option value="Youtube">YouTube Drill Video</option>
                <option value="Video">Video File (MP4/WebM)</option>
                <option value="Document">Document / PDF Guide</option>
              </select>
            </div>

            <div className="form-group">
              <label>Duration / Length</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="e.g. 15 mins or 4:30" 
                value={form.duration}
                onChange={e => setForm({ ...form, duration: e.target.value })}
              />
            </div>
          </div>
          
          {/* YouTube Link Field */}
          <div className="form-group">
            <label>YouTube URL {form.type === 'Youtube' ? <span className="text-danger">*</span> : '(Optional)'}</label>
            <div className="flex gap-sm">
              <Youtube size={22} className="text-danger mt-sm" />
              <input 
                type="url" 
                className="form-control" 
                placeholder="https://www.youtube.com/watch?v=..." 
                value={form.youtubeUrl}
                onChange={e => setForm({ ...form, youtubeUrl: e.target.value })}
                required={form.type === 'Youtube'}
              />
            </div>
            {form.youtubeUrl && getYoutubeId(form.youtubeUrl) && (
              <p className="text-xs text-success mt-xs">
                ✓ Valid YouTube Video ID: <strong>{getYoutubeId(form.youtubeUrl)}</strong>
              </p>
            )}
          </div>

          {/* File or External Link URL */}
          <div className="form-group">
            <label>Document / Media File URL (Optional)</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="https://.../tactical_guide.pdf or storage link" 
              value={form.fileUrl}
              onChange={e => setForm({ ...form, fileUrl: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Description & Tactical Notes</label>
            <textarea 
              rows={4}
              className="form-control" 
              placeholder="Explain setup, key coaching points, equipment needed, and tactical variations..."
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={() => setShowUpload(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving Content...' : editingDrill ? 'Save Changes' : 'Save to Library'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TrainingCenter;
