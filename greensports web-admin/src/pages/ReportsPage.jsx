import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { 
  Users, ShoppingBag, ListChecks, PieChart as PieIcon,
  FileSpreadsheet, RefreshCcw, Download, Calendar
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function ReportsPage() {
  const { selectedClubId, selectedClub } = useClub();
  const [stats, setStats] = useState({
    members: 0,
    teams: 0,
    products: 0,
    orders: 0,
    revenue: 0,
    tasks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [growthData, setGrowthData] = useState([]);
  const [taskDistribution, setTaskDistribution] = useState([]);

  const fetchStats = async () => {
    if (!selectedClubId) return;
    setLoading(true);
    try {
      const cols = ['members', 'teams', 'products', 'orders', 'tasks'];
      const counts = {};
      const dataStore = {};

      await Promise.all(cols.map(async (col) => {
        const snap = await getDocs(collection(db, 'clubs', selectedClubId, col));
        counts[col] = snap.size;
        dataStore[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }));

      setStats({
        members: counts.members,
        teams: counts.teams,
        products: counts.products,
        orders: counts.orders,
        tasks: counts.tasks,
        revenue: (dataStore.orders || []).reduce((acc, o) => acc + (Number(o.total) || 0), 0)
      });

      // Calculate Real Task Distribution
      const taskDocs = dataStore.tasks || [];
      let pendingTasks = 0;
      let inProgressTasks = 0;
      let completedTasks = 0;

      taskDocs.forEach(t => {
        const s = (t.status || '').toLowerCase();
        if (s === 'completed' || s === 'done') completedTasks++;
        else if (s === 'in_progress' || s === 'inprogress') inProgressTasks++;
        else pendingTasks++;
      });

      const totalTasks = taskDocs.length;
      if (totalTasks > 0) {
        setTaskDistribution([
          { name: 'Pending', value: Math.round((pendingTasks / totalTasks) * 100), count: pendingTasks },
          { name: 'In Progress', value: Math.round((inProgressTasks / totalTasks) * 100), count: inProgressTasks },
          { name: 'Completed', value: Math.round((completedTasks / totalTasks) * 100), count: completedTasks },
        ]);
      } else {
        setTaskDistribution([
          { name: 'Pending', value: 0, count: 0 },
          { name: 'In Progress', value: 0, count: 0 },
          { name: 'Completed', value: 0, count: 0 },
        ]);
      }

      // Calculate Real Member Growth
      const memberDocs = dataStore.members || [];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const now = new Date();
      const monthBuckets = [];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthBuckets.push({
          month: months[d.getMonth()],
          year: d.getFullYear(),
          mIndex: d.getMonth(),
          count: 0
        });
      }

      memberDocs.forEach(m => {
        const dateObj = m.joinedAt?.toDate ? m.joinedAt.toDate() : (m.createdAt ? new Date(m.createdAt) : null);
        if (dateObj && !isNaN(dateObj.getTime())) {
          const mIdx = dateObj.getMonth();
          const bucket = monthBuckets.find(b => b.mIndex === mIdx);
          if (bucket) bucket.count++;
        }
      });

      let cumulative = 0;
      const chartPoints = monthBuckets.map(b => {
        cumulative += b.count;
        return {
          month: b.month,
          members: cumulative || memberDocs.length
        };
      });

      setGrowthData(chartPoints);
    } catch (err) {
      console.error('Fetch stats failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchStats(); 
  }, [selectedClubId]);

  const exportToCSV = (data, filename) => {
    const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const handleExportMembers = async () => {
    if (!selectedClubId) return;
    const snap = await getDocs(collection(db, 'clubs', selectedClubId, 'members'));
    const members = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const csv = 'Name,Email,Roles,JoinedAt\n' + 
      members.map(m => `"${m.displayName || m.name || ''}","${m.email || ''}","${(m.roles || [m.role || 'Member']).join(';')}",${m.joinedAt?.toDate?.().toLocaleDateString() || ''}`).join('\n');
    exportToCSV(csv, `${selectedClub?.name || 'Club'}_Members.csv`);
  };

  const handleExportOrders = async () => {
    if (!selectedClubId) return;
    const snap = await getDocs(collection(db, 'clubs', selectedClubId, 'orders'));
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const csv = 'OrderID,Customer,Email,Total,Status,Payment,Date\n' + 
      orders.map(o => `"${o.id}","${o.userName || ''}","${o.userEmail || o.email || ''}",${o.total || 0},"${o.status || 'Completed'}","${o.paymentStatus || 'Paid'}",${o.createdAt?.toDate?.().toLocaleDateString() || ''}`).join('\n');
    exportToCSV(csv, `${selectedClub?.name || 'Club'}_Orders.csv`);
  };

  return (
    <div className="reports-container dashboard-container">
      <div className="page-header">
        <div>
          <h1>Insights &amp; Analytics</h1>
          <p className="subtitle">Real club telemetry and data-driven performance metrics for {selectedClub?.name || 'Club'}.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={fetchStats}>
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} /> 
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="reports-grid">
        {/* Growth Chart */}
        <div className="card glass-card span-2">
          <div className="card-header">
            <h3><Users size={18} className="text-primary" /> Member Growth Trend</h3>
            <span className="badge badge-success">{stats.members} Total Roster</span>
          </div>
          <div className="chart-container" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData.length > 0 ? growthData : [{ month: 'Current', members: stats.members }]}>
                <defs>
                  <linearGradient id="colorMembers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
                />
                <Area type="monotone" dataKey="members" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorMembers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Task Distribution */}
        <div className="card">
          <div className="card-header">
            <h3><ListChecks size={18} className="text-primary" /> Task Distribution</h3>
            <span className="badge badge-default">{stats.tasks} Tasks</span>
          </div>
          <div className="chart-container" style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {stats.tasks === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>
                <p style={{ margin: 0, fontSize: 13 }}>No tasks recorded yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {taskDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val, name, item) => [`${val}% (${item.payload.count} tasks)`, name]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="pie-legend">
            {taskDistribution.map((t, i) => (
              <div key={t.name} className="legend-item">
                <span className="dot" style={{ background: COLORS[i] }}></span>
                <span className="label">{t.name}</span>
                <span className="value">{t.value}% ({t.count})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Export Center */}
        <div className="card span-3" style={{ marginTop: '8px' }}>
          <div className="card-header">
            <div>
              <h3><FileSpreadsheet size={18} className="text-primary" /> Export Center</h3>
              <p className="subtitle" style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                Securely export and download raw verified club data in CSV format.
              </p>
            </div>
          </div>
          <div className="export-grid">
            <div className="export-box" onClick={handleExportMembers}>
              <div className="eb-icon"><Users size={22} /></div>
              <div className="eb-info">
                <h4>Full Member Roster Export</h4>
                <p>Includes all players, coaches, volunteers, and contact info.</p>
              </div>
              <Download size={20} className="eb-arrow" />
            </div>
            <div className="export-box" onClick={handleExportOrders}>
              <div className="eb-icon"><ShoppingBag size={22} /></div>
              <div className="eb-info">
                <h4>Order &amp; Merchandise History</h4>
                <p>Complete historical log of all member shop transactions.</p>
              </div>
              <Download size={20} className="eb-arrow" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
