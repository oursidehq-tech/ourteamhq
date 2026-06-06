import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Megaphone, Plus, Trash2, Save, X, Search } from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { Button, FAB } from "../../components/ui/Button";
import { theme } from "../../theme/theme";
import { useClub } from "../../contexts/ClubContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  subscribeToPosts,
  createPost,
  updatePost,
  deletePost,
} from "../../services/postService";
import { subscribeToTeams } from "../../services/teamService";
import { subscribeToGroups } from "../../services/managementService";
import { sendPushNotification } from "../../services/pushNotificationService";

const VISIBILITY_OPTIONS = ["Club-Only", "Public", "Network"];

const formatTime = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

export default function UpdatesScreen() {
  const { activeClubId, userRole, userGroupIds } = useClub();
  const { user, profile } = useAuth();
  const isLeader = userRole === "Owner" || userRole === "Admin";

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState("Club-Only");
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState("");
  const [teams, setTeams] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedLinkKey, setSelectedLinkKey] = useState("");
  const [linkSearchQuery, setLinkSearchQuery] = useState("");

  const myTeamIds =
    profile?.clubMemberships?.find((m) => m.clubId === activeClubId)?.teamIds ||
    [];

  useEffect(() => {
    if (!activeClubId) {
      setPosts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToPosts(
      activeClubId,
      (rows) => {
        setPosts(rows || []);
        setLoading(false);
      },
      100,
      {
        userId: user?.uid,
        teamIds: myTeamIds,
        isClubMember: true,
      },
    );

    const unsubTeams = subscribeToTeams(
      activeClubId,
      (rows) => setTeams(rows || []),
      { teamIds: myTeamIds, isAdmin: isLeader },
    );
    const unsubGroups = subscribeToGroups(
      activeClubId,
      (rows) => setGroups(rows || []),
      { groupIds: userGroupIds, isAdmin: isLeader },
    );

    return () => {
      unsubscribe?.();
      unsubTeams?.();
      unsubGroups?.();
    };
  }, [activeClubId, user?.uid, myTeamIds, userGroupIds, isLeader]);

  const updatePosts = useMemo(() => {
    return (posts || [])
      .filter((post) => {
        const category = (post.category || "").toLowerCase();
        const type = (post.type || "").toLowerCase();
        return category === "updates" || type === "update";
      })
      .sort((a, b) => {
        const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bMs - aMs;
      });
  }, [posts]);

  const normalizeSearchText = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const applySearch = (rows, getLabel) => {
    const query = normalizeSearchText(linkSearchQuery);
    if (!query) return rows;
    return (rows || [])
      .filter((row) => normalizeSearchText(getLabel(row)).includes(query))
      .sort((a, b) => {
        const aLabel = normalizeSearchText(getLabel(a));
        const bLabel = normalizeSearchText(getLabel(b));
        const aStarts = aLabel.startsWith(query);
        const bStarts = bLabel.startsWith(query);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return aLabel.localeCompare(bLabel);
      });
  };

  const filteredTeams = useMemo(
    () => applySearch(teams, (team) => team.name || ""),
    [teams, linkSearchQuery],
  );

  const filteredGroups = useMemo(
    () =>
      applySearch(groups, (group) => group.groupName || group.name || ""),
    [groups, linkSearchQuery],
  );

  const hasSearchResults =
    filteredTeams.length + filteredGroups.length > 0;

  const onCreateUpdate = async () => {
    if (!activeClubId || !isLeader) return;
    if (!content.trim()) {
      Alert.alert("Required", "Please add update details.");
      return;
    }

    setSaving(true);
    try {
      await createPost(activeClubId, {
        authorId: user?.uid || "",
        authorName: profile?.displayName || "Club Admin",
        content: content.trim(),
        imageUrl: "",
        visibility,
        teamId:
          selectedLinkKey.startsWith("team:") &&
          teams.find((t) => t.id === selectedLinkKey.replace("team:", ""))
            ? selectedLinkKey.replace("team:", "")
            : null,
        groupId:
          selectedLinkKey.startsWith("group:") &&
          groups.find((g) => g.id === selectedLinkKey.replace("group:", ""))
            ? selectedLinkKey.replace("group:", "")
            : null,
        type: "update",
        category: "Updates",
      });
      setContent("");
      setVisibility("Club-Only");
      setSelectedLinkKey("");
      if (profile?.expoPushToken) {
        await sendPushNotification({
          expoPushToken: profile.expoPushToken,
          title: "Update sent",
          body: "Your club update was posted successfully.",
          data: { source: "updates" },
        });
      }
      setShowCreate(false);
      Alert.alert("Success", "Club update posted.");
    } catch {
      Alert.alert("Error", "Could not post update right now.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (post) => {
    setEditingId(post.id);
    setEditingContent(post.content || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingContent("");
  };

  const saveEdit = async (postId) => {
    if (!activeClubId || !isLeader) return;
    if (!editingContent.trim()) {
      Alert.alert("Required", "Update content cannot be empty.");
      return;
    }
    try {
      await updatePost(activeClubId, postId, {
        content: editingContent.trim(),
      });
      cancelEdit();
    } catch {
      Alert.alert("Error", "Could not update announcement right now.");
    }
  };

  const removeUpdate = (postId) => {
    if (!activeClubId || !isLeader) return;
    Alert.alert(
      "Delete Update",
      "Are you sure you want to delete this update?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePost(activeClubId, postId);
            } catch {
              Alert.alert("Error", "Could not delete this update right now.");
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text variant="h2">Updates</Text>
          <Text variant="small" style={{ marginTop: 2 }}>
            Official club announcements
          </Text>
        </View>
        <View style={styles.headerIconWrap}>
          <Megaphone color={theme.colors.primary} size={20} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {showCreate && isLeader ? (
          <Card style={styles.formCard}>
            <Text variant="h4" style={{ marginBottom: theme.spacing.md }}>
              New Update
            </Text>

            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Share an important update for your members..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={[styles.input, styles.textArea]}
            />

            <Text variant="small" style={styles.label}>
              Visibility
            </Text>
            <View style={styles.chipRow}>
              {VISIBILITY_OPTIONS.map((option) => {
                const active = visibility === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setVisibility(option)}
                  >
                    <Text
                      variant="small"
                      color={active ? theme.colors.white : theme.colors.text}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text variant="small" style={styles.label}>
              Link to Team/Group (Optional)
            </Text>
            <View style={styles.linkSearchBar}>
              <View style={styles.searchIconWrap}>
                <Search color={theme.colors.textSecondary} size={16} />
              </View>
              <TextInput
                placeholder="Search teams or groups..."
                style={styles.linkSearchInput}
                value={linkSearchQuery}
                onChangeText={setLinkSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {linkSearchQuery.trim().length > 0 ? (
                <TouchableOpacity
                  style={styles.clearSearchBtn}
                  onPress={() => setLinkSearchQuery("")}
                >
                  <X color={theme.colors.textSecondary} size={16} />
                </TouchableOpacity>
              ) : null}
            </View>
            {linkSearchQuery.trim().length > 0 && !hasSearchResults ? (
              <Text
                variant="small"
                color={theme.colors.textSecondary}
                style={{ marginTop: theme.spacing.xs }}
              >
                No teams or groups match that search.
              </Text>
            ) : null}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 6 }}
            >
              <TouchableOpacity
                style={[
                  styles.chip,
                  { marginTop: 0 },
                  !selectedLinkKey && styles.chipActive,
                ]}
                onPress={() => setSelectedLinkKey("")}
              >
                <Text
                  variant="small"
                  color={
                    !selectedLinkKey ? theme.colors.white : theme.colors.text
                  }
                >
                  None
                </Text>
              </TouchableOpacity>
              {filteredTeams.map((team) => (
                <TouchableOpacity
                  key={team.id}
                  style={[
                    styles.chip,
                    { marginTop: 0 },
                    selectedLinkKey === `team:${team.id}` && styles.chipActive,
                  ]}
                  onPress={() => setSelectedLinkKey(`team:${team.id}`)}
                >
                  <Text
                    variant="small"
                    color={
                      selectedLinkKey === `team:${team.id}`
                        ? theme.colors.white
                        : theme.colors.text
                    }
                  >
                    {team.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {filteredGroups.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  style={[
                    styles.chip,
                    { marginTop: 0 },
                    selectedLinkKey === `group:${group.id}` &&
                      styles.chipActive,
                  ]}
                  onPress={() => setSelectedLinkKey(`group:${group.id}`)}
                >
                  <Text
                    variant="small"
                    color={
                      selectedLinkKey === `group:${group.id}`
                        ? theme.colors.white
                        : theme.colors.text
                    }
                  >
                    {group.groupName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.formActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowCreate(false)}
                style={styles.formBtn}
              />
              <Button
                title={saving ? "Posting..." : "Post Update"}
                onPress={onCreateUpdate}
                disabled={saving}
                style={styles.formBtn}
              />
            </View>
          </Card>
        ) : null}

        {loading ? (
          <ActivityIndicator
            size="large"
            color={theme.colors.primary}
            style={{ marginTop: theme.spacing.xl * 2 }}
          />
        ) : updatePosts.length === 0 ? (
          <View style={styles.emptyState}>
            <Megaphone color={theme.colors.border} size={48} />
            <Text
              variant="h4"
              color={theme.colors.textSecondary}
              style={{ marginTop: theme.spacing.md }}
            >
              No updates yet.
            </Text>
            <Text
              variant="body"
              color={theme.colors.textSecondary}
              style={{ marginTop: 4, textAlign: "center" }}
            >
              Club leaders can publish important announcements here.
            </Text>
          </View>
        ) : (
          updatePosts.map((post) => (
            <Card key={post.id} style={styles.updateCard}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text variant="small" color={theme.colors.textSecondary}>
                    {post.authorName || "Club"}
                  </Text>
                  <Text
                    variant="small"
                    color={theme.colors.textSecondary}
                    style={{ marginTop: 2 }}
                  >
                    {formatTime(post.createdAt)}
                    {post.teamId && teams.find((t) => t.id === post.teamId)
                      ? ` • Linked to ${teams.find((t) => t.id === post.teamId).name}`
                      : ""}
                    {post.groupId && groups.find((g) => g.id === post.groupId)
                      ? ` • Linked to ${groups.find((g) => g.id === post.groupId).groupName}`
                      : ""}
                  </Text>
                </View>
                {isLeader ? (
                  <View style={styles.actionsRow}>
                    {editingId === post.id ? (
                      <>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => saveEdit(post.id)}
                        >
                          <Save color={theme.colors.primary} size={18} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={cancelEdit}
                        >
                          <X color={theme.colors.textSecondary} size={18} />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => startEdit(post)}
                        >
                          <Save color={theme.colors.primary} size={18} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => removeUpdate(post.id)}
                        >
                          <Trash2 color={theme.colors.error} size={18} />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                ) : null}
              </View>

              {editingId === post.id ? (
                <TextInput
                  value={editingContent}
                  onChangeText={setEditingContent}
                  style={[
                    styles.input,
                    styles.textArea,
                    { marginTop: theme.spacing.md },
                  ]}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              ) : (
                <Text
                  variant="body"
                  style={{ marginTop: theme.spacing.md, lineHeight: 22 }}
                >
                  {post.content}
                </Text>
              )}
            </Card>
          ))
        )}
      </ScrollView>

      {isLeader && !showCreate ? (
        <FAB
          icon={<Plus color={theme.colors.white} size={24} />}
          onPress={() => setShowCreate(true)}
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
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${theme.colors.primary}20`,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 160,
  },
  formCard: {
    marginBottom: theme.spacing.md,
  },
  label: {
    marginTop: theme.spacing.sm,
    marginBottom: 6,
    color: theme.colors.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  textArea: {
    minHeight: 110,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    marginRight: theme.spacing.sm,
    marginTop: 6,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  linkSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${theme.colors.primary}10`,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: `${theme.colors.primary}40`,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    height: 48,
    marginTop: 4,
    marginBottom: theme.spacing.xs,
  },
  searchIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${theme.colors.primary}15`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.sm,
  },
  linkSearchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
  },
  formActions: {
    flexDirection: "row",
    marginTop: theme.spacing.lg,
    justifyContent: "space-between",
  },
  formBtn: {
    flex: 1,
    marginHorizontal: 4,
  },
  emptyState: {
    alignItems: "center",
    marginTop: theme.spacing.xl * 2,
    paddingHorizontal: theme.spacing.md,
  },
  updateCard: {
    marginBottom: theme.spacing.sm,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});
