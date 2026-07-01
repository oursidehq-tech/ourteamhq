import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, Zap, Globe, Plus, Edit2, Trash2, Settings, ExternalLink, RefreshCw } from 'lucide-react';
import { useClub } from '../context/ClubContext';
import { leagueService } from '../services/leagueService';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';

const LeaguePlatform = () => {
  const { selectedClubId } = useClub();
  const [activeTab, setActiveTab] = useState('leagues');
  const [leagues, setLeagues] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (selectedClubId) {
      loadData();
    }
  }, [selectedClubId, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'leagues') {
        const data = await leagueService.getLeagues(selectedClubId);
        setLeagues(data);
      } else if (activeTab === 'fixtures') {
        // Fetch fixtures for all leagues in this club
        const allFixtures = [];
        for (const league of leagues) {
          const data = await leagueService.getFixtures(selectedClubId, league.id);
          allFixtures.push(...data.map(f => ({ ...f, leagueName: league.name })));
        }
        setFixtures(allFixtures);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!selectedClubId) {
      alert('Please select a club first.');
      return;
    }
    const formData = new FormData(e.target);
    setIsSaving(true);
    
    try {
      if (activeTab === 'leagues') {
        const data = {
          name: formData.get('name'),
          season: formData.get('season'),
          type: formData.get('type'),
          governingBody: formData.get('governingBody'),
          status: editingItem?.status || 'Active'
        };
        if (editingItem) {
          await leagueService.updateLeague(selectedClubId, editingItem.id, data);
        } else {
          await leagueService.createLeague(selectedClubId, data);
        }
      } else {
        const data = {
          homeTeam: formData.get('homeTeam'),
          awayTeam: formData.get('awayTeam'),
          date: formData.get('date'),
          venue: formData.get('venue'),
          leagueId: formData.get('leagueId')
        };
        if (editingItem) {
          await leagueService.updateFixture(selectedClubId, editingItem.id, data);
        } else {
          await leagueService.createFixture(selectedClubId, data);
        }
      }
      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Failed to save: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const leagueColumns = [
    { 
      header: 'League Name', 
      accessor: 'name',
      render: (val, row) => (
        <div className="flex-center gap-md">
          <div className="sm-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Trophy size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{val}</div>
            <div className="text-muted text-sm">{row.season || '2024 Season'}</div>
          </div>
        </div>
      )
    },
    { header: 'Type', accessor: 'type' },
    { 
      header: 'Status', 
      accessor: 'status',
      render: (val) => (
        <span className={`badge badge-${val === 'Active' ? 'success' : 'warning'}`}>
          {val || 'Active'}
        </span>
      )
    },
    { header: 'Governing Body', accessor: 'governingBody', render: (val) => val || 'None' }
  ];

  const fixtureColumns = [
    { 
      header: 'Match Details', 
      accessor: 'homeTeam',
      render: (val, row) => (
        <div style={{ fontWeight: 600 }}>
          {row.homeTeam} vs {row.awayTeam}
          <div className="text-xs text-muted font-normal">{row.leagueName}</div>
        </div>
      )
    },
    { header: 'Date', accessor: 'date' },
    { header: 'Venue', accessor: 'venue' },
    { 
      header: 'Result', 
      accessor: 'score',
      render: (val) => val ? <span className="badge badge-info">{val}</span> : <span className="text-muted">Upcoming</span>
    }
  ];

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1>League Platform</h1>
          <p>Manage competitions, fixtures, governing body integrations, and live score APIs.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={loadData}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button className="btn btn-primary" onClick={() => { setEditingItem(null); setShowModal(true); }}>
            <Plus size={18} />
            <span>New {activeTab === 'leagues' ? 'Competition' : 'Fixture'}</span>
          </button>
        </div>
      </div>

      <div className="tabs-container mb-md">
        <div className="tabs">
          <button className={`tab ${activeTab === 'leagues' ? 'active' : ''}`} onClick={() => setActiveTab('leagues')}>
            <Trophy size={16} />
            Competitions
          </button>
          <button className={`tab ${activeTab === 'fixtures' ? 'active' : ''}`} onClick={() => setActiveTab('fixtures')}>
            <Calendar size={16} />
            Fixtures
          </button>
          <button className={`tab ${activeTab === 'api' ? 'active' : ''}`} onClick={() => setActiveTab('api')}>
            <Settings size={16} />
            API Configurations
          </button>
        </div>
      </div>

      {activeTab === 'api' ? (
        <div className="card">
          <div className="card-header">
            <h3><Zap size={20} className="text-primary" /> Live Score Integrations</h3>
          </div>
          <div className="grid-2col">
            <div className="detail-card">
              <h5>FA Connect API</h5>
              <p className="text-muted mb-md">Sync scores and fixtures directly from your governing body.</p>
              <div className="form-group">
                <label>API Key</label>
                <input type="password" underline className="form-control" placeholder="••••••••••••••••" />
              </div>
              <button className="btn btn-primary btn-sm">Connect Provider</button>
            </div>
            <div className="detail-card">
              <h5>Custom Webhook</h5>
              <p className="text-muted mb-md">Send live score updates to your own external platforms.</p>
              <div className="form-group">
                <label>Webhook URL</label>
                <input type="text" className="form-control" placeholder="https://api.yourclub.com/scores" />
              </div>
              <button className="btn btn-outline btn-sm">Save Config</button>
            </div>
          </div>
        </div>
      ) : (
        <DataTable 
          title={activeTab === 'leagues' ? "Active Competitions" : "Upcoming Fixtures"}
          columns={activeTab === 'leagues' ? leagueColumns : fixtureColumns}
          data={activeTab === 'leagues' ? leagues : fixtures}
          actions={[
            { label: 'Edit', icon: <Edit2 size={16} />, onClick: (row) => { setEditingItem(row); setShowModal(true); } },
            { 
              label: 'Delete', 
              icon: <Trash2 size={16} />, 
              variant: 'danger', 
              onClick: async (row) => {
                if (window.confirm(`Delete this ${activeTab === 'leagues' ? 'competition' : 'fixture'}?`)) {
                  try {
                    if (activeTab === 'leagues') {
                      await leagueService.deleteLeague(selectedClubId, row.id);
                    } else {
                      await leagueService.deleteFixture(selectedClubId, row.id);
                    }
                    loadData();
                  } catch (err) {
                    alert(err.message);
                  }
                }
              } 
            }
          ]}
          loading={loading}
        />
      )}

      <Modal 
        title={editingItem ? `Edit ${activeTab === 'leagues' ? 'Competition' : 'Fixture'}` : `Create New ${activeTab === 'leagues' ? 'Competition' : 'Fixture'}`} 
        open={showModal}
        onClose={() => setShowModal(false)}
      >
        <form onSubmit={handleSaveItem}>
          {activeTab === 'leagues' ? (
            <>
              <div className="form-group">
                <label>League Name</label>
                <input name="name" type="text" className="form-control" placeholder="e.g. Premier League" defaultValue={editingItem?.name} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Season</label>
                  <input name="season" type="text" className="form-control" placeholder="e.g. 2024" defaultValue={editingItem?.season} required />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select name="type" className="form-control" defaultValue={editingItem?.type || 'League'}>
                    <option>Tournament</option>
                    <option>League</option>
                    <option>Cup</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Governing Body Integration</label>
                <select name="governingBody" className="form-control" defaultValue={editingItem?.governingBody || ''}>
                  <option value="">None</option>
                  <option value="FA Connect">FA Connect</option>
                  <option value="US Soccer Connect">US Soccer Connect</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label>League / Competition</label>
                <select name="leagueId" className="form-control" defaultValue={editingItem?.leagueId || leagues[0]?.id} required>
                  {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Home Team</label>
                  <input name="homeTeam" type="text" className="form-control" defaultValue={editingItem?.homeTeam} required />
                </div>
                <div className="form-group">
                  <label>Away Team</label>
                  <input name="awayTeam" type="text" className="form-control" defaultValue={editingItem?.awayTeam} required />
                </div>
              </div>
              <div className="form-group">
                <label>Date & Time</label>
                <input name="date" type="datetime-local" className="form-control" defaultValue={editingItem?.date} required />
              </div>
              <div className="form-group">
                <label>Venue</label>
                <input name="venue" type="text" className="form-control" defaultValue={editingItem?.venue} required />
              </div>
            </>
          )}
          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LeaguePlatform;
