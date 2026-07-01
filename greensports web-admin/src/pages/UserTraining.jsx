import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import { Library, Video, FileText, Search, Folder, Youtube, Globe, BookOpen } from 'lucide-react';
import Modal from '../components/Modal';

export default function UserTraining() {
  const { selectedClubId, selectedClub } = useClub();
  const { user } = useAuth();
  
  const [drills, setDrills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedDrill, setSelectedDrill] = useState(null);

  const fetchDrills = async () => {
    if (!selectedClubId) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'clubs', selectedClubId, 'drills'));
      setDrills(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching drills:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDrills();
  }, [selectedClubId]);

  const filteredDrills = useMemo(() => {
    return drills.filter(d => {
      const titleMatch = d.title?.toLowerCase().includes(search.toLowerCase()) || d.description?.toLowerCase().includes(search.toLowerCase());
      if (!titleMatch) return false;
      if (activeTab === 'all') return true;
      if (activeTab === 'videos') return d.type === 'Video' || d.youtubeUrl;
      if (activeTab === 'docs') return d.type === 'Document';
      return true;
    });
  }, [drills, search, activeTab]);

  const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleViewDrill = async (drill) => {
    setSelectedDrill(drill);
    try {
      // Increment views count in Firestore (non-blocking)
      const drillRef = doc(db, 'clubs', selectedClubId, 'drills', drill.id);
      await updateDoc(drillRef, { views: increment(1) });
      setDrills(prev => prev.map(d => d.id === drill.id ? { ...d, views: (d.views || 0) + 1 } : d));
    } catch (e) {
      console.warn('Views increment failed:', e);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1>Training Hub & Drill Library</h1>
          <p className="subtitle">Improve your skills with tactical guides, video tutorials, and drills shared by {selectedClub?.name} coaches</p>
        </div>
      </div>

      {/* Toolbar Filter */}
      <div className="table-toolbar" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border)', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setActiveTab('all')}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'all' ? 'var(--primary-light)' : 'transparent',
              color: activeTab === 'all' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >All Tactics</button>
          <button 
            onClick={() => setActiveTab('videos')}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'videos' ? 'var(--primary-light)' : 'transparent',
              color: activeTab === 'videos' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >Videos & YouTube</button>
          <button 
            onClick={() => setActiveTab('docs')}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'docs' ? 'var(--primary-light)' : 'transparent',
              color: activeTab === 'docs' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >Technical Guides</button>
        </div>
        
        <div className="search-box" style={{ margin: 0, width: '280px' }}>
          <Search size={16} />
          <input 
            placeholder="Search tactical library..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            style={{ borderRadius: '10px' }}
          />
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>Loading library...</p>
      ) : filteredDrills.length === 0 ? (
        <div className="card text-center" style={{ padding: '60px 20px', border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px' }}>
          <Library size={40} style={{ color: 'var(--text-lighter)', marginBottom: '16px' }} />
          <h3 style={{ margin: 0, color: 'var(--text)' }}>No Guides Found</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
            Try adjusting your search query or check back later!
          </p>
        </div>
      ) : (
        <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {filteredDrills.map(drill => {
            const ytId = getYoutubeId(drill.youtubeUrl);
            return (
              <div 
                key={drill.id} 
                className="card shadow-sm" 
                style={{ 
                  padding: '0', 
                  overflow: 'hidden', 
                  border: '1px solid var(--border)', 
                  background: '#ffffff', 
                  borderRadius: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column'
                }}
                onClick={() => handleViewDrill(drill)}
              >
                {/* Media banner */}
                <div style={{ height: '170px', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', position: 'relative' }}>
                  {drill.youtubeUrl && ytId ? (
                    <img 
                      src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} 
                      alt="YouTube Thumbnail"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }}
                    />
                  ) : null}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.1)' }}>
                    {drill.youtubeUrl ? <Youtube size={44} color="#FF0000" /> : drill.type === 'Video' ? <Video size={40} opacity={0.6} /> : <FileText size={40} opacity={0.6} />}
                  </div>
                  <span className="badge" style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', fontSize: '9px', fontWeight: 700 }}>
                    {drill.youtubeUrl ? 'YOUTUBE' : (drill.duration || 'GUIDE')}
                  </span>
                </div>

                {/* Details */}
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{drill.category || 'General'}</span>
                    <h4 style={{ margin: '4px 0 8px 0', fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>{drill.title}</h4>
                    {drill.description && (
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {drill.description}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light, #f1f5f9)', marginTop: '12px', paddingTop: '10px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <BookOpen size={12} /> {drill.views || 0} studies
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Folder size={12} /> {drill.type || 'Library'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Drill detail modal */}
      <Modal open={!!selectedDrill} onClose={() => setSelectedDrill(null)} title={selectedDrill?.category || 'Training Guide'}>
        {selectedDrill && (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--text)' }}>
              {selectedDrill.title}
            </h2>

            {selectedDrill.youtubeUrl ? (
              <div style={{ width: '100%', height: '280px', borderRadius: '12px', overflow: 'hidden', background: '#000', marginBottom: '16px' }}>
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${getYoutubeId(selectedDrill.youtubeUrl)}`}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
            ) : null}

            {selectedDrill.description && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text)' }}>Instructions & Notes</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {selectedDrill.description}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', paddingTop: '16px', marginBottom: '20px' }}>
              <span>Category: <strong>{selectedDrill.category || 'General'}</strong></span>
              <span>•</span>
              <span>Format: <strong>{selectedDrill.type || 'Library'}</strong></span>
              <span>•</span>
              <span>Total studies: <strong>{selectedDrill.views || 0} views</strong></span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              {selectedDrill.youtubeUrl && (
                <button 
                  className="btn btn-primary" 
                  onClick={() => window.open(selectedDrill.youtubeUrl, '_blank')}
                  style={{ marginRight: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Globe size={14} /> Open in YouTube
                </button>
              )}
              <button className="btn btn-outline" onClick={() => setSelectedDrill(null)}>
                Close Hub
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
