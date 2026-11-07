import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import { Bell, RefreshCw, Search, CheckCircle } from 'lucide-react';

/**
 * Member-facing view of club announcements.
 * Shows notifications broadcast to "all" or directly addressed to this member.
 */
export default function UserNotifications() {
  const { selectedClubId, selectedClub } = useClub();
  const { user } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [readIds, setReadIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('readNotifications') || '[]'); } catch { return []; }
  });

  const fetchNotifications = async () => {
    if (!selectedClubId) { setLoading(false); return; }
    setLoading(true);
    try {
      const col = collection(db, 'clubs', selectedClubId, 'notifications');
      let snap;
      try {
        snap = await getDocs(query(col, orderBy('createdAt', 'desc')));
      } catch {
        snap = await getDocs(col);
      }
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, [selectedClubId]);

  // Only broadcasts + those addressed to me
  const myNotifications = useMemo(() => {
    return notifications.filter(n => {
      const recipient = n.recipientId || 'all';
      return recipient === 'all' || recipient === user?.uid;
    });
  }, [notifications, user]);

  const filtered = myNotifications.filter(n =>
    n.title?.toLowerCase().includes(search.toLowerCase()) ||
    n.message?.toLowerCase().includes(search.toLowerCase())
  );

  const markRead = (id) => {
    if (readIds.includes(id)) return;
    const next = [...readIds, id];
    setReadIds(next);
    localStorage.setItem('readNotifications', JSON.stringify(next));
  };

  const markAllRead = () => {
    const next = [...new Set([...readIds, ...filtered.map(n => n.id)])];
    setReadIds(next);
    localStorage.setItem('readNotifications', JSON.stringify(next));
  };

  const unreadCount = filtered.filter(n => !readIds.includes(n.id)).length;

  const formatDate = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h1>Notifications</h1>
          <p className="subtitle">Announcements and updates from {selectedClub?.name}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {unreadCount > 0 && (
            <button className="btn btn-outline" onClick={markAllRead}>
              <CheckCircle size={16} /> <span>Mark all read</span>
            </button>
          )}
          <button className="btn btn-outline" onClick={fetchNotifications}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="search-box" style={{ marginBottom: '18px', background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '8px', height: '44px' }}>
        <Search size={16} color="var(--text-secondary)" />
        <input
          placeholder="Search notifications..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ border: 'none', outline: 'none', flex: 1, fontSize: '14px', background: 'transparent' }}
        />
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>Loading notifications...</p>
      ) : filtered.length === 0 ? (
        <div className="card shadow-sm" style={{ padding: '60px 20px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: '16px', background: '#fff' }}>
          <Bell size={36} color="var(--text-lighter)" style={{ marginBottom: '10px' }} />
          <h4 style={{ margin: 0, color: 'var(--text)' }}>No notifications</h4>
          <p className="text-muted" style={{ marginTop: '4px', fontSize: '13px' }}>You're all caught up.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map(n => {
            const isRead = readIds.includes(n.id);
            return (
              <div
                key={n.id}
                onClick={() => markRead(n.id)}
                className="card shadow-sm"
                style={{
                  border: '1px solid var(--border)',
                  borderLeft: isRead ? '1px solid var(--border)' : '4px solid var(--primary)',
                  borderRadius: '14px',
                  background: isRead ? '#fff' : 'rgba(16, 185, 129, 0.04)',
                  padding: '16px 18px',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                      background: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Bell size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{n.title}</h4>
                        {!isRead && <span className="badge badge-success" style={{ fontSize: '9px', padding: '2px 7px' }}>NEW</span>}
                      </div>
                      <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.message}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-lighter)', whiteSpace: 'nowrap' }}>{formatDate(n.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
