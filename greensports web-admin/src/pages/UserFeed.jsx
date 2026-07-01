import { useEffect, useState, useMemo } from 'react';
import { collection, doc, getDocs, setDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, orderBy, query, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import { ThumbsUp, MessageSquare, Send, Calendar, Users, Trophy, Eye, Plus, Trash2, Pin, Sparkles, MapPin, Tag, Activity } from 'lucide-react';
import Modal from '../components/Modal';

export default function UserFeed() {
  const { selectedClubId, selectedClub } = useClub();
  const { profile, user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [matches, setMatches] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [commentText, setCommentText] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Create Post state
  const [newPostContent, setNewPostContent] = useState('');
  const [postVisibility, setPostVisibility] = useState('Club-Only');
  const [postCategory, setPostCategory] = useState('Updates'); // 'Updates', 'Matches', 'Events', 'Network'
  const [linkKey, setLinkKey] = useState('');
  const [teams, setTeams] = useState([]);
  const [groups, setGroups] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const postsCol = () => collection(db, 'clubs', selectedClubId, 'posts');

  const fetchAll = async () => {
    if (!selectedClubId) return;
    try {
      const postsSnap = await getDocs(query(postsCol(), orderBy('createdAt', 'desc')));
      setPosts(postsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      const matchesSnap = await getDocs(collection(db, 'clubs', selectedClubId, 'events'));
      const allMatches = matchesSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(e => e.type === 'game');
      setMatches(allMatches);
    } catch (err) {
      console.error('Feed fetch failed:', err);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [selectedClubId]);

  useEffect(() => {
    if (!selectedClubId) return;
    const fetchLinks = async () => {
      const [tSnap, gSnap] = await Promise.all([
        getDocs(collection(db, 'clubs', selectedClubId, 'teams')),
        getDocs(collection(db, 'clubs', selectedClubId, 'groups'))
      ]);
      setTeams(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setGroups(gSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchLinks();
  }, [selectedClubId]);

  const handleLike = async (post) => {
    if (!user) return;
    const isLiked = post.likes?.includes(user.uid);
    const postRef = doc(db, 'clubs', selectedClubId, 'posts', post.id);
    
    try {
      if (isLiked) {
        await updateDoc(postRef, {
          likes: arrayRemove(user.uid)
        });
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(user.uid)
        });
      }
      fetchAll();
    } catch (err) {
      console.error('Like failed:', err);
    }
  };

  const handleAddComment = async (postId) => {
    const text = commentText[postId]?.trim();
    if (!text || !user) return;

    const postRef = doc(db, 'clubs', selectedClubId, 'posts', postId);
    const commentObj = {
      authorId: user.uid,
      authorName: profile?.displayName || 'User',
      text: text,
      createdAt: Date.now()
    };

    try {
      await updateDoc(postRef, {
        comments: arrayUnion(commentObj)
      });
      setCommentText(prev => ({ ...prev, [postId]: '' }));
      fetchAll();
    } catch (err) {
      console.error('Add comment failed:', err);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await deleteDoc(doc(db, 'clubs', selectedClubId, 'posts', postId));
      fetchAll();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;
    setSubmitting(true);

    try {
      const ref = doc(postsCol());
      const teamId = linkKey.startsWith('team:') ? linkKey.replace('team:', '') : null;
      const groupId = linkKey.startsWith('group:') ? linkKey.replace('group:', '') : null;

      await setDoc(ref, {
        content: newPostContent.trim(),
        visibility: postVisibility,
        category: postCategory,
        type: postCategory.toLowerCase() === 'updates' ? 'update' : 'post',
        authorId: user.uid,
        authorName: profile?.displayName || 'Club Member',
        imageUrl: '',
        teamId: teamId,
        groupId: groupId,
        likes: [],
        comments: [],
        createdAt: serverTimestamp()
      });

      setNewPostContent('');
      setLinkKey('');
      setShowCreateModal(false);
      fetchAll();
    } catch (err) {
      alert('Post creation failed: ' + err.message);
    }
    setSubmitting(false);
  };

  const filteredPosts = useMemo(() => {
    if (activeCategory === 'All') return posts;
    return posts.filter(p => p.category === activeCategory);
  }, [posts, activeCategory]);

  const resolveLink = (post) => {
    if (post.teamId) {
      const team = teams.find(t => t.id === post.teamId);
      return team ? `Team: ${team.name}` : 'Team';
    }
    if (post.groupId) {
      const group = groups.find(g => g.id === post.groupId);
      return group ? `Group: ${group.groupName || group.name}` : 'Group';
    }
    return '';
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      {/* Top Banner */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1>Club Feed</h1>
          <p className="subtitle">Catch up on announcements, match results, and community discussions inside {selectedClub?.name}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} style={{ marginRight: '6px' }} /> Share Update
        </button>
      </div>

      {/* Grid: Left Feed / Right Sidebar (Matches) */}
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* Left Column: Post Stream */}
        <div>
          {/* Feed Filter Categories */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
            {['All', 'Updates', 'Matches', 'Events', 'Network'].map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '12px',
                  border: `1px solid ${activeCategory === cat ? 'var(--primary)' : 'var(--border)'}`,
                  background: activeCategory === cat ? 'var(--primary)' : 'var(--card-bg, #ffffff)',
                  color: activeCategory === cat ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: activeCategory === cat ? '0 4px 12px rgba(16, 139, 81, 0.15)' : 'none'
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Feed Stream */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredPosts.length === 0 ? (
              <div className="card text-center" style={{ padding: '40px', border: '1px solid var(--border)' }}>
                <Activity size={32} style={{ color: 'var(--text-lighter)', marginBottom: '12px' }} />
                <h4 style={{ margin: 0, color: 'var(--text)' }}>No feed items found</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>Be the first to share an update with the club members!</p>
              </div>
            ) : filteredPosts.map(post => {
              const likedByUser = post.likes?.includes(user?.uid);
              const postLink = resolveLink(post);
              return (
                <div key={post.id} className="card shadow-sm" style={{ border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px', padding: '20px' }}>
                  {/* Post Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)',
                        fontWeight: 700
                      }}>
                        {post.authorName?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '14px' }}>
                          {post.authorName}
                          {post.visibility && (
                            <span style={{
                              marginLeft: '8px',
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              background: '#f1f5f9',
                              color: '#64748b',
                              fontWeight: 500
                            }}>
                              {post.visibility}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {post.createdAt?.toDate?.().toLocaleDateString() || 'Just now'}
                          {postLink && ` • ${postLink}`}
                        </div>
                      </div>
                    </div>
                    {/* Delete capability if user is author or has admin capabilities */}
                    {(post.authorId === user?.uid || profile?.accountType === 'owner' || profile?.accountType === 'superadmin') && (
                      <button className="btn-icon danger" onClick={() => handleDeletePost(post.id)}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Post Content */}
                  <p style={{
                    fontSize: '14px',
                    lineHeight: '1.6',
                    color: 'var(--text)',
                    whiteSpace: 'pre-wrap',
                    margin: '0 0 16px 0'
                  }}>
                    {post.content}
                  </p>

                  {/* Post Actions (Likes count & comments toggle) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    borderTop: '1px solid var(--border)',
                    paddingTop: '12px',
                    color: 'var(--text-secondary)'
                  }}>
                    <button
                      onClick={() => handleLike(post)}
                      style={{
                        background: 'none',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: likedByUser ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                    >
                      <ThumbsUp size={16} fill={likedByUser ? 'var(--primary)' : 'none'} />
                      <span>{post.likes?.length || 0} Likes</span>
                    </button>
                    <button
                      onClick={() => setExpandedComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                      style={{
                        background: 'none',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                    >
                      <MessageSquare size={16} />
                      <span>{post.comments?.length || 0} Comments</span>
                    </button>
                  </div>

                  {/* Comments section */}
                  {expandedComments[post.id] && (
                    <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-light, #f1f5f9)', paddingTop: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                        {post.comments && post.comments.map((comment, index) => (
                          <div key={index} style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '12px', fontSize: '13px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{comment.authorName}</span>
                              <span style={{ fontSize: '10px', color: 'var(--text-lighter)' }}>
                                {new Date(comment.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <span style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{comment.text}</span>
                          </div>
                        ))}
                      </div>

                      {/* Comment Input */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Write a comment..."
                          value={commentText[post.id] || ''}
                          onChange={e => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddComment(post.id); }}
                          style={{
                            borderRadius: '10px',
                            fontSize: '13px',
                            padding: '8px 12px'
                          }}
                        />
                        <button className="btn btn-primary" onClick={() => handleAddComment(post.id)} style={{ padding: '8px 12px', borderRadius: '10px' }}>
                          <Send size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Upcoming Matches (Sidebar widget) */}
        <div>
          <div className="card shadow-sm" style={{ border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px', padding: '20px', position: 'sticky', top: '24px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 800, margin: '0 0 16px 0', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <Trophy size={18} color="var(--primary)" /> Match Center
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {matches.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', margin: '16px 0' }}>
                  No upcoming fixtures scheduled.
                </p>
              ) : matches.slice(0, 4).map(match => (
                <div key={match.id} style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-light, #f1f5f9)',
                  background: '#f8fafc'
                }}>
                  <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{match.category || 'Fixture'}</span>
                    <span>{match.date}</span>
                  </div>
                  
                  <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)', margin: '4px 0' }}>
                    {match.teamName || 'Our Team'} vs {match.opponent || 'Opponent'}
                  </div>

                  {match.status === 'Completed' ? (
                    <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                      Result: {match.ourScore} - {match.opponentScore} ({match.status})
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      <MapPin size={10} />
                      <span>{match.location || 'Venue TBA'} • {match.startTime || 'TBA'}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Share Update Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Community Post">
        <form onSubmit={handleCreatePost}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label>Content</label>
            <textarea
              className="form-control"
              rows={4}
              required
              placeholder="What would you like to share with the club today?"
              value={newPostContent}
              onChange={e => setNewPostContent(e.target.value)}
              style={{ borderRadius: '12px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group">
              <label>Category</label>
              <select
                className="form-control"
                value={postCategory}
                onChange={e => setPostCategory(e.target.value)}
                style={{ borderRadius: '10px' }}
              >
                <option value="Updates">Updates</option>
                <option value="Matches">Matches</option>
                <option value="Events">Events</option>
                <option value="Network">Network / Public</option>
              </select>
            </div>

            <div className="form-group">
              <label>Visibility Scope</label>
              <select
                className="form-control"
                value={postVisibility}
                onChange={e => setPostVisibility(e.target.value)}
                style={{ borderRadius: '10px' }}
              >
                <option value="Club-Only">Club-Only (Members)</option>
                <option value="Public">Public (Web & App Discoverable)</option>
                <option value="Network">Network (Connected Clubs)</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label>Link to Team/Group (Optional)</label>
            <select
              className="form-control"
              value={linkKey}
              onChange={e => setLinkKey(e.target.value)}
              style={{ borderRadius: '10px' }}
            >
              <option value="">None / General</option>
              <optgroup label="My Teams">
                {teams.map(team => (
                  <option key={team.id} value={`team:${team.id}`}>{team.name}</option>
                ))}
              </optgroup>
              <optgroup label="My Groups">
                {groups.map(group => (
                  <option key={group.id} value={`group:${group.id}`}>{group.groupName || group.name || group.id}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="form-actions" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Publishing...' : 'Publish Post'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
