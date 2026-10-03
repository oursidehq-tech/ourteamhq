import React, { useState, useEffect } from 'react';
import { 
  Trophy, Calendar, Zap, Globe, Plus, Edit2, Trash2, Settings, 
  ExternalLink, RefreshCw, Radio, Video, Play, Pause, CheckCircle2, 
  Flame, AlertCircle, Eye, Tv, Users, ArrowUpRight, Undo2,
  ChevronRight, Volume2, Shield, CircleDot
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

export default function LeaguePlatform() {
  const { selectedClubId } = useClub();
  const [activeTab, setActiveTab] = useState('live'); // Default to Live Match Center as requested!
  const [leagues, setLeagues] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sports Mode: 'cricket' (Cricbuzz) or 'general' (Soccer/Basketball)
  const [sportMode, setSportMode] = useState('cricket');

  // Live Match Selected
  const [selectedLiveMatch, setSelectedLiveMatch] = useState(null);
  const [liveStatus, setLiveStatus] = useState('live'); // scheduled, live, break, completed
  const [livePeriod, setLivePeriod] = useState("2nd Inning");
  const [streamUrl, setStreamUrl] = useState('');
  const [streamTitle, setStreamTitle] = useState('');
  const [showStreamPlayer, setShowStreamPlayer] = useState(false);
  const [savingLive, setSavingLive] = useState(false);

  // General Scores
  const [liveHomeScore, setLiveHomeScore] = useState(0);
  const [liveAwayScore, setLiveAwayScore] = useState(0);

  // 🏏 Cricbuzz Live Cricket State
  const [cricket, setCricket] = useState({
    battingTeam: 'home', // 'home' | 'away'
    homeRuns: 148,
    homeWickets: 3,
    homeOvers: '16.4',
    awayRuns: 182,
    awayWickets: 6,
    awayOvers: '20.0',
    target: 183,
    toss: 'Sydney Sixers won the toss and elected to bat first',
    striker: { name: 'D. Warner', runs: 64, balls: 38, fours: 7, sixes: 2 },
    nonStriker: { name: 'M. Marsh', runs: 32, balls: 22, fours: 3, sixes: 1 },
    bowler: { name: 'S. Abbott', overs: '3.4', maidens: 0, runs: 31, wickets: 2 },
    partnership: { runs: 58, balls: 34 },
    lastWicket: 'T. Head c Henriques b Abbott 28 (16) - 90/3 (10.2 ov)',
    recentBalls: ['1', '0', '4', '6', 'W', '1', '2', '1', '4', '•']
  });

  // Undo History Stack for Ball-by-ball
  const [undoStack, setUndoStack] = useState([]);

  // Live Commentary Feed
  const [liveTimeline, setLiveTimeline] = useState([]);
  const [customCommentary, setCustomCommentary] = useState({ over: '', title: '', desc: '', author: 'Official Scorer' });

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

      const allFixtures = await leagueService.getAllFixturesAndMatches(selectedClubId);
      setFixtures(allFixtures);

      if (allFixtures.length > 0 && !selectedLiveMatch) {
        const liveOne = allFixtures.find(f => (f.status || '').toLowerCase() === 'live');
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
    
    // Check if match contains cricket data or infer from teams
    const cData = match.cricketState || {};
    const isCricket = match.sport?.toLowerCase() === 'cricket' || 
      (match.homeTeam?.toLowerCase().includes('sixers') || match.awayTeam?.toLowerCase().includes('sixers') || match.homeTeam?.toLowerCase().includes('warrior'));
    
    if (isCricket) setSportMode('cricket');

    const homeRuns = typeof cData.homeRuns === 'number' ? cData.homeRuns : (typeof match.homeScore === 'number' ? match.homeScore : 148);
    const awayRuns = typeof cData.awayRuns === 'number' ? cData.awayRuns : (typeof match.awayScore === 'number' ? match.awayScore : 182);

    setLiveHomeScore(homeRuns);
    setLiveAwayScore(awayRuns);
    setLiveStatus((match.status || 'live').toLowerCase());
    setLivePeriod(match.period || '2nd Inning');
    setStreamUrl(match.streamUrl || '');
    setStreamTitle(match.streamTitle || `${match.homeTeam} vs ${match.awayTeam} Live Broadcast`);
    if (match.streamUrl) setShowStreamPlayer(true);

    const initialBalls = Array.isArray(cData.recentBalls) && cData.recentBalls.length > 0 
      ? cData.recentBalls 
      : ['1', '0', '4', '6', 'W', '1', '2', '1', '4', '•'];

    setCricket({
      battingTeam: cData.battingTeam || 'home',
      homeRuns,
      homeWickets: typeof cData.homeWickets === 'number' ? cData.homeWickets : 3,
      homeOvers: cData.homeOvers || '16.4',
      awayRuns,
      awayWickets: typeof cData.awayWickets === 'number' ? cData.awayWickets : 6,
      awayOvers: cData.awayOvers || '20.0',
      target: cData.target || 183,
      toss: cData.toss || `${match.awayTeam || 'Sydney Sixers'} won the toss and elected to bat first`,
      striker: cData.striker || { name: 'D. Warner', runs: 64, balls: 38, fours: 7, sixes: 2 },
      nonStriker: cData.nonStriker || { name: 'M. Marsh', runs: 32, balls: 22, fours: 3, sixes: 1 },
      bowler: cData.bowler || { name: 'S. Abbott', overs: '3.4', maidens: 0, runs: 31, wickets: 2 },
      partnership: cData.partnership || { runs: 58, balls: 34 },
      lastWicket: cData.lastWicket || 'T. Head c Henriques b Abbott 28 (16) - 90/3 (10.2 ov)',
      recentBalls: initialBalls
    });

    setLiveTimeline(Array.isArray(match.timeline) && match.timeline.length > 0 ? match.timeline : [
      { id: '1', over: '16.4', team: 'home', text: 'S. Abbott to D. Warner, FOUR! Slapped through point with tremendous power and placement!', type: 'four', time: 'Just now' },
      { id: '2', over: '16.3', team: 'home', text: 'S. Abbott to D. Warner, no run, good length delivery outside off, steered to backward point.', type: 'dot', time: '1 min ago' },
      { id: '3', over: '16.2', team: 'home', text: 'S. Abbott to M. Marsh, 1 run, pushed down to long-on for an easy single.', type: 'single', time: '2 mins ago' },
      { id: '4', over: '16.1', team: 'home', text: 'S. Abbott to M. Marsh, 2 runs, clipped off the pads into the deep mid-wicket pocket.', type: 'two', time: '3 mins ago' }
    ]);
  };

  // 🏏 Cricbuzz Ball-by-Ball Scoring Engine
  const scoreBall = (ballType, runs = 0, isExtra = false, isWicket = false) => {
    if (!selectedLiveMatch) return;

    // Push to undo stack
    setUndoStack(prev => [...prev, { cricket: { ...cricket }, timeline: [...liveTimeline] }]);

    const isHomeBatting = cricket.battingTeam === 'home';
    const currentRuns = isHomeBatting ? cricket.homeRuns : cricket.awayRuns;
    const currentWickets = isHomeBatting ? cricket.homeWickets : cricket.awayWickets;
    const currentOversStr = isHomeBatting ? cricket.homeOvers : cricket.awayOvers;

    // Calculate over and ball
    const [overNum, ballNum] = currentOversStr.split('.').map(n => parseInt(n || '0', 10));
    let nextOverNum = overNum;
    let nextBallNum = ballNum;

    if (!isExtra) {
      if (ballNum >= 5) {
        nextOverNum = overNum + 1;
        nextBallNum = 0;
      } else {
        nextBallNum = ballNum + 1;
      }
    }

    const nextOversFormatted = `${nextOverNum}.${nextBallNum}`;
    const nextTotalRuns = currentRuns + runs;
    const nextTotalWickets = isWicket ? Math.min(10, currentWickets + 1) : currentWickets;

    // Update Striker and Bowler stats
    let nextStriker = { ...cricket.striker };
    let nextNonStriker = { ...cricket.nonStriker };
    let nextBowler = { ...cricket.bowler };

    if (!isExtra) {
      nextStriker.balls += 1;
      nextStriker.runs += runs;
      if (runs === 4) nextStriker.fours += 1;
      if (runs === 6) nextStriker.sixes += 1;
    }
    nextBowler.runs += runs;
    if (isWicket) nextBowler.wickets += 1;

    // Rotate strike on odd runs (1, 3) or at end of over (6 balls)
    let shouldSwap = (runs % 2 !== 0);
    if (!isExtra && nextBallNum === 0) {
      // Over complete
      shouldSwap = !shouldSwap;
    }

    if (shouldSwap) {
      const temp = nextStriker;
      nextStriker = nextNonStriker;
      nextNonStriker = temp;
    }

    // Ball label for timeline pill
    let pillLabel = ballType;
    if (ballType === '0') pillLabel = '•';

    const nextBalls = [pillLabel, ...cricket.recentBalls.slice(0, 15)];

    // Generate dynamic Cricbuzz commentary line
    const bowlerName = nextBowler.name || 'Bowler';
    const strikerName = nextStriker.name || 'Batter';
    let commentaryDesc = `${bowlerName} to ${strikerName}, `;

    if (ballType === '0') commentaryDesc += `no run, defended solidly towards cover.`;
    else if (ballType === '1') commentaryDesc += `1 run, worked into the leg side gap for a brisk single.`;
    else if (ballType === '2') commentaryDesc += `2 runs, driven into the deep cover space with positive running.`;
    else if (ballType === '3') commentaryDesc += `3 runs, nicely placed through extra cover, outfield slows it down.`;
    else if (ballType === '4') commentaryDesc += `FOUR! Sublime timing! Leans into the drive and strokes it through cover point!`;
    else if (ballType === '6') commentaryDesc += `SIX! Dispatched with majesty! Launched high over long-on into the crowd!`;
    else if (ballType === 'W') commentaryDesc += `OUT! Breakthrough! ${strikerName} departs, caught in the deep trying to clear the ropes!`;
    else if (ballType === 'Wd') commentaryDesc += `Wide ball, slipped down leg side, signaled by the umpire.`;
    else if (ballType === 'Nb') commentaryDesc += `No ball, overstepping the crease! Free hit coming up!`;

    const newCommentaryEvent = {
      id: `ball_${Date.now()}`,
      over: `${overNum}.${ballNum + 1}`,
      team: cricket.battingTeam,
      text: commentaryDesc,
      type: ballType === '4' ? 'four' : ballType === '6' ? 'six' : ballType === 'W' ? 'wicket' : 'normal',
      time: 'Just now'
    };

    const nextTimeline = [newCommentaryEvent, ...liveTimeline];

    const updatedCricket = {
      ...cricket,
      homeRuns: isHomeBatting ? nextTotalRuns : cricket.homeRuns,
      homeWickets: isHomeBatting ? nextTotalWickets : cricket.homeWickets,
      homeOvers: isHomeBatting ? nextOversFormatted : cricket.homeOvers,
      awayRuns: !isHomeBatting ? nextTotalRuns : cricket.awayRuns,
      awayWickets: !isHomeBatting ? nextTotalWickets : cricket.awayWickets,
      awayOvers: !isHomeBatting ? nextOversFormatted : cricket.awayOvers,
      striker: nextStriker,
      nonStriker: nextNonStriker,
      bowler: nextBowler,
      recentBalls: nextBalls
    };

    setCricket(updatedCricket);
    setLiveHomeScore(updatedCricket.homeRuns);
    setLiveAwayScore(updatedCricket.awayRuns);
    setLiveTimeline(nextTimeline);

    // Auto-sync live broadcast
    syncLiveMatchState(updatedCricket, nextTimeline);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const lastState = undoStack[undoStack.length - 1];
    setCricket(lastState.cricket);
    setLiveTimeline(lastState.timeline);
    setLiveHomeScore(lastState.cricket.homeRuns);
    setLiveAwayScore(lastState.cricket.awayRuns);
    setUndoStack(prev => prev.slice(0, -1));
    syncLiveMatchState(lastState.cricket, lastState.timeline);
  };

  const handleSwapStrike = () => {
    setCricket(prev => ({
      ...prev,
      striker: prev.nonStriker,
      nonStriker: prev.striker
    }));
  };

  const handleSwitchInnings = () => {
    setCricket(prev => ({
      ...prev,
      battingTeam: prev.battingTeam === 'home' ? 'away' : 'home'
    }));
    setLivePeriod(prev => prev === '1st Inning' ? '2nd Inning' : '1st Inning');
  };

  const syncLiveMatchState = async (cState = cricket, tLine = liveTimeline) => {
    if (!selectedClubId || !selectedLiveMatch) return;
    setSavingLive(true);
    try {
      const isHomeBatting = cState.battingTeam === 'home';
      const battingScore = isHomeBatting ? `${cState.homeRuns}/${cState.homeWickets} (${cState.homeOvers} ov)` : `${cState.awayRuns}/${cState.awayWickets} (${cState.awayOvers} ov)`;
      const bowlingScore = isHomeBatting ? `${cState.awayRuns}/${cState.awayWickets} (${cState.awayOvers} ov)` : `${cState.homeRuns}/${cState.homeWickets} (${cState.homeOvers} ov)`;
      const scoreSummary = `${selectedLiveMatch.homeTeam} ${cState.homeRuns}/${cState.homeWickets} vs ${selectedLiveMatch.awayTeam} ${cState.awayRuns}/${cState.awayWickets}`;

      const liveData = {
        sport: sportMode,
        homeScore: cState.homeRuns,
        awayScore: cState.awayRuns,
        score: scoreSummary,
        status: liveStatus,
        period: livePeriod,
        matchMinute: isHomeBatting ? `${cState.homeOvers} ov` : `${cState.awayOvers} ov`,
        streamUrl: streamUrl.trim(),
        streamTitle: streamTitle.trim(),
        isStreaming: !!streamUrl.trim(),
        cricketState: cState,
        timeline: tLine
      };

      await leagueService.updateLiveMatch(selectedClubId, selectedLiveMatch.id, liveData);
      setSelectedLiveMatch(prev => ({ ...prev, ...liveData }));
    } catch (err) {
      console.warn('Sync notice:', err.message);
    } finally {
      setSavingLive(false);
    }
  };

  const handleAddCustomCommentary = (e) => {
    e.preventDefault();
    if (!customCommentary.desc.trim()) return;

    const newEvt = {
      id: `comment_${Date.now()}`,
      over: customCommentary.over || (cricket.battingTeam === 'home' ? cricket.homeOvers : cricket.awayOvers),
      team: cricket.battingTeam,
      text: customCommentary.title ? `[${customCommentary.title}] ${customCommentary.desc}` : customCommentary.desc,
      type: 'custom',
      time: 'Just now'
    };

    const nextTimeline = [newEvt, ...liveTimeline];
    setLiveTimeline(nextTimeline);
    setCustomCommentary({ over: '', title: '', desc: '', author: 'Official Scorer' });
    syncLiveMatchState(cricket, nextTimeline);
  };

  // Run rates calculation
  const getOversDecimal = (oversStr) => {
    const [ov, b] = (oversStr || '0.0').split('.').map(Number);
    return (ov || 0) + (b || 0) / 6;
  };

  const battingRuns = cricket.battingTeam === 'home' ? cricket.homeRuns : cricket.awayRuns;
  const battingOversDec = getOversDecimal(cricket.battingTeam === 'home' ? cricket.homeOvers : cricket.awayOvers);
  const crr = battingOversDec > 0 ? (battingRuns / battingOversDec).toFixed(2) : '0.00';

  const bowlingRuns = cricket.battingTeam === 'home' ? cricket.awayRuns : cricket.homeRuns;
  const target = bowlingRuns + 1;
  const runsNeeded = Math.max(0, target - battingRuns);
  const maxOvers = 20; // Default T20
  const remainingOversDec = Math.max(0.1, maxOvers - battingOversDec);
  const rrr = runsNeeded > 0 ? (runsNeeded / remainingOversDec).toFixed(2) : '0.00';
  const remainingBalls = Math.max(0, Math.round(remainingOversDec * 6));

  const embedStream = getEmbedStreamUrl(streamUrl);

  return (
    <div className="league-platform-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2>League &amp; Match Platform</h2>
          <p className="text-muted">Cricbuzz-grade real-time match scoring, live commentary, ball telemetry &amp; live streaming</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={loadData}>
            <RefreshCw size={14} className="mr-xs" /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          <button className={`tab ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>
            <Radio size={16} className="text-danger" />
            🔴 Cricbuzz Live Center
          </button>
          <button className={`tab ${activeTab === 'fixtures' ? 'active' : ''}`} onClick={() => setActiveTab('fixtures')}>
            <Calendar size={16} />
            Fixtures &amp; Matches ({fixtures.length})
          </button>
          <button className={`tab ${activeTab === 'leagues' ? 'active' : ''}`} onClick={() => setActiveTab('leagues')}>
            <Trophy size={16} />
            Competitions ({leagues.length})
          </button>
        </div>
      </div>

      {/* 🔴 TAB: CRICBUZZ LIVE CENTER */}
      {activeTab === 'live' && (
        <div className="cricbuzz-live-container">
          
          {/* Match & Sport Selector Toolbar */}
          <div className="card shadow-sm mb-md" style={{ padding: '16px 20px', background: '#F8FAFC', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              
              {/* Match dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 280, flex: 1 }}>
                <span className="cricbuzz-badge-live">
                  <Radio size={12} /> LIVE SCORER
                </span>
                <select 
                  className="form-control"
                  style={{ fontWeight: 700, fontSize: 14 }}
                  value={selectedLiveMatch?.id || ''} 
                  onChange={(e) => {
                    const match = fixtures.find(f => f.id === e.target.value);
                    if (match) initLiveMatch(match);
                  }}
                >
                  {fixtures.length === 0 && <option value="">No matches scheduled</option>}
                  {fixtures.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.homeTeam} vs {f.awayTeam} • {f.competitionName || 'Match'} ({f.date || 'Today'}) {f.status === 'live' ? '🔴 LIVE' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mode & Stream Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Sports Mode Switcher */}
                <div style={{ display: 'flex', background: '#e2e8f0', padding: 3, borderRadius: 8, gap: 4 }}>
                  <button 
                    type="button"
                    onClick={() => setSportMode('cricket')}
                    style={{
                      border: 'none',
                      background: sportMode === 'cricket' ? 'var(--primary)' : 'transparent',
                      color: sportMode === 'cricket' ? '#fff' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: 12,
                      padding: '5px 12px',
                      borderRadius: 6,
                      cursor: 'pointer'
                    }}
                  >
                    🏏 Cricket
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSportMode('general')}
                    style={{
                      border: 'none',
                      background: sportMode === 'general' ? 'var(--primary)' : 'transparent',
                      color: sportMode === 'general' ? '#fff' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: 12,
                      padding: '5px 12px',
                      borderRadius: 6,
                      cursor: 'pointer'
                    }}
                  >
                    ⚽ Football / Other
                  </button>
                </div>

                {/* Live Video Toggle */}
                <button 
                  type="button" 
                  className={`btn btn-sm ${showStreamPlayer ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setShowStreamPlayer(!showStreamPlayer)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Tv size={14} /> {showStreamPlayer ? 'Hide Video Stream' : 'Show Video Stream'}
                </button>

                {/* Broadcast State Indicator */}
                <button 
                  type="button" 
                  className="btn btn-sm btn-primary"
                  onClick={() => syncLiveMatchState()}
                  disabled={savingLive}
                >
                  {savingLive ? 'Broadcasting...' : '📡 Broadcast Sync'}
                </button>
              </div>

            </div>
          </div>

          {selectedLiveMatch ? (
            <div>
              {/* Optional Collapsible Stream Player */}
              {showStreamPlayer && (
                <div className="card shadow-sm mb-md" style={{ padding: 16, background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, color: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Tv size={18} className="text-primary" />
                      <strong style={{ fontSize: 15 }}>Live Broadcast Player</strong>
                      <span className="cricbuzz-badge-live">STREAM ON AIR</span>
                    </div>
                    <input 
                      type="text" 
                      placeholder="YouTube / Twitch Live Embed URL" 
                      value={streamUrl} 
                      onChange={e => setStreamUrl(e.target.value)}
                      style={{ background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 12, width: '320px' }}
                    />
                  </div>
                  {embedStream ? (
                    <div style={{ position: 'relative', width: '100%', paddingTop: '45%', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
                      <iframe 
                        src={embedStream.src} 
                        title="Live Match Broadcast" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen 
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} 
                      />
                    </div>
                  ) : (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', border: '1px dashed #334155', borderRadius: 10 }}>
                      No active stream URL provided. Paste a YouTube or Twitch URL in the input above.
                    </div>
                  )}
                </div>
              )}

              {/* 🏏 CRICBUZZ PRO SCORECARD BANNER */}
              <div className="cricbuzz-header-card mb-md">
                
                {/* Meta Top Line */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="cricbuzz-badge-live">
                      <Radio size={12} /> {liveStatus.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>
                      {selectedLiveMatch.competitionName || 'GreenSports Premier League'} • {selectedLiveMatch.venue || 'SCG Stadium'}
                    </span>
                  </div>
                  
                  {/* Status Toggle buttons */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button 
                      type="button" 
                      className={`btn btn-xs ${liveStatus === 'live' ? 'btn-danger' : 'btn-outline'}`}
                      style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
                      onClick={() => setLiveStatus('live')}
                    >
                      In Play (Live)
                    </button>
                    <button 
                      type="button" 
                      className={`btn btn-xs ${liveStatus === 'break' ? 'btn-primary' : 'btn-outline'}`}
                      style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
                      onClick={() => setLiveStatus('break')}
                    >
                      Innings Break
                    </button>
                    <button 
                      type="button" 
                      className={`btn btn-xs ${liveStatus === 'completed' ? 'btn-primary' : 'btn-outline'}`}
                      style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
                      onClick={() => setLiveStatus('completed')}
                    >
                      Match Finished
                    </button>
                  </div>
                </div>

                {/* Big Match Score Display */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 20 }}>
                  
                  {/* Team 1 (Home) */}
                  <div style={{ padding: '0 10px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: cricket.battingTeam === 'home' ? '#10b981' : '#f8fafc' }}>
                        {selectedLiveMatch.homeTeam}
                      </h2>
                      {cricket.battingTeam === 'home' && (
                        <span style={{ background: '#10b981', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>
                          BATTING
                        </span>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span style={{ fontSize: 44, fontWeight: 900, fontFamily: 'monospace', color: '#ffffff' }}>
                        {cricket.homeRuns}/{cricket.homeWickets}
                      </span>
                      <span style={{ fontSize: 16, color: '#94a3b8', fontWeight: 600 }}>
                        ({cricket.homeOvers} ov)
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                      CRR: <strong style={{ color: '#38bdf8' }}>{cricket.battingTeam === 'home' ? crr : (cricket.homeRuns / 20).toFixed(2)}</strong>
                    </div>
                  </div>

                  {/* VS Divider & Switch Innings */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 800, color: '#64748b' }}>
                      VS
                    </div>
                    <button 
                      type="button" 
                      onClick={handleSwitchInnings}
                      title="Switch batting/bowling team"
                      style={{
                        marginTop: 8,
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        color: '#38bdf8',
                        fontSize: 11,
                        padding: '4px 8px',
                        borderRadius: 6,
                        cursor: 'pointer'
                      }}
                    >
                      🔄 Swap Innings
                    </button>
                  </div>

                  {/* Team 2 (Away) */}
                  <div style={{ padding: '0 10px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 4 }}>
                      {cricket.battingTeam === 'away' && (
                        <span style={{ background: '#38bdf8', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>
                          BATTING
                        </span>
                      )}
                      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: cricket.battingTeam === 'away' ? '#38bdf8' : '#f8fafc' }}>
                        {selectedLiveMatch.awayTeam}
                      </h2>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 10 }}>
                      <span style={{ fontSize: 44, fontWeight: 900, fontFamily: 'monospace', color: '#ffffff' }}>
                        {cricket.awayRuns}/{cricket.awayWickets}
                      </span>
                      <span style={{ fontSize: 16, color: '#94a3b8', fontWeight: 600 }}>
                        ({cricket.awayOvers} ov)
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                      CRR: <strong style={{ color: '#38bdf8' }}>{cricket.battingTeam === 'away' ? crr : (cricket.awayRuns / 20).toFixed(2)}</strong>
                    </div>
                  </div>

                </div>

                {/* Cricbuzz Equation Ticker Strip */}
                <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Flame size={16} className="text-warning" />
                    {runsNeeded > 0 ? (
                      <span>
                        {cricket.battingTeam === 'home' ? selectedLiveMatch.homeTeam : selectedLiveMatch.awayTeam} need <strong>{runsNeeded} runs</strong> in <strong>{remainingBalls} balls</strong> to win (RRR: {rrr})
                      </span>
                    ) : (
                      <span>Match concluded • Target successfully chased!</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                    {cricket.toss}
                  </div>
                </div>

              </div>

              {/* 🏏 CRICBUZZ BALL-BY-BALL TIMELINE STRIP */}
              <div className="card shadow-sm mb-md" style={{ padding: '14px 20px', background: '#F8FAFC', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <strong style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                      Recent Deliveries:
                    </strong>
                    <div className="cricbuzz-over-strip">
                      {cricket.recentBalls.map((b, i) => {
                        let cls = 'ball-dot';
                        if (b === '1') cls = 'ball-single';
                        else if (b === '2') cls = 'ball-two';
                        else if (b === '3') cls = 'ball-three';
                        else if (b === '4') cls = 'ball-four';
                        else if (b === '6') cls = 'ball-six';
                        else if (b === 'W') cls = 'ball-wicket';
                        else if (b === 'Wd' || b === 'Nb') cls = 'ball-extra';
                        return (
                          <span key={i} className={`cricbuzz-ball-pill ${cls}`} title={`Ball ${b}`}>
                            {b}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      type="button" 
                      className="btn btn-sm btn-outline" 
                      onClick={handleSwapStrike}
                      title="Swap active striker"
                    >
                      ⇄ Rotate Strike
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-sm btn-outline text-danger" 
                      onClick={handleUndo}
                      disabled={undoStack.length === 0}
                      title="Undo last ball entry"
                    >
                      <Undo2 size={13} className="mr-xs" /> Undo Ball
                    </button>
                  </div>
                </div>
              </div>

              {/* 🏏 CREASE TRACKER & SCORING ACTION PAD (2 COLUMNS) */}
              <div className="grid-2col" style={{ gap: 20, alignItems: 'start', marginBottom: 20 }}>
                
                {/* Left Column: Crease Batsmen & Bowler Tracker */}
                <div className="card shadow-sm">
                  <div className="card-header" style={{ marginBottom: 14 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Users size={16} className="text-primary" /> Active Pitch Crease (Batters &amp; Bowler)
                    </h3>
                  </div>

                  {/* Batting Table */}
                  <table className="crease-table mb-md">
                    <thead>
                      <tr>
                        <th>Batter</th>
                        <th>R</th>
                        <th>B</th>
                        <th>4s</th>
                        <th>6s</th>
                        <th>SR</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="active-striker">
                        <td>
                          <strong>{cricket.striker.name} *</strong>
                          <span style={{ fontSize: 10, color: 'var(--primary)', marginLeft: 6 }}>Striker</span>
                        </td>
                        <td><strong>{cricket.striker.runs}</strong></td>
                        <td>{cricket.striker.balls}</td>
                        <td>{cricket.striker.fours}</td>
                        <td>{cricket.striker.sixes}</td>
                        <td>{cricket.striker.balls > 0 ? ((cricket.striker.runs / cricket.striker.balls) * 100).toFixed(1) : '0.0'}</td>
                      </tr>
                      <tr>
                        <td>
                          <span>{cricket.nonStriker.name}</span>
                        </td>
                        <td><strong>{cricket.nonStriker.runs}</strong></td>
                        <td>{cricket.nonStriker.balls}</td>
                        <td>{cricket.nonStriker.fours}</td>
                        <td>{cricket.nonStriker.sixes}</td>
                        <td>{cricket.nonStriker.balls > 0 ? ((cricket.nonStriker.runs / cricket.nonStriker.balls) * 100).toFixed(1) : '0.0'}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Bowler Row */}
                  <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>CURRENT BOWLER</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>
                        Econ: {cricket.bowler.overs > 0 ? (cricket.bowler.runs / parseFloat(cricket.bowler.overs)).toFixed(2) : '0.00'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{cricket.bowler.name}</div>
                      <div style={{ display: 'flex', gap: 14, fontSize: 13, fontFamily: 'monospace' }}>
                        <span>O: <strong>{cricket.bowler.overs}</strong></span>
                        <span>M: <strong>{cricket.bowler.maidens}</strong></span>
                        <span>R: <strong>{cricket.bowler.runs}</strong></span>
                        <span>W: <strong style={{ color: '#dc2626' }}>{cricket.bowler.wickets}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Partnership & Last Wicket */}
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div><strong>Partnership:</strong> {cricket.partnership.runs} runs off {cricket.partnership.balls} balls</div>
                    <div><strong>Last Wicket:</strong> {cricket.lastWicket}</div>
                  </div>
                </div>

                {/* Right Column: Cricbuzz Rapid Scorer Action Pad */}
                <div className="card shadow-sm">
                  <div className="card-header" style={{ marginBottom: 14 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Zap size={16} className="text-primary" /> Live Scorer Action Pad
                    </h3>
                    <span className="badge badge-default">Tap button to score</span>
                  </div>

                  {/* Runs & Balls Grid */}
                  <div className="cricbuzz-scorer-pad">
                    <button type="button" className="scorer-btn" onClick={() => scoreBall('0', 0)}>
                      <span style={{ fontSize: 20 }}>•</span>
                      <span style={{ fontSize: 11 }}>Dot (0)</span>
                    </button>
                    
                    <button type="button" className="scorer-btn" onClick={() => scoreBall('1', 1)}>
                      <span style={{ fontSize: 20 }}>1</span>
                      <span style={{ fontSize: 11 }}>Single</span>
                    </button>

                    <button type="button" className="scorer-btn" onClick={() => scoreBall('2', 2)}>
                      <span style={{ fontSize: 20 }}>2</span>
                      <span style={{ fontSize: 11 }}>Two</span>
                    </button>

                    <button type="button" className="scorer-btn" onClick={() => scoreBall('3', 3)}>
                      <span style={{ fontSize: 20 }}>3</span>
                      <span style={{ fontSize: 11 }}>Three</span>
                    </button>

                    <button type="button" className="scorer-btn btn-ball-four" onClick={() => scoreBall('4', 4)}>
                      <span style={{ fontSize: 22 }}>4</span>
                      <span style={{ fontSize: 11 }}>FOUR!</span>
                    </button>

                    <button type="button" className="scorer-btn btn-ball-six" onClick={() => scoreBall('6', 6)}>
                      <span style={{ fontSize: 22 }}>6</span>
                      <span style={{ fontSize: 11 }}>SIX!</span>
                    </button>

                    <button type="button" className="scorer-btn btn-ball-wicket" onClick={() => scoreBall('W', 0, false, true)}>
                      <span style={{ fontSize: 20 }}>W</span>
                      <span style={{ fontSize: 11 }}>WICKET</span>
                    </button>

                    <button type="button" className="scorer-btn btn-ball-extra" onClick={() => scoreBall('Wd', 1, true)}>
                      <span style={{ fontSize: 18 }}>Wd</span>
                      <span style={{ fontSize: 11 }}>Wide (+1)</span>
                    </button>

                    <button type="button" className="scorer-btn btn-ball-extra" onClick={() => scoreBall('Nb', 1, true)}>
                      <span style={{ fontSize: 18 }}>Nb</span>
                      <span style={{ fontSize: 11 }}>No Ball</span>
                    </button>

                    <button type="button" className="scorer-btn" onClick={() => scoreBall('1', 1, true)}>
                      <span style={{ fontSize: 16 }}>Bye</span>
                      <span style={{ fontSize: 11 }}>Extra (+1)</span>
                    </button>
                  </div>

                  {/* General Sports Quick Controls (if sportMode === 'general') */}
                  {sportMode === 'general' && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                      <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'block' }}>
                        ⚽ General Sports Mode (Direct Scores):
                      </label>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ flex: 1, textAlign: 'center', background: '#f8fafc', padding: 10, borderRadius: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{selectedLiveMatch.homeTeam}</span>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 6 }}>
                            <button type="button" className="btn btn-sm btn-outline" onClick={() => scoreBall('Goal', 1)}>+1 Goal</button>
                            <button type="button" className="btn btn-sm btn-outline" onClick={() => scoreBall('Point', 2)}>+2</button>
                          </div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center', background: '#f8fafc', padding: 10, borderRadius: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{selectedLiveMatch.awayTeam}</span>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 6 }}>
                            <button type="button" className="btn btn-sm btn-outline" onClick={() => scoreBall('Goal', 1)}>+1 Goal</button>
                            <button type="button" className="btn btn-sm btn-outline" onClick={() => scoreBall('Point', 2)}>+2</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      Every ball broadcasts immediately to members
                    </span>
                    <button 
                      type="button" 
                      className="btn btn-sm btn-primary"
                      onClick={() => syncLiveMatchState()}
                    >
                      <CheckCircle2 size={13} className="mr-xs" /> Save State
                    </button>
                  </div>
                </div>

              </div>

              {/* 🏏 CRICBUZZ LIVE COMMENTARY & HIGHLIGHTS FEED */}
              <div className="card shadow-sm mb-md">
                <div className="card-header" style={{ marginBottom: 14 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Flame size={18} className="text-primary" /> Cricbuzz Ball-by-Ball Live Commentary
                  </h3>
                  <span className="badge badge-default">{liveTimeline.length} Entries</span>
                </div>

                {/* Add Custom Highlight / Commentary Form */}
                <form onSubmit={handleAddCustomCommentary} style={{ marginBottom: 20, background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 180px 1fr auto', gap: 10, alignItems: 'center' }}>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="16.5" 
                      value={customCommentary.over} 
                      onChange={e => setCustomCommentary({ ...customCommentary, over: e.target.value })} 
                    />
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Headline (e.g. FIFTY!)" 
                      value={customCommentary.title} 
                      onChange={e => setCustomCommentary({ ...customCommentary, title: e.target.value })} 
                    />
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Ball commentary or match event detail..." 
                      value={customCommentary.desc} 
                      onChange={e => setCustomCommentary({ ...customCommentary, desc: e.target.value })} 
                      required 
                    />
                    <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                      <Plus size={14} className="mr-xs" /> Add Note
                    </button>
                  </div>
                </form>

                {/* Timeline Stream */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
                  {liveTimeline.length === 0 ? (
                    <p className="text-muted text-center" style={{ padding: '24px 0' }}>No commentary entries logged yet.</p>
                  ) : liveTimeline.map((item) => (
                    <div 
                      key={item.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: 14, 
                        padding: '12px 16px', 
                        borderRadius: 10, 
                        background: item.type === 'four' ? 'rgba(37, 99, 235, 0.05)' : item.type === 'six' ? 'rgba(124, 58, 237, 0.05)' : item.type === 'wicket' ? 'rgba(220, 38, 38, 0.06)' : '#ffffff',
                        border: '1px solid var(--border)' 
                      }}
                    >
                      <span 
                        style={{ 
                          fontFamily: 'monospace', 
                          fontWeight: 800, 
                          fontSize: 13, 
                          padding: '3px 8px', 
                          borderRadius: 6, 
                          background: item.type === 'four' ? '#2563eb' : item.type === 'six' ? '#7c3aed' : item.type === 'wicket' ? '#dc2626' : '#e2e8f0',
                          color: item.type === 'four' || item.type === 'six' || item.type === 'wicket' ? '#ffffff' : '#334155',
                          flexShrink: 0
                        }}
                      >
                        {item.over || item.minute || '•'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>
                          {item.text || item.description}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                          {item.time || 'Live'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="card text-center" style={{ padding: 48 }}>
              <Trophy size={48} style={{ color: 'var(--text-lighter)', marginBottom: 12 }} />
              <h3>No Match Selected</h3>
              <p className="text-muted">Select an existing match above or schedule a fixture to begin live broadcasting.</p>
            </div>
          )}

        </div>
      )}

      {/* 📅 TAB: FIXTURES & MATCHES */}
      {activeTab === 'fixtures' && (
        <div>
          <div className="card shadow-sm">
            <div className="card-header">
              <h3>Fixtures &amp; Scheduled Matches</h3>
              <button className="btn btn-primary" onClick={() => { setEditingItem(null); setShowModal(true); }}>
                <Plus size={16} /> Schedule Fixture
              </button>
            </div>
            
            <DataTable 
              columns={[
                { key: 'homeTeam', label: 'Home Team', render: (val, row) => <strong>{val}</strong> },
                { key: 'awayTeam', label: 'Away Team' },
                { key: 'date', label: 'Date', render: (val) => val || 'TBD' },
                { key: 'venue', label: 'Venue', render: (val) => val || 'Main Stadium' },
                { key: 'score', label: 'Score', render: (val, row) => row.score || `${row.homeScore || 0} - ${row.awayScore || 0}` },
                { key: 'status', label: 'Status', render: (val) => (
                  <span className={`badge ${val === 'live' ? 'badge-danger' : val === 'completed' ? 'badge-info' : 'badge-default'}`}>
                    {val || 'scheduled'}
                  </span>
                )},
                { key: 'actions', label: 'Actions', render: (_, row) => (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button 
                      className="btn btn-sm btn-primary" 
                      onClick={() => { initLiveMatch(row); setActiveTab('live'); }}
                      title="Open Live Match Center"
                    >
                      <Radio size={13} className="mr-xs" /> Live Center
                    </button>
                    <button 
                      className="btn-icon danger" 
                      onClick={async () => {
                        if (window.confirm(`Delete fixture?`)) {
                          await leagueService.deleteFixture(selectedClubId, row.id);
                          loadData();
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              ]}
              data={fixtures}
              loading={loading}
            />
          </div>
        </div>
      )}

      {/* 🏆 TAB: COMPETITIONS */}
      {activeTab === 'leagues' && (
        <div className="card shadow-sm">
          <div className="card-header">
            <h3>Competitions &amp; Tournaments</h3>
            <button className="btn btn-primary" onClick={() => { setEditingItem(null); setShowModal(true); }}>
              <Plus size={16} /> Create Competition
            </button>
          </div>
          <DataTable 
            columns={[
              { key: 'name', label: 'Tournament Name', render: (val) => <strong>{val}</strong> },
              { key: 'season', label: 'Season' },
              { key: 'type', label: 'Type' },
              { key: 'status', label: 'Status', render: (val) => <span className="badge badge-success">{val || 'Active'}</span> }
            ]}
            data={leagues}
            loading={loading}
          />
        </div>
      )}

      {/* Fixture / League Creation Modal */}
      <Modal 
        open={showModal} 
        onClose={() => setShowModal(false)}
        title={activeTab === 'leagues' ? 'Create Competition' : 'Schedule Match Fixture'}
      >
        <form onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          setIsSaving(true);
          try {
            if (activeTab === 'leagues') {
              await leagueService.createLeague(selectedClubId, {
                name: fd.get('name'),
                season: fd.get('season'),
                type: fd.get('type') || 'Tournament'
              });
            } else {
              await leagueService.createFixture(selectedClubId, {
                homeTeam: fd.get('homeTeam'),
                awayTeam: fd.get('awayTeam'),
                date: fd.get('date'),
                venue: fd.get('venue'),
                competitionName: fd.get('competitionName') || 'League Match',
                status: 'scheduled',
                homeScore: 0,
                awayScore: 0
              });
            }
            setShowModal(false);
            loadData();
          } catch (err) {
            alert(err.message);
          } finally {
            setIsSaving(false);
          }
        }}>
          {activeTab === 'leagues' ? (
            <>
              <div className="form-group">
                <label>Competition Name</label>
                <input className="form-control" name="name" placeholder="e.g. Premier Cricket League" required />
              </div>
              <div className="form-group">
                <label>Season</label>
                <input className="form-control" name="season" placeholder="2026-2027" required />
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label>Home Team</label>
                <input className="form-control" name="homeTeam" placeholder="e.g. Warrior" required />
              </div>
              <div className="form-group">
                <label>Away Team</label>
                <input className="form-control" name="awayTeam" placeholder="e.g. Sydney Sixers" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Date</label>
                  <input className="form-control" name="date" type="date" required />
                </div>
                <div className="form-group">
                  <label>Venue</label>
                  <input className="form-control" name="venue" placeholder="e.g. Sydney Cricket Ground" required />
                </div>
              </div>
              <div className="form-group">
                <label>Competition / League</label>
                <input className="form-control" name="competitionName" placeholder="e.g. Big Bash T20" />
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Fixture'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
