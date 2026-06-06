import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";

const organizationsCol = (clubId) =>
  collection(db, "clubs", clubId, "leagueOrganizations");
const competitionsCol = (clubId) =>
  collection(db, "clubs", clubId, "leagueCompetitions");
const fixturesCol = (clubId) =>
  collection(db, "clubs", clubId, "leagueFixtures");
const eventsCol = (clubId) => collection(db, "clubs", clubId, "events");
const teamsCol = (clubId) => collection(db, "clubs", clubId, "teams");
const postsCol = (clubId) => collection(db, "clubs", clubId, "posts");
const announcementsCol = (clubId) =>
  collection(db, "clubs", clubId, "leagueAnnouncements");
const liveScoreIntegrationsCol = (clubId) =>
  collection(db, "clubs", clubId, "liveScoreIntegrations");
const sponsorsCol = (clubId) => collection(db, "clubs", clubId, "sponsors");
const facilityBookingsCol = (clubId) =>
  collection(db, "clubs", clubId, "facilityBookings");

const toRows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const toNumericScore = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractFixtureRowsFromPayload = (payload) => {
  const candidates = [
    payload?.fixtures,
    payload?.matches,
    payload?.data,
    payload?.results,
    payload,
  ];

  const source = candidates.find((row) => Array.isArray(row));
  if (!Array.isArray(source)) return [];

  return source.map((row) => {
    const homeTeam =
      row?.homeTeam ||
      row?.home_team ||
      row?.homeName ||
      row?.home_name ||
      row?.home?.name ||
      "";
    const awayTeam =
      row?.awayTeam ||
      row?.away_team ||
      row?.awayName ||
      row?.away_name ||
      row?.away?.name ||
      "";

    return {
      externalId: String(
        row?.fixtureId || row?.fixture_id || row?.matchId || row?.id || "",
      ).trim(),
      homeTeam: String(homeTeam || "").trim(),
      awayTeam: String(awayTeam || "").trim(),
      fixtureDate: String(
        row?.fixtureDate || row?.date || row?.startTime || row?.kickoff || "",
      ).trim(),
      homeScore: toNumericScore(
        row?.homeScore || row?.home_score || row?.score?.home || row?.scores?.home,
      ),
      awayScore: toNumericScore(
        row?.awayScore || row?.away_score || row?.score?.away || row?.scores?.away,
      ),
      status: String(row?.status || row?.state || "live")
        .trim()
        .toLowerCase(),
    };
  });
};

const datePrefix = (value) => String(value || "").trim().slice(0, 10);

const parseFixtureDateTime = (fixtureDate = "") => {
  const raw = String(fixtureDate || "").trim();
  if (!raw) return { date: "", startTime: "" };
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { date: raw, startTime: "" };

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return { date: raw.slice(0, 10), startTime: "" };

  const date = parsed.toISOString().slice(0, 10);
  const hh = String(parsed.getHours()).padStart(2, "0");
  const mm = String(parsed.getMinutes()).padStart(2, "0");
  return { date, startTime: `${hh}:${mm}` };
};

const normalizeId = (value) => String(value || "").trim();

const syncOrganizationFixtureToClubTeamEvents = async (
  clubId,
  fixtureId,
  fixtureData,
) => {
  if (!clubId || !fixtureId) return;

  const organizationTeamIds = [
    normalizeId(fixtureData?.homeOrganizationTeamId),
    normalizeId(fixtureData?.awayOrganizationTeamId),
  ].filter(Boolean);

  if (!organizationTeamIds.length) return;

  const teamSnap = await getDocs(query(teamsCol(clubId), orderBy("name", "asc")));
  const teams = toRows(teamSnap);

  const linkedTeams = teams.filter((team) =>
    organizationTeamIds.includes(
      normalizeId(team?.linkedOrganizationTeamId || team?.linkedOrgTeamId),
    ),
  );

  if (!linkedTeams.length) return;

  const { date, startTime } = parseFixtureDateTime(fixtureData?.fixtureDate);
  const title = `${fixtureData?.homeTeam || "Home"} vs ${fixtureData?.awayTeam || "Away"}`;

  await Promise.all(
    linkedTeams.map((team) => {
      const linkedOrgTeamId = normalizeId(
        team?.linkedOrganizationTeamId || team?.linkedOrgTeamId,
      );
      const isHomeSide =
        linkedOrgTeamId &&
        linkedOrgTeamId === normalizeId(fixtureData?.homeOrganizationTeamId);
      const eventId = `orgfixture_${fixtureId}_${team.id}`;
      const eventRef = doc(eventsCol(clubId), eventId);
      return setDoc(
        eventRef,
        {
          title,
          description: `Organisation fixture for ${team.name || "team"}`,
          date,
          startTime,
          endTime: "",
          location: String(fixtureData?.venue || "").trim(),
          type: "game",
          category: "fixtures",
          source: "organization",
          sourceFixtureId: fixtureId,
          isFixtureLocked: true,
          teamId: team.id,
          teamName: team.name || "",
          assignedGroupId: team.id,
          assignedGroupIds: [String(team.id).toLowerCase()],
          assignedGroupName: team.name || "",
          groupType: "Team",
          openToAll: false,
          status: String(fixtureData?.status || "scheduled")
            .trim()
            .toLowerCase(),
          ourScore: isHomeSide
            ? fixtureData?.homeScore ?? null
            : fixtureData?.awayScore ?? null,
          opponentScore: isHomeSide
            ? fixtureData?.awayScore ?? null
            : fixtureData?.homeScore ?? null,
          opponent: isHomeSide
            ? fixtureData?.awayTeam || ""
            : fixtureData?.homeTeam || "",
          organizationTeamIds,
          createdBy: fixtureData?.createdBy || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }),
  );
};

const syncOrganizationAnnouncementToTeamPosts = async (
  clubId,
  announcementId,
  announcementData,
) => {
  if (!clubId || !announcementId) return;

  const teamSnap = await getDocs(query(teamsCol(clubId), orderBy("name", "asc")));
  const teams = toRows(teamSnap);
  const linkedTeams = teams.filter(
    (team) =>
      !!normalizeId(team?.linkedOrganizationTeamId || team?.linkedOrgTeamId),
  );

  if (!linkedTeams.length) return;

  await Promise.all(
    linkedTeams.map((team) => {
      const postId = `organn_${announcementId}_${team.id}`;
      const postRef = doc(postsCol(clubId), postId);
      return setDoc(
        postRef,
        {
          clubId,
          authorId: announcementData?.createdBy || "",
          authorName: announcementData?.organizationName || "Organisation",
          content: String(announcementData?.message || "").trim(),
          title: String(announcementData?.title || "").trim(),
          visibility: "Club-Only",
          teamId: team.id,
          type: "update",
          category: "Updates",
          source: "organization",
          sourceAnnouncementId: announcementId,
          isPinned: false,
          pinnedAt: null,
          likes: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }),
  );
};

const findMatchingFixture = (localFixtures = [], incoming = {}) => {
  const byExternalId = localFixtures.find(
    (fixture) =>
      incoming.externalId &&
      String(fixture?.liveSourceFixtureId || "").trim() === incoming.externalId,
  );
  if (byExternalId) return byExternalId;

  const incomingHome = normalizeText(incoming.homeTeam);
  const incomingAway = normalizeText(incoming.awayTeam);
  const incomingDate = datePrefix(incoming.fixtureDate);

  return localFixtures.find((fixture) => {
    const localHome = normalizeText(fixture?.homeTeam);
    const localAway = normalizeText(fixture?.awayTeam);
    const sameTeams = localHome === incomingHome && localAway === incomingAway;
    if (!sameTeams) return false;

    const localDate = datePrefix(fixture?.fixtureDate);
    if (!incomingDate || !localDate) return true;
    return localDate === incomingDate;
  });
};

export const createLeagueOrganization = async (
  clubId,
  { name, region = "", season = "", createdBy = "" },
) => {
  const ref = doc(organizationsCol(clubId));
  const data = {
    name: String(name || "").trim(),
    region: String(region || "").trim(),
    season: String(season || "").trim(),
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { id: ref.id, ...data };
};

export const subscribeToLeagueOrganizations = (clubId, callback) => {
  const q = query(organizationsCol(clubId), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => callback(toRows(snap)),
    () => callback([]),
  );
};

export const createLeagueCompetition = async (
  clubId,
  {
    organizationId,
    organizationName,
    title,
    division = "",
    season = "",
    createdBy = "",
  },
) => {
  const ref = doc(competitionsCol(clubId));
  const data = {
    organizationId: String(organizationId || "").trim(),
    organizationName: String(organizationName || "").trim(),
    title: String(title || "").trim(),
    division: String(division || "").trim(),
    season: String(season || "").trim(),
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { id: ref.id, ...data };
};

export const subscribeToLeagueCompetitions = (clubId, callback) => {
  const q = query(competitionsCol(clubId), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => callback(toRows(snap)),
    () => callback([]),
  );
};

export const createLeagueFixture = async (
  clubId,
  {
    competitionId,
    competitionTitle,
    homeTeam,
    awayTeam,
    homeOrganizationTeamId = "",
    awayOrganizationTeamId = "",
    fixtureDate,
    venue = "",
    status = "scheduled",
    createdBy = "",
  },
) => {
  const ref = doc(fixturesCol(clubId));
  const data = {
    competitionId: String(competitionId || "").trim(),
    competitionTitle: String(competitionTitle || "").trim(),
    homeTeam: String(homeTeam || "").trim(),
    awayTeam: String(awayTeam || "").trim(),
    homeOrganizationTeamId: String(homeOrganizationTeamId || "").trim(),
    awayOrganizationTeamId: String(awayOrganizationTeamId || "").trim(),
    fixtureDate: String(fixtureDate || "").trim(),
    venue: String(venue || "").trim(),
    status: String(status || "scheduled")
      .trim()
      .toLowerCase(),
    homeScore: null,
    awayScore: null,
    liveSourceFixtureId: "",
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  await syncOrganizationFixtureToClubTeamEvents(clubId, ref.id, data);
  return { id: ref.id, ...data };
};

export const updateLeagueFixtureScore = async (
  clubId,
  fixtureId,
  { homeScore, awayScore, status = "live", updatedBy = "" },
) => {
  await updateDoc(doc(db, "clubs", clubId, "leagueFixtures", fixtureId), {
    homeScore:
      homeScore === null || homeScore === ""
        ? null
        : Number.isFinite(Number(homeScore))
          ? Number(homeScore)
          : null,
    awayScore:
      awayScore === null || awayScore === ""
        ? null
        : Number.isFinite(Number(awayScore))
          ? Number(awayScore)
          : null,
    status: String(status || "live")
      .trim()
      .toLowerCase(),
    lastScoreUpdateBy: updatedBy,
    updatedAt: serverTimestamp(),
  });

  const fixtureSnap = await getDoc(doc(db, "clubs", clubId, "leagueFixtures", fixtureId));
  if (fixtureSnap.exists()) {
    await syncOrganizationFixtureToClubTeamEvents(clubId, fixtureId, {
      ...fixtureSnap.data(),
      homeScore:
        homeScore === null || homeScore === ""
          ? null
          : Number.isFinite(Number(homeScore))
            ? Number(homeScore)
            : null,
      awayScore:
        awayScore === null || awayScore === ""
          ? null
          : Number.isFinite(Number(awayScore))
            ? Number(awayScore)
            : null,
      status: String(status || "live")
        .trim()
        .toLowerCase(),
    });
  }
};

export const linkClubTeamToOrganizationTeam = async (
  clubId,
  { clubTeamId, organizationTeamId = "", linkedBy = "" },
) => {
  await updateDoc(doc(db, "clubs", clubId, "teams", clubTeamId), {
    linkedOrganizationTeamId: String(organizationTeamId || "").trim(),
    linkedBy: String(linkedBy || "").trim(),
    linkedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const subscribeToLeagueFixtures = (clubId, callback) => {
  const q = query(fixturesCol(clubId), orderBy("fixtureDate", "asc"));
  return onSnapshot(
    q,
    (snap) => callback(toRows(snap)),
    () => callback([]),
  );
};

export const createLeagueAnnouncement = async (
  clubId,
  {
    organizationId = "",
    organizationName = "",
    title,
    message,
    audience = "all",
    createdBy = "",
  },
) => {
  const ref = doc(announcementsCol(clubId));
  const data = {
    organizationId: String(organizationId || "").trim(),
    organizationName: String(organizationName || "").trim(),
    title: String(title || "").trim(),
    message: String(message || "").trim(),
    audience: String(audience || "all")
      .trim()
      .toLowerCase(),
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  await syncOrganizationAnnouncementToTeamPosts(clubId, ref.id, data);
  return { id: ref.id, ...data };
};

export const subscribeToLeagueAnnouncements = (clubId, callback) => {
  const q = query(announcementsCol(clubId), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => callback(toRows(snap)),
    () => callback([]),
  );
};

export const upsertLiveScoreIntegrationConfig = async (
  clubId,
  {
    provider,
    apiBaseUrl,
    feedType = "pull",
    authMode = "api-key",
    tokenHint = "",
    approvedByLeague = false,
    notes = "",
    updatedBy = "",
  },
) => {
  const ref = doc(liveScoreIntegrationsCol(clubId), "default");
  const snap = await getDoc(ref);

  const payload = {
    provider: String(provider || "").trim(),
    apiBaseUrl: String(apiBaseUrl || "").trim(),
    feedType: String(feedType || "pull")
      .trim()
      .toLowerCase(),
    authMode: String(authMode || "api-key")
      .trim()
      .toLowerCase(),
    tokenHint: String(tokenHint || "").trim(),
    approvedByLeague: !!approvedByLeague,
    notes: String(notes || "").trim(),
    updatedBy,
    updatedAt: serverTimestamp(),
  };

  if (!snap.exists()) {
    await setDoc(ref, {
      ...payload,
      createdAt: serverTimestamp(),
    });
    return;
  }

  await updateDoc(ref, payload);
};

export const subscribeToLiveScoreIntegrationConfig = (clubId, callback) => {
  const ref = doc(liveScoreIntegrationsCol(clubId), "default");
  return onSnapshot(
    ref,
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    () => callback(null),
  );
};

export const syncLeagueFixtureScoresFromProvider = async (
  clubId,
  { updatedBy = "" } = {},
) => {
  const configRef = doc(liveScoreIntegrationsCol(clubId), "default");
  const configSnap = await getDoc(configRef);
  if (!configSnap.exists()) {
    throw new Error("Live score integration is not configured.");
  }

  const config = configSnap.data() || {};
  const apiBaseUrl = String(config.apiBaseUrl || "").trim();
  if (!apiBaseUrl) {
    throw new Error("API base URL is required before syncing.");
  }

  if (config.approvedByLeague !== true) {
    throw new Error("League approval is required before syncing live scores.");
  }

  const base = apiBaseUrl.replace(/\/$/, "");
  const endpoints = [`${base}/fixtures/live`, `${base}/fixtures`];
  const authValue = String(config.tokenHint || "").trim();

  try {
    let payload = null;
    let lastStatus = 0;

    for (const endpoint of endpoints) {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(authValue
            ? {
                Authorization: authValue.toLowerCase().startsWith("bearer ")
                  ? authValue
                  : `Bearer ${authValue}`,
              }
            : {}),
        },
      });

      lastStatus = response.status;
      if (!response.ok) continue;

      payload = await response.json();
      break;
    }

    if (!payload) {
      throw new Error(`Provider request failed (${lastStatus || "no response"}).`);
    }
    const incomingFixtures = extractFixtureRowsFromPayload(payload);

    const localSnap = await getDocs(query(fixturesCol(clubId), orderBy("fixtureDate", "asc")));
    const localFixtures = toRows(localSnap);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const incoming of incomingFixtures) {
      const hasScore =
        incoming.homeScore !== null || incoming.awayScore !== null;
      if (!hasScore) {
        skippedCount += 1;
        continue;
      }

      const match = findMatchingFixture(localFixtures, incoming);
      if (!match?.id) {
        skippedCount += 1;
        continue;
      }

      await updateDoc(doc(db, "clubs", clubId, "leagueFixtures", match.id), {
        homeScore: incoming.homeScore,
        awayScore: incoming.awayScore,
        status: incoming.status || "live",
        liveSourceFixtureId:
          incoming.externalId || String(match.liveSourceFixtureId || ""),
        lastScoreUpdateBy: updatedBy,
        updatedAt: serverTimestamp(),
      });

      updatedCount += 1;
    }

    await updateDoc(configRef, {
      lastSyncAt: serverTimestamp(),
      lastSyncBy: updatedBy,
      lastSyncStatus: "success",
      lastSyncError: "",
      lastSyncUpdatedFixtures: updatedCount,
      lastSyncSkippedFixtures: skippedCount,
      lastSyncPayloadCount: incomingFixtures.length,
      updatedAt: serverTimestamp(),
    });

    return {
      updatedCount,
      skippedCount,
      payloadCount: incomingFixtures.length,
    };
  } catch (error) {
    await updateDoc(configRef, {
      lastSyncAt: serverTimestamp(),
      lastSyncBy: updatedBy,
      lastSyncStatus: "failed",
      lastSyncError: String(error?.message || error || "Unknown error"),
      updatedAt: serverTimestamp(),
    });

    throw error;
  }
};

export const createSponsor = async (
  clubId,
  {
    name,
    tier = "Community",
    amount = "",
    contactName = "",
    contactEmail = "",
    websiteUrl = "",
    status = "active",
    createdBy = "",
  },
) => {
  const ref = doc(sponsorsCol(clubId));
  const data = {
    name: String(name || "").trim(),
    tier: String(tier || "Community").trim(),
    amount:
      amount === "" || amount === null
        ? null
        : Number.isFinite(Number(amount))
          ? Number(amount)
          : null,
    contactName: String(contactName || "").trim(),
    contactEmail: String(contactEmail || "").trim(),
    websiteUrl: String(websiteUrl || "").trim(),
    status: String(status || "active")
      .trim()
      .toLowerCase(),
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { id: ref.id, ...data };
};

export const subscribeToSponsors = (clubId, callback) => {
  const q = query(sponsorsCol(clubId), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => callback(toRows(snap)),
    () => callback([]),
  );
};

export const createFacilityBooking = async (
  clubId,
  {
    facilityName,
    bookingDate,
    startTime,
    endTime,
    purpose,
    requesterId,
    requesterName,
    contactPhone = "",
  },
) => {
  const ref = doc(facilityBookingsCol(clubId));
  const data = {
    facilityName: String(facilityName || "").trim(),
    bookingDate: String(bookingDate || "").trim(),
    startTime: String(startTime || "").trim(),
    endTime: String(endTime || "").trim(),
    purpose: String(purpose || "").trim(),
    requesterId: String(requesterId || "").trim(),
    requesterName: String(requesterName || "").trim(),
    contactPhone: String(contactPhone || "").trim(),
    status: "pending",
    reviewedBy: "",
    reviewNote: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, data);
  return { id: ref.id, ...data };
};

export const updateFacilityBookingStatus = async (
  clubId,
  bookingId,
  { status, reviewedBy = "", reviewNote = "" },
) => {
  await updateDoc(doc(db, "clubs", clubId, "facilityBookings", bookingId), {
    status: String(status || "pending")
      .trim()
      .toLowerCase(),
    reviewedBy,
    reviewNote: String(reviewNote || "").trim(),
    updatedAt: serverTimestamp(),
  });
};

export const subscribeToFacilityBookings = (clubId, callback) => {
  const q = query(facilityBookingsCol(clubId), orderBy("bookingDate", "asc"));
  return onSnapshot(
    q,
    (snap) => callback(toRows(snap)),
    () => callback([]),
  );
};
