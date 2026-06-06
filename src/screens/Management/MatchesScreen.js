import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Calendar as DatePickerCalendar } from "react-native-calendars";
import {
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Trophy,
  Save,
  X,
} from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { Button, FAB } from "../../components/ui/Button";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { theme } from "../../theme/theme";
import { useClub } from "../../contexts/ClubContext";
import { useAuth } from "../../contexts/AuthContext";
import { subscribeToTeams } from "../../services/teamService";
import {
  subscribeToEvents,
  createMatch,
  updateMatch,
  deleteEvent,
} from "../../services/eventService";

const RESULT_OPTIONS = ["scheduled", "completed"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function MatchesScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const { activeClubId, userRole, userGroupIds } = useClub();
  const { user, profile } = useAuth();
  const normalizedRole = String(userRole || "")
    .trim()
    .toLowerCase();
  const isAdminUser = normalizedRole === "owner" || normalizedRole === "admin";
  const canManageMatches = ["owner", "admin", "coach", "manager"].includes(
    normalizedRole,
  );
  const isOrganizationManagedMatch = (match) =>
    String(match?.source || "").toLowerCase() === "organization" ||
    match?.isFixtureLocked === true;

  const [teams, setTeams] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState(0); // 0 Upcoming, 1 Results
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateDatePicker, setShowCreateDatePicker] = useState(false);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);

  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [opponent, setOpponent] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    teamId: "",
    opponent: "",
    date: "",
    startTime: "",
    location: "",
    description: "",
    status: "scheduled",
    ourScore: "",
    opponentScore: "",
  });

  const myTeamIds = useMemo(() => {
    const memberships = Array.isArray(profile?.clubMemberships)
      ? profile.clubMemberships
      : [];
    const membership = memberships.find((m) => m.clubId === activeClubId);
    return Array.isArray(membership?.teamIds) ? membership.teamIds : [];
  }, [profile?.clubMemberships, activeClubId]);

  useEffect(() => {
    if (!activeClubId) {
      setTeams([]);
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubTeams = subscribeToTeams(activeClubId, setTeams, {
      teamIds: myTeamIds,
      isAdmin: isAdminUser,
    });
    const unsubEvents = subscribeToEvents(
      activeClubId,
      (rows) => {
        setEvents(rows || []);
        setLoading(false);
      },
      {
        teamIds: myTeamIds,
        groupIds: userGroupIds,
        isAdmin: isAdminUser,
      },
    );

    return () => {
      unsubTeams?.();
      unsubEvents?.();
    };
  }, [activeClubId, myTeamIds, userGroupIds, isAdminUser]);

  useEffect(() => {
    if (!selectedTeamId && teams.length > 0) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  const selectedTeamRecord = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) || null,
    [teams, selectedTeamId],
  );

  const matches = useMemo(() => {
    return (events || [])
      .filter((e) => e.type === "game" || e.type === "match")
      .sort((a, b) => {
        const aKey = `${a.date || ""} ${a.startTime || ""}`;
        const bKey = `${b.date || ""} ${b.startTime || ""}`;
        return aKey.localeCompare(bKey);
      });
  }, [events]);

  const today = new Date().toISOString().slice(0, 10);
  const upcomingMatches = matches.filter(
    (m) =>
      (m.status || "scheduled") !== "completed" && (!m.date || m.date >= today),
  );
  const completedMatches = matches
    .filter(
      (m) =>
        (m.status || "scheduled") === "completed" || (m.date && m.date < today),
    )
    .reverse();

  const visibleMatches = activeTab === 0 ? upcomingMatches : completedMatches;
  const pageWidthStyle = width >= 900 ? styles.pageWidth : null;

  const teamNameById = useMemo(() => {
    const map = {};
    teams.forEach((t) => {
      map[t.id] = t.name;
    });
    return map;
  }, [teams]);

  const resetCreateForm = () => {
    setOpponent("");
    setDate("");
    setStartTime("");
    setLocation("");
    setNotes("");
  };

  const handleCreateDateSelect = (day) => {
    if (!day?.dateString) return;
    setDate(day.dateString);
    setShowCreateDatePicker(false);
  };

  const handleEditDateSelect = (day) => {
    if (!day?.dateString) return;
    setEditForm((prev) => ({ ...prev, date: day.dateString }));
    setShowEditDatePicker(false);
  };

  const onCreateMatch = async () => {
    if (!activeClubId || !canManageMatches) return;
    if (teams.length === 0) {
      Alert.alert(
        "No Teams Found",
        "Create a team first, then schedule a match.",
      );
      return;
    }
    if (!selectedTeamId) {
      Alert.alert("Team Required", "Select a team before creating a match.");
      return;
    }
    if (
      selectedTeamRecord?.linkedOrganizationTeamId ||
      selectedTeamRecord?.linkedOrgTeamId
    ) {
      Alert.alert(
        "Organisation Managed",
        "This team is linked to an organisation team. Create fixtures from Organisation so they flow down automatically.",
      );
      return;
    }
    if (!selectedTeamId || !opponent.trim() || !date.trim()) {
      Alert.alert("Required", "Team, opponent, and date are required.");
      return;
    }
    if (!DATE_RE.test(date.trim())) {
      Alert.alert("Invalid Date", "Use YYYY-MM-DD format for date.");
      return;
    }
    if (startTime.trim() && !TIME_RE.test(startTime.trim())) {
      Alert.alert(
        "Invalid Time",
        "Use 24-hour HH:MM format for kick-off time.",
      );
      return;
    }

    setSaving(true);
    try {
      await createMatch(activeClubId, {
        teamId: selectedTeamId,
        teamName: teamNameById[selectedTeamId] || "Team",
        opponent: opponent.trim(),
        date: date.trim(),
        startTime: startTime.trim(),
        location: location.trim(),
        description: notes.trim(),
        createdBy: user?.uid || "",
      });
      resetCreateForm();
      setShowCreate(false);
      Alert.alert("Success", "Match scheduled successfully.");
    } catch {
      Alert.alert("Error", "Could not create match right now.");
    } finally {
      setSaving(false);
    }
  };

  const onDeleteMatch = (matchId) => {
    if (!activeClubId || !canManageMatches) return;
    const targetMatch = matches.find((match) => match.id === matchId);
    if (isOrganizationManagedMatch(targetMatch)) {
      Alert.alert(
        "Organisation Managed",
        "This fixture comes from Organisation and cannot be deleted from Club Matches.",
      );
      return;
    }
    Alert.alert("Delete Match", "Are you sure you want to delete this match?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteEvent(activeClubId, matchId);
          } catch {
            Alert.alert("Error", "Could not delete match right now.");
          }
        },
      },
    ]);
  };

  const startEdit = (match) => {
    if (isOrganizationManagedMatch(match)) {
      Alert.alert(
        "Organisation Managed",
        "This fixture is controlled by Organisation and cannot be edited here.",
      );
      return;
    }
    setEditingId(match.id);
    setEditForm({
      teamId: match.teamId || "",
      opponent: match.opponent || "",
      date: match.date || "",
      startTime: match.startTime || "",
      location: match.location || "",
      description: match.description || "",
      status: match.status || "scheduled",
      ourScore:
        typeof match.ourScore === "number" ? String(match.ourScore) : "",
      opponentScore:
        typeof match.opponentScore === "number"
          ? String(match.opponentScore)
          : "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      teamId: "",
      opponent: "",
      date: "",
      startTime: "",
      location: "",
      description: "",
      status: "scheduled",
      ourScore: "",
      opponentScore: "",
    });
  };

  const saveEdit = async (matchId) => {
    if (!activeClubId || !canManageMatches) return;
    const targetMatch = matches.find((match) => match.id === matchId);
    if (isOrganizationManagedMatch(targetMatch)) {
      Alert.alert(
        "Organisation Managed",
        "This fixture is locked. Update it from Organisation.",
      );
      return;
    }
    if (
      !editForm.teamId ||
      !editForm.opponent.trim() ||
      !editForm.date.trim()
    ) {
      Alert.alert("Required", "Team, opponent, and date are required.");
      return;
    }

    const nextStatus = editForm.status;
    const parsedOur = Number.parseInt(editForm.ourScore, 10);
    const parsedOpp = Number.parseInt(editForm.opponentScore, 10);
    const hasResult = Number.isFinite(parsedOur) && Number.isFinite(parsedOpp);

    try {
      await updateMatch(activeClubId, matchId, {
        teamId: editForm.teamId,
        teamName: teamNameById[editForm.teamId] || "Team",
        opponent: editForm.opponent.trim(),
        date: editForm.date.trim(),
        startTime: editForm.startTime.trim(),
        location: editForm.location.trim(),
        description: editForm.description.trim(),
        status: hasResult ? "completed" : nextStatus,
        ourScore: hasResult ? parsedOur : null,
        opponentScore: hasResult ? parsedOpp : null,
      });
      cancelEdit();
    } catch {
      Alert.alert("Error", "Could not update match right now.");
    }
  };

  const renderMatchSubtitle = (match) => {
    const parts = [];
    if (match.date) parts.push(match.date);
    if (match.startTime) parts.push(match.startTime);
    if (match.location) parts.push(match.location);
    return parts.join(" • ");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={[styles.header, pageWidthStyle]}>
        <View>
          <Text variant="h2">Matches</Text>
          <Text variant="small" style={{ marginTop: 2 }}>
            Schedule fixtures and record results
          </Text>
        </View>
        <View style={styles.headerActions}>
          {canManageMatches && (
            <Button
              title={showCreate ? "Close" : "New Match"}
              size="small"
              variant={showCreate ? "outline" : "primary"}
              onPress={() => setShowCreate((prev) => !prev)}
            />
          )}
          <View style={styles.headerIconWrap}>
            <Calendar color={theme.colors.primary} size={20} />
          </View>
        </View>
      </View>

      <View style={[styles.segmentWrap, pageWidthStyle]}>
        <SegmentedControl
          options={["Upcoming", "Results"]}
          selectedIndex={activeTab}
          onChange={setActiveTab}
        />
      </View>

      <ScrollView contentContainerStyle={[styles.content, pageWidthStyle]}>
        {showCreate && canManageMatches ? (
          <Card style={styles.formCard}>
            <Text variant="h4" style={{ marginBottom: theme.spacing.md }}>
              Create Match
            </Text>

            <Text variant="small" style={styles.label}>
              Team
            </Text>
            <TouchableOpacity
              style={styles.selectTeamButton}
              onPress={() => setShowTeamPicker(true)}
            >
              <Text variant="small" weight="600" color={theme.colors.primary}>
                Select Team
              </Text>
            </TouchableOpacity>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {teams.map((team) => {
                const active = selectedTeamId === team.id;
                return (
                  <TouchableOpacity
                    key={team.id}
                    style={[styles.teamChip, active && styles.teamChipActive]}
                    onPress={() => setSelectedTeamId(team.id)}
                  >
                    <Text
                      variant="small"
                      color={active ? theme.colors.white : theme.colors.text}
                    >
                      {team.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text variant="small" style={styles.label}>
              Opponent
            </Text>
            <TextInput
              value={opponent}
              onChangeText={setOpponent}
              placeholder="e.g. City United"
              style={styles.input}
            />

            <Text variant="small" style={styles.label}>
              Date (YYYY-MM-DD)
            </Text>
            <TouchableOpacity
              style={styles.datePickerInput}
              onPress={() => setShowCreateDatePicker(true)}
            >
              <Text
                color={date ? theme.colors.text : theme.colors.textSecondary}
              >
                {date || "Select date"}
              </Text>
            </TouchableOpacity>

            <Text variant="small" style={styles.label}>
              Kick-off Time
            </Text>
            <TextInput
              value={startTime}
              onChangeText={setStartTime}
              placeholder="18:30"
              style={styles.input}
            />

            <Text variant="small" style={styles.label}>
              Location
            </Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Main Stadium"
              style={styles.input}
            />

            <Text variant="small" style={styles.label}>
              Notes
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional match notes"
              style={[styles.input, styles.textArea]}
              multiline
            />

            <View style={styles.formActions}>
              <Button
                title={saving ? "Saving..." : "Save Match"}
                onPress={onCreateMatch}
                disabled={saving}
                size="small"
              />
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => {
                  resetCreateForm();
                  setShowCreate(false);
                }}
                size="small"
              />
            </View>
          </Card>
        ) : null}

        {loading ? (
          <ActivityIndicator
            size="large"
            color={theme.colors.primary}
            style={{ marginTop: theme.spacing.xl }}
          />
        ) : visibleMatches.length === 0 ? (
          <View style={styles.emptyState}>
            <Trophy color={theme.colors.border} size={44} />
            <Text
              variant="body"
              color={theme.colors.textSecondary}
              style={{ marginTop: theme.spacing.md, textAlign: "center" }}
            >
              {activeTab === 0
                ? "No upcoming matches yet."
                : "No match results recorded yet."}
            </Text>
            {activeTab === 0 && canManageMatches ? (
              <Button
                title="Schedule Match"
                size="small"
                style={{ marginTop: theme.spacing.md }}
                onPress={() => setShowCreate(true)}
              />
            ) : null}
          </View>
        ) : (
          visibleMatches.map((match) => {
            const teamName =
              teamNameById[match.teamId] || match.teamName || "Team";
            const isEditing = editingId === match.id;
            return (
              <TouchableOpacity
                key={match.id}
                activeOpacity={0.92}
                onPress={() =>
                  navigation.navigate("MatchDetails", {
                    match: {
                      id: match.id,
                      teamId: match.teamId || "",
                      teamName,
                      opponent: match.opponent || "",
                      date: match.date || "",
                      startTime: match.startTime || "",
                      location: match.location || "",
                      status: match.status || "scheduled",
                      ourScore: match.ourScore,
                      opponentScore: match.opponentScore,
                      description: match.description || "",
                    },
                  })
                }
              >
                <Card style={styles.matchCard}>
                  {isEditing ? (
                    <>
                      <Text variant="small" style={styles.label}>
                        Team
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                      >
                        {teams.map((team) => {
                          const active = editForm.teamId === team.id;
                          return (
                            <TouchableOpacity
                              key={team.id}
                              style={[
                                styles.teamChip,
                                active && styles.teamChipActive,
                              ]}
                              onPress={() =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  teamId: team.id,
                                }))
                              }
                            >
                              <Text
                                variant="small"
                                color={
                                  active
                                    ? theme.colors.white
                                    : theme.colors.text
                                }
                              >
                                {team.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>

                      <Text variant="small" style={styles.label}>
                        Opponent
                      </Text>
                      <TextInput
                        value={editForm.opponent}
                        onChangeText={(v) =>
                          setEditForm((prev) => ({ ...prev, opponent: v }))
                        }
                        style={styles.input}
                      />

                      <View style={styles.rowInputs}>
                        <View style={{ flex: 1 }}>
                          <Text variant="small" style={styles.label}>
                            Date
                          </Text>
                          <TouchableOpacity
                            style={styles.datePickerInput}
                            onPress={() => setShowEditDatePicker(true)}
                          >
                            <Text
                              color={
                                editForm.date
                                  ? theme.colors.text
                                  : theme.colors.textSecondary
                              }
                            >
                              {editForm.date || "Select date"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text variant="small" style={styles.label}>
                            Time
                          </Text>
                          <TextInput
                            value={editForm.startTime}
                            onChangeText={(v) =>
                              setEditForm((prev) => ({ ...prev, startTime: v }))
                            }
                            style={styles.input}
                          />
                        </View>
                      </View>

                      <Text variant="small" style={styles.label}>
                        Location
                      </Text>
                      <TextInput
                        value={editForm.location}
                        onChangeText={(v) =>
                          setEditForm((prev) => ({ ...prev, location: v }))
                        }
                        style={styles.input}
                      />

                      <Text variant="small" style={styles.label}>
                        Status
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          marginBottom: theme.spacing.sm,
                        }}
                      >
                        {RESULT_OPTIONS.map((s) => {
                          const active = editForm.status === s;
                          return (
                            <TouchableOpacity
                              key={s}
                              style={[
                                styles.statePill,
                                active && styles.statePillActive,
                              ]}
                              onPress={() =>
                                setEditForm((prev) => ({ ...prev, status: s }))
                              }
                            >
                              <Text
                                variant="small"
                                color={
                                  active
                                    ? theme.colors.white
                                    : theme.colors.text
                                }
                              >
                                {s === "completed" ? "Completed" : "Scheduled"}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <View style={styles.rowInputs}>
                        <View style={{ flex: 1 }}>
                          <Text variant="small" style={styles.label}>
                            {teamName} Score
                          </Text>
                          <TextInput
                            value={editForm.ourScore}
                            onChangeText={(v) =>
                              setEditForm((prev) => ({
                                ...prev,
                                ourScore: v.replace(/[^0-9]/g, ""),
                              }))
                            }
                            keyboardType="number-pad"
                            style={styles.input}
                            placeholder="-"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text variant="small" style={styles.label}>
                            Opponent Score
                          </Text>
                          <TextInput
                            value={editForm.opponentScore}
                            onChangeText={(v) =>
                              setEditForm((prev) => ({
                                ...prev,
                                opponentScore: v.replace(/[^0-9]/g, ""),
                              }))
                            }
                            keyboardType="number-pad"
                            style={styles.input}
                            placeholder="-"
                          />
                        </View>
                      </View>

                      <Text variant="small" style={styles.label}>
                        Notes
                      </Text>
                      <TextInput
                        value={editForm.description}
                        onChangeText={(v) =>
                          setEditForm((prev) => ({ ...prev, description: v }))
                        }
                        style={[styles.input, styles.textArea]}
                        multiline
                      />

                      <View style={styles.editActions}>
                        <TouchableOpacity
                          style={styles.iconTextBtn}
                          onPress={() => saveEdit(match.id)}
                        >
                          <Save color={theme.colors.primary} size={16} />
                          <Text
                            variant="small"
                            color={theme.colors.primary}
                            style={{ marginLeft: 6 }}
                          >
                            Save
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconTextBtn}
                          onPress={cancelEdit}
                        >
                          <X color={theme.colors.textSecondary} size={16} />
                          <Text variant="small" style={{ marginLeft: 6 }}>
                            Cancel
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.cardHeader}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text variant="h4">
                            {teamName} vs {match.opponent || "Opponent"}
                          </Text>
                          <Text
                            variant="small"
                            color={theme.colors.textSecondary}
                            style={{ marginTop: 4 }}
                          >
                            {renderMatchSubtitle(match) || "Date and venue TBD"}
                          </Text>
                        </View>
                        <View style={styles.statusBadge}>
                          <Text variant="small" color={theme.colors.primary}>
                            {(match.status || "scheduled").toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {typeof match.ourScore === "number" &&
                      typeof match.opponentScore === "number" ? (
                        <View style={styles.resultLine}>
                          <Trophy color={theme.colors.primary} size={14} />
                          <Text
                            variant="small"
                            weight="600"
                            style={{ marginLeft: 6 }}
                          >
                            Result: {teamName} {match.ourScore} -{" "}
                            {match.opponentScore} {match.opponent}
                          </Text>
                        </View>
                      ) : null}

                      {match.description ? (
                        <Text
                          variant="small"
                          color={theme.colors.textSecondary}
                          style={{ marginTop: 6 }}
                        >
                          {match.description}
                        </Text>
                      ) : null}

                      {isOrganizationManagedMatch(match) ? (
                        <Text
                          variant="small"
                          color={theme.colors.primary}
                          style={{ marginTop: 6 }}
                        >
                          Organisation source of truth
                        </Text>
                      ) : null}

                      {canManageMatches &&
                      !isOrganizationManagedMatch(match) ? (
                        <View style={styles.manageActions}>
                          <TouchableOpacity
                            style={styles.iconTextBtn}
                            onPress={() => startEdit(match)}
                          >
                            <Pencil color={theme.colors.primary} size={16} />
                            <Text
                              variant="small"
                              color={theme.colors.primary}
                              style={{ marginLeft: 6 }}
                            >
                              Manage
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.iconTextBtn}
                            onPress={() => onDeleteMatch(match.id)}
                          >
                            <Trash2 color={theme.colors.error} size={16} />
                            <Text
                              variant="small"
                              color={theme.colors.error}
                              style={{ marginLeft: 6 }}
                            >
                              Delete
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </>
                  )}
                </Card>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {canManageMatches && !showCreate ? (
        <FAB
          icon={<Plus color={theme.colors.white} size={24} />}
          onPress={() => setShowCreate(true)}
        />
      ) : null}

      <Modal
        visible={showTeamPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTeamPicker(false)}
      >
        <View style={styles.dateModalOverlay}>
          <View style={styles.dateModalCard}>
            <Text variant="h4" style={styles.dateModalTitle}>
              Select Team
            </Text>
            <ScrollView>
              {teams.length === 0 ? (
                <Text
                  variant="body"
                  color={theme.colors.textSecondary}
                  style={{ textAlign: "center", marginTop: theme.spacing.md }}
                >
                  No teams available.
                </Text>
              ) : (
                teams.map((team) => (
                  <TouchableOpacity
                    key={`team-picker-${team.id}`}
                    style={styles.teamPickerRow}
                    onPress={() => {
                      setSelectedTeamId(team.id);
                      setShowTeamPicker(false);
                    }}
                  >
                    <Text variant="body" weight="600">
                      {team.name}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.dateModalCloseBtn}
              onPress={() => setShowTeamPicker(false)}
            >
              <Text variant="body" weight="600" color={theme.colors.primary}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCreateDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateDatePicker(false)}
      >
        <View style={styles.dateModalOverlay}>
          <View style={styles.dateModalCard}>
            <Text variant="h4" style={styles.dateModalTitle}>
              Select Match Date
            </Text>
            <DatePickerCalendar
              current={DATE_RE.test(date) ? date : undefined}
              onDayPress={handleCreateDateSelect}
              markedDates={
                DATE_RE.test(date)
                  ? {
                      [date]: {
                        selected: true,
                        selectedColor: theme.colors.primary,
                      },
                    }
                  : undefined
              }
              theme={{
                todayTextColor: theme.colors.primary,
                selectedDayBackgroundColor: theme.colors.primary,
                arrowColor: theme.colors.primary,
                textDayFontWeight: "500",
                textMonthFontWeight: "700",
              }}
            />
            <TouchableOpacity
              style={styles.dateModalCloseBtn}
              onPress={() => setShowCreateDatePicker(false)}
            >
              <Text variant="body" weight="600" color={theme.colors.primary}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEditDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditDatePicker(false)}
      >
        <View style={styles.dateModalOverlay}>
          <View style={styles.dateModalCard}>
            <Text variant="h4" style={styles.dateModalTitle}>
              Select Match Date
            </Text>
            <DatePickerCalendar
              current={DATE_RE.test(editForm.date) ? editForm.date : undefined}
              onDayPress={handleEditDateSelect}
              markedDates={
                DATE_RE.test(editForm.date)
                  ? {
                      [editForm.date]: {
                        selected: true,
                        selectedColor: theme.colors.primary,
                      },
                    }
                  : undefined
              }
              theme={{
                todayTextColor: theme.colors.primary,
                selectedDayBackgroundColor: theme.colors.primary,
                arrowColor: theme.colors.primary,
                textDayFontWeight: "500",
                textMonthFontWeight: "700",
              }}
            />
            <TouchableOpacity
              style={styles.dateModalCloseBtn}
              onPress={() => setShowEditDatePicker(false)}
            >
              <Text variant="body" weight="600" color={theme.colors.primary}>
                Close
              </Text>
            </TouchableOpacity>
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
  pageWidth: {
    width: "100%",
    maxWidth: 1024,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(16,139,81,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  segmentWrap: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 160,
  },
  formCard: {
    marginBottom: theme.spacing.md,
  },
  label: {
    marginBottom: 6,
    color: theme.colors.textSecondary,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    color: theme.colors.text,
  },
  datePickerInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  teamChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  teamChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  selectTeamButton: {
    alignSelf: "flex-start",
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: "rgba(16,139,81,0.08)",
  },
  teamPickerRow: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  formActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: theme.spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    marginTop: theme.spacing.xl,
  },
  matchCard: {
    marginBottom: theme.spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(16,139,81,0.12)",
  },
  resultLine: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  manageActions: {
    marginTop: theme.spacing.sm,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  editActions: {
    marginTop: theme.spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  iconTextBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  rowInputs: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  statePill: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: theme.spacing.sm,
  },
  statePillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: theme.spacing.md,
  },
  dateModalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  dateModalTitle: {
    marginBottom: theme.spacing.sm,
  },
  dateModalCloseBtn: {
    marginTop: theme.spacing.sm,
    alignSelf: "flex-end",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
});
