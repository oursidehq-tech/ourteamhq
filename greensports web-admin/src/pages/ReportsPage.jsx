import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { 
  BarChart3, Download, Users, ShoppingBag, 
  Calendar, ListChecks, TrendingUp, PieChart as PieIcon,
  FileSpreadsheet, Filter, RefreshCcw
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const MOCK_GROWTH = [
  { month: 'Jan', members: 45 },
  { month: 'Feb', members: 52 },
  { month: 'Mar', members: 48 },
  { month: 'Apr', members: 70 },
  { month: 'May', members: 85 },
  { month: 'Jun', members: 103 },
];

const MOCK_TASKS = [
  { name: 'Pending', value: 40 },
  { name: 'In Progress', value: 25 },
  { name: 'Completed', value: 35 },
];

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

  const fetchStats = async () => {
    if (!selectedClubId) return;
    setLoading(true);
    try {
      const cols = ['members', 'teams', 'products', 'orders', 'tasks'];
      const counts = {};
      await Promise.all(cols.map(async (col) => {
        const snap = await getDocs(collection(db, 'clubs', selectedClubId, col));
        counts[col] = snap.size;
      }));

      setStats({
        members: counts.members,
        teams: counts.teams,
        products: counts.products,
        orders: counts.orders,
        tasks: counts.tasks,
      });
    } catch (err) {
      console.error('Fetch stats failed:', err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, [selectedClubId]);

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
      members.map(m => `"${m.displayName}","${m.email}","${(m.roles || [m.role]).join(';')}",${m.joinedAt?.toDate?.().toLocaleDateString()}`).join('\n');
    exportToCSV(csv, `${selectedClub?.name || 'Club'}_Members.csv`);
  };

  const handleExportOrders = async () => {
    if (!selectedClubId) return;
    const snap = await getDocs(collection(db, 'clubs', selectedClubId, 'orders'));
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const csv = 'OrderID,Customer,Email,Total,Status,Payment,Date\n' + 
      orders.map(o => `"${o.id}","${o.userName}","${o.userEmail || o.email}",${o.total},"${o.status}","${o.paymentStatus}",${o.createdAt?.toDate?.().toLocaleDateString()}`).join('\n');
    exportToCSV(csv, `${selectedClub?.name || 'Club'}_Orders.csv`);
  };

  return (
    <div className="reports-container">
      <div className="page-header">
        <div>
          <h1>Insights & Analytics</h1>
          <p className="subtitle">Data-driven club performance metrics</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={fetchStats}><RefreshCcw size={16} /> Refresh</button>
        </div>
      </div>

      <div className="reports-grid">
        {/* Growth Chart */}
        <div className="card glass-card span-2">
          <div className="card-header">
            <h3><Users size={18} /> Member Growth Trend</h3>
            <div className="flex gap-sm">
              <span className="badge badge-success">+15% vs Last Month</span>
            </div>
          </div>
          <div className="chart-container" style={{height: 350}}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_GROWTH}>
                <defs>
                  <linearGradient id="colorMembers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)'}}
                />
                <Area type="monotone" dataKey="members" stroke="#6366F1" strokeWidth={3} fillOpacity={1} fill="url(#colorMembers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Task Distribution */}
        <div className="card">
          <div className="card-header">
            <h3><ListChecks size={18} /> Task Distribution</h3>
          </div>
          <div className="chart-container" style={{height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={MOCK_TASKS}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {MOCK_TASKS.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="pie-legend">
            {MOCK_TASKS.map((t, i) => (
              <div key={t.name} className="legend-item">
                <span className="dot" style={{background: COLORS[i]}}></span>
                <span className="label">{t.name}</span>
                <span className="value">{t.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Data Management */}
        <div className="card span-3">
          <div className="card-header">
            <h3><FileSpreadsheet size={18} /> Export Center</h3>
            <p className="subtitle">Securely download your club data</p>
          </div>
          <div className="export-grid">
            <div className="export-box" onClick={handleExportMembers}>
              <div className="eb-icon"><Users size={24} /></div>
              <div className="eb-info">
                <h4>Full Roster Export</h4>
                <p>Includes all players, coaches, and contact info.</p>
              </div>
              <Download size={20} className="eb-arrow" />
            </div>
            <div className="export-box" onClick={handleExportOrders}>
              <div className="eb-icon"><ShoppingBag size={24} /></div>
              <div className="eb-info">
                <h4>Order History Export</h4>
                <p>Complete record of all shop transactions.</p>
              </div>
              <Download size={20} className="eb-arrow" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
