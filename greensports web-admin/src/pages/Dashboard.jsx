import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import StatsCard from '../components/StatsCard';
import {
  Building2, Users, UsersRound, Calendar, ShoppingBag, PackageCheck,
  ListChecks, Shield, TrendingUp, ArrowUpRight, Zap, Plus,
  Settings as SettingsIcon, Radio, Trophy, DollarSign, ChevronRight,
  RefreshCw, Clock, MapPin, Repeat, AlertCircle, Newspaper, Boxes,
  UserCheck, ArrowRight
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts';
import {
  buildOccurrenceDates,
  hasRecurrence,
  todayIsoDate,
  addDaysToIsoDate,
  parseIsoDate,
} from '../utils/recurrence';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatMoney = (value) => {
  const n = Number(value) || 0;
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 10000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
};

const formatShortDate = (isoDate) => {
  const d = parseIsoDate(isoDate);
  if (!d) return 'Date TBC';
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
};

const formatEventTime = (event) => {
  if (event?.isAllDay) return 'All day';
  const start = event?.startTime || event?.time || '';
  if (!start) return 'Time TBC';
  return event?.endTime ? `${start} – ${event.endTime}` : start;
};

const ROLE_COLORS = {
  Player: '#6366F1',
  Parent: '#8B5CF6',
  Coach: '#10B981',
  Manager: '#F59E0B',
  Volunteer: '#06B6D4',
  Admin: '#EF4444',
  Registrar: '#EC4899',
  'Shop Manager': '#14B8A6',
  Owner: '#0F172A',
};

export default function Dashboard() {
  const { selectedClubId, selectedClub } = useClub();
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    members: 0,
    teams: 0,
    posts: 0,
    events: 0,
    products: 0,
    orders: 0,
    tasks: 0,
    totalRevenue: 0,
    liveMatchesCount: 0,
  });

  const [platformStats, setPlatformStats] = useState({ clubs: 0, users: 0 });
  const [approvals, setApprovals] = useState({ orders: [], tasks: [] });
  const [recentMatches, setRecentMatches] = useState([]);
  const [liveMatch, setLiveMatch] = useState(null);
  const [recentOrdersList, setRecentOrdersList] = useState([]);
  const [rawOrders, setRawOrders] = useState([]);
  const [rawMembers, setRawMembers] = useState([]);
  const [rawEvents, setRawEvents] = useState([]);
  const [rawTasks, setRawTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyticsTab, setAnalyticsTab] = useState('revenue');

  const [revenueData, setRevenueData] = useState(
    DAY_NAMES.slice(1).concat(DAY_NAMES[0]).map((name) => ({ name, revenue: 0, orders: 0 }))
  );

  useEffect(() => {
    if (!selectedClubId) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);

    const unsubscribers = [
      onSnapshot(collection(db, 'clubs', selectedClubId, 'members'), (snap) => {
        const members = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRawMembers(members);
        setStats((curr) => ({ ...curr, members: snap.size }));
      }),
      onSnapshot(collection(db, 'clubs', selectedClubId, 'teams'), (snap) => {
        setStats((curr) => ({ ...curr, teams: snap.size }));
      }),
      onSnapshot(collection(db, 'clubs', selectedClubId, 'posts'), (snap) => {
        setStats((curr) => ({ ...curr, posts: snap.size }));
      }),
      onSnapshot(collection(db, 'clubs', selectedClubId, 'events'), (snap) => {
        setRawEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setStats((curr) => ({ ...curr, events: snap.size }));
      }),
      onSnapshot(collection(db, 'clubs', selectedClubId, 'products'), (snap) => {
        setStats((curr) => ({ ...curr, products: snap.size }));
      }),
      onSnapshot(collection(db, 'clubs', selectedClubId, 'orders'), (snap) => {
        const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const rev = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

        // Build a rolling 7-day revenue series ending today.
        const buckets = {};
        for (let i = 6; i >= 0; i -= 1) {
          const day = new Date();
          day.setDate(day.getDate() - i);
          const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
          buckets[key] = { name: DAY_NAMES[day.getDay()], revenue: 0, orders: 0 };
        }
        orders.forEach((o) => {
          const created = toDate(o.createdAt);
          if (!created) return;
          const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`;
          if (buckets[key]) {
            buckets[key].revenue += Number(o.total) || 0;
            buckets[key].orders += 1;
          }
        });

        setRawOrders(orders);
        setStats((curr) => ({ ...curr, orders: snap.size, totalRevenue: rev }));
        setRecentOrdersList(
          [...orders]
            .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0))
            .slice(0, 5)
        );
        setRevenueData(
          Object.values(buckets).map((b) => ({
            name: b.name,
            revenue: Math.round(b.revenue),
            orders: b.orders,
          }))
        );
      }),
      onSnapshot(collection(db, 'clubs', selectedClubId, 'tasks'), (snap) => {
        setRawTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setStats((curr) => ({ ...curr, tasks: snap.size }));
      }),
      onSnapshot(
        query(collection(db, 'clubs', selectedClubId, 'orders'), where('status', '==', 'pending'), limit(4)),
        (snap) => {
          setApprovals((curr) => ({ ...curr, orders: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }));
        },
        () => {}
      ),
      onSnapshot(
        query(collection(db, 'clubs', selectedClubId, 'tasks'), where('status', '==', 'pending'), limit(4)),
        (snap) => {
          setApprovals((curr) => ({ ...curr, tasks: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }));
        },
        () => {}
      ),
      onSnapshot(
        collection(db, 'clubs', selectedClubId, 'leagueFixtures'),
        (snap) => {
          const matches = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          const liveOne = matches.find((m) => {
            const s = (m.status || '').toLowerCase();
            return s === 'live' || s === 'inprogress';
          });
          setLiveMatch(liveOne || null);
          setStats((curr) => ({
            ...curr,
            liveMatchesCount: matches.filter((m) => (m.status || '').toLowerCase() === 'live').length,
          }));
          setRecentMatches(matches.slice(0, 4));
          setLoading(false);
        },
        () => setLoading(false)
      ),
    ];

    return () => unsubscribers.forEach((u) => u());
  }, [selectedClubId]);

  useEffect(() => {
    if (!isSuperAdmin) return undefined;
    const unsubClubs = onSnapshot(collection(db, 'clubs'), (snap) => {
      setPlatformStats((curr) => ({ ...curr, clubs: snap.size }));
    });
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setPlatformStats((curr) => ({ ...curr, users: snap.size }));
    });
    return () => {
      unsubClubs();
      unsubUsers();
    };
  }, [isSuperAdmin]);

  /* ── Derived insights ─────────────────────────────────────────── */

  // Upcoming events (recurrence-aware) for the next 30 days.
  const upcomingEvents = useMemo(() => {
    const today = todayIsoDate();
    const horizon = addDaysToIsoDate(today, 30);
    const out = [];
    (rawEvents || []).forEach((event) => {
      const baseDate = event.startDate || event.date;
      if (!baseDate) return;
      const dates = buildOccurrenceDates(baseDate, event.recurringRule, today, horizon, {
        endDate: event.endDate || event.date,
      });
      dates.forEach((occurrenceDate) => {
        out.push({ ...event, occurrenceDate, isRecurring: hasRecurrence(event.recurringRule) });
      });
    });
    return out
      .sort((a, b) => {
        const aKey = `${a.occurrenceDate} ${a.startTime || a.time || '99:99'}`;
        const bKey = `${b.occurrenceDate} ${b.startTime || b.time || '99:99'}`;
        return aKey.localeCompare(bKey);
      })
      .slice(0, 5);
  }, [rawEvents]);

  // Member role distribution.
  const roleBreakdown = useMemo(() => {
    const counts = {};
    (rawMembers || []).forEach((m) => {
      const roles = Array.isArray(m.roles) && m.roles.length > 0 ? m.roles : m.role ? [m.role] : ['Unassigned'];
      roles.forEach((role) => {
        const key = String(role || 'Unassigned');
        counts[key] = (counts[key] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, color: ROLE_COLORS[name] || '#94A3B8' }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [rawMembers]);

  // Order status split.
  const orderStatusBreakdown = useMemo(() => {
    const counts = {};
    (rawOrders || []).forEach((o) => {
      const key = String(o.status || 'pending').toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rawOrders]);

  const pendingTaskCount = useMemo(
    () => (rawTasks || []).filter((t) => String(t.status || '').toLowerCase() !== 'completed').length,
    [rawTasks]
  );

  const revenueThisWeek = useMemo(
    () => revenueData.reduce((sum, d) => sum + (Number(d.revenue) || 0), 0),
    [revenueData]
  );

  const ordersThisWeek = useMemo(
    () => revenueData.reduce((sum, d) => sum + (Number(d.orders) || 0), 0),
    [revenueData]
  );

  const avgOrderValue = stats.orders > 0 ? stats.totalRevenue / stats.orders : 0;

  const memberGrowthData = useMemo(
    () => [
      { name: 'Members', total: stats.members },
      { name: 'Teams', total: stats.teams },
      { name: 'Events', total: stats.events },
      { name: 'Products', total: stats.products },
    ],
    [stats.members, stats.teams, stats.events, stats.products]
  );

  const pendingApprovalsTotal = approvals.tasks.length + approvals.orders.length;

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            Control Center
            {stats.liveMatchesCount > 0 && (
              <span className="badge badge-danger dash-live-badge">
                <Radio size={12} /> {stats.liveMatchesCount} MATCH LIVE
              </span>
            )}
          </h1>
          <p className="subtitle">
            {isSuperAdmin
              ? 'Global platform administration'
              : `Managing ${selectedClub?.name || 'your club'}`}
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={() => navigate('/calendar')}>
            <Calendar size={16} /> <span>Calendar</span>
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/league-platform')}>
            <Radio size={16} /> <span>Live Match Center</span>
          </button>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="stats-marquee">
        <StatsCard icon={Users} label="Total Members" value={stats.members} trend={`${stats.teams} teams`} color="#6366F1" />
        <StatsCard icon={DollarSign} label="Shop Revenue" value={formatMoney(stats.totalRevenue)} trend={`${stats.orders} orders`} color="#10B981" />
        <StatsCard icon={ShoppingBag} label="Avg Order Value" value={formatMoney(avgOrderValue)} trend={`${formatMoney(revenueThisWeek)} this week`} color="#0EA5E9" />
        <StatsCard icon={ListChecks} label="Open Tasks" value={pendingTaskCount} trend={pendingApprovalsTotal > 0 ? `${pendingApprovalsTotal} need review` : 'All clear'} color="#F59E0B" />
        <StatsCard icon={Calendar} label="Upcoming Events" value={upcomingEvents.length} trend={stats.events > 0 ? `${stats.events} total` : 'None yet'} color="#8B5CF6" />
      </div>

      {/* Live Match Spotlight */}
      {liveMatch && (
        <div className="dash-live-card">
          <div className="dash-live-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className={`dash-live-pill ${(liveMatch.status || '').toLowerCase() === 'live' ? 'is-live' : ''}`}>
                <Radio size={10} /> {(liveMatch.status || 'Scheduled').toUpperCase()}
              </span>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                {liveMatch.competitionName || 'Club Fixture'}
                {liveMatch.period ? ` • ${liveMatch.period}` : ''}
              </span>
            </div>
            <button className="btn btn-sm btn-primary" onClick={() => navigate('/league-platform')}>
              Control Broadcast <ChevronRight size={14} />
            </button>
          </div>

          <div className="dash-live-body">
            <div className="dash-live-team">
              <h3>{liveMatch.homeTeam || 'Home Team'}</h3>
              <div className="dash-live-score home">
                {typeof liveMatch.homeScore === 'number' ? liveMatch.homeScore : 0}
              </div>
            </div>
            <div className="dash-live-vs">
              <span>VS</span>
              <div>{liveMatch.venue || 'Main Stadium'}</div>
            </div>
            <div className="dash-live-team">
              <h3>{liveMatch.awayTeam || 'Away Team'}</h3>
              <div className="dash-live-score away">
                {typeof liveMatch.awayScore === 'number' ? liveMatch.awayScore : 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="dashboard-grid">
        <div className="dashboard-main">
          {/* Analytics */}
          <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3><TrendingUp size={18} className="text-primary" /> Performance Analytics</h3>
                <span className="text-muted text-sm">
                  {analyticsTab === 'revenue'
                    ? `${formatMoney(revenueThisWeek)} across ${ordersThisWeek} order${ordersThisWeek === 1 ? '' : 's'} in the last 7 days`
                    : 'Club inventory at a glance'}
                </span>
              </div>
              <div className="dash-tabs">
                <button
                  type="button"
                  className={analyticsTab === 'revenue' ? 'active' : ''}
                  onClick={() => setAnalyticsTab('revenue')}
                >
                  Revenue
                </button>
                <button
                  type="button"
                  className={analyticsTab === 'members' ? 'active' : ''}
                  onClick={() => setAnalyticsTab('members')}
                >
                  Club Overview
                </button>
              </div>
            </div>

            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                {analyticsTab === 'revenue' ? (
                  <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      formatter={(val) => [`$${val}`, 'Revenue']}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                ) : (
                  <BarChart data={memberGrowthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                    <Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]} name="Count" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Upcoming Schedule + Recent Orders */}
          <div className="dashboard-subgrid">
            <div className="card">
              <div className="card-header">
                <h3><Calendar size={18} className="text-primary" /> Upcoming Schedule</h3>
                <button className="text-btn" onClick={() => navigate('/calendar')}>
                  <span>Calendar</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>
              <div className="dash-list">
                {upcomingEvents.length === 0 ? (
                  <p className="dash-empty">Nothing scheduled in the next 30 days</p>
                ) : (
                  upcomingEvents.map((event) => (
                    <div key={`${event.id}-${event.occurrenceDate}`} className="dash-list-row">
                      <div className="dash-date-chip">
                        <span>{MONTH_SHORT[parseIsoDate(event.occurrenceDate)?.getMonth() ?? 0]}</span>
                        <strong>{parseIsoDate(event.occurrenceDate)?.getDate() ?? '—'}</strong>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="dash-row-title">
                          {event.title || 'Untitled event'}
                          {event.isRecurring && <Repeat size={11} className="dash-repeat-icon" />}
                        </p>
                        <span className="dash-row-meta">
                          <Clock size={11} /> {formatEventTime(event)}
                          {event.location ? (
                            <>
                              <MapPin size={11} style={{ marginLeft: 8 }} /> {event.location}
                            </>
                          ) : null}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3><PackageCheck size={18} className="text-primary" /> Recent Orders</h3>
                <button className="text-btn" onClick={() => navigate('/orders')}>
                  <span>View All</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>
              <div className="dash-list">
                {recentOrdersList.length === 0 ? (
                  <p className="dash-empty">No shop orders yet</p>
                ) : (
                  recentOrdersList.map((o) => (
                    <div key={o.id} className="dash-list-row">
                      <div className="dash-icon-chip" style={{ background: '#ECFDF5', color: '#10B981' }}>
                        <ShoppingBag size={15} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="dash-row-title">{o.userName || o.userEmail || 'Member'}</p>
                        <span className="dash-row-meta">
                          {o.status || 'pending'} • {o.items?.length || 1} item{(o.items?.length || 1) === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="dash-row-amount">{formatMoney(o.total)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Role distribution */}
          <div className="card">
            <div className="card-header">
              <h3><UsersRound size={18} className="text-primary" /> Member Roles</h3>
              <button className="text-btn" onClick={() => navigate('/members')}>
                <span>Manage</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
            {roleBreakdown.length === 0 ? (
              <p className="dash-empty">No members registered yet</p>
            ) : (
              <div className="dash-role-grid">
                {roleBreakdown.map((role) => (
                  <div key={role.name} className="dash-role-item">
                    <span className="dash-role-dot" style={{ background: role.color }} />
                    <span className="dash-role-name">{role.name}</span>
                    <span className="dash-role-count">{role.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Side column */}
        <div className="dashboard-side">
          {/* Club identity */}
          <div className="card">
            <div className="card-header">
              <h3><Building2 size={18} /> Club Identity</h3>
              <SettingsIcon
                size={16}
                className="text-muted cursor-pointer"
                onClick={() => navigate('/settings')}
              />
            </div>
            {selectedClub ? (
              <div className="dash-club">
                <div className="dash-club-banner">
                  <div className="dash-club-avatar">
                    {selectedClub.name?.charAt(0) || 'C'}
                  </div>
                  <h4>{selectedClub.name}</h4>
                  <p>{selectedClub.sport || 'Sports'} Organization</p>
                </div>
                <div className="dash-club-chips">
                  <span className="badge badge-info">
                    <Zap size={10} /> {selectedClub.plan || 'Pro'}
                  </span>
                  <span className="badge badge-default">
                    <Shield size={10} /> {selectedClub.inviteCode || 'No code'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="dash-empty">Select a club to view its profile</p>
            )}
          </div>

          {/* Needs attention */}
          <div className="card">
            <div className="card-header">
              <h3><AlertCircle size={18} /> Needs Attention</h3>
              {pendingApprovalsTotal > 0 && (
                <span className="badge badge-warning">{pendingApprovalsTotal}</span>
              )}
            </div>
            <div className="dash-list">
              {pendingApprovalsTotal === 0 ? (
                <p className="dash-empty">Everything is up to date</p>
              ) : (
                <>
                  {approvals.orders.map((o) => (
                    <div
                      key={`order-${o.id}`}
                      className="dash-list-row clickable"
                      onClick={() => navigate('/orders')}
                    >
                      <div className="dash-icon-chip" style={{ background: '#FFFBEB', color: '#F59E0B' }}>
                        <ShoppingBag size={15} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="dash-row-title">{o.userName || 'Order'}</p>
                        <span className="dash-row-meta">Awaiting fulfilment</span>
                      </div>
                      <ArrowRight size={14} className="text-muted" />
                    </div>
                  ))}
                  {approvals.tasks.map((t) => (
                    <div
                      key={`task-${t.id}`}
                      className="dash-list-row clickable"
                      onClick={() => navigate('/tasks')}
                    >
                      <div className="dash-icon-chip" style={{ background: '#EEF2FF', color: '#6366F1' }}>
                        <ListChecks size={15} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="dash-row-title">{t.title || 'Task'}</p>
                        <span className="dash-row-meta">Due {t.dueDate || 'ASAP'}</span>
                      </div>
                      <ArrowRight size={14} className="text-muted" />
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Order status */}
          {orderStatusBreakdown.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3><Boxes size={18} /> Order Pipeline</h3>
              </div>
              <div className="dash-list">
                {orderStatusBreakdown.map((s) => (
                  <div key={s.name} className="dash-status-row">
                    <span className="dash-status-name">{s.name}</span>
                    <div className="dash-status-bar">
                      <div
                        style={{
                          width: `${Math.max(6, (s.value / Math.max(1, stats.orders)) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="dash-status-count">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="card">
            <div className="card-header">
              <h3><Zap size={18} className="text-primary" /> Quick Actions</h3>
            </div>
            <div className="action-grid">
              <button className="action-btn" onClick={() => navigate('/members')}>
                <div className="action-icon" style={{ background: '#FFFBEB', color: '#F59E0B' }}>
                  <UserCheck size={20} />
                </div>
                <span>Members</span>
              </button>
              <button className="action-btn" onClick={() => navigate('/events')}>
                <div className="action-icon" style={{ background: '#EEF2FF', color: '#6366F1' }}>
                  <Calendar size={20} />
                </div>
                <span>Events</span>
              </button>
              <button className="action-btn" onClick={() => navigate('/products')}>
                <div className="action-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>
                  <ShoppingBag size={20} />
                </div>
                <span>Products</span>
              </button>
              <button className="action-btn" onClick={() => navigate('/posts')}>
                <div className="action-icon" style={{ background: '#FEF2F2', color: '#EF4444' }}>
                  <Newspaper size={20} />
                </div>
                <span>New Post</span>
              </button>
            </div>
          </div>

          {/* Superadmin platform */}
          {isSuperAdmin && (
            <div className="card">
              <div className="card-header">
                <h3><Shield size={18} /> Platform</h3>
              </div>
              <div className="dash-platform-grid">
                <div>
                  <span>Clubs</span>
                  <strong>{platformStats.clubs}</strong>
                </div>
                <div>
                  <span>Users</span>
                  <strong>{platformStats.users}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
