import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, Search, ChevronRight, Users, Plus } from "lucide-react-native";
import { Text } from "../components/ui/Typography";
import { Card } from "../components/ui/Card";
import { Avatar } from "../components/ui/Avatar";
import { FAB, Button } from "../components/ui/Button";
import { theme } from "../theme/theme";
import { useAuth } from "../contexts/AuthContext";
import { useClub } from "../contexts/ClubContext";
import { useTabBarAnimation } from "../contexts/TabBarAnimationContext";
import {
  subscribeToTeams,
  getClubMembers,
  createTeam,
} from "../services/teamService";

const getMemberNormalizedRoles = (member = {}) => {
  const rolePool = Array.isArray(member?.roles) ? member.roles : [member?.role];
  return rolePool
    .map((role) =>
      String(role || "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);
};

const isPlayerMember = (member = {}) => {
  // Count all members assigned to the team
  return true;
};

export default function TeamsScreen({ navigation }) {
  const { profile } = useAuth();
  const { activeClubId, activeClub, userRole } = useClub();
  const normalizedRole = String(userRole || "")
    .trim()
    .toLowerCase();
  
  const myTeamIds = useMemo(() => {
    const memberships = Array.isArray(profile?.clubMemberships)
      ? profile.clubMemberships
      : [];
    const membership = memberships.find((m) => m.clubId === activeClubId);
    return Array.isArray(membership?.teamIds) ? membership.teamIds : [];
  }, [profile?.clubMemberships, activeClubId]);

  const isAdminUser = ["owner", "admin"].includes(normalizedRole);
  const canManageTeams = isAdminUser;
  const { setCollapsed } = useTabBarAnimation();
  const [searchQuery, setSearchQuery] = useState("");
  const [teams, setTeams] = useState([]);
  const [clubMembers, setClubMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamAgeGroup, setNewTeamAgeGroup] = useState("");
  const [newTeamDivision, setNewTeamDivision] = useState("");
  const [newTeamCoachName, setNewTeamCoachName] = useState("");

  useFocusEffect(
    useCallback(() => {
      setCollapsed(false);
      return () => setCollapsed(false);
    }, [setCollapsed]),
  );

  const handleTabBarScroll = useCallback(
    (event) => {
      const offsetY = event?.nativeEvent?.contentOffset?.y || 0;
      setCollapsed(offsetY > 24);
    },
    [setCollapsed],
  );

  useEffect(() => {
    if (!activeClubId) {
      setTeams([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToTeams(
      activeClubId,
      (newTeams) => {
        setTeams(newTeams || []);
        setLoading(false);
      },
      {
        teamIds: myTeamIds,
        isAdmin: isAdminUser,
      },
    );

    return unsubscribe;
  }, [activeClubId]);

  useEffect(() => {
    let cancelled = false;

    const loadMembers = async () => {
      if (!activeClubId) {
        setClubMembers([]);
        return;
      }

      try {
        const members = await getClubMembers(activeClubId);
        if (!cancelled) {
          setClubMembers(Array.isArray(members) ? members : []);
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

  const filteredTeams = useMemo(() => {
    const isPlayerOrParent = normalizedRole === "player" || normalizedRole === "parent";
    return (teams || []).filter((team) => {
      if (isPlayerOrParent && !myTeamIds.includes(team.id)) {
        return false;
      }
      return (
        (team.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (team.ageGroup || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (team.division || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      );
    });
  }, [teams, searchQuery, normalizedRole, myTeamIds]);

  const teamPlayerCounts = useMemo(() => {
    const counts = {};
    (clubMembers || []).forEach((member) => {
      if (!isPlayerMember(member)) return;
      (Array.isArray(member.teamIds) ? member.teamIds : []).forEach(
        (teamId) => {
          counts[teamId] = (counts[teamId] || 0) + 1;
        },
      );
    });
    return counts;
  }, [clubMembers]);

  const goToTeamFeed = (team, initialTab = "All Posts") => {
    setSelectedTeamId(team.id);
    navigation.navigate("TeamFeed", {
      teamId: team.id,
      teamName: team.name,
      initialTab,
    });
  };

  const resetAddTeamForm = () => {
    setNewTeamName("");
    setNewTeamAgeGroup("");
    setNewTeamDivision("");
    setNewTeamCoachName("");
  };

  const handleCreateTeam = async () => {
    if (!activeClubId || !canManageTeams) return;
    if (!newTeamName.trim()) {
      Alert.alert("Required", "Team name is required.");
      return;
    }

    const normalizedName = newTeamName.trim().toLowerCase();
    const duplicate = (teams || []).some(
      (team) =>
        String(team?.name || "")
          .trim()
          .toLowerCase() === normalizedName,
    );
    if (duplicate) {
      Alert.alert("Duplicate Team", "A team with this name already exists.");
      return;
    }

    setCreatingTeam(true);
    try {
      await createTeam(activeClubId, {
        name: newTeamName.trim(),
        ageGroup: newTeamAgeGroup.trim(),
        division: newTeamDivision.trim(),
        coachName: newTeamCoachName.trim(),
      });
      resetAddTeamForm();
      setShowAddTeam(false);
      Alert.alert("Success", "Team added successfully.");
    } catch {
      Alert.alert("Error", "Could not create team right now.");
    } finally {
      setCreatingTeam(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Avatar
            source={
              activeClub?.logoUrl
                ? { uri: activeClub.logoUrl }
                : {
                    uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(activeClub?.name || "Club")}&background=108B51&color=fff&size=150`,
                  }
            }
            size={40}
            isClub
          />
          <View style={styles.titleInfo}>
            <Text variant="h3">Teams</Text>
            <Text variant="small">{activeClub?.name || "No Club"}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.bellIcon}
          onPress={() => navigation.navigate("Notifications")}
        >
          <Bell color={theme.colors.text} size={24} />
          <View style={styles.badge} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
        scrollEventThrottle={16}
        onScroll={handleTabBarScroll}
      >
        {showAddTeam && canManageTeams ? (
          <View style={styles.addTeamCard}>
            <Text variant="h4" style={{ marginBottom: theme.spacing.sm }}>
              Add Team
            </Text>
            <TextInput
              placeholder="Team name"
              style={styles.formInput}
              value={newTeamName}
              onChangeText={setNewTeamName}
            />
            <TextInput
              placeholder="Age group (optional)"
              style={styles.formInput}
              value={newTeamAgeGroup}
              onChangeText={setNewTeamAgeGroup}
            />
            <TextInput
              placeholder="Division (optional)"
              style={styles.formInput}
              value={newTeamDivision}
              onChangeText={setNewTeamDivision}
            />
            <TextInput
              placeholder="Coach name (optional)"
              style={styles.formInput}
              value={newTeamCoachName}
              onChangeText={setNewTeamCoachName}
            />
            <View style={styles.addTeamActions}>
              <Button
                title={creatingTeam ? "Adding..." : "Add Team"}
                onPress={handleCreateTeam}
                size="small"
                disabled={creatingTeam}
              />
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => {
                  resetAddTeamForm();
                  setShowAddTeam(false);
                }}
                size="small"
              />
            </View>
          </View>
        ) : null}

        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Search color={theme.colors.textSecondary} size={20} />
            <TextInput
              placeholder="Search teams or age groups..."
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <View style={styles.listContainer}>
          {loading ? (
            <ActivityIndicator
              size="large"
              color={theme.colors.primary}
              style={{ marginTop: theme.spacing.xl * 2 }}
            />
          ) : filteredTeams.length === 0 ? (
            <View style={styles.emptyState}>
              <Users color={theme.colors.border} size={48} />
              <Text
                variant="h4"
                color={theme.colors.textSecondary}
                style={{ marginTop: theme.spacing.md, textAlign: "center" }}
              >
                No teams found.
              </Text>
              <Text
                variant="body"
                color={theme.colors.textSecondary}
                style={{ marginTop: 4, textAlign: "center" }}
              >
                Create or join a team to get started.
              </Text>
              <Button
                title="Add Team"
                onPress={() => {
                  if (!canManageTeams) {
                    Alert.alert(
                      "Not allowed",
                      "Only admins can create teams. Ask an Owner or Admin.",
                    );
                    return;
                  }
                  setShowAddTeam(true);
                }}
                disabled={!canManageTeams}
                style={{ marginTop: theme.spacing.lg }}
              />
            </View>
          ) : (
            filteredTeams.map((team) => {
              const isSelected = selectedTeamId === team.id;
              return (
                <TouchableOpacity
                  key={team.id}
                  activeOpacity={0.7}
                  onPress={() => goToTeamFeed(team)}
                >
                  <Card style={styles.teamCard}>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <View style={styles.teamIconContainer}>
                        <Users color={theme.colors.primary} size={24} />
                      </View>
                      <View style={styles.teamInfo}>
                        <Text variant="h4">{team.name}</Text>
                        <Text
                          variant="small"
                          color={theme.colors.textSecondary}
                          style={{ marginTop: 2 }}
                        >
                          {team.division || team.ageGroup || ""}
                        </Text>
                        <View style={styles.teamStats}>
                          <Users color={theme.colors.textSecondary} size={14} />
                          <Text
                            variant="small"
                            color={theme.colors.textSecondary}
                            style={{ marginLeft: 4 }}
                          >
                            {teamPlayerCounts[team.id] ?? team.playerCount ?? 0}{" "}
                            Players
                          </Text>
                        </View>
                      </View>
                      <ChevronRight color={theme.colors.border} size={24} />
                    </View>

                    {isSelected ? (
                      <View style={styles.selectedBadge}>
                        <Text
                          variant="small"
                          color={theme.colors.primary}
                          weight="600"
                        >
                          Selected Team
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.teamCardActionsRow}>
                      <TouchableOpacity
                        style={styles.teamCardActionBtn}
                        onPress={() => navigation.navigate("TeamMembers", { team, teamId: team.id })}
                      >
                        <Text
                          variant="small"
                          color={theme.colors.primary}
                          weight="600"
                        >
                          Players
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.teamCardActionBtn}
                        onPress={() => goToTeamFeed(team, "Matches")}
                      >
                        <Text
                          variant="small"
                          color={theme.colors.primary}
                          weight="600"
                        >
                          Match Details
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {isAdminUser ? (
        <FAB
          style={{ bottom: 160 }}
          icon={<Plus color={theme.colors.white} size={24} />}
          onPress={() => {
            if (!canManageTeams) {
              Alert.alert(
                "Not allowed",
                "Only admins can create teams. Ask an Owner or Admin.",
              );
              return;
            }
            setShowAddTeam((prev) => !prev);
          }}
        />
      ) : null}
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleInfo: {
    marginLeft: theme.spacing.sm,
  },
  bellIcon: {
    padding: theme.spacing.xs,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.error,
  },
  searchContainer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  addTeamCard: {
    margin: theme.spacing.md,
    marginBottom: 0,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  formInput: {
    height: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  addTeamActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: theme.spacing.xs,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontSize: 16,
    color: theme.colors.text,
  },
  listContainer: {
    padding: theme.spacing.md,
  },
  emptyState: {
    alignItems: "center",
    marginTop: theme.spacing.xl * 2,
  },
  teamCard: {
    justifyContent: "center",
    padding: theme.spacing.md,
    borderColor: theme.colors.border,
    borderWidth: 1,
    marginBottom: theme.spacing.sm,
  },
  teamIconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  teamInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  teamStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  selectedBadge: {
    marginTop: theme.spacing.sm,
    alignSelf: "flex-start",
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  teamCardActionsRow: {
    marginTop: theme.spacing.sm,
    flexDirection: "row",
    gap: 8,
  },
  teamCardActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: `${theme.colors.primary}33`,
    backgroundColor: `${theme.colors.primary}14`,
  },
});
