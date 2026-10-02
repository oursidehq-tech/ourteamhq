import React, { useState, useEffect } from 'react';
import { 
  Trophy, Calendar, Zap, Globe, Plus, Edit2, Trash2, Settings, 
  ExternalLink, RefreshCw, Radio, Video, Play, Pause, CheckCircle2, 
  MessageSquare, Flame, AlertCircle, Eye, Tv, Users, ArrowUpRight
} from 'lucide-react';
import { useClub } from '../context/ClubContext';
import { leagueService } from '../services/leagueService';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';

export const getEmbedStreamUrl = (url) => {
  if (!url) return null;
  const trimmed = url.trim();

  // YouTube Live / Video
  const ytMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/))([a-zA-Z0-9_-]{11})/);
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      src: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=0&rel=0`
    };
  }

  // Twitch
  const twitchMatch = trimmed.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
  if (twitchMatch && twitchMatch[1]) {
    const parentDomain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return {
      type: 'twitch',
      src: `https://player.twitch.tv/?channel=${twitchMatch[1]}&parent=${parentDomain}`
    };
  }

  // Direct MP4 / WebM / HLS
  if (trimmed.endsWith('.mp4') || trimmed.endsWith('.webm') || trimmed.includes('.m3u8')) {
    return {
      type: 'video',
      src: trimmed
    };
  }

  return {
    type: 'iframe',
    src: trimmed
  };
};

const LeaguePlatform = () => {
  const { selectedClubId } = useClub();
  const [activeTab, setActiveTab] = useState('fixtures'); // default to fixtures for fast access
  const [leagues, setLeagues] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Live Match Center State
  const [selectedLiveMatch, setSelectedLiveMatch] = useState(null);
  const [liveHomeScore, setLiveHomeScore] = useState(0);
  const [liveAwayScore, setLiveAwayScore] = useState(0);
  const [liveStatus, setLiveStatus] = useState('live'); // scheduled, live, halftime, completed
  const [livePeriod, setLivePeriod] = useState("1st Half");
  const [liveMinute, setLiveMinute] = useState("10'");
  const [streamUrl, setStreamUrl] = useState('');
  const [streamTitle, setStreamTitle] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [liveTimeline, setLiveTimeline] = useState([]);
  const [savingLive, setSavingLive] = useState(false);

  // New Event Form in Live Center
  const [eventMinute, setEventMinute] = useState('');
  const [eventType, setEventType] = useState('goal');
  const [eventTeam, setEventTeam] = useState('home');
  const [eventPlayer, setEventPlayer] = useState('');
  const [eventDesc, setEventDesc] = useState('');

  useEffect(() => {
    if (selectedClubId) {
      loadData();
    }
  }, [selectedClubId, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const leaguesData = await leagueService.getLeagues(selectedClubId);
      setLeagues(leaguesData);

      // Load all fixtures & matches from both leagueFixtures & game events
      const allFixtures = await leagueService.getAllFixturesAndMatches(selectedClubId);
      setFixtures(allFixtures);

      // If activeTab is live and we don't have a selected match yet, select the first live or upcoming match
      if (allFixtures.length > 0 && !selectedLiveMatch) {
        const liveOne = allFixtures.find(f => (f.status || '').toLowerCase() === 'live' || (f.status || '').toLowerCase() === 'inprogress');
        initLiveMatch(liveOne || allFixtures[0]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const initLiveMatch = (match) => {
    if (!match) return;
    setSelectedLiveMatch(match);
    setLiveHomeScore(typeof match.homeScore === 'number' ? match.homeScore : (typeof match.ourScore === 'number' ? match.ourScore : 0));
    setLiveAwayScore(typeof match.awayScore === 'number' ? match.awayScore : (typeof match.opponentScore === 'number' ? match.opponentScore : 0));
    setLiveStatus((match.status || 'live').toLowerCase());
    setLivePeriod(match.period || '1st Half');
    setLiveMinute(match.matchMinute || match.minute || "10'");
    setStreamUrl(match.streamUrl || '');
    setStreamTitle(match.streamTitle || `${match.homeTeam} vs ${match.awayTeam} Live Broadcast`);
    setIsStreaming(!!match.streamUrl || match.isStreaming === true);
    setLiveTimeline(Array.isArray(match.timeline) ? match.timeline : []);
  };

  const handleOpenLiveMatch = (fixture) => {
    initLiveMatch(fixture);
    setActiveTab('live');
  };

  const handleSaveLiveState = async () => {
    if (!selectedClubId || !selectedLiveMatch) return;
    setSavingLive(true);
    try {
      const liveData = {
        homeScore: liveHomeScore,
        awayScore: liveAwayScore,
        ourScore: liveHomeScore,
        opponentScore: liveAwayScore,
        score: `${liveHomeScore} - ${liveAwayScore}`,
        status: liveStatus,
        period: livePeriod,
        matchMinute: liveMinute,
        streamUrl: streamUrl.trim(),
        streamTitle: streamTitle.trim(),
        isStreaming: !!streamUrl.trim(),
        timeline: liveTimeline,
      };

      await leagueService.updateLiveMatch(selectedClubId, selectedLiveMatch.id, liveData);
      
      // Update local state
      setSelectedLiveMatch(prev => ({ ...prev, ...liveData }));
      setFixtures(prev => prev.map(f => f.id === selectedLiveMatch.id ? { ...f, ...liveData } : f));
      alert('Live Match Score & Streaming broadcasted successfully!');
    } catch (err) {
      alert('Failed to sync live state: ' + err.message);
    } finally {
      setSavingLive(false);
    }
  };

  const handleAddTimelineEvent = (e) => {
    e.preventDefault();
    if (!eventDesc && !eventPlayer) return;

    const newEvent = {
      id: `evt_${Date.now()}`,
      minute: eventMinute ? `${eventMinute.replace(/[^0-9]/g, '')}'` : `${liveMinute || "—"}`,
      team: eventTeam,
      type: eventType,
      player: eventPlayer.trim(),
      description: eventDesc.trim(),
      scoreAfter: `${liveHomeScore} - ${liveAwayScore}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const nextTimeline = [newEvent, ...liveTimeline];
    setLiveTimeline(nextTimeline);
    setEventPlayer('');
    setEventDesc('');
    setEventMinute('');

    // Auto-sync after adding a timeline event
    if (selectedClubId && selectedLiveMatch) {
      leagueService.updateLiveMatch(selectedClubId, selectedLiveMatch.id, {
        homeScore: liveHomeScore,
        awayScore: liveAwayScore,
        timeline: nextTimeline,
        status: liveStatus,
        period: livePeriod,
      });
    }
  };

  const handleDeleteTimelineEvent = (eventId) => {
    const next = liveTimeline.filter(ev => ev.id !== eventId);
    setLiveTimeline(next);
    if (selectedClubId && selectedLiveMatch) {
      leagueService.updateLiveMatch(selectedClubId, selectedLiveMatch.id, {
        timeline: next
      });
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
          leagueId: formData.get('leagueId') || '',
          competitionName: leagues.find(l => l.id === formData.get('leagueId'))?.name || 'League',
          streamUrl: formData.get('streamUrl') || '',
          status: editingItem?.status || 'scheduled'
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
          <div className="text-xs text-muted font-normal">{row.competitionName || row.leagueName || 'League Match'}</div>
        </div>
      )
    },
    { header: 'Date', accessor: 'date' },
    { header: 'Venue', accessor: 'venue' },
    { 
      header: 'Score / Status', 
      accessor: 'score',
      render: (val, row) => {
        const isLive = (row.status || '').toLowerCase() === 'live' || (row.status || '').toLowerCase() === 'inprogress';
        return (
          <div className="flex align-center gap-sm">
            {isLive ? (
              <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span className="notification-dot" style={{ position: 'static', width: 6, height: 6 }}></span>
                LIVE {val || '0 - 0'}
              </span>
            ) : val ? (
              <span className="badge badge-info">{val}</span>
            ) : (
              <span className="text-muted">Upcoming</span>
            )}
            {row.streamUrl && (
              <span title="Stream Available" style={{ color: 'var(--primary)', display: 'inline-flex' }}>
                <Video size={14} />
              </span>
            )}
          </div>
        );
      }
    }
  ];

  const embedStream = getEmbedStreamUrl(streamUrl);

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1>League &amp; Match Platform</h1>
          <p>Real-time live scores, video streaming, tournament fixtures, and governing body sync.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={loadData}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          {activeTab !== 'live' && (
            <button className="btn btn-primary" onClick={() => { setEditingItem(null); setShowModal(true); }}>
              <Plus size={18} />
              <span>New {activeTab === 'leagues' ? 'Competition' : 'Fixture'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="tabs-container mb-md">
        <div className="tabs">
          <button className={`tab ${activeTab === 'fixtures' ? 'active' : ''}`} onClick={() => setActiveTab('fixtures')}>
            <Calendar size={16} />
            Fixtures &amp; Matches ({fixtures.length})
          </button>
          <button className={`tab ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>
            <Radio size={16} className="text-danger" />
            🔴 Live Match Center &amp; Stream
          </button>
          <button className={`tab ${activeTab === 'leagues' ? 'active' : ''}`} onClick={() => setActiveTab('leagues')}>
            <Trophy size={16} />
            Competitions
          </button>
          <button className={`tab ${activeTab === 'api' ? 'active' : ''}`} onClick={() => setActiveTab('api')}>
            <Settings size={16} />
            API Configurations
          </button>
        </div>
      </div>

      {/* TAB 1: LIVE MATCH CENTER & STREAMING */}
      {activeTab === 'live' && (
        <div>
          {/* Match Picker Bar */}
          <div className="card mb-md" style={{ padding: '16px 20px', background: '#F8FAFC', border: '1px solid var(--border)' }}>
            <div className="flex align-center justify-between" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div className="flex align-center gap-md">
                <Radio size={20} className="text-danger" />
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Select Match for Live Broadcasting</h4>
                  <p className="text-muted text-sm" style={{ margin: 0 }}>Syncs instantly with the mobile app &amp; member portal</p>
                </div>
              </div>
              <div style={{ minWidth: 260 }}>
                <select 
                  className="form-control"
                  value={selectedLiveMatch?.id || ''} 
                  onChange={(e) => {
                    const match = fixtures.find(f => f.id === e.target.value);
                    if (match) initLiveMatch(match);
                  }}
                >
                  {fixtures.length === 0 && <option value="">No matches found</option>}
                  {fixtures.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.homeTeam} vs {f.awayTeam} ({f.date || 'Upcoming'}) {f.status === 'live' ? '🔴 [LIVE]' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {selectedLiveMatch ? (
            <div className="grid-2col" style={{ gap: 24, alignItems: 'start' }}>
              
              {/* Left Column: Digital Live Scoreboard & Status */}
              <div>
                <div className="card shadow-sm mb-md" style={{ border: '2px solid var(--primary-light)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: liveStatus === 'live' ? 'var(--danger)' : 'var(--primary)' }} />
                  
                  {/* Status & Period Control */}
                  <div className="flex align-center justify-between mb-md pb-sm" style={{ borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
                    <div className="flex align-center gap-sm">
                      <span className={`badge ${liveStatus === 'live' ? 'badge-danger' : liveStatus === 'completed' ? 'badge-info' : 'badge-default'}`} style={{ fontSize: 13, padding: '4px 10px', textTransform: 'uppercase', fontWeight: 700 }}>
                        {liveStatus === 'live' ? '🔴 LIVE IN PLAY' : liveStatus === 'halftime' ? '⏸️ HALF TIME' : liveStatus === 'completed' ? '🏁 FULL TIME' : '📅 SCHEDULED'}
                      </span>
                      <span className="badge badge-default" style={{ fontWeight: 600 }}>{livePeriod}</span>
                      <span className="text-sm text-muted font-mono">{liveMinute}</span>
                    </div>

                    <div className="flex gap-xs">
                      <button 
                        type="button"
                        className={`btn btn-sm ${liveStatus === 'live' ? 'btn-danger' : 'btn-outline'}`}
                        onClick={() => setLiveStatus('live')}
                      >
                        Live
                      </button>
                      <button 
                        type="button"
                        className={`btn btn-sm ${liveStatus === 'halftime' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => { setLiveStatus('halftime'); setLivePeriod('Half Time'); }}
                      >
                        Half Time
                      </button>
                      <button 
                        type="button"
                        className={`btn btn-sm ${liveStatus === 'completed' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => { setLiveStatus('completed'); setLivePeriod('Full Time'); }}
                      >
                        Full Time
                      </button>
                    </div>
                  </div>

                  {/* Big Digital Scoreboard */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', textAlign: 'center', padding: '10px 0 20px 0', gap: 16 }}>
                    
                    {/* Home Team */}
                    <div style={{ padding: '0 8px' }}>
                      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{selectedLiveMatch.homeTeam}</h3>
                      <div style={{ 
                        fontSize: 56, 
                        fontWeight: 900, 
                        fontFamily: 'monospace', 
                        color: 'var(--text)', 
                        background: '#F1F5F9', 
                        borderRadius: 14, 
                        padding: '10px 0',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)'
                      }}>
                        {liveHomeScore}
                      </div>
                      <div className="flex justify-center gap-xs mt-sm" style={{ flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => setLiveHomeScore(prev => prev + 1)}>+1</button>
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => setLiveHomeScore(prev => prev + 2)}>+2</button>
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => setLiveHomeScore(prev => prev + 3)}>+3</button>
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => setLiveHomeScore(prev => prev + 6)}>+6</button>
                        <button type="button" className="btn btn-sm btn-outline text-danger" onClick={() => setLiveHomeScore(prev => Math.max(0, prev - 1))}>-1</button>
                      </div>
                    </div>

                    {/* VS & Clock Center */}
                    <div style={{ padding: '0 4px' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-lighter)', marginBottom: 4 }}>VS</div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <input 
                          type="text" 
                          className="form-control" 
                          style={{ textAlign: 'center', width: 90, margin: '0 auto', fontSize: 13, padding: '4px 6px' }}
                          placeholder="45'"
                          value={liveMinute} 
                          onChange={(e) => setLiveMinute(e.target.value)} 
                        />
                      </div>
                    </div>

                    {/* Away Team */}
                    <div style={{ padding: '0 8px' }}>
                      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{selectedLiveMatch.awayTeam}</h3>
                      <div style={{ 
                        fontSize: 56, 
                        fontWeight: 900, 
                        fontFamily: 'monospace', 
                        color: 'var(--text)', 
                        background: '#F1F5F9', 
                        borderRadius: 14, 
                        padding: '10px 0',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)'
                      }}>
                        {liveAwayScore}
                      </div>
                      <div className="flex justify-center gap-xs mt-sm" style={{ flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => setLiveAwayScore(prev => prev + 1)}>+1</button>
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => setLiveAwayScore(prev => prev + 2)}>+2</button>
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => setLiveAwayScore(prev => prev + 3)}>+3</button>
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => setLiveAwayScore(prev => prev + 6)}>+6</button>
                        <button type="button" className="btn btn-sm btn-outline text-danger" onClick={() => setLiveAwayScore(prev => Math.max(0, prev - 1))}>-1</button>
                      </div>
                    </div>

                  </div>

                  {/* Broadcast & Period Row */}
                  <div className="form-row" style={{ marginTop: 12 }}>
                    <div className="form-group">
                      <label>Period Label</label>
                      <select className="form-control" value={livePeriod} onChange={e => setLivePeriod(e.target.value)}>
                        <option>1st Half</option>
                        <option>Half Time</option>
                        <option>2nd Half</option>
                        <option>Extra Time</option>
                        <option>Penalties</option>
                        <option>Full Time</option>
                        <option>Quarter 1</option>
                        <option>Quarter 2</option>
                        <option>Quarter 3</option>
                        <option>Quarter 4</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button 
                        type="button" 
                        className="btn btn-primary" 
                        style={{ width: '100%' }}
                        onClick={handleSaveLiveState}
                        disabled={savingLive}
                      >
                        {savingLive ? 'Broadcasting...' : '📡 Broadcast Score Live'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Log Match Event Card */}
                <div className="card shadow-sm">
                  <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Flame size={18} className="text-primary" />
                    Log Live Match Event / Commentary
                  </h4>

                  <form onSubmit={handleAddTimelineEvent}>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Minute</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="e.g. 24'" 
                          value={eventMinute} 
                          onChange={e => setEventMinute(e.target.value)} 
                        />
                      </div>
                      <div className="form-group">
                        <label>Team</label>
                        <select className="form-control" value={eventTeam} onChange={e => setEventTeam(e.target.value)}>
                          <option value="home">{selectedLiveMatch.homeTeam} (Home)</option>
                          <option value="away">{selectedLiveMatch.awayTeam} (Away)</option>
                          <option value="neutral">Neutral / Match Official</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Event Type</label>
                        <select className="form-control" value={eventType} onChange={e => setEventType(e.target.value)}>
                          <option value="goal">Goal ⚽</option>
                          <option value="try">Try / Touchdown 🏉</option>
                          <option value="point">Point / Basket 🏀</option>
                          <option value="yellow_card">Yellow Card 🟨</option>
                          <option value="red_card">Red Card 🟥</option>
                          <option value="sub">Substitution 🔄</option>
                          <option value="penalty">Penalty 🎯</option>
                          <option value="whistle">Whistle / Break ⏱️</option>
                          <option value="commentary">Commentary 📢</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Player Involved</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Player name (optional)" 
                          value={eventPlayer} 
                          onChange={e => setEventPlayer(e.target.value)} 
                        />
                      </div>
                      <div className="form-group">
                        <label>Event Details</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="e.g. Great header into top corner!" 
                          value={eventDesc} 
                          onChange={e => setEventDesc(e.target.value)} 
                          required 
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                      <button type="submit" className="btn btn-outline btn-sm">
                        <Plus size={14} className="mr-xs" /> Add to Live Feed
                      </button>
                    </div>
                  </form>

                  {/* Live Feed Timeline */}
                  <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <h5 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 12 }}>
                      Live Match Timeline ({liveTimeline.length})
                    </h5>

                    {liveTimeline.length === 0 ? (
                      <p className="text-muted text-sm text-center" style={{ padding: '16px 0' }}>No timeline events logged yet. Add goals, cards, and highlights above!</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
                        {liveTimeline.map((item) => (
                          <div 
                            key={item.id} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between',
                              padding: '10px 14px', 
                              borderRadius: 10, 
                              background: '#F8FAFC',
                              border: '1px solid var(--border)'
                            }}
                          >
                            <div className="flex align-center gap-md">
                              <span className="badge badge-default font-mono" style={{ fontWeight: 700, minWidth: 40, textAlign: 'center' }}>
                                {item.minute}
                              </span>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>
                                  {item.type === 'goal' ? '⚽ ' : item.type === 'yellow_card' ? '🟨 ' : item.type === 'red_card' ? '🟥 ' : item.type === 'sub' ? '🔄 ' : '📢 '}
                                  {item.player ? <strong>{item.player} — </strong> : ''}
                                  {item.description}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                  {item.team === 'home' ? selectedLiveMatch.homeTeam : item.team === 'away' ? selectedLiveMatch.awayTeam : 'Match'} • Score: {item.scoreAfter || `${liveHomeScore} - ${liveAwayScore}`}
                                </div>
                              </div>
                            </div>
                            <button 
                              className="btn-icon danger" 
                              onClick={() => handleDeleteTimelineEvent(item.id)}
                              title="Delete event"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Live Video Streaming Hub & Player */}
              <div>
                <div className="card shadow-sm mb-md">
                  <div className="flex align-center justify-between mb-md">
                    <h4 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Tv size={18} className="text-primary" />
                      Live Video Broadcast &amp; Stream
                    </h4>
                    {embedStream && (
                      <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                        <span className="notification-dot" style={{ position: 'static', width: 6, height: 6 }}></span>
                        STREAM ACTIVE
                      </span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Broadcast Title / Camera</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. GreenSports TV - Main Camera" 
                      value={streamTitle} 
                      onChange={e => setStreamTitle(e.target.value)} 
                    />
                  </div>

                  <div className="form-group">
                    <label>Live Stream URL (YouTube Live, Twitch, or Direct Video/HLS)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="https://www.youtube.com/watch?v=... or https://twitch.tv/..." 
                      value={streamUrl} 
                      onChange={e => setStreamUrl(e.target.value)} 
                    />
                    <p className="text-muted text-xs mt-xs">
                      Paste any public YouTube Live, Twitch channel, or MP4/HLS link. Mobile app and web users can watch live simultaneously.
                    </p>
                  </div>

                  {/* Embedded Live Player Preview */}
                  <div style={{ marginTop: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Live Stream Preview
                    </label>
                    
                    {embedStream ? (
                      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: 12, overflow: 'hidden', background: '#0F172A', border: '1px solid var(--border)' }}>
                        {embedStream.type === 'video' ? (
                          <video 
                            src={embedStream.src} 
                            controls 
                            autoPlay 
                            muted
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }} 
                          />
                        ) : (
                          <iframe 
                            src={embedStream.src} 
                            title="Live Stream Broadcast"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                          />
                        )}
                        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, background: 'rgba(239, 68, 68, 0.9)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }}></span>
                          LIVE BROADCAST
                        </div>
                      </div>
                    ) : (
                      <div style={{ 
                        height: 220, 
                        border: '2px dashed var(--border)', 
                        borderRadius: 12, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        background: '#F8FAFC',
                        color: 'var(--text-muted)'
                      }}>
                        <Video size={36} style={{ marginBottom: 8, opacity: 0.6 }} />
                        <div style={{ fontWeight: 600, fontSize: 14 }}>No Stream Configured</div>
                        <p style={{ fontSize: 12, margin: '4px 0 0 0' }}>Paste a YouTube or Twitch URL above to broadcast live</p>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    {streamUrl && (
                      <a href={streamUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                        <ExternalLink size={14} className="mr-xs" /> Open Direct Stream
                      </a>
                    )}
                    <button 
                      type="button" 
                      className="btn btn-primary btn-sm"
                      onClick={handleSaveLiveState}
                      disabled={savingLive}
                    >
                      <CheckCircle2 size={14} className="mr-xs" /> Save &amp; Broadcast Stream
                    </button>
                  </div>
                </div>

                {/* Match Information Card */}
                <div className="card shadow-sm">
                  <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Match Context</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                    <div>
                      <div className="text-muted text-xs">Competition</div>
                      <strong>{selectedLiveMatch.competitionName || selectedLiveMatch.leagueName || 'League Match'}</strong>
                    </div>
                    <div>
                      <div className="text-muted text-xs">Venue</div>
                      <strong>{selectedLiveMatch.venue || selectedLiveMatch.location || 'Home Ground'}</strong>
                    </div>
                    <div>
                      <div className="text-muted text-xs">Scheduled Date</div>
                      <strong>{selectedLiveMatch.date || 'Today'}</strong>
                    </div>
                    <div>
                      <div className="text-muted text-xs">Kick-off Time</div>
                      <strong>{selectedLiveMatch.startTime || '15:00'}</strong>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="card text-center" style={{ padding: '48px 24px' }}>
              <Trophy size={48} style={{ color: 'var(--text-lighter)', margin: '0 auto 12px auto' }} />
              <h3>No Matches Selected</h3>
              <p className="text-muted">Create a fixture or match first to start live scoring and streaming.</p>
              <button className="btn btn-primary" onClick={() => { setActiveTab('fixtures'); setShowModal(true); }}>
                <Plus size={16} className="mr-xs" /> Create New Fixture
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FIXTURES TABLE */}
      {activeTab === 'fixtures' && (
        <DataTable 
          title="Match Fixtures &amp; Scorecard"
          columns={fixtureColumns}
          data={fixtures}
          onRowClick={(row) => handleOpenLiveMatch(row)}
          actions={[
            { 
              label: '🔴 Live Center', 
              icon: <Radio size={16} className="text-danger" />, 
              onClick: (row) => handleOpenLiveMatch(row) 
            },
            { 
              label: 'Edit', 
              icon: <Edit2 size={16} />, 
              onClick: (row) => { setEditingItem(row); setShowModal(true); } 
            },
            { 
              label: 'Delete', 
              icon: <Trash2 size={16} />, 
              variant: 'danger', 
              onClick: async (row) => {
                if (window.confirm(`Delete this match fixture?`)) {
                  try {
                    await leagueService.deleteFixture(selectedClubId, row.id);
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

      {/* TAB 3: LEAGUES / COMPETITIONS */}
      {activeTab === 'leagues' && (
        <DataTable 
          title="Active Competitions"
          columns={leagueColumns}
          data={leagues}
          onRowClick={(row) => { setEditingItem(row); setShowModal(true); }}
          actions={[
            { label: 'Edit', icon: <Edit2 size={16} />, onClick: (row) => { setEditingItem(row); setShowModal(true); } },
            { 
              label: 'Delete', 
              icon: <Trash2 size={16} />, 
              variant: 'danger', 
              onClick: async (row) => {
                if (window.confirm(`Delete this competition?`)) {
                  try {
                    await leagueService.deleteLeague(selectedClubId, row.id);
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

      {/* TAB 4: API CONFIGURATIONS */}
      {activeTab === 'api' && (
        <div className="card">
          <div className="card-header">
            <h3><Zap size={20} className="text-primary" /> Live Score Integrations &amp; Webhooks</h3>
          </div>
          <div className="grid-2col">
            <div className="detail-card">
              <h5>Governing Body API Sync</h5>
              <p className="text-muted mb-md">Sync scores, fixtures, and ladders directly from your sports federation.</p>
              <div className="form-group">
                <label>API Key / Client Secret</label>
                <input type="password" underline="true" className="form-control" placeholder="••••••••••••••••" />
              </div>
              <button className="btn btn-primary btn-sm">Connect Provider</button>
            </div>
            <div className="detail-card">
              <h5>Outbound Live Score Webhook</h5>
              <p className="text-muted mb-md">Stream live score updates to your own LED scoreboards or website.</p>
              <div className="form-group">
                <label>Webhook Destination URL</label>
                <input type="text" className="form-control" placeholder="https://api.yourclub.com/live-scores" />
              </div>
              <button className="btn btn-outline btn-sm">Save Config</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT FIXTURE OR COMPETITION MODAL */}
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
                <select name="leagueId" className="form-control" defaultValue={editingItem?.leagueId || leagues[0]?.id}>
                  <option value="">Friendly / Independent Match</option>
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
              <div className="form-row">
                <div className="form-group">
                  <label>Date &amp; Time</label>
                  <input name="date" type="datetime-local" className="form-control" defaultValue={editingItem?.date} required />
                </div>
                <div className="form-group">
                  <label>Venue</label>
                  <input name="venue" type="text" className="form-control" defaultValue={editingItem?.venue} required />
                </div>
              </div>
              <div className="form-group">
                <label>Live Stream URL (Optional)</label>
                <input name="streamUrl" type="url" className="form-control" placeholder="https://youtube.com/live/... or https://twitch.tv/..." defaultValue={editingItem?.streamUrl} />
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
