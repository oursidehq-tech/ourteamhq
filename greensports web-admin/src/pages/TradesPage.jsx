import { useEffect, useState } from 'react';
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import Modal from '../components/Modal';
import { Search, Plus, Edit2, Trash2, Phone, Mail, Award } from 'lucide-react';

export default function TradesPage() {
  const { selectedClubId, selectedClub } = useClub();
  const [trades, setTrades] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [includeSponsors, setIncludeSponsors] = useState(false);
  const [syncSponsor, setSyncSponsor] = useState(false);
  const [sponsorTier, setSponsorTier] = useState('Bronze');

  const defaultTiers = ['Gold', 'Silver', 'Bronze'];
  const currentTiers = selectedClub?.sponsorTiers || defaultTiers;

  const col = () => collection(db, 'clubs', selectedClubId, 'trades');

  const fetch = async () => {
    if (!selectedClubId) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(col(), orderBy('name', 'asc')));
      let tradesList = snap.docs.map(d => ({ id: d.id, ...d.data(), type: 'trade' }));

      if (includeSponsors) {
        const sponsorSnap = await getDocs(collection(db, 'clubs', selectedClubId, 'sponsors'));
        const sponsorsList = sponsorSnap.docs.map(d => ({
          id: d.id,
          name: d.data().name,
          category: `Sponsor (${d.data().tier || 'Bronze'})`,
          phone: d.data().phone || '',
          email: d.data().email || '',
          description: d.data().website || '',
          type: 'sponsor',
          tier: d.data().tier || 'Bronze'
        }));
        tradesList = [...tradesList, ...sponsorsList].sort((a, b) => a.name.localeCompare(b.name));
      }
      setTrades(tradesList);
    } catch (err) {
      console.error('Error fetching trades:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, [selectedClubId, includeSponsors]);

  const filtered = trades.filter(t =>
    t.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.category?.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setForm({ name: '', category: '', phone: '', email: '', description: '' });
    setSyncSponsor(false);
    setSponsorTier(currentTiers[0] || 'Bronze');
    setModal('add');
  };

  const openEdit = (t) => {
    if (t.type === 'sponsor') {
      alert('Sponsors must be edited from the Sponsor Management page.');
      return;
    }
    setForm({
      name: t.name || '',
      category: t.category || '',
      phone: t.phone || '',
      email: t.email || '',
      description: t.description || ''
    });
    setSyncSponsor(!!t.syncedSponsorId);
    setSponsorTier(t.sponsorTier || currentTiers[0] || 'Bronze');
    setModal(t);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) return alert('Supplier name is required');
    setSaving(true);
    try {
      let syncedSponsorId = modal === 'add' ? null : (modal.syncedSponsorId || null);

      if (syncSponsor) {
        const sponsorData = {
          name: form.name.trim(),
          tier: sponsorTier,
          phone: form.phone || '',
          email: form.email || '',
          website: '',
          expiry: '',
          status: 'Active',
          updatedAt: serverTimestamp(),
        };

        if (syncedSponsorId) {
          await updateDoc(doc(db, 'clubs', selectedClubId, 'sponsors', syncedSponsorId), sponsorData);
        } else {
          const sponsorRef = doc(collection(db, 'clubs', selectedClubId, 'sponsors'));
          await setDoc(sponsorRef, {
            ...sponsorData,
            impressions: 0,
            clicks: 0,
            clubId: selectedClubId,
            createdAt: serverTimestamp(),
          });
          syncedSponsorId = sponsorRef.id;
        }
      }

      const tradeData = {
        ...form,
        name: form.name.trim(),
        syncedSponsorId,
        sponsorTier: syncSponsor ? sponsorTier : null,
        updatedAt: serverTimestamp(),
      };

      if (modal === 'add') {
        const ref = doc(col());
        await setDoc(ref, {
          ...tradeData,
          createdBy: 'admin',
          createdAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'clubs', selectedClubId, 'trades', modal.id), tradeData);
      }
      await fetch();
      setModal(null);
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t) => {
    if (t.type === 'sponsor') {
      alert('Sponsors must be deleted from the Sponsor Management page.');
      return;
    }
    if (!window.confirm(`Delete supplier "${t.name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'clubs', selectedClubId, 'trades', t.id));
      await fetch();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Trades &amp; Suppliers</h1>
          <p>Manage sponsors, trades people and preferred suppliers</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16} />Add Supplier</button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h3>{filtered.length} Supplier{filtered.length !== 1 ? 's' : ''}</h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '14px', fontWeight: '500', userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={includeSponsors} 
                onChange={e => setIncludeSponsors(e.target.checked)} 
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              Include Sponsors
            </label>
            <div className="search-box">
              <Search size={16} />
              <input placeholder="Search suppliers…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Phone</th>
              <th>Email</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="table-empty">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="table-empty">No suppliers found</td></tr>
            ) : filtered.map(t => (
              <tr key={t.id} style={t.type === 'sponsor' ? { background: 'rgba(245, 158, 11, 0.02)' } : {}}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong>{t.name}</strong>
                    {t.type === 'sponsor' && (
                      <span className="flex-center" style={{ color: '#F59E0B' }} title={`Sponsor Tier: ${t.tier}`}>
                        <Award size={14} />
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <span className={`badge ${t.type === 'sponsor' ? 'badge-warning' : 'badge-default'}`}>
                    {t.category || '—'}
                  </span>
                </td>
                <td>{t.phone ? <a href={`tel:${t.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={13} />{t.phone}</a> : '—'}</td>
                <td>{t.email ? <a href={`mailto:${t.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Mail size={13} />{t.email}</a> : '—'}</td>
                <td>
                  <div className="flex gap-sm">
                    <button className="btn-icon" onClick={() => openEdit(t)} disabled={t.type === 'sponsor'} title={t.type === 'sponsor' ? 'Sponsors must be edited in Sponsor Management' : 'Edit'}><Edit2 size={15} /></button>
                    <button className="btn-icon danger" onClick={() => handleDelete(t)} disabled={t.type === 'sponsor'} title={t.type === 'sponsor' ? 'Sponsors must be deleted in Sponsor Management' : 'Delete'}><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'add' ? 'Add Supplier' : 'Edit Supplier'}>
        <div className="form-group"><label>Name</label><input className="form-control" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
        <div className="form-group">
          <label>Category</label>
          <select className="form-control" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })}>
            <option value="">Select…</option>
            <option>Sponsor</option><option>Tradesperson</option><option>Supplier</option><option>Food &amp; Beverage</option><option>Equipment</option><option>Medical</option><option>Other</option>
          </select>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Phone</label><input className="form-control" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="form-group"><label>Email</label><input className="form-control" type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        </div>
        <div className="form-group"><label>Description</label><textarea className="form-control" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        
        <div style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input 
              type="checkbox" 
              id="syncSponsor" 
              checked={syncSponsor} 
              onChange={e => setSyncSponsor(e.target.checked)} 
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="syncSponsor" style={{ cursor: 'pointer', margin: 0, fontSize: '14px', fontWeight: '500' }}>Sync as Sponsor</label>
          </div>
          {syncSponsor && (
            <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
              <label>Sponsor Tier</label>
              <select className="form-control" value={sponsorTier} onChange={e => setSponsorTier(e.target.value)}>
                {currentTiers.map(tier => (
                  <option key={tier} value={tier}>{tier}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : modal === 'add' ? 'Add Supplier' : 'Save Changes'}</button>
        </div>
      </Modal>
    </div>
  );
}
