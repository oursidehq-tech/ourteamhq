import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import ClubSelector from '../components/ClubSelector';
import StatsCard from '../components/StatsCard';
import { 
  Building2, Users, UsersRound, FileText, Calendar, 
  ShoppingBag, PackageCheck, ListChecks, Crown, Shield, 
  TrendingUp, ArrowUpRight, Zap, Plus, Download, 
  Settings as SettingsIcon, Bell
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area,
  BarChart, Bar
} from 'recharts';

// Mock trend data (real clubs would aggregate this via cloud functions)
const MOCK_TREND = [
  { name: 'Mon', value: 400 },
  { name: 'Tue', value: 300 },
  { name: 'Wed', value: 600 },
  { name: 'Thu', value: 800 },
  { name: 'Fri', value: 500 },
  { name: 'Sat', value: 900 },
  { name: 'Sun', value: 700 },
];

export default function Dashboard() {
  const { selectedClubId, selectedClub, clubs } = useClub();
  const { isOwnerOf, profile, isSuperAdmin } = useAuth();
  const [stats, setStats] = useState({ members: 0, teams: 0, posts: 0, events: 0, products: 0, orders: 0, tasks: 0 });
  const [platformStats, setPlatformStats] = useState({ clubs: 0, users: 0, totalOrders: 0, recentSignups: [] });
  const [approvals, setApprovals] = useState({ orders: [], tasks: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedClubId) return;
    setLoading(true);

    const unsubscribers = [
      onSnapshot(collection(db, 'clubs', selectedClubId, 'members'), (snap) => setStats((current) => ({ ...current, members: snap.size }))),
      onSnapshot(collection(db, 'clubs', selectedClubId, 'teams'), (snap) => setStats((current) => ({ ...current, teams: snap.size }))),
      onSnapshot(collection(db, 'clubs', selectedClubId, 'posts'), (snap) => setStats((current) => ({ ...current, posts: snap.size }))),
      onSnapshot(collection(db, 'clubs', selectedClubId, 'events'), (snap) => setStats((current) => ({ ...current, events: snap.size }))),
      onSnapshot(collection(db, 'clubs', selectedClubId, 'products'), (snap) => setStats((current) => ({ ...current, products: snap.size }))),
      onSnapshot(collection(db, 'clubs', selectedClubId, 'orders'), (snap) => setStats((current) => ({ ...current, orders: snap.size }))),
      onSnapshot(collection(db, 'clubs', selectedClubId, 'tasks'), (snap) => setStats((current) => ({ ...current, tasks: snap.size }))),
      onSnapshot(query(collection(db, 'clubs', selectedClubId, 'orders'), where('status', '==', 'pending'), limit(3)), (snap) => {
        setApprovals((current) => ({ ...current, orders: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        setLoading(false);
      }),
      onSnapshot(query(collection(db, 'clubs', selectedClubId, 'tasks'), where('status', '==', 'pending'), limit(3)), (snap) => {
        setApprovals((current) => ({ ...current, tasks: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        setLoading(false);
      })
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [selectedClubId]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const clubsQuery = query(collection(db, 'clubs'), orderBy('createdAt', 'desc'));
    const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));

    const unsubscribeClubs = onSnapshot(clubsQuery, (snap) => {
      setPlatformStats((current) => ({ ...current, clubs: snap.size }));
    });

    const unsubscribeUsers = onSnapshot(usersQuery, (snap) => {
      setPlatformStats((current) => ({ ...current, users: snap.size, recentSignups: snap.docs.slice(0, 5).map(d => ({ id: d.id, ...d.data() })) }));
    });

    return () => {
      unsubscribeClubs();
      unsubscribeUsers();
    };
  }, [isSuperAdmin]);

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1>Control Center</h1>
          <p className="subtitle">{isSuperAdmin ? 'Global Platform Administration' : `Managing ${selectedClub?.name || 'Infrastructure'}`}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-icon-round" title="System Notifications"><Bell size={20} /></button>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="stats-marquee">
        <StatsCard icon={Users} label="Total Members" value={stats.members} trend="+12%" color="#6366F1" />
        <StatsCard icon={ShoppingBag} label="Shop Orders" value={stats.orders} trend="+5%" color="#10B981" />
        <StatsCard icon={UsersRound} label="Active Teams" value={stats.teams} trend="+2%" color="#F59E0B" />
        <StatsCard icon={ListChecks} label="Tasks Pending" value={approvals.tasks.length + approvals.orders.length} color="#EF4444" />
      </div>

      <div className="dashboard-grid">
        {/* Left Column: Charts & Activity */}
        <div className="dashboard-main">
          <div className="card glass-card">
            <div className="card-header">
              <h3><TrendingUp size={18} /> Performance Overview</h3>
              <select className="btn btn-sm btn-outline">
                <option>Last 7 Days</option><option>Last 30 Days</option>
              </select>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={MOCK_TREND}>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)'}}
                    itemStyle={{color: 'var(--primary)', fontWeight: 600}}
                  />
                  <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="dashboard-subgrid">
            <div className="card">
              <div className="card-header">
                <h3><PackageCheck size={18} /> Recent Orders</h3>
                <button className="text-btn" onClick={() => window.location.href='/orders'}>View All</button>
              </div>
              <div className="activity-list">
                {approvals.orders.length === 0 ? (
                  <p className="empty-msg">No recent activity</p>
                ) : approvals.orders.map(o => (
                  <div key={o.id} className="activity-item">
                    <div className="activity-icon"><ShoppingBag size={14} /></div>
                    <div className="activity-content">
                      <p><strong>{o.userName}</strong> placed an order</p>
                      <span>{o.createdAt?.toDate?.().toLocaleTimeString() || 'Just now'}</span>
                    </div>
                    <div className="activity-badge">${(o.total || 0).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3><Zap size={18} /> Rapid Actions</h3>
              </div>
              <div className="action-grid">
                <button className="action-btn" onClick={() => window.location.href='/members'}>
                  <div className="action-icon" style={{background: '#EEF2FF', color: '#6366F1'}}><Users size={20} /></div>
                  <span>Manage Members</span>
                </button>
                <button className="action-btn" onClick={() => window.location.href='/posts'}>
                  <div className="action-icon" style={{background: '#ECFDF5', color: '#10B981'}}><Plus size={20} /></div>
                  <span>Create Post</span>
                </button>
                <button className="action-btn" onClick={() => window.location.href='/products'}>
                  <div className="action-icon" style={{background: '#FFFBEB', color: '#F59E0B'}}><ShoppingBag size={20} /></div>
                  <span>Add Product</span>
                </button>
                <button className="action-btn" onClick={() => window.location.href='/reports'}>
                  <div className="action-icon" style={{background: '#FEF2F2', color: '#EF4444'}}><Download size={20} /></div>
                  <span>Export Reports</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Platform & Context */}
        <div className="dashboard-side">
          {isSuperAdmin && (
            <div className="card platform-card">
              <h3><Shield size={18} /> Platform Status</h3>
              <div className="platform-stats">
                <div className="p-stat"><span>Clubs</span><strong>{platformStats.clubs}</strong></div>
                <div className="p-stat"><span>Users</span><strong>{platformStats.users}</strong></div>
              </div>
              <div className="pulse-indicator">
                <div className="pulse-dot"></div>
                <span>System Online & Secure</span>
              </div>
              <button className="btn btn-primary btn-full mt-md" onClick={() => window.location.href='/users'}>User Management</button>
            </div>
          )}

          {isSuperAdmin && <PlatformRecovery />}

          <div className="card context-card">
            <div className="card-header">
              <h3><Building2 size={18} /> Club Identity</h3>
              <SettingsIcon size={16} className="text-muted cursor-pointer" onClick={() => window.location.href='/settings'} />
            </div>
            {selectedClub ? (
              <div className="club-mini-profile">
                <div className="club-banner-placeholder">
                  <div className="club-logo-float">{selectedClub.name.charAt(0)}</div>
                </div>
                <div className="club-info-stack">
                  <h4>{selectedClub.name}</h4>
                  <p>{selectedClub.sport || 'Club'} Infrastructure</p>
                  <div className="info-chips">
                    <span className="chip"><Zap size={10} /> {selectedClub.plan || 'Active'}</span>
                    <span className="chip"><Shield size={10} /> {selectedClub.inviteCode}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="empty-msg">Select a club to view profile</p>
            )}
          </div>

          <div className="card task-card">
            <h3><ListChecks size={18} /> Pending Approvals</h3>
            <div className="mini-task-list">
              {approvals.tasks.length === 0 ? (
                <p className="empty-msg">No items pending</p>
              ) : approvals.tasks.map(t => (
                <div key={t.id} className="mini-task">
                  <div className="task-status"></div>
                  <div className="task-body">
                    <p>{t.title}</p>
                    <span>Due: {t.dueDate || 'ASAP'}</span>
                  </div>
                  <ArrowUpRight size={14} className="task-link" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlatformRecovery() {
  const [typoEmail, setTypoEmail] = useState('theboysoffficialone@gmial.com');
  const [correctEmail, setCorrectEmail] = useState('theboysofficialone@gmail.com');
  const [fixing, setFixing] = useState(false);

  const handleFix = async () => {
    if (!window.confirm(`Fix typo from ${typoEmail} to ${correctEmail} across all clubs?`)) return;
    setFixing(true);
    try {
      const clubsSnap = await getDocs(collection(db, 'clubs'));
      let fixCount = 0;

      // Handle variations for prefix
      const typoPrefixes = [typoEmail, typoEmail.replace('offficial', 'official')];
      const correctPrefix = correctEmail;

      for (const clubDoc of clubsSnap.docs) {
        for (const typo of typoPrefixes) {
          const memberQuery = query(collection(db, 'clubs', clubDoc.id, 'members'), where('email', '==', typo));
          const memberSnap = await getDocs(memberQuery);
          
          for (const mDoc of memberSnap.docs) {
            await updateDoc(mDoc.ref, { 
              email: correctPrefix, 
              updatedAt: new Date() 
            });
            fixCount++;
          }
        }
      }

      alert(`Successfully fixed ${fixCount} membership records. The new owner can now sign up/sign in with the correct email.`);
    } catch (err) {
      alert('Repair failed: ' + err.message);
    }
    setFixing(false);
  };

  return (
    <div className="card platform-card" style={{ marginTop: 24, border: '1px solid var(--warning)' }}>
      <h3><Shield size={18} color="var(--warning)" /> Platform Recovery</h3>
      <p style={{ fontSize: 11, marginBottom: 12, color: 'var(--text-secondary)' }}>Fix ownership transfer email typos</p>
      
      <div className="form-group">
        <label style={{ fontSize: 11 }}>Typo Email</label>
        <input className="form-control form-control-sm" value={typoEmail} onChange={e => setTypoEmail(e.target.value)} />
      </div>
      <div className="form-group" style={{ marginTop: 8 }}>
        <label style={{ fontSize: 11 }}>Correct Email</label>
        <input className="form-control form-control-sm" value={correctEmail} onChange={e => setCorrectEmail(e.target.value)} />
      </div>

      <button className="btn btn-warning btn-full mt-md" onClick={handleFix} disabled={fixing}>
        {fixing ? 'Repairing...' : 'Fix Typo & Restore Ownership'}
      </button>
    </div>
  );
}
