import { 
  collection, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

export const leagueService = {
  // Leagues Management
  async getLeagues(clubId) {
    if (!clubId) return [];
    try {
      const q = query(
        collection(db, 'clubs', clubId, 'leagueCompetitions'), 
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.warn('Fallback: query leagueCompetitions without ordering', error);
      const q = collection(db, 'clubs', clubId, 'leagueCompetitions');
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  },

  async createLeague(clubId, leagueData) {
    const ref = doc(collection(db, 'clubs', clubId, 'leagueCompetitions'));
    await setDoc(ref, {
      ...leagueData,
      clubId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return ref;
  },

  async updateLeague(clubId, leagueId, leagueData) {
    const leagueRef = doc(db, 'clubs', clubId, 'leagueCompetitions', leagueId);
    return await updateDoc(leagueRef, {
      ...leagueData,
      updatedAt: serverTimestamp()
    });
  },

  async deleteLeague(clubId, leagueId) {
    return await deleteDoc(doc(db, 'clubs', clubId, 'leagueCompetitions', leagueId));
  },

  // Fixtures Management
  async getFixtures(clubId, leagueId) {
    if (!clubId || !leagueId) return [];
    try {
      const q = query(
        collection(db, 'clubs', clubId, 'leagueFixtures'), 
        where('competitionId', '==', leagueId),
        orderBy('date', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.warn('Fallback: query leagueFixtures without ordering', error);
      const q = query(
        collection(db, 'clubs', clubId, 'leagueFixtures'), 
        where('competitionId', '==', leagueId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  },

  async createFixture(clubId, fixtureData) {
    const ref = doc(collection(db, 'clubs', clubId, 'leagueFixtures'));
    const compId = fixtureData.leagueId || fixtureData.competitionId;
    await setDoc(ref, {
      ...fixtureData,
      clubId,
      competitionId: compId,
      leagueId: compId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return ref;
  },

  async updateFixture(clubId, fixtureId, fixtureData) {
    const fixtureRef = doc(db, 'clubs', clubId, 'leagueFixtures', fixtureId);
    const compId = fixtureData.leagueId || fixtureData.competitionId;
    return await updateDoc(fixtureRef, {
      ...fixtureData,
      competitionId: compId,
      leagueId: compId,
      updatedAt: serverTimestamp()
    });
  },

  async deleteFixture(clubId, fixtureId) {
    return await deleteDoc(doc(db, 'clubs', clubId, 'leagueFixtures', fixtureId));
  },

  // Live Score & Streaming Integration
  async updateLiveScore(clubId, fixtureId, scores) {
    const fixtureRef = doc(db, 'clubs', clubId, 'leagueFixtures', fixtureId);
    return await updateDoc(fixtureRef, {
      scores,
      lastUpdated: serverTimestamp()
    });
  },

  async getAllFixturesAndMatches(clubId) {
    if (!clubId) return [];
    const results = [];
    const seenIds = new Set();

    // 1. Load from leagueFixtures
    try {
      const snap = await getDocs(collection(db, 'clubs', clubId, 'leagueFixtures'));
      snap.docs.forEach(d => {
        seenIds.add(d.id);
        const data = d.data();
        results.push({
          id: d.id,
          homeTeam: data.homeTeam || 'Home Team',
          awayTeam: data.awayTeam || 'Away Team',
          homeScore: typeof data.homeScore === 'number' ? data.homeScore : (typeof data.ourScore === 'number' ? data.ourScore : 0),
          awayScore: typeof data.awayScore === 'number' ? data.awayScore : (typeof data.opponentScore === 'number' ? data.opponentScore : 0),
          score: data.score || (typeof data.homeScore === 'number' ? `${data.homeScore} - ${data.awayScore || 0}` : ''),
          status: data.status || 'Scheduled',
          streamUrl: data.streamUrl || '',
          streamTitle: data.streamTitle || '',
          period: data.period || '',
          timeline: data.timeline || [],
          source: 'leagueFixture',
          ...data
        });
      });
    } catch (e) {
      console.warn('Error fetching leagueFixtures:', e);
    }

    // 2. Load from events (type == game)
    try {
      const q = query(collection(db, 'clubs', clubId, 'events'), where('type', '==', 'game'));
      const snap = await getDocs(q);
      snap.docs.forEach(d => {
        if (!seenIds.has(d.id)) {
          const data = d.data();
          const titleParts = (data.title || '').split(' vs ');
          results.push({
            id: d.id,
            homeTeam: data.teamName || titleParts[0]?.trim() || 'Club Team',
            awayTeam: data.opponent || titleParts[1]?.trim() || 'Opponent',
            date: data.date || data.startDate || '',
            venue: data.location || 'Home Ground',
            score: (typeof data.ourScore === 'number' && typeof data.opponentScore === 'number')
              ? `${data.ourScore} - ${data.opponentScore}`
              : (data.score || ''),
            homeScore: typeof data.ourScore === 'number' ? data.ourScore : 0,
            awayScore: typeof data.opponentScore === 'number' ? data.opponentScore : 0,
            status: data.status || 'scheduled',
            streamUrl: data.streamUrl || '',
            streamTitle: data.streamTitle || '',
            period: data.period || '',
            timeline: data.timeline || [],
            source: 'event',
            ...data
          });
        }
      });
    } catch (e) {
      console.warn('Error fetching game events:', e);
    }

    return results;
  },

  async updateLiveMatch(clubId, matchId, matchData) {
    const fixtureRef = doc(db, 'clubs', clubId, 'leagueFixtures', matchId);
    const eventRef = doc(db, 'clubs', clubId, 'events', matchId);

    const homeScore = typeof matchData.homeScore === 'number' ? matchData.homeScore : 0;
    const awayScore = typeof matchData.awayScore === 'number' ? matchData.awayScore : 0;

    const payload = {
      ...matchData,
      homeScore,
      awayScore,
      ourScore: homeScore,
      opponentScore: awayScore,
      score: `${homeScore} - ${awayScore}`,
      updatedAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    };

    try {
      await setDoc(fixtureRef, payload, { merge: true });
    } catch (err) {
      console.warn('Sync fixture failed:', err);
    }

    try {
      await setDoc(eventRef, { ...payload, type: 'game' }, { merge: true });
    } catch (err) {
      console.warn('Sync event failed:', err);
    }
  }
};
