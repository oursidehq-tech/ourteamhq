import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import {
  Users, UsersRound, Calendar, ListChecks, ShieldCheck,
  RefreshCw, TrendingUp, Clock, CheckCircle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const TYPE_COLORS = { Match: '#f59e0b', Training: '#3b82f6', Social: '#10b981', Meeting: '#64748b', Other: '#8b5cf6' };

/**
 * Member-facing, read-only summary of club activity and the member's own involvement.
 */
export default function UserReports() {
  const { selectedClubId, selectedClub } = useClub();
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [clubStats, setClubStats] = useState({ members: 0, teams: 0, events: 0 });
  const [mine, setMine] = useState({ teams: 0, pendingTasks: 0, completedTasks: 0, bookings: 0, complianceDone: 0, complianceTotal: 0 });
  const [eventTypes, setEventTypes] = useState([]);

  const load = async () => {
    if (!selectedClubId) { setLoading(false); return; }
    setLoading(true);
    try {
      // Each collection is fetched defensively: security rules may limit a
      // regular member to a subset, or deny a collection entirely. A denied
      // read should degrade to empty rather than break the whole report.
      const safeGet = async (name) => {
        try {
          const snap = await getDocs(collection(db, 'clubs', selectedClubId, name));
          return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
          console.warn(`Report: skipped "${name}" (${e?.code || e?.message})`);
          return [];
        }
      };

      const [members, teams, events, tasks, bookings, compliance, forms] = await Promise.all([
        safeGet('members'),
        safeGet('teams'),
        safeGet('events'),
        safeGet('tasks'),
        safeGet('bookings'),
        safeGet('compliance'),
        safeGet('complianceForms'),
      ]);

      const emailLower = user?.email?.toLowerCase().trim();
      const memberRecord = members.find(m =>
        m.id === user?.uid || m.uid === user?.uid || m.userId === user?.uid ||
        (m.email && m.email.toLowerCase().trim() === emailLower)
      );

      // My teams
      const myTeamIds = new Set(memberRecord?.teamIds || []);
      teams.forEach(t => {
        if (t.memberIds?.includes(user?.uid)) myTeamIds.add(t.id);
        if (memberRecord && t.memberIds?.includes(memberRecord.id)) myTeamIds.add(t.id);
      });

      // My tasks
      const myTasks = tasks.filter(t => {
        const nameMatch = String(t.assigneeName || '').trim().toLowerCase() === String(profile?.displayName || '').trim().toLowerCase();
        return t.assigneeId === user?.uid || nameMatch;
      });
      const completedTasks = myTasks.filter(t => t.status === 'completed').length;

      // My bookings
      const myBookings = bookings.filter(b =>
        b.requestedByUid === user?.uid ||
        (b.requestedByName && b.requestedByName.trim().toLowerCase() === String(profile?.displayName || '').trim().toLowerCase())
      );

      // My approved compliance
      const myCompliance = compliance.filter(c => c.uid === user?.uid);
      const complianceDone = myCompliance.filter(c => c.status === 'Approved').length;

      // Requirements applicable to me (best-effort total)
      const myGroupIds = new Set(memberRecord?.groupIds || []);
      const myRoles = new Set([...(memberRecord?.roles || []), memberRecord?.role].filter(Boolean));
      const applicable = forms.filter(f => {
        if (f.targetType === 'all') return true;
        const teamMatch = (f.targetTeamIds || []).some(id => myTeamIds.has(id));
        const groupMatch = (f.targetGroupIds || []).some(id => myGroupIds.has(id));
        const roleMatch = (f.targetRoles || []).some(r => myRoles.has(r));
        const noScope = !f.targetTeamIds?.length && !f.targetGroupIds?.length;
        return teamMatch || groupMatch || roleMatch || noScope;
      });
      const complianceTotal = applicable.reduce((sum, f) => sum + ((f.requirements?.length) || 1), 0);

      setClubStats({ members: members.length, teams: teams.length, events: events.length });
      setMine({
        teams: myTeamIds.size,
        pendingTasks: myTasks.length - completedTasks,
        completedTasks,
        bookings: myBookings.length,
        complianceDone,
        complianceTotal,
      });

      // Events by type (all events)
      const counts = {};
      events.forEach(e => {
        const t = (e.type || 'other').toLowerCase();
        const key = t === 'match' || t === 'game' ? 'Match'
          : t === 'training' ? 'Training'
          : t === 'social' ? 'Social'
          : t === 'meeting' ? 'Meeting'
          : 'Other';
        counts[key] = (counts[key] || 0) + 1;
      });
      setEventTypes(Object.entries(counts).map(([name, value]) => ({ name, value })));
    } catch (err) {
      console.error('Error loading report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedClubId, user?.uid]);

  const cards = useMemo(() => ([
    { label: 'Club Members', value: clubStats.members, icon: Users, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
    { label: 'Club Events', value: clubStats.events, icon: Calendar, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    { label: 'My Teams', value: mine.teams, icon: UsersRound, color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)' },
    { label: 'My Open Tasks', value: mine.pendingTasks, icon: ListChecks, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
    { label: 'My Bookings', value: mine.bookings, icon: Clock, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
    { label: 'Tasks Done', value: mine.completedTasks, icon: CheckCircle, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  ]), [clubStats, mine]);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h1>Reports & Summary</h1>
          <p className="subtitle">A read-only overview of {selectedClub?.name} and your involvement</p>
        </div>
        <button className="btn btn-outline" onClick={load}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>Building your summary...</p>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            {cards.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="card shadow-sm" style={{ border: '1px solid var(--border)', borderRadius: '14px', background: '#fff', padding: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                  <Icon size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>{value}</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* My compliance progress */}
            <div className="card shadow-sm" style={{ border: '1px solid var(--border)', borderRadius: '16px', background: '#fff', padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="var(--primary)" /> My Compliance
              </h3>
              {mine.complianceTotal === 0 ? (
                <p className="text-muted" style={{ fontSize: '13px' }}>No compliance documents are required for you.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Approved</span>
                    <strong>{mine.complianceDone} / {mine.complianceTotal}</strong>
                  </div>
                  <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${mine.complianceTotal ? (mine.complianceDone / mine.complianceTotal) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <CheckCircle size={14} color="#10b981" /> {Math.round(mine.complianceTotal ? (mine.complianceDone / mine.complianceTotal) * 100 : 0)}% complete
                  </div>
                </>
              )}
            </div>

            {/* Events by type */}
            <div className="card shadow-sm" style={{ border: '1px solid var(--border)', borderRadius: '16px', background: '#fff', padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} color="var(--primary)" /> Events by Type
              </h3>
              {eventTypes.length === 0 ? (
                <p className="text-muted" style={{ fontSize: '13px' }}>No events recorded yet.</p>
              ) : (
                <div style={{ width: '100%', height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={eventTypes} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip cursor={{ fill: 'rgba(16,185,129,0.06)' }} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={54}>
                        {eventTypes.map((entry, i) => (
                          <Cell key={i} fill={TYPE_COLORS[entry.name] || '#8b5cf6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
