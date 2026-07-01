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

  // Live Score Integration
  async updateLiveScore(clubId, fixtureId, scores) {
    const fixtureRef = doc(db, 'clubs', clubId, 'leagueFixtures', fixtureId);
    return await updateDoc(fixtureRef, {
      scores,
      lastUpdated: serverTimestamp()
    });
  }
};
