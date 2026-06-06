import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Pressable,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  Bell,
  ChevronLeft,
  Home,
  Users,
  CalendarDays,
  ShoppingBag,
  Menu,
  CheckSquare,
  ClipboardList,
  ShieldCheck,
  UserPlus,
  UserMinus,
} from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { Avatar } from "../../components/ui/Avatar";
import { theme } from "../../theme/theme";
import { useClub } from "../../contexts/ClubContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  subscribeToTeams,
  updateTeam,
  subscribeToClubMembers,
  deleteTeam,
  requestToFollowTeam,
  approveTeamFollower,
  removeTeamFollower,
  assignMembersToTeam,
  unassignMembersFromTeam,
} from "../../services/teamService";
import { subscribeToEvents } from "../../services/eventService";
import {
  subscribeToVisibleTasks,
  subscribeToVisibleRosters,
} from "../../services/managementService";
import { subscribeToPosts } from "../../services/postService";
import {
  subscribeToChecklists,
  subscribeToTrainingPlans,
} from "../../services/clubOperationsService";

const FEED_TABS = [
  "All Posts",
  "Matches",
  "Tasks",
  "Updates",
  "Checklists",
  "Training Plans",
  "Events",
];

const isTeamMatch = (row, teamId) => {
  if (!teamId || !row) return false;
  const tid = String(teamId).trim().toLowerCase();
  const rowTeamId = String(row.teamId || "")
    .trim()
    .toLowerCase();
  const rowGroupId = String(row.assignedGroupId || "")
    .trim()
    .toLowerCase();
  const assignedIds = Array.isArray(row.assignedGroupIds)
    ? row.assignedGroupIds.map((id) => String(id).trim().toLowerCase())
    : [];
  return rowTeamId === tid || rowGroupId === tid || assignedIds.includes(tid);
};

const formatDateLine = (row) => {
  const date = row?.date || row?.dueDate || "Date TBD";
  const start = row?.startTime || row?.time || "";
  const end = row?.endTime || "";
  if (!start && !end) return date;
  return `${date} ${start}${end ? ` - ${end}` : ""}`.trim();
};

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
  const normalizedRoles = getMemberNormalizedRoles(member);
  if (!normalizedRoles.length) return true;
  return normalizedRoles.includes("player");
};

const TEAM_BADGE_COLORS = [
  "#E0F2FE",
  "#DCFCE7",
  "#FEF3C7",
  "#FCE7F3",
  "#EDE9FE",
  "#FEE2E2",
];

const getTeamBadgeColor = (teamId = "") => {
  const source = String(teamId || "");
  if (!source) return TEAM_BADGE_COLORS[0];

  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) % 2147483647;
  }

  return TEAM_BADGE_COLORS[Math.abs(hash) % TEAM_BADGE_COLORS.length];
};

export default function TeamFeedScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { activeClubId, activeClub, userRole, userGroupIds } = useClub();
  const { user, profile } = useAuth();
  const teamId = route?.params?.teamId || "";
  const teamNameFromRoute = route?.params?.teamName || "";
  const initialTabFromRoute = route?.params?.initialTab || "";

  const [teams, setTeams] = useState([]);
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [posts, setPosts] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [trainingPlans, setTrainingPlans] = useState([]);
  const [clubMembers, setClubMembers] = useState([]);
  const [activeTab, setActiveTab] = useState("All Posts");
  const [taskFilter, setTaskFilter] = useState("Upcoming");
  const [loading, setLoading] = useState(true);
  const [deletingTeam, setDeletingTeam] = useState(false);
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
  const [updatingPlayers, setUpdatingPlayers] = useState(false);
  const [newManualPlayerName, setNewManualPlayerName] = useState("");
  const [selectedManualPlayerIds, setSelectedManualPlayerIds] = useState([]);
  const [savingManualRoster, setSavingManualRoster] = useState(false);
  const [allPostsTeamFilterId, setAllPostsTeamFilterId] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    if (FEED_TABS.includes(initialTabFromRoute)) {
      setActiveTab(initialTabFromRoute);
    }
  }, [initialTabFromRoute]);

  const quickNavItems = [
    { key: "Home", label: "Home", icon: Home, active: false },
    { key: "Teams", label: "Teams", icon: Users, active: true },
    { key: "Groups", label: "Groups", icon: Users, active: false },
    { key: "Calendar", label: "Calendar", icon: CalendarDays, active: false },
    { key: "Shop", label: "Shop", icon: ShoppingBag, active: false },
    { key: "More", label: "More", icon: Menu, active: false },
  ];

  const normalizedRole = String(userRole || "")
    .trim()
    .toLowerCase();
  const isOwner = normalizedRole === "owner";
  const isAdmin = [
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
  const myTeamIds = useMemo(() => {
    const memberships = Array.isArray(profile?.clubMemberships)
      ? profile.clubMemberships
      : [];
    const membership = memberships.find((m) => m.clubId === activeClubId);
    return Array.isArray(membership?.teamIds) ? membership.teamIds : [];
  }, [profile?.clubMemberships, activeClubId]);

  const canManageManualRoster = ["owner", "admin"].includes(normalizedRole);
  const canSelectManualRoster = ["owner", "admin", "coach", "manager"].includes(
    normalizedRole,
  );

  const isTeamMember = myTeamIds.includes(teamId);

  useEffect(() => {
    if (!activeClubId) {
      setTeams([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubTeams = subscribeToTeams(activeClubId, setTeams, {
      teamIds: myTeamIds,
      isAdmin,
    });
    const unsubEvents = subscribeToEvents(
      activeClubId,
      (rows) => setEvents(rows || []),
      {
        teamIds: myTeamIds,
        groupIds: userGroupIds,
        isAdmin,
      },
    );
    const unsubTasks = subscribeToVisibleTasks(
      activeClubId,
      (rows) => setTasks(rows || []),
      { userGroupIds, userId: user?.uid || "", scope: "all", isAdmin },
    );
    const unsubRosters = subscribeToVisibleRosters(
      activeClubId,
      (rows) => {
        setRosters(rows || []);
        setLoading(false);
      },
      { userGroupIds, userId: user?.uid || "", scope: "all", isAdmin },
    );
    const unsubPosts = subscribeToPosts(
      activeClubId,
      (rows) => setPosts(rows || []),
      100,
      {
        userId: user?.uid,
        teamIds: myTeamIds,
        isClubMember: true,
      },
    );
    const unsubChecklists = subscribeToChecklists(activeClubId, (rows) => {
      setChecklists(rows || []);
    });
    const unsubTrainingPlans = subscribeToTrainingPlans(
      activeClubId,
      (rows) => {
        setTrainingPlans(rows || []);
      },
    );

    return () => {
      unsubTeams?.();
      unsubEvents?.();
      unsubTasks?.();
      unsubRosters?.();
      unsubPosts?.();
      unsubChecklists?.();
      unsubTrainingPlans?.();
    };
  }, [activeClubId, userGroupIds, user?.uid, myTeamIds, isAdmin]);

  useEffect(() => {
    if (!activeClubId) {
      setClubMembers([]);
      return;
    }

    const unsubscribeMembers = subscribeToClubMembers(
      activeClubId,
      (members) => {
        setClubMembers(Array.isArray(members) ? members : []);
      },
    );

    return () => unsubscribeMembers?.();
  }, [activeClubId]);

  const selectedTeam =
    teams.find((team) => team.id === teamId) ||
    (teamId
      ? {
          id: teamId,
          name: teamNameFromRoute || "Team",
          division: "",
        }
      : null);

  const clubTeamIds = useMemo(
    () =>
      (teams || [])
        .map((team) => String(team?.id || "").trim())
        .filter(Boolean),
    [teams],
  );

  const pendingFollowers = Array.isArray(selectedTeam?.pendingFollowers)
    ? selectedTeam.pendingFollowers
    : [];
  const followers = Array.isArray(selectedTeam?.followers)
    ? selectedTeam.followers
    : [];

  const isFollower = followers.some((f) => f.uid === user?.uid);
  const isPendingFollower = pendingFollowers.some((f) => f.uid === user?.uid);

  const hasAccessToFeed = isTeamMember || isFollower || isAdmin;

  const visibleTasks = tasks;
  const visibleRosters = rosters;

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
          const aName = (a.displayName || a.email || "").toLowerCase();
          const bName = (b.displayName || b.email || "").toLowerCase();
          return aName.localeCompare(bName);
        }),
    [clubMembers, teamId],
  );

  const teamPlayerCount = teamPlayers.length;
  const teamManualPlayers = Array.isArray(selectedTeam?.manualPlayers)
    ? selectedTeam.manualPlayers
    : [];

  const assignablePlayers = useMemo(() => {
    const query = playerSearchQuery.trim().toLowerCase();
    return (clubMembers || [])
      .filter(
        (member) =>
          (!Array.isArray(member.teamIds) ||
            !member.teamIds.includes(teamId)) &&
          isPlayerMember(member),
      )
      .filter((member) => {
        if (!query) return true;
        const name = (member.displayName || "").toLowerCase();
        const email = (member.email || "").toLowerCase();
        return name.includes(query) || email.includes(query);
      })
      .sort((a, b) => {
        const aName = (a.displayName || a.email || "").toLowerCase();
        const bName = (b.displayName || b.email || "").toLowerCase();
        return aName.localeCompare(bName);
      });
  }, [clubMembers, playerSearchQuery, teamId]);

  const teamMatches = useMemo(
    () =>
      (events || [])
        .filter((event) => isTeamMatch(event, teamId))
        .filter((event) => {
          const type = (event.type || "").toLowerCase();
          return type === "game" || type === "match";
        })
        .sort((a, b) =>
          `${a.date || ""} ${a.startTime || ""}`.localeCompare(
            `${b.date || ""} ${b.startTime || ""}`,
          ),
        ),
    [events, teamId],
  );

  const teamEvents = useMemo(
    () =>
      (events || [])
        .filter((event) => isTeamMatch(event, teamId))
        .filter((event) => {
          const type = (event.type || "").toLowerCase();
          return type !== "game" && type !== "match";
        })
        .sort((a, b) =>
          `${a.date || ""} ${a.startTime || ""}`.localeCompare(
            `${b.date || ""} ${b.startTime || ""}`,
          ),
        ),
    [events, teamId],
  );

  const teamUpdates = useMemo(
    () =>
      (posts || [])
        .filter((post) => isTeamMatch(post, teamId))
        .filter((post) => {
          const type = (post.type || "").toLowerCase();
          const category = (post.category || "").toLowerCase();
          return type === "update" || category === "updates";
        }),
    [posts, teamId],
  );

  const teamPosts = useMemo(
    () =>
      (posts || [])
        .filter((post) => isTeamMatch(post, teamId))
        .sort((a, b) => {
          const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return bMs - aMs;
        }),
    [posts, teamId],
  );

  const allTeamPosts = useMemo(
    () =>
      (posts || [])
        .filter((post) =>
          clubTeamIds.some((candidateTeamId) =>
            isTeamMatch(post, candidateTeamId),
          ),
        )
        .sort((a, b) => {
          const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return bMs - aMs;
        }),
    [posts, clubTeamIds],
  );

  const filteredAllTeamPosts = useMemo(() => {
    if (!allPostsTeamFilterId) return allTeamPosts;
    return allTeamPosts.filter((post) =>
      isTeamMatch(post, allPostsTeamFilterId),
    );
  }, [allTeamPosts, allPostsTeamFilterId]);

  const teamChecklists = useMemo(
    () =>
      (checklists || [])
        .filter((checklist) => isTeamMatch(checklist, teamId))
        .sort((a, b) => {
          const aMs = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
          const bMs = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
          return bMs - aMs;
        }),
    [checklists, teamId],
  );

  const teamTrainingPlans = useMemo(
    () =>
      (trainingPlans || [])
        .filter((plan) => isTeamMatch(plan, teamId))
        .sort((a, b) => {
          const aMs = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
          const bMs = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
          return bMs - aMs;
        }),
    [trainingPlans, teamId],
  );

  const teamTasks = useMemo(
    () =>
      (visibleTasks || [])
        .filter((task) => isTeamMatch(task, teamId))
        .sort((a, b) =>
          `${a.dueDate || ""}`.localeCompare(`${b.dueDate || ""}`),
        ),
    [visibleTasks, teamId],
  );

  const teamShifts = useMemo(
    () =>
      (visibleRosters || [])
        .filter((roster) => isTeamMatch(roster, teamId))
        .flatMap((roster) =>
          (roster.shifts || [])
            .filter(
              (shift) =>
                isTeamMatch(shift, teamId) ||
                isTeamMatch(
                  {
                    assignedGroupId: roster.assignedGroupId,
                    assignedGroupIds: roster.assignedGroupIds,
                    teamId: roster.teamId,
                  },
                  teamId,
                ),
            )
            .map((shift, idx) => ({
              id: `${roster.id}-${idx}`,
              title: roster.title,
              date: roster.date,
              ...shift,
            })),
        ),
    [visibleRosters, teamId],
  );

  const feedRows = useMemo(() => {
    if (activeTab === "Matches") {
      return teamMatches.map((match) => ({
        id: `match-${match.id}`,
        originalItem: match,
        kind: "match",
        title: `${match.teamName || selectedTeam?.name || "Team"} vs ${match.opponent || "Opponent"}`,
        subtitle:
          typeof match.ourScore === "number" &&
          typeof match.opponentScore === "number"
            ? `Result ${match.ourScore} - ${match.opponentScore}`
            : match.location || "Score pending",
        meta: formatDateLine(match),
        eventId: match.id,
        status: match.status || "scheduled",
        opponent: match.opponent || "",
        teamName: match.teamName || selectedTeam?.name || "Team",
        ourScore: match.ourScore,
        opponentScore: match.opponentScore,
        date: match.date || "",
        startTime: match.startTime || "",
        location: match.location || "",
        description: match.description || "",
      }));
    }

    if (activeTab === "Updates") {
      return teamUpdates.map((update) => ({
        id: `update-${update.id}`,
        originalItem: update,
        kind: "update",
        title: update.content || "Team update",
        subtitle: update.authorName || "Club",
        meta: "Update",
      }));
    }

    if (activeTab === "Checklists") {
      return teamChecklists.map((checklist) => ({
        id: `checklist-${checklist.id}`,
        originalItem: checklist,
        kind: "checklist",
        title: checklist.title || checklist.name || "Checklist",
        subtitle: checklist.teamName || checklist.teamId || "Team checklist",
        meta: checklist.dueDate || "No due date",
      }));
    }

    if (activeTab === "Training Plans") {
      return teamTrainingPlans.map((plan) => ({
        id: `training-${plan.id}`,
        originalItem: plan,
        kind: "training",
        title: plan.title || "Training Plan",
        subtitle: `${(plan.drillIds || []).length} drill(s)`,
        meta: plan.sessionDate || "No session date",
      }));
    }

    if (activeTab === "All Posts") {
      try {
        const toMs = (item) => {
          const ts =
            item?.createdAt ||
            item?.updatedAt ||
            item?.dueDate ||
            item?.date ||
            item?.sessionDate ||
            "";
          if (ts?.toMillis) return ts.toMillis();
          if (ts?.seconds) return ts.seconds * 1000;
          if (typeof ts === "string" && ts) return new Date(ts).getTime() || 0;
          return 0;
        };

        // Show ALL club content (not just team-matched) on All Posts tab
        const allMatches = (events || []).filter((e) =>
          ["game", "match"].includes((e.type || "").toLowerCase()),
        );
        const allEvents = (events || []).filter(
          (e) => !["game", "match"].includes((e.type || "").toLowerCase()),
        );
        const allUpdates = posts || [];
        const allTasks = visibleTasks || [];
        const allChk = checklists || [];
        const allPlans = trainingPlans || [];

        const rows = [
          ...allMatches.map((match) => ({
            id: `allpost-match-${match?.id || Math.random()}`,
            originalItem: match,
            kind: "match",
            _ts: toMs(match),
            title: `${match?.teamName || selectedTeam?.name || "Team"} vs ${match?.opponent || "Opponent"}`,
            subtitle:
              typeof match?.ourScore === "number" &&
              typeof match?.opponentScore === "number"
                ? `Result ${match.ourScore} - ${match.opponentScore}`
                : match?.location || "Score pending",
            meta: formatDateLine(match),
            eventId: match?.id,
            status: match?.status || "scheduled",
            opponent: match?.opponent || "",
            teamName: match?.teamName || selectedTeam?.name || "Team",
            ourScore: match?.ourScore,
            opponentScore: match?.opponentScore,
            date: match?.date || "",
            startTime: match?.startTime || "",
            location: match?.location || "",
            description: match?.description || "",
          })),
          ...allEvents.map((event) => ({
            id: `allpost-event-${event?.id || Math.random()}`,
            originalItem: event,
            kind: "event",
            _ts: toMs(event),
            title: event?.title || "Event",
            subtitle: event?.location || "",
            meta: formatDateLine(event),
          })),
          ...allUpdates.map((post) => ({
            id: `allpost-update-${post?.id || Math.random()}`,
            originalItem: post,
            kind: "update",
            _ts: toMs(post),
            title: post?.content || "Team update",
            subtitle: post?.authorName || "Club",
            meta: post?.category || "Update",
          })),
          ...allTasks.map((task) => ({
            id: `allpost-task-${task?.id || Math.random()}`,
            originalItem: task,
            kind: "task",
            _ts: toMs(task),
            title: task?.title || "Task",
            subtitle:
              task?.assigneeName || task?.assignedUserName || "Unassigned",
            meta: task?.dueDate || "No due date",
          })),
          ...allChk.map((checklist) => ({
            id: `allpost-checklist-${checklist?.id || Math.random()}`,
            originalItem: checklist,
            kind: "checklist",
            _ts: toMs(checklist),
            title: checklist?.title || checklist?.name || "Checklist",
            subtitle:
              checklist?.teamName || checklist?.teamId || "Team checklist",
            meta: checklist?.dueDate || "No due date",
          })),
          ...allPlans.map((plan) => ({
            id: `allpost-training-${plan?.id || Math.random()}`,
            originalItem: plan,
            kind: "training",
            _ts: toMs(plan),
            title: plan?.title || "Training Plan",
            subtitle: `${(plan?.drillIds || []).length} drill(s)`,
            meta: plan?.sessionDate || "No session date",
          })),
        ];

        // Sort newest first
        return rows.sort((a, b) => b._ts - a._ts);
      } catch (err) {
        console.warn("Error processing All Posts feedRows", err);
        return [];
      }
    }

    if (activeTab === "Events") {
      return teamEvents.map((event) => ({
        id: `event-${event.id}`,
        originalItem: event,
        kind: "event",
        title: event.title || "Event",
        subtitle: event.location || "",
        meta: formatDateLine(event),
      }));
    }

    if (activeTab === "Tasks") {
      let filteredTasks = teamTasks;
      if (taskFilter === "Upcoming") {
        filteredTasks = teamTasks.filter(
          (t) =>
            !["completed", "done", "resolved"].includes(
              String(t.status || "").toLowerCase(),
            ),
        );
      } else if (taskFilter === "Completed") {
        filteredTasks = teamTasks.filter((t) =>
          ["completed", "done", "resolved"].includes(
            String(t.status || "").toLowerCase(),
          ),
        );
      }
      return filteredTasks.map((task) => ({
        id: `task-${task.id}`,
        originalItem: task,
        kind: "task",
        title: task.title || "Task",
        subtitle: task.assigneeName || task.assignedUserName || "Unassigned",
        meta: task.dueDate || "No due date",
      }));
    }

    if (activeTab === "Shifts") {
      return teamShifts.map((shift) => ({
        id: `shift-${shift.id}`,
        kind: "shift",
        title: `${shift.title || "Roster"} - ${shift.role || "Shift"}`,
        subtitle: shift.filledByName || "Open shift",
        meta: `${shift.date || "Date TBD"} ${shift.startTime || ""}${shift.endTime ? ` - ${shift.endTime}` : ""}`.trim(),
      }));
    }

    const allRows = [
      ...teamMatches.map((match) => ({
        id: `all-match-${match.id}`,
        originalItem: match,
        kind: "match",
        title: `${match.teamName || selectedTeam?.name || "Team"} vs ${match.opponent || "Opponent"}`,
        subtitle:
          typeof match.ourScore === "number" &&
          typeof match.opponentScore === "number"
            ? `Result ${match.ourScore} - ${match.opponentScore}`
            : match.location || "Score pending",
        meta: formatDateLine(match),
        eventId: match.id,
        status: match.status || "scheduled",
        opponent: match.opponent || "",
        teamName: match.teamName || selectedTeam?.name || "Team",
        ourScore: match.ourScore,
        opponentScore: match.opponentScore,
        date: match.date || "",
        startTime: match.startTime || "",
        location: match.location || "",
        description: match.description || "",
      })),
      ...teamEvents.map((event) => ({
        id: `all-event-${event.id}`,
        originalItem: event,
        kind: "event",
        title: event.title || "Event",
        subtitle: event.location || "",
        meta: formatDateLine(event),
      })),
      ...teamUpdates.map((update) => ({
        id: `all-update-${update.id}`,
        originalItem: update,
        kind: "update",
        title: update.content || "Team update",
        subtitle: update.authorName || "Club",
        meta: "Update",
      })),
      ...teamChecklists.map((checklist) => ({
        id: `all-checklist-${checklist.id}`,
        originalItem: checklist,
        kind: "checklist",
        title: checklist.title || checklist.name || "Checklist",
        subtitle: checklist.teamName || checklist.teamId || "Team checklist",
        meta: checklist.dueDate || "No due date",
      })),
      ...teamTrainingPlans.map((plan) => ({
        id: `all-training-${plan.id}`,
        originalItem: plan,
        kind: "training",
        title: plan.title || "Training Plan",
        subtitle: `${(plan.drillIds || []).length} drill(s)`,
        meta: plan.sessionDate || "No session date",
      })),
      ...teamPosts
        .filter((post) => {
          const type = (post.type || "").toLowerCase();
          const category = (post.category || "").toLowerCase();
          return !(type === "update" || category === "updates");
        })
        .map((post) => ({
          id: `all-post-${post.id}`,
          kind: "post",
          title: post.content || "Post",
          subtitle: post.authorName || "Club",
          meta: post.category || post.type || "Post",
        })),
      ...teamTasks.map((task) => ({
        id: `all-task-${task.id}`,
        originalItem: task,
        kind: "task",
        title: task.title || "Task",
        subtitle: task.assigneeName || "Unassigned",
        meta: task.dueDate || "No due date",
      })),
      ...teamShifts.map((shift) => ({
        id: `all-shift-${shift.id}`,
        kind: "shift",
        title: `${shift.title || "Roster"} - ${shift.role || "Shift"}`,
        subtitle: shift.filledByName || "Open shift",
        meta: `${shift.date || "Date TBD"} ${shift.startTime || ""}${shift.endTime ? ` - ${shift.endTime}` : ""}`.trim(),
      })),
    ];

    // Fallback tab — sort newest first using timestamp
    const toMsSimple = (item) => {
      const ts =
        item?.createdAt || item?.updatedAt || item?.dueDate || item?.date || "";
      if (ts?.toMillis) return ts.toMillis();
      if (ts?.seconds) return ts.seconds * 1000;
      if (typeof ts === "string" && ts) return new Date(ts).getTime() || 0;
      return 0;
    };
    return allRows.sort(
      (a, b) => toMsSimple(b.originalItem) - toMsSimple(a.originalItem),
    );
  }, [
    activeTab,
    selectedTeam,
    teamPlayers,
    teamMatches,
    teamEvents,
    teamUpdates,
    teamChecklists,
    teamTrainingPlans,
    filteredAllTeamPosts,
    teams,
    teamPosts,
    teamTasks,
    teamShifts,
    taskFilter,
    events,
    posts,
    visibleTasks,
    checklists,
    trainingPlans,
  ]);

  const handleDeleteTeam = () => {
    if (!isAdmin || !activeClubId || !teamId) return;

    Alert.alert(
      "Delete Team",
      `Delete ${selectedTeam?.name || "this team"}? This will remove the team from all linked memberships.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingTeam(true);
              await deleteTeam(activeClubId, teamId);
              navigation.goBack();
            } catch {
              Alert.alert("Error", "Could not delete team right now.");
            } finally {
              setDeletingTeam(false);
            }
          },
        },
      ],
    );
  };

  const handleFollowRequest = async () => {
    if (!activeClubId || !teamId || !user?.uid) return;
    try {
      await requestToFollowTeam(
        activeClubId,
        teamId,
        user.uid,
        profile || user,
      );
      Alert.alert(
        "Request Sent",
        "Your request to follow this team has been sent to the team admins.",
      );
    } catch {
      Alert.alert("Error", "Could not send follow request.");
    }
  };

  const togglePlayerSelection = (memberId) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId],
    );
  };

  const handleAddPlayers = async () => {
    if (
      !activeClubId ||
      !teamId ||
      !isAdmin ||
      selectedPlayerIds.length === 0
    ) {
      return;
    }
    setUpdatingPlayers(true);
    try {
      await assignMembersToTeam(activeClubId, teamId, selectedPlayerIds);
      setSelectedPlayerIds([]);
      setPlayerSearchQuery("");
    } catch {
      Alert.alert("Error", "Could not add players right now.");
    } finally {
      setUpdatingPlayers(false);
    }
  };

  const handleRemovePlayer = async (memberId) => {
    if (!activeClubId || !teamId || !isAdmin || !memberId) return;
    setUpdatingPlayers(true);
    try {
      await unassignMembersFromTeam(activeClubId, teamId, [memberId]);
      setSelectedPlayerIds((prev) => prev.filter((id) => id !== memberId));
    } catch {
      Alert.alert("Error", "Could not remove player from team right now.");
    } finally {
      setUpdatingPlayers(false);
    }
  };

  useEffect(() => {
    const ids = Array.isArray(selectedTeam?.selectedManualPlayerIds)
      ? selectedTeam.selectedManualPlayerIds.filter(Boolean)
      : [];
    setSelectedManualPlayerIds(ids);
  }, [selectedTeam?.id, selectedTeam?.selectedManualPlayerIds]);

  const handleAddManualPlayer = async () => {
    if (!activeClubId || !teamId || !canManageManualRoster) return;
    const name = newManualPlayerName.trim();
    if (!name) return;

    const exists = teamManualPlayers.some(
      (player) =>
        String(player?.name || "")
          .trim()
          .toLowerCase() === name.toLowerCase(),
    );
    if (exists) {
      Alert.alert(
        "Duplicate Player",
        "This player is already in the team list.",
      );
      return;
    }

    const manualPlayer = {
      id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      createdBy: user?.uid || "",
      createdAt: new Date().toISOString(),
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

  const handleRemoveManualPlayer = async (manualPlayerId) => {
    if (!activeClubId || !teamId || !canManageManualRoster || !manualPlayerId) {
      return;
    }

    const nextManualPlayers = teamManualPlayers.filter(
      (player) => player?.id !== manualPlayerId,
    );
    const nextSelected = selectedManualPlayerIds.filter(
      (id) => id !== manualPlayerId,
    );

    setSavingManualRoster(true);
    try {
      await updateTeam(activeClubId, teamId, {
        manualPlayers: nextManualPlayers,
        selectedManualPlayerIds: nextSelected,
      });
      setSelectedManualPlayerIds(nextSelected);
    } catch {
      Alert.alert("Error", "Could not remove player from team list right now.");
    } finally {
      setSavingManualRoster(false);
    }
  };

  const toggleManualPlayerSelection = (manualPlayerId) => {
    if (!canSelectManualRoster) return;
    setSelectedManualPlayerIds((prev) =>
      prev.includes(manualPlayerId)
        ? prev.filter((id) => id !== manualPlayerId)
        : [...prev, manualPlayerId],
    );
  };

  const handleSaveManualSelection = async () => {
    if (!activeClubId || !teamId || !canSelectManualRoster) return;
    setSavingManualRoster(true);
    try {
      await updateTeam(activeClubId, teamId, {
        selectedManualPlayerIds,
      });
      Alert.alert("Saved", "Team player selection updated.");
    } catch {
      Alert.alert("Error", "Could not save team player selection right now.");
    } finally {
      setSavingManualRoster(false);
    }
  };

  const openMatchDetails = (row) => {
    if (!row) return;
    if (row.kind === "match" || row.kind === "event") {
      navigation.navigate("MatchDetails", {
        match: row.originalItem || {
          id: row.eventId || row.id,
          teamId,
          teamName: row.teamName || selectedTeam?.name || "Team",
          opponent: row.opponent || "Opponent",
          date: row.date || "",
          startTime: row.startTime || "",
          location: row.location || "",
          status: row.status || "scheduled",
          ourScore: row.ourScore,
          opponentScore: row.opponentScore,
          description: row.description || "",
        },
      });
    } else if (row.kind === "task") {
      setSelectedTask(row.originalItem || row);
    } else if (row.kind === "update") {
      navigation.navigate("Updates");
    } else if (row.kind === "checklist") {
      navigation.navigate("ClubOperations", { initialTab: 1 });
    } else if (row.kind === "training") {
      navigation.navigate("ClubOperations", { initialTab: 4 });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft color={theme.colors.text} size={26} />
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
          <View style={{ marginLeft: theme.spacing.sm }}>
            <Text variant="h3">Teams</Text>
            <Text variant="small">{activeClub?.name || "Club"}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.bellIcon}
          onPress={() => navigation.navigate("Notifications")}
        >
          <Bell color={theme.colors.text} size={22} />
          <View style={styles.badge} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() =>
            navigation.navigate("TeamMembers", { team: selectedTeam, teamId })
          }
        >
          <Card style={styles.teamSummaryCard}>
            <View style={styles.teamSummaryRow}>
              <View style={styles.teamIconContainer}>
                <Users color={theme.colors.primary} size={20} />
              </View>
              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <Text variant="h4">
                  {selectedTeam?.name || teamNameFromRoute || "Team"}
                </Text>
                <Text variant="small" color={theme.colors.textSecondary}>
                  {selectedTeam?.division ||
                    selectedTeam?.ageGroup ||
                    "Team Feed"}
                </Text>
              </View>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "flex-end",
                marginTop: 8,
                gap: 8,
              }}
            >
              {!isTeamMember &&
                !isAdmin &&
                !isFollower &&
                !isPendingFollower && (
                  <TouchableOpacity
                    style={[
                      styles.deleteTeamBtn,
                      { borderColor: theme.colors.primary },
                    ]}
                    onPress={handleFollowRequest}
                  >
                    <Text
                      variant="small"
                      weight="600"
                      color={theme.colors.primary}
                    >
                      Follow Team
                    </Text>
                  </TouchableOpacity>
                )}
              {isPendingFollower && (
                <View
                  style={[
                    styles.deleteTeamBtn,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.background,
                    },
                  ]}
                >
                  <Text
                    variant="small"
                    weight="600"
                    color={theme.colors.textSecondary}
                  >
                    Pending Approval
                  </Text>
                </View>
              )}
              {isAdmin ? (
                <TouchableOpacity
                  style={styles.deleteTeamBtn}
                  onPress={handleDeleteTeam}
                  disabled={deletingTeam}
                >
                  <Text variant="small" weight="600" color={theme.colors.error}>
                    {deletingTeam ? "Deleting..." : "Delete Team"}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </Card>
        </TouchableOpacity>

        {isAdmin && pendingFollowers.length > 0 && (
          <View style={{ marginTop: theme.spacing.md }}>
            <Text variant="h4" style={{ marginBottom: 8 }}>
              Pending Followers
            </Text>
            {pendingFollowers.map((follower) => (
              <View
                key={follower.uid}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: theme.colors.background,
                  padding: 8,
                  borderRadius: theme.radius.md,
                  marginBottom: 8,
                }}
              >
                <Text variant="small" weight="600">
                  {follower.name}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={() =>
                      approveTeamFollower(activeClubId, teamId, follower)
                    }
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      backgroundColor: theme.colors.primary,
                      borderRadius: theme.radius.sm,
                    }}
                  >
                    <Text
                      variant="small"
                      color={theme.colors.white}
                      weight="700"
                    >
                      Approve
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      removeTeamFollower(activeClubId, teamId, follower, true)
                    }
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      backgroundColor: theme.colors.error,
                      borderRadius: theme.radius.sm,
                    }}
                  >
                    <Text
                      variant="small"
                      color={theme.colors.white}
                      weight="700"
                    >
                      Reject
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabRow}
          contentContainerStyle={styles.tabRowContent}
        >
          {FEED_TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              >
                <Text
                  variant="small"
                  weight={isActive ? "700" : "600"}
                  color={
                    isActive ? theme.colors.primary : theme.colors.textSecondary
                  }
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {activeTab === "Tasks" && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ paddingHorizontal: 16, marginBottom: 12 }}
          >
            {["Upcoming", "Completed", "All"].map((filter) => (
              <TouchableOpacity
                key={filter}
                onPress={() => setTaskFilter(filter)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 16,
                  backgroundColor:
                    taskFilter === filter
                      ? theme.colors.primary
                      : theme.colors.surface,
                  borderWidth: 1,
                  borderColor:
                    taskFilter === filter
                      ? theme.colors.primary
                      : theme.colors.border,
                  marginRight: 8,
                }}
              >
                <Text
                  variant="small"
                  color={
                    taskFilter === filter
                      ? theme.colors.white
                      : theme.colors.textSecondary
                  }
                  weight={taskFilter === filter ? "600" : "400"}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {!hasAccessToFeed ? (
          <View style={styles.emptyState}>
            <ShieldCheck color={theme.colors.border} size={46} />
            <Text
              variant="h4"
              color={theme.colors.textSecondary}
              style={{ marginTop: theme.spacing.md, textAlign: "center" }}
            >
              Private Team Feed
            </Text>
            <Text
              variant="small"
              color={theme.colors.textSecondary}
              style={{ marginTop: 4, textAlign: "center" }}
            >
              You must be a team member, staff, or approved follower to view
              this content.
            </Text>
          </View>
        ) : loading ? (
          <ActivityIndicator
            size="large"
            color={theme.colors.primary}
            style={{ marginTop: theme.spacing.xl }}
          />
        ) : feedRows.length === 0 ? (
          <View style={styles.emptyState}>
            <CalendarDays color={theme.colors.border} size={46} />
            <Text
              variant="h4"
              color={theme.colors.textSecondary}
              style={{ marginTop: theme.spacing.md }}
            >
              {activeTab === "All Posts" && allPostsTeamFilterId
                ? "No posts for this team filter yet."
                : "Nothing yet for this team."}
            </Text>
          </View>
        ) : (
          <>
            {activeTab === "All Posts" && allPostsTeamFilterId ? (
              <View style={styles.allPostsFilterRow}>
                <Text variant="small" color={theme.colors.textSecondary}>
                  Filtered by team
                </Text>
                <TouchableOpacity
                  style={styles.clearAllPostsFilterBtn}
                  onPress={() => setAllPostsTeamFilterId("")}
                >
                  <Text
                    variant="small"
                    weight="700"
                    color={theme.colors.primary}
                  >
                    Clear Filter
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {feedRows.map((row) => (
              <TouchableOpacity
                key={row.id}
                activeOpacity={
                  [
                    "match",
                    "event",
                    "task",
                    "update",
                    "checklist",
                    "training",
                  ].includes(row.kind)
                    ? 0.92
                    : 1
                }
                onPress={() => openMatchDetails(row)}
                disabled={
                  ![
                    "match",
                    "event",
                    "task",
                    "update",
                    "checklist",
                    "training",
                  ].includes(row.kind)
                }
              >
                <Card style={styles.rowCard}>
                  {(() => {
                    return (
                      <>
                        <View style={styles.rowHeader}>
                          <View style={styles.rowTitleWrap}>
                            {row.kind === "player" ? (
                              <Users color={theme.colors.primary} size={16} />
                            ) : row.kind === "task" ? (
                              <CheckSquare
                                color={theme.colors.primary}
                                size={16}
                              />
                            ) : row.kind === "shift" ? (
                              <ClipboardList
                                color={theme.colors.primary}
                                size={16}
                              />
                            ) : (
                              <CalendarDays
                                color={theme.colors.primary}
                                size={16}
                              />
                            )}
                            <Text
                              variant="body"
                              weight="600"
                              style={{ marginLeft: 8, flexShrink: 1 }}
                            >
                              {row.title}
                            </Text>
                          </View>
                          <View style={styles.rowHeaderRight}>
                            <Text
                              variant="small"
                              color={theme.colors.textSecondary}
                              style={styles.rowKindLabel}
                            >
                              {row.kind.toUpperCase()}
                            </Text>
                            {row.teamLabel ? (
                              <TouchableOpacity
                                style={[
                                  styles.teamBadge,
                                  { backgroundColor: row.teamBadgeColor },
                                ]}
                                onPress={() => {
                                  if (!row.teamId) return;
                                  setAllPostsTeamFilterId((prev) =>
                                    prev === row.teamId ? "" : row.teamId,
                                  );
                                }}
                              >
                                <Text
                                  variant="small"
                                  weight="700"
                                  style={styles.teamBadgeText}
                                >
                                  {row.teamLabel}
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </View>

                        {row.subtitle ? (
                          <Text
                            variant="small"
                            color={theme.colors.textSecondary}
                            style={{ marginTop: 6 }}
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

                        {row.kind === "match" && row.eventId ? (
                          <>
                            <View style={styles.teamMatchInfoCard}>
                              <Text
                                variant="small"
                                color={theme.colors.textSecondary}
                                style={{ marginBottom: 3 }}
                              >
                                Kick-off: {row.date || "Date TBD"}
                                {row.startTime ? ` • ${row.startTime}` : ""}
                              </Text>
                              <Text
                                variant="small"
                                color={theme.colors.textSecondary}
                              >
                                Venue: {row.location || "Venue TBD"}
                              </Text>
                            </View>

                            <View style={styles.teamMatchDetailRow}>
                              <Text
                                variant="small"
                                color={theme.colors.textSecondary}
                                weight="600"
                              >
                                Status:{" "}
                                {(row.status || "scheduled").toUpperCase()}
                              </Text>
                              {typeof row.ourScore === "number" &&
                              typeof row.opponentScore === "number" ? (
                                <Text variant="small" weight="700">
                                  Score: {row.ourScore} - {row.opponentScore}
                                </Text>
                              ) : null}
                            </View>

                            {row.description ? (
                              <Text
                                variant="small"
                                color={theme.colors.textSecondary}
                                style={{ marginTop: 6 }}
                              >
                                {row.description}
                              </Text>
                            ) : null}

                            <Text
                              variant="small"
                              color={theme.colors.textSecondary}
                              style={{ marginTop: 8 }}
                            >
                              Attendance tracking is not used in Match Details.
                            </Text>
                          </>
                        ) : null}
                      </>
                    );
                  })()}
                </Card>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      <View
        style={[
          styles.quickNavBar,
          {
            bottom: insets.bottom + 12,
          },
        ]}
      >
        {quickNavItems.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.quickNavItem,
              item.active ? styles.quickNavItemActive : null,
            ]}
            onPress={() =>
              navigation.navigate("Main", {
                screen: item.key,
              })
            }
          >
            <item.icon
              size={16}
              color={
                item.active ? theme.colors.primary : theme.colors.textSecondary
              }
            />
            <Text
              variant="small"
              weight={item.active ? "700" : "600"}
              color={
                item.active ? theme.colors.primary : theme.colors.textSecondary
              }
              style={{ marginTop: 4 }}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Modal
        visible={!!selectedTask}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTask(null)}
      >
        <View style={styles.taskModalOverlay}>
          <Pressable
            style={styles.taskModalBackdrop}
            onPress={() => setSelectedTask(null)}
          />

          {selectedTask && (
            <View style={styles.taskModalCard}>
              <View style={styles.taskModalHeader}>
                <Text variant="h3">Task Details</Text>
                <TouchableOpacity
                  onPress={() => setSelectedTask(null)}
                  style={styles.taskModalCloseBtn}
                >
                  <Text
                    variant="small"
                    weight="700"
                    color={theme.colors.primary}
                  >
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.taskModalBody}>
                <Text variant="small" color={theme.colors.textSecondary}>
                  Title
                </Text>
                <Text variant="body" weight="700" style={{ marginBottom: 8 }}>
                  {selectedTask.title || "Untitled task"}
                </Text>

                <Text variant="small" color={theme.colors.textSecondary}>
                  Description
                </Text>
                <Text variant="body" style={{ marginBottom: 8 }}>
                  {selectedTask.description || "No description provided."}
                </Text>

                <Text variant="small" color={theme.colors.textSecondary}>
                  Assignee
                </Text>
                <Text variant="body" style={{ marginBottom: 8 }}>
                  {selectedTask.assigneeName ||
                    selectedTask.assignedUserName ||
                    "Unassigned"}
                </Text>

                <Text variant="small" color={theme.colors.textSecondary}>
                  Status
                </Text>
                <Text variant="body">
                  {String(selectedTask.status || "pending")
                    .trim()
                    .toLowerCase() === "completed"
                    ? "Completed"
                    : "Upcoming"}
                </Text>
              </View>
            </View>
          )}
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    marginRight: theme.spacing.xs,
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
  content: {
    padding: theme.spacing.md,
    paddingBottom: 210,
  },
  teamSummaryCard: {
    marginBottom: theme.spacing.md,
  },
  teamSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  teamIconContainer: {
    width: 46,
    height: 46,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  teamMenuCard: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
  },
  teamMenuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  teamMenuItem: {
    width: "48%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  teamMenuLabel: {
    marginTop: 6,
    textAlign: "center",
  },
  deleteTeamBtn: {
    alignSelf: "flex-end",
    marginTop: theme.spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  playersCard: {
    marginBottom: theme.spacing.md,
  },
  playersHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  playersWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  playerChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  removePlayerBtn: {
    marginLeft: 8,
    padding: 2,
  },
  managePlayersWrap: {
    marginTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  playerSearchInput: {
    height: 42,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    marginBottom: theme.spacing.sm,
  },
  assignablePlayersWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  assignablePlayerChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
    marginBottom: 8,
  },
  assignablePlayerChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  addPlayersBtn: {
    marginTop: theme.spacing.sm,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addPlayersBtnDisabled: {
    opacity: 0.5,
  },
  manualRosterWrap: {
    marginTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  manualPlayerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  removeManualPlayerBtn: {
    marginLeft: 8,
    padding: 4,
  },
  manualAddRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing.sm,
  },
  tabRow: {
    marginBottom: theme.spacing.sm,
  },
  tabRowContent: {
    paddingRight: theme.spacing.md,
  },
  tabBtn: {
    paddingVertical: 10,
    marginRight: theme.spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: {
    borderBottomColor: theme.colors.primary,
  },
  allPostsFilterRow: {
    marginBottom: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  clearAllPostsFilterBtn: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: theme.colors.surface,
  },
  emptyState: {
    alignItems: "center",
    marginTop: theme.spacing.xl,
  },
  rowCard: {
    marginBottom: theme.spacing.sm,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  rowTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  rowHeaderRight: {
    alignItems: "flex-end",
    marginLeft: theme.spacing.sm,
  },
  rowKindLabel: {
    marginBottom: 4,
  },
  teamBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
    maxWidth: 132,
  },
  teamBadgeText: {
    color: "#1E293B",
    fontSize: 11,
  },
  teamMatchDetailRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  teamMatchInfoCard: {
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs + 2,
  },
  quickNavBar: {
    position: "absolute",
    left: 18,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FCFDFF",
    borderWidth: 1,
    borderColor: "#E8EDF2",
    borderRadius: 36,
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: "#1E2C2A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 20,
  },
  quickNavItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 999,
    paddingVertical: 4,
  },
  quickNavItemActive: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCEDE3",
  },
  taskModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  taskModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  taskModalCard: {
    width: "88%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
  },
  taskModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  taskModalCloseBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  taskModalBody: {
    gap: 2,
  },
});
