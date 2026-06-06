import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  CalendarDays,
  MapPin,
  Clock3,
  Trophy,
} from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { theme } from "../../theme/theme";
import { useClub } from "../../contexts/ClubContext";
import { getTeam } from "../../services/teamService";
import { getClubMembers } from "../../services/clubService";
import { getEventById, updateEvent } from "../../services/eventService";

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
  const match = route?.params?.match || {};
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
        <Card style={styles.scoreCard}>
          <View style={styles.scoreHeader}>
            <Text
              variant="small"
              color={theme.colors.textSecondary}
              weight="600"
            >
              {statusLabel.toUpperCase()}
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
        </Card>

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
});
