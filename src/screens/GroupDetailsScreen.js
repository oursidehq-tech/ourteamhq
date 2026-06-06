import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  ClipboardList,
  CalendarDays,
  ShieldCheck,
  ListChecks,
} from "lucide-react-native";
import { Text } from "../components/ui/Typography";
import { Card } from "../components/ui/Card";
import { Avatar } from "../components/ui/Avatar";
import { theme } from "../theme/theme";
import { useClub } from "../contexts/ClubContext";
import {
  subscribeToGroupMemberships,
  subscribeToGroups,
  subscribeToVisibleTasks,
  subscribeToVisibleRosters,
} from "../services/managementService";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToEvents } from "../services/eventService";
import { subscribeToPosts } from "../services/postService";
import { subscribeToTrainingPlans } from "../services/clubOperationsService";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../config/firebase";

const FEED_TABS = [
  "All",
  "Tasks",
  "Shifts",
  "Updates",
  "Checklist",
  "Training Plans",
];

const isGroupMatch = (row, groupId) => {
  if (!groupId || !row) return false;
  const assignedIds = Array.isArray(row.assignedGroupIds)
    ? row.assignedGroupIds
    : [];
  const rowTeamId = (row.teamId || "").toLowerCase();
  const rowGroupId = (row.assignedGroupId || "").toLowerCase();
  const rowGroupType = (row.groupType || "").toLowerCase();
  return (
    rowTeamId === groupId ||
    rowGroupId === groupId ||
    assignedIds.map((id) => id.toLowerCase()).includes(groupId) ||
    rowGroupType === groupId
  );
};

export default function GroupDetailsScreen({ navigation, route }) {
  const { activeClubId, activeClub, userRole, userGroupIds } = useClub();
  const { user, profile } = useAuth();
  const initialGroup = route?.params?.group || null;

  const [group, setGroup] = useState(initialGroup);
  const [groupMemberships, setGroupMemberships] = useState([]);
  const [activeFeedTab, setActiveFeedTab] = useState("All");
  const [allTasks, setAllTasks] = useState([]);
  const [allRosters, setAllRosters] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [allPosts, setAllPosts] = useState([]);
  const [allTrainingPlans, setAllTrainingPlans] = useState([]);
  const [allChecklists, setAllChecklists] = useState([]);
  const [allCompliance, setAllCompliance] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  const myTeamIds = useMemo(() => {
    const memberships = Array.isArray(profile?.clubMemberships)
      ? profile.clubMemberships
      : [];
    const membership = memberships.find((m) => m.clubId === activeClubId);
    return Array.isArray(membership?.teamIds) ? membership.teamIds : [];
  }, [profile?.clubMemberships, activeClubId]);

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

  // Subscribe to tasks and rosters for the feed
  useEffect(() => {
    if (!activeClubId || !groupId) {
      setAllTasks([]);
      setAllRosters([]);
      setAllChecklists([]);
      setAllCompliance([]);
      setLoadingFeed(false);
      return;
    }

    setLoadingFeed(true);
    const unsubTasks = subscribeToVisibleTasks(
      activeClubId,
      (rows) => setAllTasks(rows || []),
      {
        userGroupIds,
        userId: user?.uid || "",
        scope: "all",
        isAdmin: canManage,
      },
    );
    const unsubRosters = subscribeToVisibleRosters(
      activeClubId,
      (rows) => {
        setAllRosters(rows || []);
      },
      {
        userGroupIds,
        userId: user?.uid || "",
        scope: "all",
        isAdmin: canManage,
      },
    );

    const unsubEvents = subscribeToEvents(activeClubId, (rows) => {
      setAllEvents(rows || []);
    });

    const unsubPosts = subscribeToPosts(
      activeClubId,
      (rows) => {
        setAllPosts(rows || []);
      },
      100,
      {
        userId: user?.uid || "",
        teamIds: myTeamIds,
        isClubMember: true,
      },
    );

    const unsubTrainingPlans = subscribeToTrainingPlans(
      activeClubId,
      (rows) => {
        setAllTrainingPlans(rows || []);
      },
    );

    // Subscribe to checklists
    const checklistsCol = collection(db, "clubs", activeClubId, "checklists");
    const unsubChecklists = onSnapshot(
      query(checklistsCol),
      (snap) => {
        setAllChecklists(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => setAllChecklists([]),
    );

    // Subscribe to team compliance
    const complianceCol = collection(
      db,
      "clubs",
      activeClubId,
      "teamCompliance",
    );
    const unsubCompliance = onSnapshot(
      query(complianceCol),
      (snap) => {
        setAllCompliance(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingFeed(false);
      },
      () => {
        setAllCompliance([]);
        setLoadingFeed(false);
      },
    );

    return () => {
      unsubTasks?.();
      unsubRosters?.();
      unsubEvents?.();
      unsubPosts?.();
      unsubTrainingPlans?.();
      unsubChecklists?.();
      unsubCompliance?.();
    };
  }, [activeClubId, groupId, userGroupIds, user?.uid, myTeamIds, canManage]);

  const groupTasks = useMemo(
    () =>
      (allTasks || [])
        .filter((task) => isGroupMatch(task, groupId))
        .sort((a, b) =>
          `${a.dueDate || ""}`.localeCompare(`${b.dueDate || ""}`),
        ),
    [allTasks, groupId],
  );

  const groupRosters = useMemo(
    () =>
      (allRosters || [])
        .filter((roster) => isGroupMatch(roster, groupId))
        .flatMap((roster) => {
          const shifts = roster.shifts || [];
          if (shifts.length === 0) {
            return [
              {
                id: roster.id,
                title: roster.title,
                date: roster.date || "Date TBD",
                role: "",
                filledByName: "",
              },
            ];
          }
          return shifts.map((shift, idx) => ({
            id: `${roster.id}-${idx}`,
            title: roster.title,
            date: roster.date || "Date TBD",
            role: shift.role || "",
            filledByName: shift.filledByName || "",
            startTime: shift.startTime || "",
            endTime: shift.endTime || "",
          }));
        }),
    [allRosters, groupId],
  );

  const groupMatches = useMemo(
    () =>
      (allEvents || [])
        .filter((event) => isGroupMatch(event, groupId))
        .filter((event) => {
          const type = (event.type || "").toLowerCase();
          return type === "game" || type === "match";
        })
        .sort((a, b) =>
          `${a.date || ""} ${a.startTime || ""}`.localeCompare(
            `${b.date || ""} ${b.startTime || ""}`,
          ),
        ),
    [allEvents, groupId],
  );

  const groupUpdates = useMemo(
    () =>
      (allPosts || [])
        .filter((post) => isGroupMatch(post, groupId))
        .filter((post) => {
          const type = (post.type || "").toLowerCase();
          const category = (post.category || "").toLowerCase();
          return type === "update" || category === "updates";
        }),
    [allPosts, groupId],
  );

  const groupPosts = useMemo(
    () =>
      (allPosts || [])
        .filter((post) => isGroupMatch(post, groupId))
        .sort((a, b) => {
          const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return bMs - aMs;
        }),
    [allPosts, groupId],
  );

  const groupChecklists = useMemo(
    () =>
      (allChecklists || [])
        .filter((checklist) => isGroupMatch(checklist, groupId))
        .sort((a, b) => {
          const aMs = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
          const bMs = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
          return bMs - aMs;
        }),
    [allChecklists, groupId],
  );

  const groupCompliance = useMemo(
    () =>
      (allCompliance || [])
        .filter((row) => isGroupMatch(row, groupId))
        .sort((a, b) =>
          `${a.teamName || ""}`.localeCompare(`${b.teamName || ""}`),
        ),
    [allCompliance, groupId],
  );

  const groupTrainingPlans = useMemo(
    () =>
      (allTrainingPlans || [])
        .filter((plan) => isGroupMatch(plan, groupId))
        .sort((a, b) => {
          const aMs = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
          const bMs = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
          return bMs - aMs;
        }),
    [allTrainingPlans, groupId],
  );

  const feedRows = useMemo(() => {
    if (activeFeedTab === "All Posts") {
      return groupPosts.map((p) => ({
        id: `post-${p.id}`,
        kind: "post",
        title: p.content || "Post",
        subtitle: p.authorName || "Club",
        meta: p.category || p.type || "Post",
      }));
    }
    if (activeFeedTab === "Matches") {
      return groupMatches.map((m) => ({
        id: `match-${m.id}`,
        kind: "match",
        title: m.title || "Match",
        subtitle: m.location || m.opponent || "",
        meta: `${m.date || "Date TBD"} ${m.startTime || ""}${m.endTime ? ` - ${m.endTime}` : ""}`.trim(),
      }));
    }
    if (activeFeedTab === "Tasks") {
      return groupTasks.map((t) => ({
        id: `task-${t.id}`,
        kind: "task",
        title: t.title || "Task",
        subtitle: t.assigneeName || t.assignedUserName || "Unassigned",
        meta: t.dueDate || "No due date",
      }));
    }
    if (activeFeedTab === "Shifts") {
      return groupRosters.map((r) => ({
        id: `roster-${r.id}`,
        kind: "shift",
        title: `${r.title}${r.role ? ` - ${r.role}` : ""}`,
        subtitle: r.filledByName || "Open shift",
        meta: `${r.date}${r.startTime ? ` ${r.startTime}` : ""}${r.endTime ? ` - ${r.endTime}` : ""}`,
      }));
    }
    if (activeFeedTab === "Updates") {
      return groupUpdates.map((u) => ({
        id: `update-${u.id}`,
        kind: "update",
        title: u.content || "Update",
        subtitle: u.authorName || "Club",
        meta: "Update",
      }));
    }
    if (activeFeedTab === "Training Plans") {
      return groupTrainingPlans.map((plan) => ({
        id: `training-${plan.id}`,
        kind: "training",
        title: plan.title || "Training Plan",
        subtitle: `${(plan.drillIds || []).length} drill(s)`,
        meta: plan.sessionDate || "No session date",
      }));
    }
    if (activeFeedTab === "Checklist") {
      return groupChecklists.map((c) => ({
        id: `checklist-${c.id}`,
        kind: "checklist",
        title: c.title || c.name || "Checklist",
        subtitle: c.description || "",
        meta: c.status || "Pending",
      }));
    }
    if (activeFeedTab === "Compliance") {
      return groupCompliance.map((c) => ({
        id: `compliance-${c.id}`,
        kind: "compliance",
        title: c.title || c.teamName || "Compliance Record",
        subtitle: c.description || c.checklistName || "",
        meta: c.status || c.completedAt || "Pending",
      }));
    }
    // All tab
    const allRows = [
      ...groupMatches.map((m) => ({
        id: `match-${m.id}`,
        kind: "match",
        title: m.title || "Match",
        subtitle: m.location || m.opponent || "",
        meta: `${m.date || "Date TBD"} ${m.startTime || ""}${m.endTime ? ` - ${m.endTime}` : ""}`.trim(),
      })),
      ...groupPosts
        .filter((p) => {
          const type = (p.type || "").toLowerCase();
          const category = (p.category || "").toLowerCase();
          return !(type === "update" || category === "updates");
        })
        .map((p) => ({
          id: `post-${p.id}`,
          kind: "post",
          title: p.content || "Post",
          subtitle: p.authorName || "Club",
          meta: p.category || p.type || "Post",
        })),
      ...groupUpdates.map((u) => ({
        id: `update-${u.id}`,
        kind: "update",
        title: u.content || "Update",
        subtitle: u.authorName || "Club",
        meta: "Update",
      })),
      ...groupTrainingPlans.map((plan) => ({
        id: `training-${plan.id}`,
        kind: "training",
        title: plan.title || "Training Plan",
        subtitle: `${(plan.drillIds || []).length} drill(s)`,
        meta: plan.sessionDate || "No session date",
      })),
      ...groupTasks.map((t) => ({
        id: `task-${t.id}`,
        kind: "task",
        title: t.title || "Task",
        subtitle: t.assigneeName || t.assignedUserName || "Unassigned",
        meta: t.dueDate || "No due date",
      })),
      ...groupRosters.map((r) => ({
        id: `roster-${r.id}`,
        kind: "shift",
        title: `${r.title}${r.role ? ` - ${r.role}` : ""}`,
        subtitle: r.filledByName || "Open shift",
        meta: `${r.date}${r.startTime ? ` ${r.startTime}` : ""}${r.endTime ? ` - ${r.endTime}` : ""}`,
      })),
      ...groupChecklists.map((c) => ({
        id: `checklist-${c.id}`,
        kind: "checklist",
        title: c.title || c.name || "Checklist",
        subtitle: c.description || "",
        meta: c.status || "Pending",
      })),
      ...groupCompliance.map((c) => ({
        id: `compliance-${c.id}`,
        kind: "compliance",
        title: c.title || c.teamName || "Compliance Record",
        subtitle: c.description || c.checklistName || "",
        meta: c.status || c.completedAt || "Pending",
      })),
    ];
    return allRows.sort((a, b) => a.meta.localeCompare(b.meta));
  }, [
    activeFeedTab,
    groupPosts,
    groupMatches,
    groupUpdates,
    groupTrainingPlans,
    groupTasks,
    groupRosters,
    groupChecklists,
    groupCompliance,
  ]);

  const openGroupMembers = () => {
    navigation.navigate("GroupMembers", {
      group,
      groupId,
      canManage,
    });
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
        <TouchableOpacity
          style={styles.groupTitlePressable}
          onPress={openGroupMembers}
          activeOpacity={0.75}
        >
          <View style={styles.groupTitleRow}>
            <View style={{ flex: 1 }}>
              <Text variant="h3">{group?.groupName || "Group Details"}</Text>
              <Text variant="small" color={theme.colors.textSecondary}>
                {group?.groupType || "General"} • {groupMemberships.length}{" "}
                member
                {groupMemberships.length === 1 ? "" : "s"} • Tap title to manage
              </Text>
            </View>
            <ChevronRight color={theme.colors.textSecondary} size={18} />
          </View>
        </TouchableOpacity>
      </View>

      {!groupId ? (
        <View style={styles.centerState}>
          <Text variant="body" color={theme.colors.textSecondary}>
            Group data is not available.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Feed Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.feedTabRow}
            contentContainerStyle={{ paddingRight: theme.spacing.md }}
          >
            {FEED_TABS.map((tab) => {
              const isActive = activeFeedTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveFeedTab(tab)}
                  style={[
                    styles.feedTabBtn,
                    isActive && styles.feedTabBtnActive,
                  ]}
                >
                  <Text
                    variant="small"
                    weight={isActive ? "700" : "600"}
                    color={
                      isActive
                        ? theme.colors.primary
                        : theme.colors.textSecondary
                    }
                  >
                    {tab}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {loadingFeed ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.primary}
              style={{ marginTop: theme.spacing.lg }}
            />
          ) : feedRows.length === 0 ? (
            <View style={styles.emptyFeed}>
              <CalendarDays color={theme.colors.border} size={40} />
              <Text
                variant="body"
                color={theme.colors.textSecondary}
                style={{ marginTop: theme.spacing.sm, textAlign: "center" }}
              >
                No{" "}
                {activeFeedTab === "All"
                  ? "items"
                  : activeFeedTab.toLowerCase()}{" "}
                linked to this group yet.
              </Text>
            </View>
          ) : (
            feedRows.map((row) => (
              <Card key={row.id} style={styles.feedCard}>
                <View style={styles.feedCardHeader}>
                  <View style={styles.feedCardTitleWrap}>
                    {row.kind === "task" ? (
                      <CheckSquare color={theme.colors.primary} size={16} />
                    ) : row.kind === "checklist" ? (
                      <ListChecks color={"#FF9500"} size={16} />
                    ) : row.kind === "compliance" ? (
                      <ShieldCheck color={"#5856D6"} size={16} />
                    ) : (
                      <ClipboardList color={theme.colors.primary} size={16} />
                    )}
                    <Text
                      variant="body"
                      weight="600"
                      style={{ marginLeft: 8, flexShrink: 1 }}
                    >
                      {row.title}
                    </Text>
                  </View>
                  <Text variant="small" color={theme.colors.textSecondary}>
                    {row.kind.toUpperCase()}
                  </Text>
                </View>
                {row.subtitle ? (
                  <Text
                    variant="small"
                    color={theme.colors.textSecondary}
                    style={{ marginTop: 4 }}
                  >
                    {row.subtitle}
                  </Text>
                ) : null}
                <Text
                  variant="small"
                  color={theme.colors.textSecondary}
                  style={{ marginTop: 4 }}
                >
                  {row.meta}
                </Text>
              </Card>
            ))
          )}
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
  groupTitlePressable: {
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  groupTitleRow: {
    flexDirection: "row",
    alignItems: "center",
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
  feedTabRow: {
    flexDirection: "row",
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  feedTabBtn: {
    paddingVertical: 10,
    marginRight: theme.spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  feedTabBtnActive: {
    borderBottomColor: theme.colors.primary,
  },
  emptyFeed: {
    alignItems: "center",
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  feedCard: {
    marginBottom: theme.spacing.sm,
  },
  feedCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  feedCardTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
});
