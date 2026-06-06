import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Plus, Search, Trash2, Users2, UserMinus } from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { theme } from "../../theme/theme";
import { useClub } from "../../contexts/ClubContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  subscribeToTeams,
  updateTeam,
  subscribeToClubMembers,
  assignMembersToTeam,
  unassignMembersFromTeam,
} from "../../services/teamService";

const getMemberNormalizedRoles = (member = {}) => {
  const rolePool = Array.isArray(member?.roles) ? member.roles : [member?.role];
  return rolePool
    .map((role) => String(role || "").trim().toLowerCase())
    .filter(Boolean);
};

const isPlayerMember = (member = {}) => {
  // Allow anyone to be added to a team (players, coaches, managers, etc.)
  return true;
};

export default function TeamMembersScreen({ navigation, route }) {
  const { activeClubId, activeClub, userRole } = useClub();
  const initialTeam = route?.params?.team || null;
  const teamId = String(route?.params?.teamId || initialTeam?.id || "").trim();

  const [team, setTeam] = useState(initialTeam);
  const [clubMembers, setClubMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  
  const [memberQuery, setMemberQuery] = useState("");
  const [busyMemberId, setBusyMemberId] = useState("");
  
  const [newManualPlayerName, setNewManualPlayerName] = useState("");
  const [savingManualRoster, setSavingManualRoster] = useState(false);

  const normalizedRole = String(userRole || "").trim().toLowerCase();
  const canManage = [
    "owner",
    "admin",
    "president",
    "vice president",
    "executive",
    "committee",
    "treasurer",
    "secretary",
    "registrar",
    "coordinator",
    "coach",
    "manager",
  ].includes(normalizedRole);

  useEffect(() => {
    if (!activeClubId || !teamId) return;
    const unsub = subscribeToTeams(activeClubId, (rows) => {
      const next = (rows || []).find((row) => row.id === teamId);
      if (next) setTeam(next);
    });
    return () => unsub?.();
  }, [activeClubId, teamId]);

  useEffect(() => {
    if (!activeClubId) {
      setClubMembers([]);
      setLoadingMembers(false);
      return;
    }
    setLoadingMembers(true);
    const unsub = subscribeToClubMembers(activeClubId, (members) => {
      setClubMembers(Array.isArray(members) ? members : []);
      setLoadingMembers(false);
    });
    return () => unsub?.();
  }, [activeClubId]);

  const teamPlayers = useMemo(
    () =>
      (clubMembers || [])
        .filter(
          (member) =>
            Array.isArray(member.teamIds) &&
            member.teamIds.includes(teamId) &&
            isPlayerMember(member),
        )
        .sort((a, b) => {
          const aName = (a.displayName || a.name || a.fullName || a.email || "").toLowerCase();
          const bName = (b.displayName || b.name || b.fullName || b.email || "").toLowerCase();
          return aName.localeCompare(bName);
        }),
    [clubMembers, teamId],
  );

  const assignablePlayers = useMemo(() => {
    const query = memberQuery.trim().toLowerCase();
    return (clubMembers || [])
      .filter(
        (member) =>
          (!Array.isArray(member.teamIds) ||
            !member.teamIds.includes(teamId)) &&
          isPlayerMember(member),
      )
      .filter((member) => {
        if (!query) return true;
        const name = (member.displayName || member.name || member.fullName || "").toLowerCase();
        const email = (member.email || "").toLowerCase();
        return name.includes(query) || email.includes(query);
      })
      .sort((a, b) => {
        const aName = (a.displayName || a.name || a.fullName || a.email || "").toLowerCase();
        const bName = (b.displayName || b.name || b.fullName || b.email || "").toLowerCase();
        if (query) {
          const aStarts = aName.startsWith(query);
          const bStarts = bName.startsWith(query);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
        }
        return aName.localeCompare(bName);
      });
  }, [clubMembers, memberQuery, teamId]);

  const teamManualPlayers = Array.isArray(team?.manualPlayers)
    ? team.manualPlayers
    : [];

  const handleAddMember = async (member) => {
    if (!activeClubId || !teamId) return;
    const memberId = String(member?.uid || member?.id || "").trim();
    if (!memberId) return;

    setBusyMemberId(memberId);
    try {
      await assignMembersToTeam(activeClubId, teamId, [memberId]);
    } catch (error) {
      Alert.alert("Error", error?.message || "Could not add member to team.");
    } finally {
      setBusyMemberId("");
    }
  };

  const handleRemoveMember = async (member) => {
    if (!activeClubId || !teamId) return;
    const memberId = String(member?.uid || member?.id || "").trim();
    if (!memberId) return;

    Alert.alert(
      "Remove Member",
      `Remove ${member?.displayName || member?.name || member?.fullName || "this member"} from this team?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setBusyMemberId(memberId);
            try {
              await unassignMembersFromTeam(activeClubId, teamId, [memberId]);
            } catch (error) {
              Alert.alert(
                "Error",
                error?.message || "Could not remove member from team.",
              );
            } finally {
              setBusyMemberId("");
            }
          },
        },
      ],
    );
  };

  const handleAddManualPlayer = async () => {
    if (!activeClubId || !teamId || !canManage) return;
    const nameStr = newManualPlayerName.trim();
    if (!nameStr) return;

    const manualPlayer = {
      id: `manual-${Date.now()}`,
      name: nameStr,
      addedAt: new Date().toISOString(),
    };

    setSavingManualRoster(true);
    try {
      await updateTeam(activeClubId, teamId, {
        manualPlayers: [...teamManualPlayers, manualPlayer],
      });
      setNewManualPlayerName("");
    } catch {
      Alert.alert("Error", "Could not add player to team list right now.");
    } finally {
      setSavingManualRoster(false);
    }
  };

  const handleRemoveManualPlayer = async (mPlayerId) => {
    if (!activeClubId || !teamId || !canManage) return;
    const nextManualPlayers = teamManualPlayers.filter((p) => p.id !== mPlayerId);
    const nextSelected = (team.selectedManualPlayerIds || []).filter(
      (id) => id !== mPlayerId,
    );

    setSavingManualRoster(true);
    try {
      await updateTeam(activeClubId, teamId, {
        manualPlayers: nextManualPlayers,
        selectedManualPlayerIds: nextSelected,
      });
    } catch {
      Alert.alert("Error", "Could not remove player from team list right now.");
    } finally {
      setSavingManualRoster(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft color={theme.colors.text} size={20} />
        </TouchableOpacity>
        <Avatar
          source={
            activeClub?.logoUrl
              ? { uri: activeClub.logoUrl }
              : {
                  uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(activeClub?.name || "Club")}&background=108B51&color=fff&size=150`,
                }
          }
          size={36}
          isClub
        />
        <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
          <Text variant="h3">{team?.name || "Team Members"}</Text>
          <Text variant="small" color={theme.colors.textSecondary}>
            {teamPlayers.length} account member{teamPlayers.length === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      {!teamId ? (
        <View style={styles.centerState}>
          <Text variant="body" color={theme.colors.textSecondary}>
            Team data is not available.
          </Text>
        </View>
      ) : loadingMembers ? (
        <ActivityIndicator
          size="large"
          color={theme.colors.primary}
          style={{ marginTop: theme.spacing.xl * 2 }}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Team Members (App Accounts) */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Users2 color={theme.colors.primary} size={18} />
              <Text variant="h4" style={{ marginLeft: 8 }}>
                Current Members ({teamPlayers.length})
              </Text>
            </View>

            {teamPlayers.length === 0 ? (
              <Text variant="small" color={theme.colors.textSecondary}>
                No members in this team yet.
              </Text>
            ) : (
              teamPlayers.map((member, idx) => {
                const memberId = String(member?.uid || member?.id || "").trim();
                return (
                  <View
                    key={memberId || `${idx}`}
                    style={[
                      styles.memberRow,
                      idx < teamPlayers.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Avatar
                      source={{
                        uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(member?.displayName || member?.name || "Member")}&background=108B51&color=fff&size=120`,
                      }}
                      size={36}
                    />
                    <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                      <Text variant="body" weight="600">
                        {member?.displayName || member?.name || member?.fullName || "Unnamed Member"}
                      </Text>
                      <Text variant="small" color={theme.colors.textSecondary}>
                        {member?.email || ""}
                      </Text>
                    </View>
                    {canManage ? (
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        onPress={() => handleRemoveMember(member)}
                        disabled={busyMemberId === memberId}
                      >
                        <Trash2 color={theme.colors.error} size={16} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })
            )}
          </Card>

          {/* Add Team Members */}
          {canManage && (
            <Card style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Plus color={theme.colors.primary} size={18} />
                <Text variant="h4" style={{ marginLeft: 8 }}>
                  Add Members
                </Text>
              </View>

              <View style={styles.searchBar}>
                <Search color={theme.colors.textSecondary} size={16} />
                <TextInput
                  style={styles.searchInput}
                  value={memberQuery}
                  onChangeText={setMemberQuery}
                  placeholder="Search by name or email"
                />
              </View>

              {assignablePlayers.length === 0 ? (
                <Text variant="small" color={theme.colors.textSecondary}>
                  No available members to add.
                </Text>
              ) : (
                assignablePlayers.slice(0, 30).map((member, idx) => {
                  const memberId = String(member?.uid || member?.id || "").trim();
                  return (
                    <View
                      key={memberId || `add-${idx}`}
                      style={[
                        styles.memberRow,
                        idx < Math.min(assignablePlayers.length, 30) - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Avatar
                        source={{
                          uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(member?.displayName || member?.name || "Member")}&background=108B51&color=fff&size=120`,
                        }}
                        size={36}
                      />
                      <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                        <Text variant="body" weight="600">
                          {member?.displayName || member?.name || member?.fullName || "Unnamed Member"}
                        </Text>
                        <Text variant="small" color={theme.colors.textSecondary}>
                          {member?.email || ""}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => handleAddMember(member)}
                        disabled={busyMemberId === memberId}
                      >
                        <Text variant="small" color={theme.colors.primary} weight="700">
                          Add
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </Card>
          )}

          {/* Team Player List (No App Account) */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Users2 color={theme.colors.primary} size={18} />
              <Text variant="h4" style={{ marginLeft: 8 }}>
                Team Player List (No App Account)
              </Text>
            </View>
            <Text variant="small" color={theme.colors.textSecondary} style={{ marginBottom: 12 }}>
              {teamManualPlayers.length} players
            </Text>

            {teamManualPlayers.length === 0 ? (
              <Text variant="small" color={theme.colors.textSecondary} style={{ marginBottom: 12 }}>
                No manual players added yet.
              </Text>
            ) : (
              <View style={styles.rolesWrap}>
                {teamManualPlayers.map((mPlayer) => (
                  <View key={mPlayer.id} style={styles.roleChip}>
                    <Text variant="small" weight="600" color={theme.colors.text}>
                      {mPlayer.name}
                    </Text>
                    {canManage && (
                      <TouchableOpacity
                        style={{ marginLeft: 8, padding: 2 }}
                        onPress={() => handleRemoveManualPlayer(mPlayer.id)}
                        disabled={savingManualRoster}
                      >
                        <UserMinus color={theme.colors.error} size={14} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}

            {canManage && (
              <View style={styles.manualInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 8 }]}
                  placeholder="Add player name..."
                  value={newManualPlayerName}
                  onChangeText={setNewManualPlayerName}
                  maxLength={50}
                />
                <Button
                  title="Add"
                  icon={<Plus color={theme.colors.white} size={16} />}
                  onPress={handleAddManualPlayer}
                  loading={savingManualRoster}
                  disabled={!newManualPlayerName.trim() || savingManualRoster}
                />
              </View>
            )}
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.lg },
  content: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, paddingBottom: theme.spacing.xl * 2 },
  sectionCard: { marginBottom: theme.spacing.md },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: theme.spacing.sm },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  searchInput: { flex: 1, marginLeft: 8, color: theme.colors.text },
  memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: theme.spacing.sm },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  addBtn: { paddingHorizontal: theme.spacing.sm, paddingVertical: 6, borderRadius: theme.radius.full, backgroundColor: theme.colors.primary + "14" },
  rolesWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    marginBottom: 4,
  },
  manualInputRow: { flexDirection: "row", alignItems: "center", marginTop: theme.spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    height: 44,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
  },
});
