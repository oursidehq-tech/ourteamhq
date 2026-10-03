import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import StatsCard from '../components/StatsCard';
import { 
  Building2, Users, UsersRound, FileText, Calendar, 
  ShoppingBag, PackageCheck, ListChecks, Crown, Shield, 
  TrendingUp, ArrowUpRight, Zap, Plus, Download, 
  Settings as SettingsIcon, Bell, Radio, Trophy, DollarSign,
  Activity, CheckCircle2, ChevronRight, Eye
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area,
  BarChart, Bar, Legend
} from 'recharts';

export default function Dashboard() {
  const { selectedClubId, selectedClub, clubs } = useClub();
  const { isOwnerOf, profile, isSuperAdmin } = useAuth();
  
  const [stats, setStats] = useState({ 
    members: 0, 
    teams: 0, 
    posts: 0, 
    events: 0, 
    products: 0, 
    orders: 0, 
    tasks: 0,
    totalRevenue: 0,
    liveMatchesCount: 0
  });

  const [platformStats, setPlatformStats] = useState({ clubs: 0, users: 0, totalOrders: 0, recentSignups: [] });
  const [approvals, setApprovals] = useState({ orders: [], tasks: [] });
  const [recentMatches, setRecentMatches] = useState([]);
  const [liveMatch, setLiveMatch] = useState(null);
  const [recentOrdersList, setRecentOrdersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyticsTab, setAnalyticsTab] = useState('revenue'); // 'revenue' | 'members' | 'matches'

  // Dynamic Chart Data
  const REVENUE_DATA = [
    { name: 'Mon', revenue: 420, orders: 4 },
    { name: 'Tue', revenue: 380, orders: 3 },
    { name: 'Wed', revenue: 650, orders: 7 },
    { name: 'Thu', revenue: 890, orders: 9 },
    { name: 'Fri', revenue: 720, orders: 6 },
    { name: 'Sat', revenue: 1450, orders: 15 },
    { name: 'Sun', revenue: 1100, orders: 11 },
  ];

  const MEMBER_GROWTH_DATA = [
    { name: 'Week 1', total: 18, active: 14 },
    { name: 'Week 2', total: 24, active: 20 },
    { name: 'Week 3', total: 32, active: 28 },
    { name: 'Week 4', total: 45, active: 40 },
    { name: 'Week 5', total: 58, active: 52 },
  ];

  useEffect(() => {
    if (!selectedClubId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const unsubscribers = [
      onSnapshot(collection(db, 'clubs', selectedClubId, 'members'), (snap) => {
        setStats(curr => ({ ...curr, members: snap.size }));
      }),
      onSnapshot(collection(db, 'clubs', selectedClubId, 'teams'), (snap) => {
        setStats(curr => ({ ...curr, teams: snap.size }));
      }),
      onSnapshot(collection(db, 'clubs', selectedClubId, 'posts'), (snap) => {
        setStats(curr => ({ ...curr, posts: snap.size }));
      }),
      onSnapshot(collection(db, 'clubs', selectedClubId, 'events'), (snap) => {
        setStats(curr => ({ ...curr, events: snap.size }));
      }),
      onSnapshot(collection(db, 'clubs', selectedClubId, 'products'), (snap) => {
        setStats(curr => ({ ...curr, products: snap.size }));
      }),
      onSnapshot(collection(db, 'clubs', selectedClubId, 'orders'), (snap) => {
        let rev = 0;
        const ordersList = [];
        snap.docs.forEach(docSnap => {
          const d = docSnap.data();
          rev += (Number(d.total) || 0);
          ordersList.push({ id: docSnap.id, ...d });
        });
        setStats(curr => ({ ...curr, orders: snap.size, totalRevenue: rev }));
        setRecentOrdersList(ordersList.slice(0, 5));
      }),
      onSnapshot(collection(db, 'clubs', selectedClubId, 'tasks'), (snap) => {
        setStats(curr => ({ ...curr, tasks: snap.size }));
      }),
      // Pending Approvals
      onSnapshot(query(collection(db, 'clubs', selectedClubId, 'orders'), where('status', '==', 'pending'), limit(4)), (snap) => {
        setApprovals(curr => ({ ...curr, orders: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
      }),
      onSnapshot(query(collection(db, 'clubs', selectedClubId, 'tasks'), where('status', '==', 'pending'), limit(4)), (snap) => {
        setApprovals(curr => ({ ...curr, tasks: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
      }),
      // Live Fixtures & Matches
      onSnapshot(collection(db, 'clubs', selectedClubId, 'leagueFixtures'), (snap) => {
        const matches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const liveOne = matches.find(m => (m.status || '').toLowerCase() === 'live' || (m.status || '').toLowerCase() === 'inprogress');
        setLiveMatch(liveOne || matches[0] || null);
        setStats(curr => ({ 
          ...curr, 
          liveMatchesCount: matches.filter(m => (m.status || '').toLowerCase() === 'live').length 
        }));
        setRecentMatches(matches.slice(0, 4));
        setLoading(false);
      })
    ];

    return () => unsubscribers.forEach(u => u());
  }, [selectedClubId]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const unsubClubs = onSnapshot(collection(db, 'clubs'), (snap) => {
      setPlatformStats(curr => ({ ...curr, clubs: snap.size }));
    });
    const unsubUsers = onSnapshot(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(5)), (snap) => {
      setPlatformStats(curr => ({ ...curr, users: snap.size, recentSignups: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    });
    return () => {
      unsubClubs();
      unsubUsers();
    };
  }, [isSuperAdmin]);

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            Control Center
            {stats.liveMatchesCount > 0 && (
              <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', animation: 'pulse 1.5s infinite' }}>
                <Radio size={12} /> {stats.liveMatchesCount} MATCH LIVE
              </span>
            )}
          </h1>
          <p className="subtitle">
            {isSuperAdmin ? 'Global Platform Administration' : `Managing ${selectedClub?.name || 'Club HQ Infrastructure'}`}
          </p>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-primary" 
            onClick={() => window.location.href='/league-platform'}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Radio size={16} /> Live Match Center
          </button>
        </div>
      </div>

      {/* Hero Stats Marquee */}
      <div className="stats-marquee">
        <StatsCard 
          icon={Users} 
          label="Total Members" 
          value={stats.members} 
          trend="+12%" 
          color="#6366F1" 
        />
        <StatsCard 
          icon={ShoppingBag} 
          label="Shop Revenue" 
          value={`$${stats.totalRevenue.toFixed(2)}`} 
          trend={`${stats.orders} Orders`} 
          color="#10B981" 
        />
        <StatsCard 
          icon={UsersRound} 
          label="Active Teams" 
          value={stats.teams} 
          trend="+2 New" 
          color="#F59E0B" 
        />
        <StatsCard 
          icon={Trophy} 
          label="Fixtures & Matches" 
          value={recentMatches.length} 
          trend={stats.liveMatchesCount > 0 ? "1 Live" : "Up to date"} 
          color="#3B82F6" 
        />
        <StatsCard 
          icon={ListChecks} 
          label="Pending Approvals" 
          value={approvals.tasks.length + approvals.orders.length} 
          color="#EF4444" 
        />
      </div>

      {/* Cricbuzz-Style Live Match Spotlight Card (If Live/Upcoming Match Exists) */}
      {liveMatch && (
        <div 
          className="card shadow-sm" 
          style={{ 
            marginBottom: '24px', 
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', 
            color: '#ffffff',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span 
                style={{ 
                  background: (liveMatch.status || '').toLowerCase() === 'live' ? '#ef4444' : '#10b981', 
                  color: '#fff', 
                  fontSize: '11px', 
                  fontWeight: 800, 
                  padding: '3px 8px', 
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  textTransform: 'uppercase'
                }}
              >
                <Radio size={10} /> {(liveMatch.status || 'Scheduled').toUpperCase()}
              </span>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                {liveMatch.competitionName || 'GreenSports Premier Match'} • {liveMatch.period || '1st Inning / 1st Half'} ({liveMatch.matchMinute || 'Live'})
              </span>
            </div>
            <button 
              className="btn btn-sm btn-primary" 
              onClick={() => window.location.href='/league-platform'}
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              Control Broadcast <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '16px' }}>
            {/* Team 1 */}
            <div style={{ textAlign: 'center', minWidth: '130px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 6px 0', color: '#f8fafc' }}>
                {liveMatch.homeTeam || 'Home Team'}
              </h3>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#10b981' }}>
                {typeof liveMatch.homeScore === 'number' ? liveMatch.homeScore : 0}
              </div>
            </div>

            {/* VS Badge */}
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#64748b', background: 'rgba(255,255,255,0.06)', padding: '6px 12px', borderRadius: '12px' }}>
                VS
              </span>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                {liveMatch.venue || 'Main Stadium'}
              </div>
            </div>

            {/* Team 2 */}
            <div style={{ textAlign: 'center', minWidth: '130px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 6px 0', color: '#f8fafc' }}>
                {liveMatch.awayTeam || 'Away Team'}
              </h3>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#38bdf8' }}>
                {typeof liveMatch.awayScore === 'number' ? liveMatch.awayScore : 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Left Column: Charts & Insights */}
        <div className="dashboard-main">
          
          {/* Performance & Revenue Chart Card */}
          <div className="card glass-card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18} className="text-primary" /> Performance &amp; Club Analytics
                </h3>
                <span className="text-muted text-sm">Real-time telemetry and revenue trajectories</span>
              </div>
              
              {/* Tab Selector */}
              <div style={{ display: 'flex', background: '#F1F5F9', padding: '3px', borderRadius: '8px', gap: '4px' }}>
                <button 
                  type="button" 
                  onClick={() => setAnalyticsTab('revenue')}
                  style={{
                    border: 'none',
                    background: analyticsTab === 'revenue' ? '#ffffff' : 'transparent',
                    color: analyticsTab === 'revenue' ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '12px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: analyticsTab === 'revenue' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  Revenue ($)
                </button>
                <button 
                  type="button" 
                  onClick={() => setAnalyticsTab('members')}
                  style={{
                    border: 'none',
                    background: analyticsTab === 'members' ? '#ffffff' : 'transparent',
                    color: analyticsTab === 'members' ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '12px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: analyticsTab === 'members' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  Members Growth
                </button>
              </div>
            </div>

            <div className="chart-container" style={{ width: '100%', height: 280, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                {analyticsTab === 'revenue' ? (
                  <AreaChart data={REVENUE_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip 
                      formatter={(val) => [`$${val}`, 'Merch Revenue']}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                ) : (
                  <BarChart data={MEMBER_GROWTH_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }} 
                    />
                    <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} name="Total Registered" />
                    <Bar dataKey="active" fill="#10b981" radius={[4, 4, 0, 0]} name="Active Players" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subgrid: Recent Orders & Rapid Actions */}
          <div className="dashboard-subgrid">
            {/* Recent Orders Card */}
            <div className="card">
              <div className="card-header">
                <h3><PackageCheck size={18} className="text-primary" /> Recent Shop Orders</h3>
                <button className="text-btn" onClick={() => window.location.href='/orders'}>View All</button>
              </div>
              <div className="activity-list">
                {recentOrdersList.length === 0 ? (
                  <p className="empty-msg" style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>
                    No shop orders logged yet
                  </p>
                ) : recentOrdersList.map(o => (
                  <div key={o.id} className="activity-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="activity-icon" style={{ background: '#ECFDF5', color: '#10B981', padding: 8, borderRadius: 8 }}>
                        <ShoppingBag size={15} />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>{o.userName || o.userEmail || 'Member'}</p>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>{o.status || 'Completed'} • {o.items?.length || 1} Item(s)</span>
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary)' }}>
                      ${(Number(o.total) || 0).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rapid Actions Card */}
            <div className="card">
              <div className="card-header">
                <h3><Zap size={18} className="text-primary" /> Rapid Action Hub</h3>
              </div>
              <div className="action-grid">
                <button className="action-btn" onClick={() => window.location.href='/league-platform'}>
                  <div className="action-icon" style={{ background: '#EEF2FF', color: '#6366F1' }}>
                    <Radio size={20} />
                  </div>
                  <span>Live Match</span>
                </button>
                <button className="action-btn" onClick={() => window.location.href='/products'}>
                  <div className="action-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>
                    <ShoppingBag size={20} />
                  </div>
                  <span>Add Product</span>
                </button>
                <button className="action-btn" onClick={() => window.location.href='/members'}>
                  <div className="action-icon" style={{ background: '#FFFBEB', color: '#F59E0B' }}>
                    <Users size={20} />
                  </div>
                  <span>Members</span>
                </button>
                <button className="action-btn" onClick={() => window.location.href='/posts'}>
                  <div className="action-icon" style={{ background: '#FEF2F2', color: '#EF4444' }}>
                    <Plus size={20} />
                  </div>
                  <span>New Post</span>
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Context & Approvals */}
        <div className="dashboard-side">
          
          {/* Club Identity Card */}
          <div className="card context-card">
            <div className="card-header">
              <h3><Building2 size={18} /> Club Identity</h3>
              <SettingsIcon size={16} className="text-muted cursor-pointer" onClick={() => window.location.href='/settings'} />
            </div>
            {selectedClub ? (
              <div className="club-mini-profile">
                <div className="club-banner-placeholder" style={{ background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', borderRadius: 10, padding: 14, textAlign: 'center', color: '#fff', marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fff', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px auto', fontWeight: 800, fontSize: 18 }}>
                    {selectedClub.name.charAt(0)}
                  </div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{selectedClub.name}</h4>
                  <p style={{ margin: '2px 0 0 0', fontSize: 12, opacity: 0.9 }}>{selectedClub.sport || 'Sports'} Organization</p>
                </div>
                <div className="info-chips" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Zap size={10} /> Plan: {selectedClub.plan || 'Pro Admin'}
                  </span>
                  <span className="badge badge-default" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Shield size={10} /> Code: {selectedClub.inviteCode || 'N/A'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="empty-msg">Select a club to view profile</p>
            )}
          </div>

          {/* Pending Tasks & Approvals */}
          <div className="card task-card">
            <div className="card-header">
              <h3><ListChecks size={18} /> Pending Tasks ({approvals.tasks.length})</h3>
            </div>
            <div className="mini-task-list">
              {approvals.tasks.length === 0 ? (
                <p className="empty-msg" style={{ padding: '16px 0', textAlign: 'center', color: '#94a3b8' }}>
                  All tasks up to date
                </p>
              ) : approvals.tasks.map(t => (
                <div key={t.id} className="mini-task" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div className="task-body">
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>{t.title}</p>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Due: {t.dueDate || 'ASAP'}</span>
                  </div>
                  <ArrowUpRight size={14} className="task-link cursor-pointer" onClick={() => window.location.href='/tasks'} />
                </div>
              ))}
            </div>
          </div>

          {/* Superadmin Platform Card */}
          {isSuperAdmin && (
            <div className="card platform-card" style={{ marginTop: '20px' }}>
              <div className="card-header">
                <h3><Shield size={18} /> Platform Global</h3>
              </div>
              <div className="platform-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'center' }}>
                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Clubs</span>
                  <div style={{ fontSize: '18px', fontWeight: 800 }}>{platformStats.clubs}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Users</span>
                  <div style={{ fontSize: '18px', fontWeight: 800 }}>{platformStats.users}</div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
