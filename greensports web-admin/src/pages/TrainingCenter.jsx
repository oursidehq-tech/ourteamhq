import React, { useState, useEffect } from 'react';
import { Library, Video, FileText, Plus, Search, Folder, MoreVertical, Youtube, RefreshCw, Trash2, Globe } from 'lucide-react';
import { useClub } from '../context/ClubContext';
import { trainingService } from '../services/trainingService';
import FileUpload from '../components/FileUpload';
import Modal from '../components/Modal';

const TrainingCenter = () => {
  const { selectedClubId } = useClub();
  const [showUpload, setShowUpload] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [drills, setDrills] = useState([]);
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedClubId) {
      alert('Please select a club first.');
      return;
    }
    const formData = new FormData(e.target);
    setIsSaving(true);
    
    try {
      const type = formData.get('type');
      const data = {
        title: formData.get('title'),
        category: formData.get('category'),
        type: type,
        youtubeUrl: formData.get('youtubeUrl') || '',
        description: formData.get('description') || '',
        duration: formData.get('duration') || '0:00',
      };
      
      await trainingService.addContent(selectedClubId, data);
      setShowUpload(false);
      loadDrills();
    } catch (error) {
      console.error('Error saving content:', error);
      alert('Failed to save content: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredDrills = drills.filter(d => {
    const matchesSearch = d.title.toLowerCase().includes(search.toLowerCase());
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'videos') return matchesSearch && (d.type === 'Video' || d.youtubeUrl);
    if (activeTab === 'docs') return matchesSearch && d.type === 'Document';
    return matchesSearch;
  });

  const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

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
          <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
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
          >All Content</button>
          <button 
            className={`tab ${activeTab === 'videos' ? 'active' : ''}`} 
            onClick={() => setActiveTab('videos')}
          >Videos & Drills</button>
          <button 
            className={`tab ${activeTab === 'docs' ? 'active' : ''}`} 
            onClick={() => setActiveTab('docs')}
          >Documents</button>
        </div>
        <div className="search-box">
          <Search size={18} />
          <input type="text" placeholder="Search library..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="flex-center justify-center py-xl" style={{ minHeight: '300px' }}>
          <RefreshCw className="animate-spin text-primary" size={32} />
        </div>
      ) : (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {filteredDrills.map(drill => (
            <div key={drill.id} className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{ height: '180px', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', position: 'relative' }}>
                {drill.youtubeUrl ? (
                  <img 
                    src={`https://img.youtube.com/vi/${getYoutubeId(drill.youtubeUrl)}/mqdefault.jpg`} 
                    alt="YouTube Thumbnail"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }}
                  />
                ) : null}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)' }}>
                  {drill.youtubeUrl ? <Youtube size={48} color="#FF0000" /> : drill.type === 'Video' ? <Video size={48} opacity={0.5} /> : <FileText size={48} opacity={0.5} />}
                </div>
                <span className="badge badge-default" style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', fontSize: '10px' }}>
                  {drill.youtubeUrl ? 'YouTube' : drill.duration}
                </span>
              </div>
              <div style={{ padding: '16px' }}>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs" style={{ color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>{drill.category}</span>
                    <h4 style={{ margin: '4px 0', fontSize: '16px', fontWeight: 600 }}>{drill.title}</h4>
                  </div>
                  <div className="flex gap-sm">
                    <button className="btn-icon" onClick={() => window.open(drill.youtubeUrl, '_blank')}><Globe size={14} /></button>
                    <button className="btn-icon danger" onClick={() => trainingService.deleteContent(selectedClubId, drill.id).then(loadDrills)}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="flex-center gap-md mt-md text-muted text-xs">
                  <span className="flex-center gap-sm"><Search size={12} /> {drill.views} views</span>
                  <span className="flex-center gap-sm"><Folder size={12} /> Library</span>
                </div>
              </div>
            </div>
          ))}
          {filteredDrills.length === 0 && (
            <div className="col-span-full py-xl text-center card">
              <Library size={48} className="text-muted mb-md opacity-20" />
              <p className="text-muted">No training content found matching your search.</p>
            </div>
          )}
        </div>
      )}

      <Modal title="Add Training Content" open={showUpload} onClose={() => setShowUpload(false)}>
        <form onSubmit={handleUpload}>
          <div className="form-group">
            <label>Content Title</label>
            <input name="title" type="text" className="form-control" placeholder="e.g. Offensive Passing Patterns" required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select name="category" className="form-control">
                <option>Technique</option>
                <option>Tactics</option>
                <option>Physical</option>
                <option>Psychological</option>
                <option>Goal Keeping</option>
              </select>
            </div>
            <div className="form-group">
              <label>Content Type</label>
              <select name="type" className="form-control">
                <option value="Video">Video File</option>
                <option value="Youtube">YouTube Link</option>
                <option value="Document">Document (PDF)</option>
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label>YouTube URL (Optional)</label>
            <div className="flex gap-sm">
              <Youtube size={20} className="text-danger mt-sm" />
              <input name="youtubeUrl" type="url" className="form-control" placeholder="https://youtube.com/watch?v=..." />
            </div>
          </div>

          <div className="form-group">
            <label>Description / Notes</label>
            <textarea name="description" className="form-control" placeholder="Brief explanation of the drill..."></textarea>
          </div>

          <div className="image-upload-zone mb-md">
            <FileUpload 
              title="Drag & Drop Content" 
              subtitle="Upload local video or PDF files (Max 500MB)" 
              accept="video/*, .pdf, image/*"
              maxSize={500}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={() => setShowUpload(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving Content...' : 'Save to Library'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TrainingCenter;
