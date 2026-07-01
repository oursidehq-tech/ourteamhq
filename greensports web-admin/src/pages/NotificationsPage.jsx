import { useEffect, useState } from 'react';
import { collection, doc, getDocs, setDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import ClubSelector from '../components/ClubSelector';
import { Bell, Send, Search, Smartphone, ShieldCheck, Clock, RefreshCw } from 'lucide-react';

export default function NotificationsPage() {
  const { selectedClubId, selectedClub } = useClub();
  const [notifications, setNotifications] = useState([]);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ title: '', message: '', recipientId: '', sendPush: true });
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetch = async () => {
    if (!selectedClubId) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'clubs', selectedClubId, 'notifications'), orderBy('createdAt', 'desc')));
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      const snap = await getDocs(collection(db, 'clubs', selectedClubId, 'notifications'));
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    const mSnap = await getDocs(collection(db, 'clubs', selectedClubId, 'members'));
    setMembers(mSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [selectedClubId]);

  const handleSend = async () => {
    if (!form.title?.trim() || !form.message?.trim()) return alert('Title & message required');
    setSending(true);
    try {
      const ref = doc(collection(db, 'clubs', selectedClubId, 'notifications'));
      await setDoc(ref, {
        title: form.title,
        message: form.message,
        recipientId: form.recipientId || 'all',
        clubId: selectedClubId,
        clubName: selectedClub?.name || '',
        read: false,
        sentBy: 'admin',
        push: form.sendPush,
        deliveryType: form.sendPush ? 'fcm_push' : 'in_app',
        createdAt: serverTimestamp(),
      });
      setForm({ title: '', message: '', recipientId: '', sendPush: true });
      await fetch();
      alert('Notification sent successfully!');
    } catch (err) { alert(err.message); }
    setSending(false);
  };

  const filtered = notifications.filter(n =>
    n.title?.toLowerCase().includes(search.toLowerCase()) ||
    n.message?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1>Global Communications</h1>
          <p>Broadcast messages and push notifications to your club members instantly.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={fetch}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 400px' }}>
        <div className="dashboard-main">
          <div className="table-container">
            <div className="table-toolbar">
              <h3>History</h3>
              <div className="search-box">
                <Search size={16} />
                <input placeholder="Search sent messages..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Title & Content</th>
                  <th>Recipient</th>
                  <th>Type</th>
                  <th>Sent Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className="table-empty">No communications sent yet</td></tr>
                ) : filtered.map(n => (
                  <tr key={n.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{n.title}</div>
                      <div className="text-sm text-muted text-truncate" style={{ maxWidth: '300px' }}>{n.message}</div>
                    </td>
                    <td><span className="badge badge-default">{n.recipientId === 'all' ? 'Entire Club' : 'Specific Member'}</span></td>
                    <td>
                      {n.push ? (
                        <span className="badge badge-success flex-center gap-xs" style={{ gap: '4px' }}>
                          <Smartphone size={10} /> Push Sent
                        </span>
                      ) : (
                        <span className="badge badge-info">In-App</span>
                      )}
                    </td>
                    <td>{n.createdAt?.toDate?.().toLocaleDateString() || 'Just now'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dashboard-side">
          <div className="card">
            <div className="card-header">
              <h3><Send size={18} /> Compose Broadcast</h3>
            </div>
            <div className="form-group">
              <label>Target Audience</label>
              <select className="form-control" value={form.recipientId} onChange={e => setForm({ ...form, recipientId: e.target.value })}>
                <option value="">All Club Members</option>
                {members.map(m => <option key={m.id} value={m.userId || m.id}>{m.displayName || m.email}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Message Title</label>
              <input className="form-control" placeholder="e.g. Training Cancelled" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Broadcast Message</label>
              <textarea className="form-control" rows={4} placeholder="Type your announcement here..." value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
            </div>
            
            <div className="detail-card mb-md" style={{ background: 'var(--primary-light)', borderColor: 'var(--primary)' }}>
              <div className="flex-center justify-between">
                <div className="flex-center gap-sm">
                  <Smartphone size={18} className="text-primary" />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>Push Notification</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Send alert to mobile lock screens</div>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  checked={form.sendPush}
                  onChange={e => setForm({ ...form, sendPush: e.target.checked })}
                />
              </div>
            </div>

            <button className="btn btn-primary w-full justify-center py-md" style={{ width: '100%' }} onClick={handleSend} disabled={sending}>
              <Send size={16} />
              <span>{sending ? 'Broadcasting...' : 'Send Now'}</span>
            </button>

            <div className="mt-md p-sm bg-gray-50 rounded-lg text-xs text-muted flex gap-sm">
              <ShieldCheck size={14} className="flex-shrink-0" />
              <p>Sent notifications are encrypted and archived for 12 months for compliance.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
