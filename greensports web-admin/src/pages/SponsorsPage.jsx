import React, { useState, useEffect } from 'react';
import { Award, TrendingUp, Eye, MousePointer, Plus, Edit2, Trash2, BarChart3, PieChart, Globe, RefreshCw, Mail, Phone } from 'lucide-react';
import { useClub } from '../context/ClubContext';
import { sponsorService } from '../services/sponsorService';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { doc, updateDoc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

const SponsorsPage = () => {
  const { selectedClubId, selectedClub, refreshClubs } = useClub();
  const [loading, setLoading] = useState(true);
  const [sponsors, setSponsors] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showTiersModal, setShowTiersModal] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingTiers, setIsSavingTiers] = useState(false);
  const [tempTiers, setTempTiers] = useState([]);
  const [syncTrade, setSyncTrade] = useState(false);

  const defaultTiers = ['Gold', 'Silver', 'Bronze'];
  const currentTiers = selectedClub?.sponsorTiers || defaultTiers;

  useEffect(() => {
    if (selectedClubId) {
      loadSponsors();
    }
  }, [selectedClubId]);

  const loadSponsors = async () => {
    setLoading(true);
    try {
      const data = await sponsorService.getSponsors(selectedClubId);
      setSponsors(data);
    } catch (error) {
      console.error('Error loading sponsors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTiers = () => {
    setTempTiers([...currentTiers]);
    setShowTiersModal(true);
  };

  const handleSaveTiers = async (e) => {
    e.preventDefault();
    if (!selectedClubId) return;
    setIsSavingTiers(true);
    try {
      const cleanTiers = tempTiers.map(t => t.trim()).filter(Boolean);
      if (cleanTiers.length === 0) {
        alert('Please define at least one tier.');
        setIsSavingTiers(false);
        return;
      }
      const clubRef = doc(db, 'clubs', selectedClubId);
      await updateDoc(clubRef, { sponsorTiers: cleanTiers });
      if (typeof refreshClubs === 'function') {
        refreshClubs();
      }
      setShowTiersModal(false);
    } catch (error) {
      console.error('Error saving tiers:', error);
      alert('Failed to save tiers: ' + error.message);
    } finally {
      setIsSavingTiers(false);
    }
  };

  const handleSaveSponsor = async (e) => {
    e.preventDefault();
    if (!selectedClubId) return;
    const formData = new FormData(e.target);
    const sponsorData = {
      name: formData.get('name'),
      tier: formData.get('tier'),
      expiry: formData.get('expiry'),
      website: formData.get('website'),
      phone: formData.get('phone') || '',
      email: formData.get('email') || '',
      status: editingSponsor?.status || 'Active'
    };

    setIsSaving(true);
    try {
      let syncedTradeId = editingSponsor?.syncedTradeId || null;

      if (syncTrade) {
        const tradeData = {
          name: sponsorData.name,
          category: 'Sponsor',
          phone: sponsorData.phone,
          email: sponsorData.email,
          description: `Sponsor Tier: ${sponsorData.tier}. Expiry: ${sponsorData.expiry || 'N/A'}. Website: ${sponsorData.website || 'N/A'}`,
          updatedAt: serverTimestamp(),
        };

        if (syncedTradeId) {
          await updateDoc(doc(db, 'clubs', selectedClubId, 'trades', syncedTradeId), tradeData);
        } else {
          const tradeRef = doc(collection(db, 'clubs', selectedClubId, 'trades'));
          await setDoc(tradeRef, {
            ...tradeData,
            createdBy: 'admin',
            createdAt: serverTimestamp(),
          });
          syncedTradeId = tradeRef.id;
        }
      }

      const finalSponsorData = {
        ...sponsorData,
        syncedTradeId
      };

      if (editingSponsor) {
        await sponsorService.updateSponsor(selectedClubId, editingSponsor.id, finalSponsorData);
      } else {
        await sponsorService.createSponsor(selectedClubId, finalSponsorData);
      }
      setShowModal(false);
      loadSponsors();
    } catch (error) {
      console.error('Error saving sponsor:', error);
      alert('Failed to save sponsor: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSponsor = async (id) => {
    if (!selectedClubId) return;
    if (window.confirm('Are you sure you want to delete this sponsor?')) {
      try {
        await sponsorService.deleteSponsor(selectedClubId, id);
        loadSponsors();
      } catch (error) {
        console.error('Error deleting sponsor:', error);
        alert('Failed to delete sponsor: ' + error.message);
      }
    }
  };

  const columns = [
    { 
      header: 'Sponsor', 
      accessor: 'name',
      render: (val, row) => (
        <div className="flex-center gap-md">
          <div className="sm-icon" style={{ background: 'var(--bg)', borderRadius: '8px' }}>
            <Globe size={18} className="text-muted" />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{val}</div>
            <div className="text-muted text-sm">Contract ends: {row.expiry || 'N/A'}</div>
          </div>
        </div>
      )
    },
    { 
      header: 'Tier', 
      accessor: 'tier',
      render: (val) => {
        const tierIndex = currentTiers.indexOf(val);
        const colors = ['#FFD700', '#94A3B8', '#CD7F32', '#6366F1', '#10B981', '#F59E0B'];
        const color = tierIndex !== -1 ? colors[tierIndex % colors.length] : 'var(--text)';
        return (
          <span className="flex-center gap-sm" style={{ fontWeight: 600, color }}>
            <Award size={14} />
            {val}
          </span>
        );
      }
    },
    { 
      header: 'Impressions', 
      accessor: 'impressions',
      render: (val) => (
        <div className="flex-center gap-sm">
          <Eye size={14} className="text-muted" />
          {val?.toLocaleString() || 0}
        </div>
      )
    },
    { 
      header: 'Clicks', 
      accessor: 'clicks',
      render: (val) => (
        <div className="flex-center gap-sm">
          <MousePointer size={14} className="text-muted" />
          {val?.toLocaleString() || 0}
        </div>
      )
    },
    { 
      header: 'CTR', 
      accessor: 'clicks',
      render: (val, row) => {
        const ctr = row.impressions > 0 ? ((val / row.impressions) * 100).toFixed(2) : 0;
        return <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{ctr}%</span>;
      }
    },
    { 
      header: 'Status', 
      accessor: 'status',
      render: (val) => <span className={`badge badge-${val === 'Active' ? 'success' : 'warning'}`}>{val}</span>
    }
  ];

  const totalImpressions = sponsors.reduce((sum, s) => sum + (s.impressions || 0), 0);
  const totalClicks = sponsors.reduce((sum, s) => sum + (s.clicks || 0), 0);
  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1>Sponsor Management</h1>
          <p>Real-time impression tracking and promotional analytics for club partners.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={handleOpenTiers} style={{ marginRight: 8 }}>
            <Award size={18} />
            <span>Edit Tiers</span>
          </button>
          <button className="btn btn-outline" onClick={loadSponsors} style={{ marginRight: 8 }}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button className="btn btn-primary" onClick={() => { setEditingSponsor(null); setSyncTrade(false); setShowModal(true); }}>
            <Plus size={18} />
            <span>New Sponsorship</span>
          </button>
        </div>
      </div>

      <div className="stats-marquee">
        <div className="stats-marquee-card">
          <div className="sm-card-top">
            <div className="sm-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6' }}>
              <Eye size={20} />
            </div>
          </div>
          <div className="sm-card-body">
            <h3>{totalImpressions.toLocaleString()}</h3>
            <p>Total Impressions</p>
          </div>
        </div>
        <div className="stats-marquee-card">
          <div className="sm-card-top">
            <div className="sm-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
              <MousePointer size={20} />
            </div>
          </div>
          <div className="sm-card-body">
            <h3>{totalClicks.toLocaleString()}</h3>
            <p>Total Clicks</p>
          </div>
        </div>
        <div className="stats-marquee-card">
          <div className="sm-card-top">
            <div className="sm-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="sm-card-body">
            <h3>{avgCtr}%</h3>
            <p>Avg. Conversion Rate</p>
          </div>
        </div>
      </div>

      <DataTable 
        title="Sponsorship Performance"
        columns={columns}
        data={sponsors}
        loading={loading}
        actions={[
          { label: 'Edit', icon: <Edit2 size={16} />, onClick: (row) => { setEditingSponsor(row); setSyncTrade(!!row.syncedTradeId); setShowModal(true); } },
          { label: 'Delete', icon: <Trash2 size={16} />, variant: 'danger', onClick: (row) => handleDeleteSponsor(row.id) }
        ]}
      />

      <Modal 
        title={editingSponsor ? "Edit Sponsor" : "Add New Sponsor"} 
        open={showModal}
        onClose={() => setShowModal(false)}
      >
        <form onSubmit={handleSaveSponsor}>
          <div className="form-group">
            <label>Sponsor Name</label>
            <input name="name" type="text" className="form-control" defaultValue={editingSponsor?.name} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Sponsorship Tier</label>
              <select name="tier" className="form-control" defaultValue={editingSponsor?.tier || currentTiers[0]}>
                {currentTiers.map(tier => (
                  <option key={tier} value={tier}>{tier}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Contract Expiry</label>
              <input name="expiry" type="date" className="form-control" defaultValue={editingSponsor?.expiry} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email Address</label>
              <input name="email" type="email" className="form-control" placeholder="sponsor@example.com" defaultValue={editingSponsor?.email} />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input name="phone" type="text" className="form-control" placeholder="+12345678" defaultValue={editingSponsor?.phone} />
            </div>
          </div>
          <div className="form-group">
            <label>Website / Landing Page</label>
            <input name="website" type="url" className="form-control" placeholder="https://" defaultValue={editingSponsor?.website} />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 12 }}>
            <input 
              type="checkbox" 
              id="syncTrade" 
              checked={syncTrade} 
              onChange={e => setSyncTrade(e.target.checked)} 
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="syncTrade" style={{ cursor: 'pointer', margin: 0, fontSize: '14px', fontWeight: '500' }}>Sync as Trade / Preferred Supplier</label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Sponsor'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Customize Tiers Modal */}
      <Modal open={showTiersModal} onClose={() => setShowTiersModal(false)} title="Customize Sponsor Tiers">
        <form onSubmit={handleSaveTiers}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Define the sponsorship tiers for your club. The ordering here will dictate how they appear in selection lists.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {tempTiers.map((tier, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-control"
                  value={tier}
                  onChange={(e) => {
                    const newTiers = [...tempTiers];
                    newTiers[idx] = e.target.value;
                    setTempTiers(newTiers);
                  }}
                  placeholder={`Tier ${idx + 1}`}
                  required
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn-icon danger"
                  onClick={() => setTempTiers(tempTiers.filter((_, i) => i !== idx))}
                  disabled={tempTiers.length <= 1}
                  style={{ flexShrink: 0 }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setTempTiers([...tempTiers, ''])}
            style={{ marginBottom: 20 }}
          >
            <Plus size={14} style={{ marginRight: 4 }} /> Add Tier
          </button>
          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={() => setShowTiersModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSavingTiers}>
              {isSavingTiers ? 'Saving...' : 'Save Tiers'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SponsorsPage;
