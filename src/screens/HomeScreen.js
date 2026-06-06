import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
} from "react-native";
import LottieAnimation from "../components/ui/LottieAnimation";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Bell,
  ChevronDown,
  CheckCircle2,
  MessageSquare,
  Share2,
  Heart,
  Image as ImageIcon,
  Calendar as CalendarIcon,
  ExternalLink,
  Megaphone,
  Trophy,
  Trash2,
  Pin,
  PinOff,
  Pencil,
  X,
  Search,
} from "lucide-react-native";
import { Text } from "../components/ui/Typography";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { CommentsModal } from "../components/ui/CommentsModal";
import { theme } from "../theme/theme";
import { useAuth } from "../contexts/AuthContext";
import { useClub } from "../contexts/ClubContext";
import { useTabBarAnimation } from "../contexts/TabBarAnimationContext";
import {
  subscribeToPosts,
  createPost,
  getNetworkPosts,
  deletePost,
  updatePost,
  togglePostPin,
  togglePostLike,
  addPostComment,
  deletePostComment,
} from "../services/postService";
import {
  subscribeToEvents,
  deleteEvent,
  getNetworkEvents,
} from "../services/eventService";
import { getPublicClubs } from "../services/clubService";
import { subscribeToTeams } from "../services/teamService";
import { subscribeToGroups } from "../services/managementService";
import * as ImagePicker from "expo-image-picker";
import { uploadPostImage } from "../services/storageService";

export default function HomeScreen({ route, navigation }) {
  const { user, profile } = useAuth();
  const {
    activeClubId,
    activeClub,
    userRole,
    allClubs,
    switchClub,
    userGroupIds,
  } = useClub();
  const isAdmin = userRole === "Owner" || userRole === "Admin";
  const isPlayerRole = String(userRole || "").toLowerCase() === "player";
  const canCreateCommunication = !isPlayerRole;
  const { setCollapsed } = useTabBarAnimation();
  const [viewMode, setViewMode] = useState(isAdmin ? 0 : 1);
  const [activeTab, setActiveTab] = useState("All Posts");
  const feedTabs = ["All Posts", "Matches", "Updates", "Events", "Network"];
  const homeClubCategories = [
    {
      key: "matches",
      title: "Matches",
      icon: Trophy,
      target: "Matches",
    },
    {
      key: "updates",
      title: "Updates",
      icon: Megaphone,
      target: "Updates",
    },
    {
      key: "events",
      title: "Events",
      icon: CalendarIcon,
      target: "Events",
    },
    {
      key: "network",
      title: "Network",
      icon: ExternalLink,
      target: "Network",
    },
  ];

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

  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [networkPosts, setNetworkPosts] = useState([]);
  const [networkEvents, setNetworkEvents] = useState([]);
  const [networkClubs, setNetworkClubs] = useState([]);
  const [teams, setTeams] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingNetwork, setLoadingNetwork] = useState(false);
  const [createPostText, setCreatePostText] = useState("");
  const [postVisibility, setPostVisibility] = useState("Club-Only");
  const [postCategory, setPostCategory] = useState("Updates");
  const [posting, setPosting] = useState(false);
  const [postImageUri, setPostImageUri] = useState("");
  const [editingPostId, setEditingPostId] = useState(null);
  const [editingContent, setEditingContent] = useState("");
  const [activeCommentPost, setActiveCommentPost] = useState(null);
  const [selectedPostImage, setSelectedPostImage] = useState(null);
  const [linkSearchQuery, setLinkSearchQuery] = useState("");
  const [selectedLinkId, setSelectedLinkId] = useState("");
  const postVisibilityOptions = ["Club-Only", "Public", "Network", "Team-Only"];
  const announcementCategories = ["Matches", "Updates", "Events", "Network"];
  const canManagePosts =
    canCreateCommunication && (isAdmin ? viewMode === 0 : true);
  const isOwner = userRole === "Owner";
  const canManageAllPosts =
    isOwner && viewMode === 0 && activeTab === "All Posts";

  const myTeamIds = useMemo(() => {
    const memberships = Array.isArray(profile?.clubMemberships)
      ? profile.clubMemberships
      : [];
    const membership = memberships.find((m) => m.clubId === activeClubId);
    return Array.isArray(membership?.teamIds) ? membership.teamIds : [];
  }, [profile?.clubMemberships, activeClubId]);

  // Subscribe to real-time posts
  useEffect(() => {
    if (!activeClubId) {
      setPosts([]);
      setLoadingPosts(false);
      return;
    }
    setLoadingPosts(true);
    const unsubscribe = subscribeToPosts(
      activeClubId,
      (newPosts) => {
        setPosts(newPosts);
        setLoadingPosts(false);
      },
      50,
      {
        userId: user?.uid,
        teamIds: myTeamIds,
        isClubMember: true,
      },
    );
    return unsubscribe;
  }, [activeClubId, user?.uid, myTeamIds]);

  useEffect(() => {
    if (!activeClubId) {
      setTeams([]);
      setGroups([]);
      return;
    }

    const unsubTeams = subscribeToTeams(
      activeClubId,
      (rows) => setTeams(rows || []),
      { teamIds: myTeamIds, isAdmin },
    );
    const unsubGroups = subscribeToGroups(
      activeClubId,
      (rows) => setGroups(rows || []),
      { groupIds: userGroupIds, isAdmin },
    );

    return () => {
      unsubTeams?.();
      unsubGroups?.();
    };
  }, [activeClubId, isAdmin, myTeamIds, userGroupIds]);

  useEffect(() => {
    if (!activeClubId) {
      setEvents([]);
      setLoadingEvents(false);
      return;
    }

    setLoadingEvents(true);
    const unsubscribe = subscribeToEvents(activeClubId, (rows) => {
      setEvents(rows || []);
      setLoadingEvents(false);
    });

    return () => unsubscribe?.();
  }, [activeClubId]);

  useEffect(() => {
    let cancelled = false;

    const applyIfActive = (setter, value) => {
      if (!cancelled) setter(value);
    };

    const loadNetwork = async () => {
      const followedClubIds = Array.isArray(profile?.followedClubIds)
        ? profile.followedClubIds
            .map((clubId) => String(clubId || "").trim())
            .filter(Boolean)
        : [];

      try {
        const discoverable = await getPublicClubs(activeClubId, 60);
        applyIfActive(setNetworkClubs, discoverable || []);
      } catch {
        applyIfActive(setNetworkClubs, []);
      }

      const sourceClubIds = Array.from(new Set(followedClubIds));

      if (!sourceClubIds.length) {
        applyIfActive(setNetworkPosts, []);
        applyIfActive(setNetworkEvents, []);
        applyIfActive(setLoadingNetwork, false);
        return;
      }

      applyIfActive(setLoadingNetwork, true);
      try {
        const [posts, eventsRows] = await Promise.all([
          getNetworkPosts(sourceClubIds, 100),
          getNetworkEvents(sourceClubIds, 100),
        ]);
        applyIfActive(setNetworkPosts, posts || []);
        applyIfActive(setNetworkEvents, eventsRows || []);
      } catch (error) {
        console.error("Failed to load network feed:", error);
        applyIfActive(setNetworkPosts, []);
        applyIfActive(setNetworkEvents, []);
      } finally {
        applyIfActive(setLoadingNetwork, false);
      }
    };

    if (activeTab === "Network" || activeTab === "All Posts") {
      loadNetwork();
    }

    return () => {
      cancelled = true;
    };
  }, [activeTab, profile?.followedClubIds, activeClubId]);

  const pickPostImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission?.granted) {
        Alert.alert(
          "Photo Access Needed",
          "Please allow photo access to attach an image to your post.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setPostImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert("Error", "Unable to open image library right now.");
    }
  };

  const handleCreatePost = async () => {
    if (!createPostText.trim() || !activeClubId) return;
    setPosting(true);
    try {
      const typeMap = {
        Matches: "match",
        Updates: "update",
        Events: "event",
        Network: "network",
      };

      const resolvedVisibility =
        postCategory === "Network" ? "Network" : postVisibility;

      const resolvedTeamId =
        resolvedVisibility === "Team-Only" ? myTeamIds?.[0] || null : null;

      const linkedTeam = selectedLinkId
        ? (teams || []).find((team) => team.id === selectedLinkId)
        : null;
      const linkedGroup = selectedLinkId
        ? (groups || []).find((group) =>
            [group.id, group.groupId].includes(selectedLinkId),
          )
        : null;

      if (resolvedVisibility === "Team-Only" && !resolvedTeamId) {
        Alert.alert(
          "Team Required",
          "Team-Only posts require you to be assigned to at least one team in this club.",
        );
        setPosting(false);
        return;
      }

      const createdPost = await createPost(activeClubId, {
        authorId: user.uid,
        authorName: profile?.displayName || profile?.email || "Member",
        content: createPostText.trim(),
        imageUrl: "",
        visibility: resolvedVisibility,
        teamId: resolvedTeamId || linkedTeam?.id || null,
        groupId: linkedTeam ? null : linkedGroup?.id || linkedGroup?.groupId,
        type: typeMap[postCategory] || "update",
        category: postCategory,
      });

      if (postImageUri) {
        const uploadedUrl = await uploadPostImage(
          activeClubId,
          createdPost.id,
          postImageUri,
        );
        if (uploadedUrl) {
          await updatePost(activeClubId, createdPost.id, {
            imageUrl: uploadedUrl,
            imageOwnerUid: user?.uid || "",
            imageOwnerName: profile?.displayName || profile?.email || "Admin",
          });
        }
      }

      setCreatePostText("");
      setPostCategory("Updates");
      setPostImageUri("");
      setSelectedLinkId("");
      setLinkSearchQuery("");
    } catch (error) {
      Alert.alert("Error", "Failed to create post.");
    } finally {
      setPosting(false);
    }
  };

  const handleDeletePost = async (post) => {
    if (!activeClubId || !post) return;
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            if (post.fromEvent && post.sourceId) {
              await deleteEvent(activeClubId, post.sourceId);
            } else {
              await deletePost(activeClubId, post.id);
            }
          } catch {
            Alert.alert("Error", "Unable to delete post right now.");
          }
        },
      },
    ]);
  };

  const handleStartEditPost = (post) => {
    setEditingPostId(post.id);
    setEditingContent(post.content || "");
  };

  const handleCancelEditPost = () => {
    setEditingPostId(null);
    setEditingContent("");
  };

  const handleSaveEditPost = async (postId) => {
    if (!activeClubId) return;
    const content = editingContent.trim();
    if (!content) {
      Alert.alert("Required", "Post content cannot be empty.");
      return;
    }
    try {
      await updatePost(activeClubId, postId, { content });
      handleCancelEditPost();
    } catch {
      Alert.alert("Error", "Unable to update post right now.");
    }
  };

  const handleTogglePinPost = async (post) => {
    if (!activeClubId || !post?.id) return;
    try {
      await togglePostPin(activeClubId, post.id, !post.isPinned);
    } catch {
      Alert.alert("Error", "Unable to update pin status right now.");
    }
  };

  const handleToggleLike = async (post) => {
    const targetClubId = post?.clubId || activeClubId;
    if (!targetClubId || !user?.uid || post?.fromEvent) return;
    try {
      await togglePostLike(targetClubId, post.id, user.uid);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (post, text) => {
    const targetClubId = post?.clubId || activeClubId;
    if (!targetClubId || !user?.uid || post?.fromEvent) return;
    const name = profile?.displayName || profile?.email || "User";
    try {
      await addPostComment(targetClubId, post.id, user.uid, name, text);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteComment = async (post, comment) => {
    const targetClubId = post?.clubId || activeClubId;
    if (!targetClubId || post?.fromEvent) return;
    try {
      await deletePostComment(targetClubId, post.id, comment);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClubSwitch = () => {
    if (allClubs.length <= 1) {
      Alert.alert("Switch Club", "You are only a member of one club.");
      return;
    }
    const buttons = allClubs.map((m) => ({
      text: m.clubName || m.clubId,
      onPress: () => switchClub(m.clubId),
    }));
    buttons.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Switch Club", "Select a club to view:", buttons);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const toMs = (ts) => {
    if (!ts) return 0;
    if (typeof ts.toMillis === "function") return ts.toMillis();
    if (typeof ts.seconds === "number") return ts.seconds * 1000;
    const d = ts instanceof Date ? ts : new Date(ts);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const isNetworkVisibility = (value) => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();
    return normalized === "public" || normalized === "network";
  };

  const networkPublicPosts = (networkPosts || []).filter((post) =>
    isNetworkVisibility(post?.visibility),
  );

  const networkEventFeedItems = (networkEvents || []).map((event) => ({
    id: `network-event-${event.clubId || "club"}-${event.id}`,
    sourceId: event.id,
    sourceType: "event",
    fromEvent: true,
    clubId: event.clubId || "",
    clubName: event.clubName || "Club",
    authorName: event.clubName || "Club",
    content:
      [event.title, event.description].filter(Boolean).join("\n") ||
      "Public event update",
    visibility: "Public",
    type: "event",
    category: "Events",
    createdAt: event.createdAt || event.updatedAt || new Date(),
    updatedAt: event.updatedAt || null,
    isPinned: false,
    date: event.date || "",
    startTime: event.startTime || "",
    location: event.location || "",
  }));

  const eventFeedItems = (events || [])
    .filter((event) => {
      const type = (event.type || "").toLowerCase();
      return type !== "game" && type !== "match";
    })
    .map((event) => ({
      id: `event-feed-${event.id}`,
      sourceId: event.id,
      fromEvent: true,
      clubId: activeClubId,
      authorName: event.createdByName || activeClub?.name || "Club Event",
      content:
        event.description ||
        [event.location, event.date, event.startTime]
          .filter(Boolean)
          .join(" • ") ||
        "Club event update",
      visibility: "Club-Only",
      type: "event",
      category: "Events",
      createdAt: event.createdAt || event.updatedAt || new Date(),
      isPinned: false,
      teamId:
        event.teamId ||
        event.assignedGroupId ||
        (Array.isArray(event.assignedGroupIds)
          ? event.assignedGroupIds[0]
          : ""),
    }));

  const matchFeedItems = (events || [])
    .filter((event) => {
      const type = (event.type || "").toLowerCase();
      return type === "game" || type === "match";
    })
    .map((event) => ({
      id: `match-feed-${event.id}`,
      sourceId: event.id,
      fromEvent: true,
      clubId: activeClubId,
      authorName: event.createdByName || activeClub?.name || "Club Match",
      content: event.description || "Match fixture",
      visibility: "Club-Only",
      type: "match",
      category: "Matches",
      createdAt: event.createdAt || event.updatedAt || new Date(),
      isPinned: false,
      teamId:
        event.teamId ||
        event.assignedGroupId ||
        (Array.isArray(event.assignedGroupIds)
          ? event.assignedGroupIds[0]
          : ""),
      teamName: event.teamName || "Team",
      opponent: event.opponent || "",
      ourScore: event.ourScore,
      opponentScore: event.opponentScore,
      status: event.status || "scheduled",
      date: event.date || "",
      startTime: event.startTime || "",
      location: event.location || "",
    }));

  const mergeNetworkFeed = (...lists) => {
    const byKey = new Map();
    lists
      .flat()
      .filter(Boolean)
      .forEach((post) => {
        const key = `${post.clubId || activeClubId || "club"}:${post.id}`;
        if (!byKey.has(key)) {
          byKey.set(key, post);
        }
      });

    return Array.from(byKey.values()).sort(
      (a, b) => toMs(b.createdAt) - toMs(a.createdAt),
    );
  };

  const sourcePosts =
    activeTab === "All Posts"
      ? mergeNetworkFeed(
          posts,
          matchFeedItems,
          eventFeedItems,
          networkPublicPosts,
          networkEventFeedItems,
        )
      : activeTab === "Network"
        ? mergeNetworkFeed(networkPublicPosts, networkEventFeedItems)
        : activeTab === "Matches"
          ? matchFeedItems
          : activeTab === "Events"
            ? [...posts, ...eventFeedItems]
            : posts;

  const renderMatchDetails = (post) => {
    if ((post?.type || "").toLowerCase() !== "match") return null;

    const hasScore =
      typeof post.ourScore === "number" &&
      typeof post.opponentScore === "number";
    const normalizedStatus = String(post.status || "scheduled")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");

    const statusLabel =
      normalizedStatus === "completed"
        ? "COMPLETED"
        : normalizedStatus === "inprogress" || normalizedStatus === "live"
          ? "LIVE"
          : normalizedStatus === "postponed"
            ? "POSTPONED"
            : normalizedStatus === "cancelled"
              ? "CANCELLED"
              : "SCHEDULED";

    const statusVariantStyle =
      statusLabel === "COMPLETED"
        ? styles.matchStatusBadgeCompleted
        : statusLabel === "LIVE"
          ? styles.matchStatusBadgeLive
          : statusLabel === "POSTPONED" || statusLabel === "CANCELLED"
            ? styles.matchStatusBadgeMuted
            : styles.matchStatusBadgeScheduled;

    const statusTextStyle =
      statusLabel === "COMPLETED"
        ? styles.matchStatusTextCompleted
        : statusLabel === "LIVE"
          ? styles.matchStatusTextLive
          : statusLabel === "POSTPONED" || statusLabel === "CANCELLED"
            ? styles.matchStatusTextMuted
            : styles.matchStatusTextScheduled;

    const outcomeLabel =
      hasScore && post.ourScore !== post.opponentScore
        ? post.ourScore > post.opponentScore
          ? "Win"
          : "Loss"
        : hasScore
          ? "Draw"
          : "Score pending";

    return (
      <View style={styles.matchDetailsCard}>
        <View style={styles.matchDetailsHeaderRow}>
          <Text variant="small" weight="700" style={styles.matchDetailsTitle}>
            Match details
          </Text>
          <View style={[styles.matchStatusBadge, statusVariantStyle]}>
            <Text variant="small" weight="700" style={statusTextStyle}>
              {statusLabel}
            </Text>
          </View>
        </View>
        <Text variant="small" weight="600" style={styles.matchFixtureText}>
          {(post.teamName || "Team").trim()} vs{" "}
          {(post.opponent || "Opponent").trim()}
        </Text>
        <Text variant="small" color={theme.colors.textSecondary}>
          {[post.date, post.startTime, post.location]
            .filter(Boolean)
            .join(" • ") || "Date and venue TBC"}
        </Text>
        <View style={styles.matchMetaRow}>
          {hasScore ? (
            <Text variant="small" weight="700" style={styles.matchScoreText}>
              Score {post.ourScore} - {post.opponentScore}
            </Text>
          ) : (
            <Text variant="small" color={theme.colors.textSecondary}>
              Score pending
            </Text>
          )}
          <Text
            variant="small"
            weight="700"
            color={
              outcomeLabel === "Win"
                ? theme.colors.primary
                : outcomeLabel === "Loss"
                  ? theme.colors.error
                  : theme.colors.textSecondary
            }
          >
            {outcomeLabel}
          </Text>
        </View>
        <View style={styles.matchExtraInfoRow}>
          <Text variant="small" color={theme.colors.textSecondary}>
            Kick-off:{" "}
            {[post.date, post.startTime].filter(Boolean).join(" • ") || "TBD"}
          </Text>
        </View>
        <View style={styles.matchExtraInfoRow}>
          <Text variant="small" color={theme.colors.textSecondary}>
            Venue: {post.location || "TBD"}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.matchDetailsLinkBtn}
          onPress={() =>
            navigation.navigate("MatchDetails", {
              match: {
                id: post.sourceId || post.id,
                teamId: post.teamId || "",
                teamName: post.teamName || "Team",
                opponent: post.opponent || "Opponent",
                date: post.date || "",
                startTime: post.startTime || "",
                location: post.location || "",
                status: post.status || "scheduled",
                ourScore: post.ourScore,
                opponentScore: post.opponentScore,
                description: post.content || "",
              },
            })
          }
        >
          <Text variant="small" weight="700" color={theme.colors.primary}>
            Open full match details
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const isMatchPost = (post) => {
    const t = String(post?.type || "").toLowerCase();
    const c = String(post?.category || "").toLowerCase();
    return t === "match" || t === "game" || c === "matches";
  };

  const isUpdatePost = (post) => {
    const t = String(post?.type || "").toLowerCase();
    const c = String(post?.category || "").toLowerCase();
    return t === "update" || c === "updates";
  };

  const getLinkedTarget = (post) => {
    if (!post || !isUpdatePost(post)) return null;
    const teamId = String(post.teamId || "").trim();
    const groupId = String(post.groupId || post.assignedGroupId || "").trim();
    if (teamId) {
      const team = (teams || []).find(
        (row) => String(row?.id || "") === teamId,
      );
      return {
        type: "team",
        id: teamId,
        name: team?.name || "Team",
      };
    }
    if (groupId) {
      const group = (groups || []).find((row) => {
        const id = String(row?.id || "").trim();
        const gid = String(row?.groupId || "").trim();
        return id === groupId || gid === groupId;
      });
      return {
        type: "group",
        id: group?.groupId || group?.id || groupId,
        name: group?.groupName || group?.name || "Group",
        group,
      };
    }
    return null;
  };

  const openLinkedTarget = (target) => {
    if (!target) return;
    if (target.type === "team") {
      navigation.navigate("TeamFeed", {
        teamId: target.id,
        teamName: target.name,
        initialTab: "Updates",
      });
      return;
    }
    navigation.navigate("GroupDetails", {
      groupId: target.id,
      group: target.group || null,
    });
  };

  const openMatchDetailsFromPost = (post) => {
    if (!isMatchPost(post)) return;

    navigation.navigate("MatchDetails", {
      match: {
        id: post.sourceId || post.id,
        teamId: post.teamId || "",
        teamName: post.teamName || "Team",
        opponent: post.opponent || "Opponent",
        date: post.date || "",
        startTime: post.startTime || "",
        location: post.location || "",
        status: post.status || "scheduled",
        ourScore: post.ourScore,
        opponentScore: post.opponentScore,
        description: post.content || "",
      },
    });
  };

  const isTabLoading =
    activeTab === "Network"
      ? loadingNetwork
      : activeTab === "Matches" || activeTab === "Events"
        ? loadingEvents
        : loadingPosts;

  // Filter posts by tab
  const filteredPosts = sourcePosts
    .filter((post) => {
      if (activeTab === "All Posts") return true;
      if (activeTab === "Network") return true;
      if (activeTab === "Matches") {
        const t = (post.type || "").toLowerCase();
        return t === "match" || t === "game";
      }
      if (activeTab === "Updates") {
        const t = (post.type || "").toLowerCase();
        const c = (post.category || "").toLowerCase();
        return t === "update" || c === "updates";
      }
      if (activeTab === "Events") {
        const t = (post.type || "").toLowerCase();
        const c = (post.category || "").toLowerCase();
        return t === "event" || c === "events";
      }
      return false;
    })
    .sort((a, b) => {
      if (activeTab === "Network" || activeTab === "All Posts") {
        return toMs(b.createdAt) - toMs(a.createdAt);
      }
      const pinA = a.isPinned ? 1 : 0;
      const pinB = b.isPinned ? 1 : 0;
      if (pinA !== pinB) return pinB - pinA;
      return toMs(b.createdAt) - toMs(a.createdAt);
    });

  const getPostCategoryLabel = (post) => {
    if (post?.category) return post.category;
    const t = (post?.type || "").toLowerCase();
    if (t === "match") return "Matches";
    if (t === "event") return "Events";
    if (t === "network") return "Network";
    return "Updates";
  };

  const linkedTargets = useMemo(() => {
    const query = linkSearchQuery.trim().toLowerCase();
    const teamRows = (teams || []).map((team) => ({
      id: team.id,
      type: "team",
      name: team.name || "Team",
    }));
    const groupRows = (groups || []).map((group) => ({
      id: group.id || group.groupId,
      type: "group",
      name: group.groupName || group.name || "Group",
    }));
    const combined = [...teamRows, ...groupRows].filter((row) => row.id);
    if (!query) return combined;
    return combined.filter((row) => row.name.toLowerCase().includes(query));
  }, [teams, groups, linkSearchQuery]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.clubSelector}
          onPress={handleClubSwitch}
        >
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
          <View style={styles.clubInfo}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text variant="h4">{activeClub?.name || "Select Club"}</Text>
              <ChevronDown
                color={theme.colors.text}
                size={16}
                style={{ marginLeft: 4 }}
              />
            </View>
            <Text variant="small">
              {activeClub?.location || "No club selected"}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <LottieAnimation
            source={{
              uri: "https://assets1.lottiefiles.com/packages/lf20_m6cuL6.json",
            }}
            autoPlay
            loop
            style={{ width: 40, height: 40, marginRight: 8 }}
          />
          <TouchableOpacity
            style={styles.bellIcon}
            onPress={() => navigation.navigate("Notifications")}
          >
            <Bell color={theme.colors.text} size={24} />
            <View style={styles.badge} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
        scrollEventThrottle={16}
        onScroll={handleTabBarScroll}
      >
        {/* View Toggle (Only for Admins) */}
        {isAdmin && (
          <View style={styles.viewToggleContainer}>
            <SegmentedControl
              options={["Admin View", "Member View"]}
              selectedIndex={viewMode}
              onChange={setViewMode}
            />
          </View>
        )}

        {/* Category Slider */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsContainer}
        >
          {feedTabs.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                variant="body"
                color={
                  activeTab === tab
                    ? theme.colors.primary
                    : theme.colors.textSecondary
                }
                weight={activeTab === tab ? "600" : "500"}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Content */}
        <View style={styles.content}>
          <Card style={styles.clubCategoriesCard}>
            <Text variant="h4" style={{ marginBottom: theme.spacing.sm }}>
              Club Information
            </Text>
            <View style={styles.clubCategoriesGrid}>
              {homeClubCategories.map((category) => {
                const IconComponent = category.icon;

                return (
                  <TouchableOpacity
                    key={category.key}
                    style={styles.clubCategoryButton}
                    onPress={() => navigation.navigate(category.target)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${category.title}`}
                  >
                    <IconComponent color={theme.colors.primary} size={18} />
                    <Text variant="small" weight="600" style={{ marginTop: 6 }}>
                      {category.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          {/* Create Post (Available for communication-capable roles) */}
          {canManagePosts && (
            <Card style={styles.createPostCard}>
              <View style={styles.createPostHeader}>
                <Text variant="h4">Create Announcement</Text>
                <Text variant="small" color={theme.colors.primary}>
                  {userRole}
                </Text>
              </View>

              <View style={styles.categoryPickerWrap}>
                <Text variant="small" weight="600" style={styles.categoryLabel}>
                  Category
                </Text>
                <SegmentedControl
                  options={announcementCategories}
                  selectedIndex={announcementCategories.indexOf(postCategory)}
                  onChange={(index) =>
                    setPostCategory(announcementCategories[index])
                  }
                />
              </View>

              <View style={styles.createPostInput}>
                <Avatar
                  source={{
                    uri: "https://images.unsplash.com/photo-1518605368461-1e1e11af485d?q=80&w=150&auto=format&fit=crop",
                  }}
                  size={40}
                />
                <TextInput
                  placeholder="Share news, schedules, or updates..."
                  style={styles.textInput}
                  multiline
                  value={createPostText}
                  onChangeText={setCreatePostText}
                />
              </View>
              <View style={styles.createPostActions}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TouchableOpacity
                    style={[
                      styles.iconButton,
                      { flexDirection: "row", alignItems: "center" },
                    ]}
                    onPress={pickPostImage}
                  >
                    <ImageIcon color={theme.colors.primary} size={16} />
                    <Text
                      variant="small"
                      color={theme.colors.primary}
                      weight="600"
                      style={{ marginLeft: 6 }}
                    >
                      {postImageUri ? "Image Selected" : "Add Image"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.iconButton,
                      { flexDirection: "row", alignItems: "center" },
                    ]}
                    onPress={() => {
                      const currentIdx =
                        postVisibilityOptions.indexOf(postVisibility);
                      const nextIdx =
                        (currentIdx + 1) % postVisibilityOptions.length;
                      setPostVisibility(postVisibilityOptions[nextIdx]);
                    }}
                  >
                    <Text
                      variant="small"
                      color={theme.colors.primary}
                      weight="600"
                    >
                      {postCategory === "Network" ? "Network" : postVisibility}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Button
                  title={posting ? "Posting..." : "Post"}
                  size="small"
                  onPress={handleCreatePost}
                  disabled={posting}
                />
              </View>
              <View style={{ marginTop: theme.spacing.sm }}>
                <Text variant="small" weight="600" style={styles.categoryLabel}>
                  Link to Team/Group (Optional)
                </Text>
                <View style={styles.linkSearchBar}>
                  <Search color={theme.colors.textSecondary} size={16} />
                  <TextInput
                    placeholder="Search teams or groups..."
                    style={styles.linkSearchInput}
                    value={linkSearchQuery}
                    onChangeText={setLinkSearchQuery}
                  />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: theme.spacing.sm }}
                >
                  <TouchableOpacity
                    style={[
                      styles.linkChip,
                      !selectedLinkId && styles.linkChipActive,
                    ]}
                    onPress={() => setSelectedLinkId("")}
                  >
                    <Text
                      variant="small"
                      color={
                        !selectedLinkId
                          ? theme.colors.white
                          : theme.colors.text
                      }
                    >
                      None
                    </Text>
                  </TouchableOpacity>
                  {linkedTargets.map((item) => {
                    const active = selectedLinkId === item.id;
                    return (
                      <TouchableOpacity
                        key={`${item.type}-${item.id}`}
                        style={[
                          styles.linkChip,
                          active && styles.linkChipActive,
                        ]}
                        onPress={() => setSelectedLinkId(item.id)}
                      >
                        <Text
                          variant="small"
                          color={
                            active ? theme.colors.white : theme.colors.text
                          }
                        >
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              {postImageUri ? (
                <View style={styles.selectedImageWrap}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() =>
                      setSelectedPostImage({
                        uri: postImageUri,
                        postId: "draft-post-image",
                      })
                    }
                  >
                    <Image
                      source={{ uri: postImageUri }}
                      style={styles.selectedImagePreview}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setPostImageUri("")}>
                    <Text
                      variant="small"
                      color={theme.colors.error}
                      weight="600"
                    >
                      Remove
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </Card>
          )}

          {isTabLoading ? (
            <ActivityIndicator
              size="large"
              color={theme.colors.primary}
              style={{ marginTop: theme.spacing.xl }}
            />
          ) : activeTab === "Network" &&
            filteredPosts.length === 0 &&
            networkClubs.length > 0 ? (
            <>
              <Text
                variant="small"
                color={theme.colors.textSecondary}
                style={{ marginBottom: theme.spacing.sm }}
              >
                Discover Clubs
              </Text>
              {networkClubs.map((club) => (
                <Card key={club.id} style={styles.networkClubCard}>
                  <View style={styles.networkClubHeader}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flex: 1,
                      }}
                    >
                      <Avatar
                        source={
                          club.logoUrl
                            ? { uri: club.logoUrl }
                            : {
                                uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(club.name || "Club")}&background=108B51&color=fff&size=150`,
                              }
                        }
                        size={40}
                        isClub
                      />
                      <View style={{ marginLeft: theme.spacing.sm, flex: 1 }}>
                        <Text variant="h4">{club.name || "Club"}</Text>
                        <Text
                          variant="small"
                          color={theme.colors.textSecondary}
                        >
                          {club.location || "Location not set"}
                        </Text>
                      </View>
                    </View>
                    <Button
                      title="View"
                      size="small"
                      variant="outline"
                      onPress={() =>
                        navigation.navigate("PublicClubPage", {
                          clubId: club.id,
                        })
                      }
                    />
                  </View>
                </Card>
              ))}
            </>
          ) : filteredPosts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text
                variant="body"
                color={theme.colors.textSecondary}
                style={{ textAlign: "center", marginTop: theme.spacing.xl }}
              >
                {activeTab === "Network"
                  ? "No network content yet. Follow clubs to see their public updates and upcoming public events."
                  : `No posts yet. ${canManagePosts ? "Create one!" : "Check back later!"}`}
              </Text>
            </View>
          ) : (
            filteredPosts.map((post) => (
              <TouchableOpacity
                key={post.id}
                activeOpacity={isMatchPost(post) ? 0.92 : 1}
                onPress={() => openMatchDetailsFromPost(post)}
                disabled={!isMatchPost(post)}
              >
                <Card style={{ marginBottom: theme.spacing.md }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: theme.spacing.sm,
                    }}
                  >
                    <Text variant="body" weight="600">
                      {post.authorName || "Unknown"}
                    </Text>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      {post.isPinned && (
                        <View style={styles.pinnedBadge}>
                          <Text variant="small" style={styles.pinnedBadgeText}>
                            PINNED
                          </Text>
                        </View>
                      )}
                      <View
                        style={[
                          styles.categoryBadge,
                          getPostCategoryLabel(post) === "Matches"
                            ? { backgroundColor: "rgba(245, 158, 11, 0.12)" }
                            : getPostCategoryLabel(post) === "Events"
                              ? { backgroundColor: "rgba(59, 130, 246, 0.12)" }
                              : getPostCategoryLabel(post) === "Network"
                                ? {
                                    backgroundColor: "rgba(147, 51, 234, 0.12)",
                                  }
                                : {
                                    backgroundColor: "rgba(16, 139, 81, 0.12)",
                                  },
                        ]}
                      >
                        <Text
                          variant="small"
                          style={{ fontSize: 10, fontWeight: "600" }}
                          color={theme.colors.text}
                        >
                          {getPostCategoryLabel(post)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.visibilityBadge,
                          post.visibility === "Public"
                            ? { backgroundColor: "rgba(59, 130, 246, 0.1)" }
                            : post.visibility === "Team-Only"
                              ? { backgroundColor: "rgba(239, 68, 68, 0.1)" }
                              : { backgroundColor: "rgba(16, 139, 81, 0.1)" },
                        ]}
                      >
                        <Text
                          variant="small"
                          style={{ fontSize: 10, fontWeight: "600" }}
                          color={
                            post.visibility === "Public"
                              ? "#3B82F6"
                              : post.visibility === "Team-Only"
                                ? theme.colors.error
                                : theme.colors.primary
                          }
                        >
                          {post.visibility}
                        </Text>
                      </View>
                      {canManagePosts &&
                        post.clubId === activeClubId &&
                        (!post.fromEvent || activeTab === "Matches") && (
                          <TouchableOpacity
                            onPress={() => handleDeletePost(post)}
                            style={styles.deletePostBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Delete post"
                          >
                            <Trash2 color={theme.colors.error} size={16} />
                          </TouchableOpacity>
                        )}
                      {canManageAllPosts &&
                        post.clubId === activeClubId &&
                        (!post.fromEvent || activeTab === "Matches") && (
                          <TouchableOpacity
                            onPress={() =>
                              post.fromEvent && activeTab === "Matches"
                                ? navigation.navigate("Matches")
                                : handleStartEditPost(post)
                            }
                            style={styles.managePostBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Edit post"
                          >
                            <Pencil color={theme.colors.primary} size={16} />
                          </TouchableOpacity>
                        )}
                      {canManageAllPosts &&
                        !post.fromEvent &&
                        post.clubId === activeClubId && (
                          <TouchableOpacity
                            onPress={() => handleTogglePinPost(post)}
                            style={styles.managePostBtn}
                            accessibilityRole="button"
                            accessibilityLabel={
                              post.isPinned ? "Unpin post" : "Pin post"
                            }
                          >
                            {post.isPinned ? (
                              <PinOff color={theme.colors.primary} size={16} />
                            ) : (
                              <Pin color={theme.colors.primary} size={16} />
                            )}
                          </TouchableOpacity>
                        )}
                    </View>
                  </View>
                  {editingPostId === post.id ? (
                    <>
                      <TextInput
                        style={styles.editPostInput}
                        value={editingContent}
                        onChangeText={setEditingContent}
                        multiline
                      />
                      <View style={styles.editPostActions}>
                        <TouchableOpacity
                          onPress={() => handleCancelEditPost()}
                          style={styles.editPostActionBtn}
                        >
                          <X color={theme.colors.textSecondary} size={16} />
                          <Text variant="small" style={{ marginLeft: 4 }}>
                            Cancel
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleSaveEditPost(post.id)}
                          style={styles.editPostActionBtn}
                        >
                          <CheckCircle2
                            color={theme.colors.primary}
                            size={16}
                          />
                          <Text
                            variant="small"
                            color={theme.colors.primary}
                            style={{ marginLeft: 4 }}
                          >
                            Save
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <Text variant="body" style={{ lineHeight: 22 }}>
                      {post.content}
                    </Text>
                  )}
                  {(() => {
                    const linked = getLinkedTarget(post);
                    if (!linked) return null;
                    return (
                      <TouchableOpacity
                        style={styles.linkedInfoRow}
                        onPress={() => openLinkedTarget(linked)}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${linked.type} details`}
                      >
                        <Text
                          variant="small"
                          weight="600"
                          color={theme.colors.primary}
                        >
                          {linked.type === "team" ? "Team" : "Group"}:{" "}
                          {linked.name}
                        </Text>
                        <Text
                          variant="small"
                          weight="600"
                          color={theme.colors.primary}
                        >
                          Open
                        </Text>
                      </TouchableOpacity>
                    );
                  })()}
                  {renderMatchDetails(post)}
                  {activeTab === "Network" && post.clubName ? (
                    <Text
                      variant="small"
                      color={theme.colors.textSecondary}
                      style={{ marginTop: theme.spacing.xs }}
                    >
                      Club: {post.clubName}
                    </Text>
                  ) : null}
                  {post.imageUrl ? (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() =>
                        setSelectedPostImage({
                          uri: post.imageUrl,
                          postId: post.id,
                        })
                      }
                    >
                      <Image
                        source={{ uri: post.imageUrl }}
                        style={{
                          width: "100%",
                          height: 200,
                          borderRadius: theme.radius.md,
                          marginTop: theme.spacing.sm,
                        }}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ) : null}
                  {post.imageUrl && post.imageOwnerName ? (
                    <Text
                      variant="small"
                      color={theme.colors.textSecondary}
                      style={{ marginTop: theme.spacing.xs }}
                    >
                      {`Image by ${post.imageOwnerName}`}
                    </Text>
                  ) : null}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: theme.spacing.md,
                      paddingTop: theme.spacing.sm,
                      borderTopWidth: 1,
                      borderTopColor: theme.colors.border,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => handleToggleLike(post)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginRight: theme.spacing.lg,
                      }}
                    >
                      <Heart
                        size={20}
                        color={
                          post.likedBy?.includes(user?.uid)
                            ? theme.colors.error
                            : theme.colors.textSecondary
                        }
                        fill={
                          post.likedBy?.includes(user?.uid)
                            ? theme.colors.error
                            : "none"
                        }
                      />
                      <Text
                        variant="small"
                        style={{ marginLeft: 6 }}
                        color={theme.colors.textSecondary}
                      >
                        {post.likedBy?.length || 0}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setActiveCommentPost(post)}
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <MessageSquare
                        size={20}
                        color={theme.colors.textSecondary}
                      />
                      <Text
                        variant="small"
                        style={{ marginLeft: 6 }}
                        color={theme.colors.textSecondary}
                      >
                        {post.comments?.length || 0}
                      </Text>
                    </TouchableOpacity>
                    <Text
                      variant="small"
                      color={theme.colors.textSecondary}
                      style={{ flex: 1, textAlign: "right" }}
                    >
                      {formatTime(post.createdAt)}
                    </Text>
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {activeCommentPost && (
        <CommentsModal
          visible={!!activeCommentPost}
          onClose={() => setActiveCommentPost(null)}
          post={
            sourcePosts.find((p) => p.id === activeCommentPost.id) ||
            activeCommentPost
          }
          currentUserId={user?.uid}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
          formatTime={formatTime}
        />
      )}

      <Modal
        visible={!!selectedPostImage}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSelectedPostImage(null)}
      >
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity
            activeOpacity={1}
            style={StyleSheet.absoluteFill}
            onPress={() => setSelectedPostImage(null)}
          />
          <TouchableOpacity
            style={styles.imageViewerCloseBtn}
            onPress={() => setSelectedPostImage(null)}
            accessibilityRole="button"
            accessibilityLabel="Close image preview"
          >
            <X color={theme.colors.white} size={22} />
          </TouchableOpacity>
          {selectedPostImage?.uri ? (
            <TouchableWithoutFeedback>
              <Image
                source={{ uri: selectedPostImage.uri }}
                style={styles.imageViewerImage}
                resizeMode="contain"
              />
            </TouchableWithoutFeedback>
          ) : null}
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
  clubSelector: {
    flexDirection: "row",
    alignItems: "center",
  },
  clubInfo: {
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
  viewToggleContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabsContainer: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tab: {
    paddingVertical: theme.spacing.md,
    marginRight: theme.spacing.xl,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: theme.colors.primary,
  },
  content: {
    padding: theme.spacing.md,
  },
  networkClubCard: {
    marginBottom: theme.spacing.sm,
  },
  networkClubHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  createPostCard: {
    marginBottom: theme.spacing.md,
  },
  clubCategoriesCard: {
    marginBottom: theme.spacing.md,
  },
  clubCategoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  clubCategoryButton: {
    width: "48%",
    marginHorizontal: "1%",
    marginBottom: 8,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  createPostHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  categoryPickerWrap: {
    marginBottom: theme.spacing.md,
  },
  categoryLabel: {
    marginBottom: 6,
    color: theme.colors.textSecondary,
  },
  createPostInput: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: theme.spacing.md,
  },
  textInput: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontSize: 16,
    color: theme.colors.text,
    minHeight: 40,
  },
  createPostActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
  },
  selectedImageWrap: {
    marginTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedImagePreview: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.sm,
  },
  iconButton: {
    padding: theme.spacing.xs,
    marginRight: theme.spacing.sm,
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
  },
  linkSearchInput: {
    flex: 1,
    marginLeft: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.text,
    paddingVertical: 0,
  },
  linkChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    marginRight: theme.spacing.sm,
  },
  linkChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  eventCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing.md,
  },
  matchBanner: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  matchTeams: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
  },
  teamBadge: {
    alignItems: "center",
  },
  matchDetails: {
    flexDirection: "row",
    justifyContent: "center",
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: theme.spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.xs,
  },
  visibilityBadge: {
    marginLeft: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  pinnedBadge: {
    marginLeft: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    backgroundColor: "rgba(16, 139, 81, 0.18)",
  },
  pinnedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  deletePostBtn: {
    marginLeft: 8,
    padding: 4,
  },
  managePostBtn: {
    marginLeft: 8,
    padding: 4,
  },
  editPostInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    fontSize: 15,
    color: theme.colors.text,
    minHeight: 70,
    marginTop: theme.spacing.xs,
  },
  editPostActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: theme.spacing.sm,
  },
  editPostActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: theme.spacing.md,
  },
  matchDetailsCard: {
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.sm,
  },
  matchDetailsTitle: {
    marginBottom: 4,
  },
  matchDetailsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  matchFixtureText: {
    marginBottom: 2,
    color: theme.colors.text,
  },
  matchMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  matchExtraInfoRow: {
    marginTop: 6,
  },
  matchDetailsLinkBtn: {
    marginTop: theme.spacing.sm,
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  linkedInfoRow: {
    marginTop: theme.spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  matchStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  matchStatusBadgeScheduled: {
    backgroundColor: "rgba(16,139,81,0.12)",
  },
  matchStatusBadgeCompleted: {
    backgroundColor: "rgba(16,139,81,0.18)",
  },
  matchStatusBadgeLive: {
    backgroundColor: "rgba(245, 158, 11, 0.20)",
  },
  matchStatusBadgeMuted: {
    backgroundColor: "rgba(142, 142, 147, 0.2)",
  },
  matchStatusTextScheduled: {
    color: theme.colors.primary,
  },
  matchStatusTextCompleted: {
    color: theme.colors.primary,
  },
  matchStatusTextLive: {
    color: "#B45309",
  },
  matchStatusTextMuted: {
    color: theme.colors.textSecondary,
  },
  matchScoreText: {
    color: theme.colors.text,
  },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
  },
  imageViewerCloseBtn: {
    position: "absolute",
    top: 52,
    right: 22,
    zIndex: 2,
    padding: 8,
  },
  imageViewerImage: {
    width: "100%",
    height: "74%",
    borderRadius: theme.radius.md,
  },
});
