import React, { useEffect, useState, useCallback, useMemo } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { Users2, ChevronRight, Plus, Search } from "lucide-react-native";
import { Text } from "../components/ui/Typography";
import { Card } from "../components/ui/Card";
import { Avatar } from "../components/ui/Avatar";
import { theme } from "../theme/theme";
import { useAuth } from "../contexts/AuthContext";
import { useClub } from "../contexts/ClubContext";
import { useTabBarAnimation } from "../contexts/TabBarAnimationContext";
import {
  subscribeToGroups,
  subscribeToGroupMemberships,
  createGroup,
} from "../services/managementService";

const GROUP_TYPES = ["Staff", "Committee", "Executive", "Other"];

export default function GroupsScreen({ navigation }) {
  const { profile } = useAuth();
  const { activeClubId, activeClub, userRole } = useClub();
  const normalizedRole = String(userRole || "").trim().toLowerCase();

  const myGroupIds = useMemo(() => {
    const memberships = Array.isArray(profile?.clubMemberships)
      ? profile.clubMemberships
      : [];
    const membership = memberships.find((m) => m.clubId === activeClubId);
    return Array.isArray(membership?.groupIds) ? membership.groupIds : [];
  }, [profile?.clubMemberships, activeClubId]);

  const { setCollapsed } = useTabBarAnimation();
  const [searchQuery, setSearchQuery] = useState("");
  const [groups, setGroups] = useState([]);
  const [groupMemberships, setGroupMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [groupTypeDraft, setGroupTypeDraft] = useState("Staff");

  const isStaff = ["owner", "admin", "coach", "manager"].includes(
    normalizedRole,
  );

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
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeToGroups(
      activeClubId,
      (allGroups) => {
        setGroups(Array.isArray(allGroups) ? allGroups : []);
        setLoading(false);
      },
      {
        groupIds: myGroupIds,
        isAdmin: isStaff,
      },
    );
    return () => unsub?.();
  }, [activeClubId]);

  useEffect(() => {
    if (!activeClubId) {
      setGroupMemberships([]);
      return;
    }

    const unsub = subscribeToGroupMemberships(activeClubId, (rows) => {
      setGroupMemberships(Array.isArray(rows) ? rows : []);
    });

    return () => unsub?.();
  }, [activeClubId]);

  const visibleGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const isPlayerOrParent = normalizedRole === "player" || normalizedRole === "parent";
    return (groups || [])
      .filter((group) => {
        if (isPlayerOrParent && !myGroupIds.includes(group.id)) {
          return false;
        }
        return String(group?.source || "").toLowerCase() !== "team";
      })
      .filter((group) => {
        if (!query) return true;
        const name = String(group?.groupName || "").toLowerCase();
        const type = String(group?.groupType || "").toLowerCase();
        return name.includes(query) || type.includes(query);
      });
  }, [groups, searchQuery, normalizedRole, myGroupIds]);

  const memberCountByGroupId = useMemo(() => {
    const counts = {};
    (groupMemberships || []).forEach((membership) => {
      const groupId = String(membership?.groupId || "")
        .trim()
        .toLowerCase();
      if (!groupId) return;
      counts[groupId] = (counts[groupId] || 0) + 1;
    });
    return counts;
  }, [groupMemberships]);

  const openGroup = (group) => {
    const groupId = String(group?.groupId || group?.id || "")
      .trim()
      .toLowerCase();
    navigation.navigate("GroupDetails", {
      group,
      groupId,
      canManage: isStaff,
    });
  };

  const cycleGroupType = () => {
    const idx = GROUP_TYPES.findIndex(
      (type) =>
        type.toLowerCase() === String(groupTypeDraft || "").toLowerCase(),
    );
    const nextIndex = idx >= 0 ? (idx + 1) % GROUP_TYPES.length : 0;
    setGroupTypeDraft(GROUP_TYPES[nextIndex]);
  };

  const handleCreateGroup = async () => {
    const nextName = String(groupNameDraft || "").trim();
    if (!activeClubId || !nextName) {
      Alert.alert("Required", "Please enter a group name.");
      return;
    }

    try {
      setCreatingGroup(true);
      await createGroup(activeClubId, {
        groupName: nextName,
        groupType: groupTypeDraft || "Staff",
      });
      setGroupNameDraft("");
      setGroupTypeDraft("Staff");
      setShowCreateGroup(false);
      Alert.alert("Created", "Group created successfully.");
    } catch (error) {
      Alert.alert("Error", error?.message || "Could not create group.");
    } finally {
      setCreatingGroup(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
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
          <View style={{ marginLeft: 10 }}>
            <Text variant="h2">Groups</Text>
            <Text variant="small" color={theme.colors.textSecondary}>
              {activeClub?.name || "Club"}
            </Text>
          </View>
        </View>
        {isStaff && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowCreateGroup((prev) => !prev)}
          >
            <Plus color={theme.colors.primary} size={24} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 160,
          paddingHorizontal: theme.spacing.md,
        }}
        scrollEventThrottle={16}
        onScroll={handleTabBarScroll}
      >
        <View style={styles.searchContainer}>
          {isStaff && showCreateGroup ? (
            <Card style={styles.createCard}>
              <Text variant="h4">Create Group</Text>
              <TextInput
                placeholder="Group name"
                style={styles.groupInput}
                value={groupNameDraft}
                onChangeText={setGroupNameDraft}
              />
              <View style={styles.groupEditorRow}>
                <TouchableOpacity
                  style={styles.groupTypeButton}
                  onPress={cycleGroupType}
                >
                  <Text variant="small" weight="700">
                    Type: {groupTypeDraft}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.groupSaveButton}
                  onPress={handleCreateGroup}
                  disabled={creatingGroup}
                >
                  <Text variant="small" weight="700" color={theme.colors.white}>
                    {creatingGroup ? "Saving..." : "Create Group"}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          ) : null}

          <View style={styles.searchBar}>
            <Search color={theme.colors.textSecondary} size={18} />
            <TextInput
              placeholder="Search groups..."
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={theme.colors.primary}
            style={{ marginTop: theme.spacing.xl * 2 }}
          />
        ) : visibleGroups.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Users2 color={theme.colors.textSecondary} size={36} />
            <Text variant="h4" style={{ marginTop: 12, textAlign: "center" }}>
              No groups yet
            </Text>
            <Text
              variant="small"
              style={{ marginTop: 6, textAlign: "center" }}
              color={theme.colors.textSecondary}
            >
              {isStaff
                ? "Use the + button to create and manage groups here."
                : "You haven't been added to any group yet."}
            </Text>
          </Card>
        ) : (
          visibleGroups.map((group) => {
            const groupId = String(group?.groupId || group?.id || "")
              .trim()
              .toLowerCase();
            const memberCount = memberCountByGroupId[groupId] || 0;
            return (
              <Card key={group.id} noPadding style={styles.groupCard}>
                <TouchableOpacity
                  style={styles.groupRow}
                  onPress={() => openGroup(group)}
                >
                  <View style={styles.groupIcon}>
                    <Users2 color={theme.colors.primary} size={22} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="h4">
                      {group.groupName || "Unnamed Group"}
                    </Text>
                    {!!group.groupType ? (
                      <Text variant="small" color={theme.colors.textSecondary}>
                        {group.groupType}
                      </Text>
                    ) : null}
                    <Text variant="small" color={theme.colors.textSecondary}>
                      {memberCount} member{memberCount !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <ChevronRight color={theme.colors.border} size={20} />
                </TouchableOpacity>
              </Card>
            );
          })
        )}
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  addBtn: {
    padding: 4,
  },
  searchContainer: {
    marginTop: theme.spacing.md,
  },
  createCard: {
    marginBottom: theme.spacing.md,
  },
  groupInput: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.text,
  },
  groupEditorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  groupTypeButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
  },
  groupSaveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: theme.colors.text,
  },
  emptyCard: {
    marginTop: theme.spacing.xl,
    alignItems: "center",
    paddingVertical: theme.spacing.xl,
  },
  groupCard: {
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E8F8EF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.md,
  },
});
