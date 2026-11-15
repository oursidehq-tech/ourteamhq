import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import { 
  Bell, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  Clock, 
  Users, 
  AlertTriangle, 
  ClipboardList, 
  ShoppingBag, 
  ArrowRight,
  ChevronDown
} from 'lucide-react';

/**
 * Concept-aligned member notifications view matching Image 8.
 * Groups updates into Today / Yesterday / Earlier with category filters and direct action links.
 */
export default function UserNotifications() {
  const { selectedClubId, selectedClub } = useClub();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all'); // all, unread, compliance, teams, duties, orders
  const [readIds, setReadIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('readNotifications') || '[]'); } catch { return []; }
  });

  const sampleNotifications = useMemo(() => [
    {
      id: 'sample-notif-1',
      type: 'compliance',
      subType: 'approved',
      title: 'Working With Children Check approved',
      message: 'Your WWCC certificate has been verified by the club administrator.',
      timeLabel: 'Today • 2:15 pm',
      groupKey: 'today',
      actionText: 'View requirement',
      actionUrl: '/my-compliance',
      isUnreadDefault: true
    },
    {
      id: 'sample-notif-2',
      type: 'compliance',
      subType: 'expiring',
      title: 'CPR Certificate expiring soon',
      message: 'Your CPR certificate expires on 25 Nov 2026. Please submit an updated copy.',
      timeLabel: 'Today • 9:30 am',
      groupKey: 'today',
      actionText: 'Renew certificate',
      actionUrl: '/my-compliance',
      isUnreadDefault: true
    },
    {
      id: 'sample-notif-3',
      type: 'teams',
      subType: 'training_update',
      title: 'U17 Nev Blair training time updated',
      message: 'Training on Tuesday 9 Feb has been moved to 5:30–6:30 pm at Main Oval.',
      timeLabel: 'Yesterday • 4:10 pm',
      groupKey: 'yesterday',
      actionText: 'View team update',
      actionUrl: '/my-teams?tab=updates',
      isUnreadDefault: false
    },
    {
      id: 'sample-notif-4',
      type: 'compliance',
      subType: 'rejected',
      title: 'First Aid Certificate requires resubmission',
      message: 'Image was blurry and expiry date was not visible. Please re-upload a clear copy.',
      timeLabel: 'Yesterday • 11:00 am',
      groupKey: 'yesterday',
      actionText: 'Resubmit evidence',
      actionUrl: '/my-compliance',
      isUnreadDefault: false
    },
    {
      id: 'sample-notif-5',
      type: 'duties',
      subType: 'duty_assigned',
      title: 'Volunteer duty assigned: Canteen helper',
      message: 'You have been assigned to Canteen helper on Sat 6 Feb, 10:30–11:00 am.',
      timeLabel: 'Yesterday • 8:45 am',
      groupKey: 'yesterday',
      actionText: 'View my duty',
      actionUrl: '/my-teams?tab=duties',
      isUnreadDefault: false
    }
  ], []);

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
      const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(loaded);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, [selectedClubId]);

  // Merge real + mock notifications
  const allItems = useMemo(() => {
    const list = [...notifications];
    
    // Add sample items if they don't collide
    sampleNotifications.forEach(s => {
      if (!list.some(item => item.id === s.id)) {
        list.push(s);
      }
    });

    return list.map(item => {
      const isUnread = !readIds.includes(item.id) && (item.isUnreadDefault || item.status === 'unread' || !item.read);
      return {
        ...item,
        isUnread
      };
    });
  }, [notifications, sampleNotifications, readIds]);

  const filtered = useMemo(() => {
    return allItems.filter(n => {
      // Category filter
      if (activeCategory === 'unread' && !n.isUnread) return false;
      if (activeCategory === 'compliance' && n.type !== 'compliance') return false;
      if (activeCategory === 'teams' && n.type !== 'teams' && n.type !== 'training') return false;
      if (activeCategory === 'duties' && n.type !== 'duties' && n.type !== 'duty') return false;
      if (activeCategory === 'orders' && n.type !== 'orders' && n.type !== 'order') return false;

      // Search filter
      if (search.trim()) {
        const query = search.toLowerCase();
        const title = (n.title || '').toLowerCase();
        const msg = (n.message || '').toLowerCase();
        return title.includes(query) || msg.includes(query);
      }

      return true;
    });
  }, [allItems, activeCategory, search]);

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

  const unreadCount = allItems.filter(n => n.isUnread).length;

  const handleActionClick = (notif) => {
    markRead(notif.id);
    if (notif.actionUrl) {
      navigate(notif.actionUrl);
    }
  };

  // Group by Today, Yesterday, Earlier
  const groupedNotifications = useMemo(() => {
    const groups = {
      Today: [],
      Yesterday: [],
      Earlier: []
    };

    filtered.forEach(item => {
      if (item.groupKey === 'today') {
        groups.Today.push(item);
      } else if (item.groupKey === 'yesterday') {
        groups.Yesterday.push(item);
      } else if (item.createdAt) {
        // dynamically check if date is today or yesterday
        const date = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = date.toDateString() === yesterday.toDateString();

        if (isToday) groups.Today.push(item);
        else if (isYesterday) groups.Yesterday.push(item);
        else groups.Earlier.push(item);
      } else {
        groups.Earlier.push(item);
      }
    });

    return groups;
  }, [filtered]);

  const renderIcon = (n) => {
    if (n.subType === 'approved' || (n.type === 'compliance' && n.title?.includes('approved'))) {
      return (
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
          <CheckCircle2 size={22} />
        </div>
      );
    }
    if (n.subType === 'expiring' || n.title?.includes('expiring')) {
      return (
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
          <Clock size={20} />
        </div>
      );
    }
    if (n.type === 'teams' || n.type === 'training' || n.title?.includes('training') || n.title?.includes('team')) {
      return (
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
          <Users size={20} />
        </div>
      );
    }
    if (n.subType === 'rejected' || n.title?.includes('resubmission') || n.title?.includes('rejected')) {
      return (
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
          <AlertTriangle size={20} />
        </div>
      );
    }
    if (n.type === 'duties' || n.type === 'duty' || n.title?.includes('duty')) {
      return (
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
          <ClipboardList size={20} />
        </div>
      );
    }
    if (n.type === 'orders' || n.type === 'order') {
      return (
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
          <ShoppingBag size={20} />
        </div>
      );
    }
    return (
      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
        <Bell size={20} />
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', padding: '24px 20px', fontFamily: 'Arial, sans-serif' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px 0', fontSize: '26px', fontWeight: 700, color: '#111827' }}>Notifications</h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#4B5563' }}>Your club, team and compliance updates</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {unreadCount > 0 && (
            <button 
              className="btn btn-outline" 
              onClick={markAllRead}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, padding: '7px 14px', borderRadius: '8px' }}
            >
              <span>Mark all as read</span>
              <ChevronDown size={14} />
            </button>
          )}
          <button 
            className="btn btn-outline" 
            onClick={fetchNotifications}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, padding: '7px 14px', borderRadius: '8px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Search Input matching Image 8 */}
      <div style={{
        background: '#fff',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        padding: '0 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        height: '46px',
        marginBottom: '16px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
      }}>
        <Search size={18} color="#9CA3AF" />
        <input 
          type="text"
          placeholder="Search notifications..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ border: 'none', outline: 'none', width: '100%', fontSize: '14px', background: 'transparent', color: '#111827' }}
        />
      </div>

      {/* Filter Pills matching Image 8 */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '28px' }}>
        <button
          onClick={() => setActiveCategory('all')}
          style={{
            padding: '6px 16px',
            borderRadius: '9999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: activeCategory === 'all' ? '#0D9488' : '#F3F4F6',
            color: activeCategory === 'all' ? '#fff' : '#4B5563',
            transition: 'all 0.15s'
          }}
        >
          All
        </button>

        <button
          onClick={() => setActiveCategory('unread')}
          style={{
            padding: '6px 16px',
            borderRadius: '9999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: activeCategory === 'unread' ? '#0D9488' : '#F3F4F6',
            color: activeCategory === 'unread' ? '#fff' : '#4B5563',
            transition: 'all 0.15s'
          }}
        >
          Unread {unreadCount > 0 ? `(${unreadCount})` : ''}
        </button>

        <button
          onClick={() => setActiveCategory('compliance')}
          style={{
            padding: '6px 16px',
            borderRadius: '9999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: activeCategory === 'compliance' ? '#0D9488' : '#F3F4F6',
            color: activeCategory === 'compliance' ? '#fff' : '#4B5563',
            transition: 'all 0.15s'
          }}
        >
          Compliance
        </button>

        <button
          onClick={() => setActiveCategory('teams')}
          style={{
            padding: '6px 16px',
            borderRadius: '9999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: activeCategory === 'teams' ? '#0D9488' : '#F3F4F6',
            color: activeCategory === 'teams' ? '#fff' : '#4B5563',
            transition: 'all 0.15s'
          }}
        >
          Teams
        </button>

        <button
          onClick={() => setActiveCategory('duties')}
          style={{
            padding: '6px 16px',
            borderRadius: '9999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: activeCategory === 'duties' ? '#0D9488' : '#F3F4F6',
            color: activeCategory === 'duties' ? '#fff' : '#4B5563',
            transition: 'all 0.15s'
          }}
        >
          Duties
        </button>

        <button
          onClick={() => setActiveCategory('orders')}
          style={{
            padding: '6px 16px',
            borderRadius: '9999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: activeCategory === 'orders' ? '#0D9488' : '#F3F4F6',
            color: activeCategory === 'orders' ? '#fff' : '#4B5563',
            transition: 'all 0.15s'
          }}
        >
          Orders
        </button>
      </div>

      {/* Notifications List Grouped */}
      {['Today', 'Yesterday', 'Earlier'].map(groupTitle => {
        const items = groupedNotifications[groupTitle];
        if (!items || items.length === 0) return null;

        return (
          <div key={groupTitle} style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#374151', margin: '0 0 12px 4px' }}>
              {groupTitle}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {items.map(notif => {
                return (
                  <div
                    key={notif.id}
                    onClick={() => markRead(notif.id)}
                    style={{
                      background: '#fff',
                      border: '1px solid #E5E7EB',
                      borderRadius: '16px',
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flex: 1 }}>
                      {renderIcon(notif)}

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                            {notif.title}
                          </span>
                          {notif.isUnread && (
                            <span style={{
                              background: '#1F2937',
                              color: '#fff',
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: '4px',
                              letterSpacing: '0.5px'
                            }}>
                              UNREAD
                            </span>
                          )}
                        </div>

                        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#4B5563', lineHeight: 1.5 }}>
                          {notif.message}
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
                            {notif.timeLabel || (notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent')}
                          </span>

                          {notif.actionText && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleActionClick(notif);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'transparent',
                                border: 'none',
                                color: '#0D9488',
                                fontSize: '13px',
                                fontWeight: 600,
                                padding: 0,
                                cursor: 'pointer'
                              }}
                            >
                              <span>{notif.actionText}</span>
                              <ArrowRight size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && !loading && (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E5E7EB', padding: '48px 24px', textAlign: 'center' }}>
          <Bell size={40} color="#D1D5DB" style={{ marginBottom: '12px' }} />
          <h4 style={{ margin: '0 0 6px 0', color: '#111827' }}>No notifications found</h4>
          <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>
            {search ? 'Try clearing your search query.' : 'You have no notifications in this category.'}
          </p>
        </div>
      )}
    </div>
  );
}