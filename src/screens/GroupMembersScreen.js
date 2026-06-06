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
import { ChevronLeft, Plus, Search, Trash2, Users2 } from "lucide-react-native";
import { Text } from "../components/ui/Typography";
import { Card } from "../components/ui/Card";
import { Avatar } from "../components/ui/Avatar";
import { theme } from "../theme/theme";
import { useClub } from "../contexts/ClubContext";
import { getClubMembers } from "../services/clubService";
import {
  addMemberToGroup,
  removeMemberFromGroup,
  subscribeToGroupMemberships,
  subscribeToGroups,
} from "../services/managementService";

export default function GroupMembersScreen({ navigation, route }) {
  const { activeClubId, activeClub, userRole } = useClub();
  const initialGroup = route?.params?.group || null;

  const [group, setGroup] = useState(initialGroup);
  const [allMembers, setAllMembers] = useState([]);
  const [groupMemberships, setGroupMemberships] = useState([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [busyMemberId, setBusyMemberId] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(true);

  const normalizedRole = String(userRole || "")
    .trim()
    .toLowerCase();
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

  const groupId = useMemo(
    () =>
      String(group?.groupId || group?.id || route?.params?.groupId || "")
        .trim()
        .toLowerCase(),
    [group, route?.params?.groupId],
  );

  useEffect(() => {
    if (!activeClubId || !groupId) return;

    const unsub = subscribeToGroups(activeClubId, (rows) => {
      const next = (rows || []).find((row) => {
        const id = String(row?.groupId || row?.id || "")
          .trim()
          .toLowerCase();
        return id && id === groupId;
      });
      if (next) setGroup(next);
    });

    return () => unsub?.();
  }, [activeClubId, groupId]);

  useEffect(() => {
    if (!activeClubId || !groupId) {
      setGroupMemberships([]);
      return;
    }

    const unsub = subscribeToGroupMemberships(activeClubId, (rows) => {
      const filtered = (Array.isArray(rows) ? rows : []).filter(
        (membership) => {
          const id = String(membership?.groupId || "")
            .trim()
            .toLowerCase();
          return id && id === groupId;
        },
      );
      setGroupMemberships(filtered);
    });

    return () => unsub?.();
  }, [activeClubId, groupId]);

  useEffect(() => {
    let cancelled = false;

    const loadMembers = async () => {
      if (!activeClubId) {
        setAllMembers([]);
        setLoadingMembers(false);
        return;
      }

      setLoadingMembers(true);
      try {
        const rows = await getClubMembers(activeClubId);
        if (!cancelled) {
          setAllMembers(Array.isArray(rows) ? rows : []);
        }
      } catch {
        if (!cancelled) {
          setAllMembers([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingMembers(false);
        }
      }
    };

    loadMembers();

    return () => {
      cancelled = true;
    };
  }, [activeClubId]);

  const memberIdsInGroup = useMemo(() => {
    const ids = new Set();
    (groupMemberships || []).forEach((membership) => {
      const userId = String(membership?.userId || "").trim();
      if (userId) ids.add(userId);
    });
    return ids;
  }, [groupMemberships]);

  const groupedMembers = useMemo(
    () =>
      (allMembers || []).filter((member) => {
        const memberId = String(member?.uid || member?.id || "").trim();
        return memberId && memberIdsInGroup.has(memberId);
      }),
    [allMembers, memberIdsInGroup],
  );

  const availableMembers = useMemo(() => {
    const queryText = String(memberQuery || "")
      .trim()
      .toLowerCase();
    return (allMembers || [])
      .filter((member) => {
        const memberId = String(member?.uid || member?.id || "").trim();
        return memberId && !memberIdsInGroup.has(memberId);
      })
      .filter((member) => {
        if (!queryText) return true;
        const displayName = String(member?.displayName || member?.name || member?.fullName || "").toLowerCase();
        const email = String(member?.email || "").toLowerCase();
        return displayName.includes(queryText) || email.includes(queryText);
      })
      .sort((a, b) => {
        const aName = String(a?.displayName || a?.name || a?.fullName || "").toLowerCase();
        const bName = String(b?.displayName || b?.name || b?.fullName || "").toLowerCase();
        if (queryText) {
          const aStarts = aName.startsWith(queryText);
          const bStarts = bName.startsWith(queryText);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
        }
        return aName.localeCompare(bName);
      });
  }, [allMembers, memberIdsInGroup, memberQuery]);

  const handleAddMember = async (member) => {
    if (!activeClubId || !groupId) return;
    const memberId = String(member?.uid || member?.id || "").trim();
    if (!memberId) return;

    setBusyMemberId(memberId);
    try {
      await addMemberToGroup(activeClubId, groupId, {
        userId: memberId,
        displayName: member?.displayName || "",
        email: member?.email || "",
      });
    } catch (error) {
      Alert.alert("Error", error?.message || "Could not add member to group.");
    } finally {
      setBusyMemberId("");
    }
  };

  const handleRemoveMember = async (member) => {
    if (!activeClubId || !groupId) return;
    const memberId = String(member?.uid || member?.id || "").trim();
    if (!memberId) return;

    Alert.alert(
      "Remove Member",
      `Remove ${member?.displayName || "this member"} from this group?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setBusyMemberId(memberId);
            try {
              await removeMemberFromGroup(activeClubId, groupId, memberId);
            } catch (error) {
              Alert.alert(
                "Error",
                error?.message || "Could not remove member from group.",
              );
            } finally {
              setBusyMemberId("");
            }
          },
        },
      ],
    );
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
          <Text variant="h3">{group?.groupName || "Group Members"}</Text>
          <Text variant="small" color={theme.colors.textSecondary}>
            {groupedMembers.length} member
            {groupedMembers.length === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      {!groupId ? (
        <View style={styles.centerState}>
          <Text variant="body" color={theme.colors.textSecondary}>
            Group data is not available.
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
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Users2 color={theme.colors.primary} size={18} />
              <Text variant="h4" style={{ marginLeft: 8 }}>
                Current Members ({groupedMembers.length})
              </Text>
            </View>

            {groupedMembers.length === 0 ? (
              <Text variant="small" color={theme.colors.textSecondary}>
                No members in this group yet.
              </Text>
            ) : (
              groupedMembers.map((member, idx) => {
                const memberId = String(member?.uid || member?.id || "").trim();
                return (
                  <View
                    key={memberId || `${idx}`}
                    style={[
                      styles.memberRow,
                      idx < groupedMembers.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Avatar
                      source={{
                        uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(member?.displayName || "Member")}&background=108B51&color=fff&size=120`,
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

          {canManage ? (
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

              {availableMembers.length === 0 ? (
                <Text variant="small" color={theme.colors.textSecondary}>
                  No available members to add.
                </Text>
              ) : (
                availableMembers.slice(0, 30).map((member, idx) => {
                  const memberId = String(
                    member?.uid || member?.id || "",
                  ).trim();
                  return (
                    <View
                      key={memberId || `add-${idx}`}
                      style={[
                        styles.memberRow,
                        idx < Math.min(availableMembers.length, 30) - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Avatar
                        source={{
                          uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(member?.displayName || "Member")}&background=108B51&color=fff&size=120`,
                        }}
                        size={36}
                      />
                      <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                        <Text variant="body" weight="600">
                          {member?.displayName || member?.name || member?.fullName || "Unnamed Member"}
                        </Text>
                        <Text
                          variant="small"
                          color={theme.colors.textSecondary}
                        >
                          {member?.email || ""}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => handleAddMember(member)}
                        disabled={busyMemberId === memberId}
                      >
                        <Text
                          variant="small"
                          color={theme.colors.primary}
                          weight="700"
                        >
                          Add
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </Card>
          ) : null}
        </ScrollView>
      )}
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
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingBottom: theme.spacing.xl * 2,
  },
  sectionCard: {
    marginBottom: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
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
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: theme.colors.text,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  addBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary + "14",
  },
});
