import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  CalendarDays,
  MapPin,
  Clock3,
  Trophy,
  Video,
  Play,
  ExternalLink,
  Flame,
  Radio,
  Edit3,
  X,
  Plus,
  Minus,
  Check,
} from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { theme } from "../../theme/theme";
import { useClub } from "../../contexts/ClubContext";
import { getTeam } from "../../services/teamService";
import { getClubMembers } from "../../services/clubService";
import { getEventById, updateEvent } from "../../services/eventService";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";

const normalizeStatus = (value) => {
  const normalized = String(value || "scheduled")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  if (normalized === "completed") return "Completed";
  if (normalized === "inprogress" || normalized === "live") return "Live";
  if (normalized === "postponed") return "Postponed";
  if (normalized === "cancelled") return "Cancelled";
  return "Scheduled";
};

const DEFAULT_PLAYER_SLOTS = 17;

const buildFixedPlayerSlots = (ids = []) => {
  const normalized = Array.isArray(ids) ? ids.filter(Boolean) : [];
  const fixed = Array.from({ length: DEFAULT_PLAYER_SLOTS }, () => "");
  normalized.slice(0, DEFAULT_PLAYER_SLOTS).forEach((id, index) => {
    fixed[index] = id;
  });
  return fixed;
};

export default function MatchDetailsScreen({ route, navigation }) {
  const { activeClubId, userRole } = useClub();
  const initialMatch = route?.params?.match || {};
  const [matchData, setMatchData] = useState(initialMatch);

  // Real-time live listener for score, stream, timeline, and status
  useEffect(() => {
    if (!activeClubId || !initialMatch?.id) return;
    const unsub = onSnapshot(
      doc(db, "clubs", activeClubId, "events", initialMatch.id),
      (snap) => {
        if (snap.exists()) {
          setMatchData((prev) => ({ ...prev, id: snap.id, ...snap.data() }));
        }
      },
      (err) => console.warn("Live match listener error:", err)
    );
    return () => unsub();
  }, [activeClubId, initialMatch?.id]);

  const match = matchData;

  // Live Score Modal State (for sideline coaches/admins)
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [liveHomeScore, setLiveHomeScore] = useState(0);
  const [liveAwayScore, setLiveAwayScore] = useState(0);
  const [liveStatus, setLiveStatus] = useState("live");
  const [livePeriod, setLivePeriod] = useState("1st Half");
  const [savingLiveScore, setSavingLiveScore] = useState(false);

  const openScoreModal = () => {
    setLiveHomeScore(typeof match.ourScore === "number" ? match.ourScore : (typeof match.homeScore === "number" ? match.homeScore : 0));
    setLiveAwayScore(typeof match.opponentScore === "number" ? match.opponentScore : (typeof match.awayScore === "number" ? match.awayScore : 0));
    setLiveStatus(match.status || "live");
    setLivePeriod(match.period || "1st Half");
    setShowScoreModal(true);
  };

  const saveLiveScore = async () => {
    if (!activeClubId || !match?.id) return;
    setSavingLiveScore(true);
    try {
      const payload = {
        ourScore: liveHomeScore,
        opponentScore: liveAwayScore,
        homeScore: liveHomeScore,
        awayScore: liveAwayScore,
        score: `${liveHomeScore} - ${liveAwayScore}`,
        status: liveStatus,
        period: livePeriod,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, "clubs", activeClubId, "events", match.id), payload);
      try {
        await updateDoc(doc(db, "clubs", activeClubId, "leagueFixtures", match.id), payload);
      } catch (e) {}
      setShowScoreModal(false);
      Alert.alert("Success", "Live score updated successfully!");
    } catch (err) {
      Alert.alert("Error", "Could not update score: " + err.message);
    } finally {
      setSavingLiveScore(false);
    }
  };

  const [loadingSquad, setLoadingSquad] = useState(false);
  const [selectedSquadPlayers, setSelectedSquadPlayers] = useState([]);
  const [manualPlayerOptions, setManualPlayerOptions] = useState([]);
  const [clubMembers, setClubMembers] = useState([]);
  const [savingTeamSheet, setSavingTeamSheet] = useState(false);
  const [teamSheet, setTeamSheet] = useState({
    coachId: "",
    managerId: "",
    leagueSafeId: "",
    firstAidId: "",
    touchJudgeId: "",
    dutyOfficialId: "",
    playerIds: buildFixedPlayerSlots(),
  });
  const [hasLoadedSavedTeamSheet, setHasLoadedSavedTeamSheet] = useState(false);

  const teamName = String(match.teamName || "Team").trim();
  const opponent = String(match.opponent || "Opponent").trim();
  const statusLabel = normalizeStatus(match.status);
  const hasScore =
    typeof match.ourScore === "number" &&
    typeof match.opponentScore === "number";

  const resultLabel = useMemo(() => {
    if (!hasScore) return "Score pending";
    if (match.ourScore > match.opponentScore) return "Win";
    if (match.ourScore < match.opponentScore) return "Loss";
    return "Draw";
  }, [hasScore, match.ourScore, match.opponentScore]);

  const normalizedRole = String(userRole || "")
    .trim()
    .toLowerCase();
  const canEditTeamSheet = ["owner", "admin", "coach", "manager"].includes(
    normalizedRole,
  );

  const displayName = (member) =>
    member?.displayName ||
    member?.name ||
    member?.email ||
    member?.id ||
    "Member";

  const getRoleTokens = (member) => {
    const raw = Array.isArray(member?.roles) ? member.roles : [member?.role];
    return raw
      .map((role) =>
        String(role || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);
  };

  const isAccreditedFor = (member, keys = []) => {
    const accreditationObj =
      member?.accreditations && typeof member.accreditations === "object"
        ? member.accreditations
        : null;

    if (accreditationObj) {
      const hasAccreditation = keys.some((key) => {
        const normalized = key.replace(/[^a-z]/g, "").toLowerCase();
        const matches = Object.keys(accreditationObj).some((accKey) => {
          const normalizedAcc = String(accKey || "")
            .replace(/[^a-z]/g, "")
            .toLowerCase();
          return normalizedAcc === normalized;
        });

        if (!matches) return false;

        const matchedKey = Object.keys(accreditationObj).find((accKey) => {
          const normalizedAcc = String(accKey || "")
            .replace(/[^a-z]/g, "")
            .toLowerCase();
          return normalizedAcc === normalized;
        });

        return !!accreditationObj[matchedKey];
      });
      if (hasAccreditation) return true;
    }

    const roleTokens = getRoleTokens(member);
    return keys.some((key) => {
      const normalizedKey = key.replace(/[^a-z]/g, "").toLowerCase();
      return roleTokens.some(
        (token) => token.replace(/[^a-z]/g, "").toLowerCase() === normalizedKey,
      );
    });
  };

  const memberOptions = useMemo(
    () =>
      (clubMembers || []).map((member) => ({
        id: member.id,
        label: displayName(member),
        member,
      })),
    [clubMembers],
  );

  const accreditedCoachOptions = useMemo(
    () =>
      memberOptions.filter((option) =>
        isAccreditedFor(option.member, ["coach"]),
      ),
    [memberOptions],
  );
  const accreditedManagerOptions = useMemo(
    () =>
      memberOptions.filter((option) =>
        isAccreditedFor(option.member, ["manager"]),
      ),
    [memberOptions],
  );
  const accreditedLeagueSafeOptions = useMemo(
    () =>
      memberOptions.filter((option) =>
        isAccreditedFor(option.member, ["leaguesafe", "league safe"]),
      ),
    [memberOptions],
  );
  const accreditedFirstAidOptions = useMemo(
    () =>
      memberOptions.filter((option) =>
        isAccreditedFor(option.member, [
          "firstaid",
          "first aid",
          "sports trainer",
          "trainer",
        ]),
      ),
    [memberOptions],
  );
  const parentOrUserOptions = useMemo(() => {
    const filtered = memberOptions.filter((option) => {
      const roles = getRoleTokens(option.member);
      return roles.includes("parent") || roles.includes("user");
    });
    return filtered.length > 0 ? filtered : memberOptions;
  }, [memberOptions]);

  const appTeamMembers = useMemo(() => {
    if (!match?.teamId) return [];
    return (clubMembers || [])
      .filter(
        (m) => Array.isArray(m.teamIds) && m.teamIds.includes(match.teamId),
      )
      .map((m) => ({
        id: m.id || m.uid,
        name: displayName(m),
        isAppMember: true,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clubMembers, match?.teamId]);

  const combinedSquad = useMemo(() => {
    const manual =
      selectedSquadPlayers.length > 0
        ? selectedSquadPlayers
        : manualPlayerOptions;
    const combined = [...appTeamMembers, ...manual];

    // remove duplicates if any (just in case)
    const seen = new Set();
    return combined.filter((p) => {
      if (!p.id || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [appTeamMembers, selectedSquadPlayers, manualPlayerOptions]);

  const playerOptions = useMemo(() => {
    return combinedSquad.map((player) => ({
      id: player.id,
      label: player.name,
    }));
  }, [combinedSquad]);

  function resolveLabel(id, options) {
    if (!id) return "Not selected";
    return options.find((option) => option.id === id)?.label || "Not selected";
  }

  const selectedSquadFromSheet = useMemo(() => {
    const slots = Array.isArray(teamSheet.playerIds) ? teamSheet.playerIds : [];
    const resolved = slots
      .filter((id) => !!id)
      .map((id, index) => ({
        id,
        label: resolveLabel(id, playerOptions),
        index,
      }))
      .filter((row) => row.label && row.label !== "Not selected");

    return resolved;
  }, [teamSheet.playerIds, playerOptions]);

  const previewPlayers = useMemo(() => {
    if (selectedSquadFromSheet.length > 0) {
      return selectedSquadFromSheet.map((player) => ({
        id: player.id,
        label: player.label,
      }));
    }

    return (combinedSquad || []).map((player, index) => ({
      id: player.id || `preview-${index}`,
      label: player.name || `Player ${index + 1}`,
    }));
  }, [selectedSquadFromSheet, combinedSquad]);

  useEffect(() => {
    let cancelled = false;

    const loadSelectedSquad = async () => {
      if (!activeClubId || !match?.teamId) {
        setSelectedSquadPlayers([]);
        return;
      }

      setLoadingSquad(true);
      try {
        const team = await getTeam(activeClubId, match.teamId);
        const manualPlayers = Array.isArray(team?.manualPlayers)
          ? team.manualPlayers
          : [];
        const selectedIds = Array.isArray(team?.selectedManualPlayerIds)
          ? team.selectedManualPlayerIds
          : [];

        const byId = new Map(
          manualPlayers
            .filter((player) => !!player?.id)
            .map((player) => [player.id, player]),
        );

        const selected = selectedIds
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((player) => ({
            id: player.id,
            name: player.name || "Unnamed Player",
          }));

        const allManual = manualPlayers.map((player) => ({
          id: player.id,
          name: player.name || "Unnamed Player",
        }));

        if (!cancelled) {
          setSelectedSquadPlayers(selected);
          setManualPlayerOptions(allManual);
        }
      } catch {
        if (!cancelled) {
          setSelectedSquadPlayers([]);
          setManualPlayerOptions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSquad(false);
        }
      }
    };

    loadSelectedSquad();

    return () => {
      cancelled = true;
    };
  }, [activeClubId, match?.teamId]);

  useEffect(() => {
    let cancelled = false;

    const loadMembers = async () => {
      if (!activeClubId) return;
      try {
        const rows = await getClubMembers(activeClubId);
        if (!cancelled) {
          setClubMembers(Array.isArray(rows) ? rows : []);
        }
      } catch {
        if (!cancelled) {
          setClubMembers([]);
        }
      }
    };

    loadMembers();

    return () => {
      cancelled = true;
    };
  }, [activeClubId]);

  useEffect(() => {
    let cancelled = false;

    const loadSavedTeamSheet = async () => {
      if (!activeClubId || !match?.id) return;
      try {
        const eventRow = await getEventById(activeClubId, match.id);
        const saved = eventRow?.teamSheet || {};
        if (!cancelled) {
          setTeamSheet((prev) => ({
            ...prev,
            coachId: saved.coachId || "",
            managerId: saved.managerId || "",
            leagueSafeId: saved.leagueSafeId || "",
            firstAidId: saved.firstAidId || "",
            touchJudgeId: saved.touchJudgeId || "",
            dutyOfficialId: saved.dutyOfficialId || "",
            playerIds: buildFixedPlayerSlots(saved.playerIds),
          }));
          setHasLoadedSavedTeamSheet(true);
        }
      } catch {
        // Keep local defaults if event fetch fails.
        if (!cancelled) {
          setHasLoadedSavedTeamSheet(true);
        }
      }
    };

    loadSavedTeamSheet();

    return () => {
      cancelled = true;
    };
  }, [activeClubId, match?.id]);

  useEffect(() => {
    if (!hasLoadedSavedTeamSheet) return;
    if (combinedSquad.length === 0) return;

    const currentSlots = Array.isArray(teamSheet.playerIds)
      ? teamSheet.playerIds
      : [];
    const hasAnySelection = currentSlots.some((id) => !!id);
    if (hasAnySelection) return;

    setTeamSheet((prev) => ({
      ...prev,
      playerIds: buildFixedPlayerSlots(
        combinedSquad.map((player) => player.id),
      ),
    }));
  }, [hasLoadedSavedTeamSheet, combinedSquad, teamSheet.playerIds]);

  const setRoleSelection = (field, value) => {
    setTeamSheet((prev) => ({
      ...prev,
      [field]: prev[field] === value ? "" : value,
    }));
  };

  const setPlayerSelectionAt = (index, playerId) => {
    setTeamSheet((prev) => {
      const next = [...(Array.isArray(prev.playerIds) ? prev.playerIds : [])];
      next[index] = next[index] === playerId ? "" : playerId;
      return { ...prev, playerIds: next };
    });
  };

  const saveTeamSheet = async () => {
    if (!activeClubId || !match?.id || !canEditTeamSheet) return;
    setSavingTeamSheet(true);
    try {
      const payload = {
        coachId: teamSheet.coachId || "",
        managerId: teamSheet.managerId || "",
        leagueSafeId: teamSheet.leagueSafeId || "",
        firstAidId: teamSheet.firstAidId || "",
        touchJudgeId: teamSheet.touchJudgeId || "",
        dutyOfficialId: teamSheet.dutyOfficialId || "",
        playerIds: buildFixedPlayerSlots(teamSheet.playerIds),
      };

      await updateEvent(activeClubId, match.id, {
        teamSheet: payload,
      });

      Alert.alert("Saved", "Weekend team roles and list updated.");
    } catch {
      Alert.alert("Error", "Could not save team sheet right now.");
    } finally {
      setSavingTeamSheet(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft color={theme.colors.text} size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text variant="h3" numberOfLines={1}>
            Match Details
          </Text>
          <Text variant="small" color={theme.colors.textSecondary}>
            {teamName} vs {opponent}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Pulsing Live Match Header */}
        {statusLabel === "Live" && (
          <View style={styles.liveBanner}>
            <View style={styles.liveDot} />
            <Text variant="small" weight="800" color="#fff" style={{ letterSpacing: 0.8 }}>
              LIVE IN PLAY
            </Text>
            {match.period ? (
              <Text variant="small" weight="700" color="#fff" style={{ marginLeft: 6 }}>
                • {match.period} {match.matchMinute ? `(${match.matchMinute})` : ""}
              </Text>
            ) : null}
          </View>
        )}

        <Card style={styles.scoreCard}>
          <View style={styles.scoreHeader}>
            <Text
              variant="small"
              color={statusLabel === "Live" ? "#EF4444" : theme.colors.textSecondary}
              weight="700"
            >
              {statusLabel === "Live" ? "🔴 " : ""}{statusLabel.toUpperCase()}
            </Text>
            <Text
              variant="small"
              weight="700"
              color={
                resultLabel === "Win"
                  ? theme.colors.primary
                  : resultLabel === "Loss"
                    ? theme.colors.error
                    : theme.colors.textSecondary
              }
            >
              {resultLabel}
            </Text>
          </View>

          <View style={styles.scoreRow}>
            <View style={styles.teamBox}>
              <Text variant="body" weight="700" numberOfLines={2}>
                {teamName}
              </Text>
            </View>
            <View style={styles.scoreBox}>
              {hasScore ? (
                <Text variant="h2" weight="700">
                  {match.ourScore} - {match.opponentScore}
                </Text>
              ) : (
                <Text variant="h4" color={theme.colors.textSecondary}>
                  vs
                </Text>
              )}
            </View>
            <View style={styles.teamBox}>
              <Text variant="body" weight="700" numberOfLines={2}>
                {opponent}
              </Text>
            </View>
          </View>

          {canEditTeamSheet && (
            <TouchableOpacity
              style={styles.updateScoreBtn}
              onPress={openScoreModal}
              activeOpacity={0.8}
            >
              <Edit3 size={14} color={theme.colors.primary} style={{ marginRight: 6 }} />
              <Text variant="small" weight="700" color={theme.colors.primary}>
                Update Live Score &amp; Status
              </Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Live Stream Broadcast Card */}
        {match.streamUrl ? (
          <Card style={styles.streamCard}>
            <View style={styles.streamHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <View style={styles.streamIconWrap}>
                  <Video color="#EF4444" size={22} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="700" numberOfLines={1}>
                    {match.streamTitle || "Live Match Stream"}
                  </Text>
                  <Text variant="caption" color={theme.colors.textSecondary}>
                    {statusLabel === "Live" ? "🔴 Live Video Broadcast Active" : "Match Video / Stream Link"}
                  </Text>
                </View>
              </View>
              <View style={styles.streamBadge}>
                <Text variant="caption" weight="800" color="#fff">
                  STREAM
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.watchStreamBtn}
              onPress={() => Linking.openURL(match.streamUrl).catch(() => Alert.alert("Error", "Could not open stream URL"))}
              activeOpacity={0.85}
            >
              <Play color="#fff" size={18} fill="#fff" style={{ marginRight: 6 }} />
              <Text variant="body" weight="700" color="#fff">
                Watch Live Stream
              </Text>
              <ExternalLink color="#fff" size={16} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </Card>
        ) : null}

        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <CalendarDays color={theme.colors.primary} size={16} />
            <Text variant="small" style={styles.infoText}>
              Date: {match.date || "TBD"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Clock3 color={theme.colors.primary} size={16} />
            <Text variant="small" style={styles.infoText}>
              Kick-off: {match.startTime || "TBD"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <MapPin color={theme.colors.primary} size={16} />
            <Text variant="small" style={styles.infoText}>
              Venue: {match.location || "TBD"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Trophy color={theme.colors.primary} size={16} />
            <Text variant="small" style={styles.infoText}>
              Competition status: {statusLabel}
            </Text>
          </View>
        </Card>

        <Card style={styles.notesCard}>
          <Text variant="h4" style={{ marginBottom: 6 }}>
            Game Information
          </Text>
          <Text variant="small" color={theme.colors.textSecondary}>
            {match.description ||
              "No additional game notes yet. This section is ready for squad sheets, match notes, and live updates."}
          </Text>
        </Card>

        {/* Live Match Timeline & Commentary Feed */}
        {Array.isArray(match.timeline) && match.timeline.length > 0 && (
          <Card style={styles.notesCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <Flame color={theme.colors.primary} size={18} />
              <Text variant="h4">Match Timeline &amp; Highlights ({match.timeline.length})</Text>
            </View>
            <View style={styles.timelineList}>
              {match.timeline.map((item, idx) => (
                <View key={item.id || `timeline-${idx}`} style={styles.timelineRow}>
                  <View style={styles.timelineMinuteBadge}>
                    <Text variant="caption" weight="700" color={theme.colors.text}>
                      {item.minute || "—"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="small" weight="700" color={theme.colors.text}>
                      {item.type === "goal" ? "⚽ " : item.type === "yellow_card" ? "🟨 " : item.type === "red_card" ? "🟥 " : item.type === "sub" ? "🔄 " : "📢 "}
                      {item.player ? `${item.player} — ` : ""}
                      {item.description}
                    </Text>
                    <Text variant="caption" color={theme.colors.textSecondary}>
                      Score: {item.scoreAfter || `${match.ourScore} - ${match.opponentScore}`}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        <Card style={styles.notesCard}>
          <Text variant="h4" style={{ marginBottom: 6 }}>
            Selected Match Squad
          </Text>
          {loadingSquad ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : previewPlayers.length > 0 ? (
            previewPlayers.map((player, index) => (
              <Text
                key={player.id || `sheet-${index}`}
                variant="small"
                color={theme.colors.textSecondary}
                style={{ marginBottom: 4 }}
              >
                {index + 1}. {player.label}
              </Text>
            ))
          ) : (
            <Text variant="small" color={theme.colors.textSecondary}>
              No players available yet. Add team members or manual players
              first.
            </Text>
          )}
        </Card>

        <Card style={styles.notesCard}>
          <Text variant="h4" style={{ marginBottom: 6 }}>
            Weekend Team Roles
          </Text>
          <Text
            variant="small"
            color={theme.colors.textSecondary}
            style={{ marginBottom: 10 }}
          >
            Fill team roles for this match. Attendance is not used here.
          </Text>

          <View style={styles.selectorBlock}>
            <Text variant="small" weight="700">
              Coach: Select Accredited Coach
            </Text>
            <Text
              variant="small"
              color={theme.colors.textSecondary}
              style={styles.currentValue}
            >
              {resolveLabel(teamSheet.coachId, accreditedCoachOptions)}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {accreditedCoachOptions.map((option) => (
                <TouchableOpacity
                  key={`coach-${option.id}`}
                  style={[
                    styles.roleChip,
                    teamSheet.coachId === option.id && styles.roleChipActive,
                  ]}
                  onPress={() => setRoleSelection("coachId", option.id)}
                  disabled={!canEditTeamSheet}
                >
                  <Text
                    variant="small"
                    color={
                      teamSheet.coachId === option.id
                        ? theme.colors.white
                        : theme.colors.text
                    }
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.selectorBlock}>
            <Text variant="small" weight="700">
              Manager: Select Accredited Manager
            </Text>
            <Text
              variant="small"
              color={theme.colors.textSecondary}
              style={styles.currentValue}
            >
              {resolveLabel(teamSheet.managerId, accreditedManagerOptions)}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {accreditedManagerOptions.map((option) => (
                <TouchableOpacity
                  key={`manager-${option.id}`}
                  style={[
                    styles.roleChip,
                    teamSheet.managerId === option.id && styles.roleChipActive,
                  ]}
                  onPress={() => setRoleSelection("managerId", option.id)}
                  disabled={!canEditTeamSheet}
                >
                  <Text
                    variant="small"
                    color={
                      teamSheet.managerId === option.id
                        ? theme.colors.white
                        : theme.colors.text
                    }
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.selectorBlock}>
            <Text variant="small" weight="700">
              League Safe: Select Accredited LeagueSafe
            </Text>
            <Text
              variant="small"
              color={theme.colors.textSecondary}
              style={styles.currentValue}
            >
              {resolveLabel(
                teamSheet.leagueSafeId,
                accreditedLeagueSafeOptions,
              )}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {accreditedLeagueSafeOptions.map((option) => (
                <TouchableOpacity
                  key={`leaguesafe-${option.id}`}
                  style={[
                    styles.roleChip,
                    teamSheet.leagueSafeId === option.id &&
                      styles.roleChipActive,
                  ]}
                  onPress={() => setRoleSelection("leagueSafeId", option.id)}
                  disabled={!canEditTeamSheet}
                >
                  <Text
                    variant="small"
                    color={
                      teamSheet.leagueSafeId === option.id
                        ? theme.colors.white
                        : theme.colors.text
                    }
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.selectorBlock}>
            <Text variant="small" weight="700">
              FirstAid: Select Accredited FirstAid
            </Text>
            <Text
              variant="small"
              color={theme.colors.textSecondary}
              style={styles.currentValue}
            >
              {resolveLabel(teamSheet.firstAidId, accreditedFirstAidOptions)}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {accreditedFirstAidOptions.map((option) => (
                <TouchableOpacity
                  key={`firstaid-${option.id}`}
                  style={[
                    styles.roleChip,
                    teamSheet.firstAidId === option.id && styles.roleChipActive,
                  ]}
                  onPress={() => setRoleSelection("firstAidId", option.id)}
                  disabled={!canEditTeamSheet}
                >
                  <Text
                    variant="small"
                    color={
                      teamSheet.firstAidId === option.id
                        ? theme.colors.white
                        : theme.colors.text
                    }
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.selectorBlock}>
            <Text variant="small" weight="700">
              Touch Judge: Select Parent or User
            </Text>
            <Text
              variant="small"
              color={theme.colors.textSecondary}
              style={styles.currentValue}
            >
              {resolveLabel(teamSheet.touchJudgeId, parentOrUserOptions)}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {parentOrUserOptions.map((option) => (
                <TouchableOpacity
                  key={`touchjudge-${option.id}`}
                  style={[
                    styles.roleChip,
                    teamSheet.touchJudgeId === option.id &&
                      styles.roleChipActive,
                  ]}
                  onPress={() => setRoleSelection("touchJudgeId", option.id)}
                  disabled={!canEditTeamSheet}
                >
                  <Text
                    variant="small"
                    color={
                      teamSheet.touchJudgeId === option.id
                        ? theme.colors.white
                        : theme.colors.text
                    }
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.selectorBlock}>
            <Text variant="small" weight="700">
              Duty Official: Select Parent or User
            </Text>
            <Text
              variant="small"
              color={theme.colors.textSecondary}
              style={styles.currentValue}
            >
              {resolveLabel(teamSheet.dutyOfficialId, parentOrUserOptions)}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {parentOrUserOptions.map((option) => (
                <TouchableOpacity
                  key={`dutyofficial-${option.id}`}
                  style={[
                    styles.roleChip,
                    teamSheet.dutyOfficialId === option.id &&
                      styles.roleChipActive,
                  ]}
                  onPress={() => setRoleSelection("dutyOfficialId", option.id)}
                  disabled={!canEditTeamSheet}
                >
                  <Text
                    variant="small"
                    color={
                      teamSheet.dutyOfficialId === option.id
                        ? theme.colors.white
                        : theme.colors.text
                    }
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.selectorBlock}>
            <Text variant="small" weight="700">
              Team List
            </Text>
            {(Array.isArray(teamSheet.playerIds)
              ? teamSheet.playerIds
              : []
            ).map((playerId, index) => (
              <View
                key={`selector-row-${playerId || "empty"}-${index}`}
                style={styles.playerSlotBlock}
              >
                <View style={styles.playerSlotHeader}>
                  <Text variant="small" weight="700">
                    Player {index + 1}
                  </Text>
                </View>
                <Text
                  variant="small"
                  color={theme.colors.textSecondary}
                  style={styles.currentValue}
                >
                  {resolveLabel(playerId, playerOptions)}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {playerOptions.map((option) => (
                    <TouchableOpacity
                      key={`slot-${index}-${option.id}`}
                      style={[
                        styles.roleChip,
                        playerId === option.id && styles.roleChipActive,
                      ]}
                      onPress={() => setPlayerSelectionAt(index, option.id)}
                      disabled={!canEditTeamSheet}
                    >
                      <Text
                        variant="small"
                        color={
                          playerId === option.id
                            ? theme.colors.white
                            : theme.colors.text
                        }
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ))}
          </View>

          {canEditTeamSheet ? (
            <Button
              title={savingTeamSheet ? "Saving..." : "Save Team Roles"}
              onPress={saveTeamSheet}
              disabled={savingTeamSheet}
              size="small"
            />
          ) : (
            <Text variant="small" color={theme.colors.textSecondary}>
              Only Owner/Admin/Coach/Manager can edit weekend team roles.
            </Text>
          )}
        </Card>
      </ScrollView>

      {/* Mobile Live Score Updating Modal */}
      <Modal
        visible={showScoreModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowScoreModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text variant="h3">Update Live Match</Text>
              <TouchableOpacity onPress={() => setShowScoreModal(false)}>
                <X color={theme.colors.textSecondary} size={22} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              {/* Score Adjuster */}
              <View style={styles.modalScoreRow}>
                <View style={styles.modalTeamScoreCol}>
                  <Text variant="small" weight="700" numberOfLines={1}>{teamName}</Text>
                  <Text variant="h1" weight="800" style={styles.modalScoreBig}>{liveHomeScore}</Text>
                  <View style={styles.modalBtnRow}>
                    <TouchableOpacity style={styles.counterBtn} onPress={() => setLiveHomeScore(prev => Math.max(0, prev - 1))}>
                      <Minus size={16} color={theme.colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.counterBtn, styles.counterBtnPrimary]} onPress={() => setLiveHomeScore(prev => prev + 1)}>
                      <Plus size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text variant="h3" color={theme.colors.textSecondary}>:</Text>

                <View style={styles.modalTeamScoreCol}>
                  <Text variant="small" weight="700" numberOfLines={1}>{opponent}</Text>
                  <Text variant="h1" weight="800" style={styles.modalScoreBig}>{liveAwayScore}</Text>
                  <View style={styles.modalBtnRow}>
                    <TouchableOpacity style={styles.counterBtn} onPress={() => setLiveAwayScore(prev => Math.max(0, prev - 1))}>
                      <Minus size={16} color={theme.colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.counterBtn, styles.counterBtnPrimary]} onPress={() => setLiveAwayScore(prev => prev + 1)}>
                      <Plus size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Status Selector */}
              <Text variant="small" style={styles.label}>Match Status</Text>
              <View style={styles.statusChipsRow}>
                {["scheduled", "live", "halftime", "completed"].map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[styles.statusChip, liveStatus === st && styles.statusChipActive]}
                    onPress={() => setLiveStatus(st)}
                  >
                    <Text variant="caption" weight="700" color={liveStatus === st ? "#fff" : theme.colors.text}>
                      {st === "live" ? "🔴 Live" : st === "halftime" ? "⏸️ Half Time" : st === "completed" ? "🏁 Full Time" : "Scheduled"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text variant="small" style={styles.label}>Period / Half Label</Text>
              <TextInput
                value={livePeriod}
                onChangeText={setLivePeriod}
                placeholder="e.g. 1st Half, 2nd Half, Extra Time"
                style={styles.modalInput}
              />
            </ScrollView>

            <Button
              title={savingLiveScore ? "Saving..." : "Save & Broadcast Live"}
              onPress={saveLiveScore}
              loading={savingLiveScore}
              style={{ marginTop: 16 }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  backBtn: {
    marginRight: theme.spacing.sm,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 120,
  },
  liveBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EF4444",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm || 8,
    marginBottom: theme.spacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
    marginRight: 8,
  },
  scoreCard: {
    marginBottom: theme.spacing.md,
  },
  scoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  teamBox: {
    flex: 1,
    alignItems: "center",
  },
  scoreBox: {
    minWidth: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  updateScoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  streamCard: {
    marginBottom: theme.spacing.md,
    backgroundColor: "#0F172A",
  },
  streamHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  streamIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  streamBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  watchStreamBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444",
    borderRadius: 10,
    paddingVertical: 12,
  },
  timelineList: {
    flexDirection: "column",
    gap: 8,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  timelineMinuteBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#E2E8F0",
    minWidth: 32,
    alignItems: "center",
  },
  infoCard: {
    marginBottom: theme.spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  infoText: {
    marginLeft: 8,
  },
  notesCard: {
    marginBottom: theme.spacing.md,
  },
  selectorBlock: {
    marginBottom: 14,
  },
  currentValue: {
    marginTop: 3,
    marginBottom: 6,
  },
  roleChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: theme.colors.surface,
  },
  roleChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  playerSlotBlock: {
    marginBottom: 10,
  },
  playerSlotHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: theme.spacing.lg,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  modalScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    marginBottom: 16,
  },
  modalTeamScoreCol: {
    alignItems: "center",
    minWidth: 100,
  },
  modalScoreBig: {
    fontSize: 40,
    marginVertical: 4,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  counterBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  counterBtnPrimary: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  label: {
    marginBottom: 6,
    fontWeight: "700",
  },
  statusChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statusChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#F8FAFC",
    fontSize: 14,
  },
});
