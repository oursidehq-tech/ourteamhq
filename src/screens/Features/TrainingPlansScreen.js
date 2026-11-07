import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock,
  Edit2,
  FileText,
  Plus,
  Search,
  Target,
  Trash2,
  Users,
  X,
  Zap,
  Play,
  PlayCircle,
  CalendarDays,
  Lock,
  ArrowUp,
  ArrowDown,
  Tag,
  Timer,
  Layers,
  Copy,
} from "lucide-react-native";
import { Text } from "../../components/ui/Typography";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";
import { useClub } from "../../contexts/ClubContext";
import { theme } from "../../theme/theme";
import { subscribeToTeams } from "../../services/teamService";
import {
  subscribeToDrills,
  subscribeToTrainingPlans,
  createTrainingPlan,
  updateTrainingPlan,
  deleteTrainingPlan,
  subscribeToTrainingSessions,
  createTrainingSession,
  deleteTrainingSession,
} from "../../services/clubOperationsService";

// ─── Design Tokens (Section 10) ───────────────────────────────────────────────
const DESIGN_TOKENS = {
  primaryTeal: "#0D9488",
  successGreen: "#10B981",
  warningOrange: "#F59E0B",
  sessionBlue: "#3B82F6",
};

// ─── Sections ─────────────────────────────────────────────────────────────────
const SECTIONS = [
  { key: "warmup", label: "Warm-up", color: "#F59E0B" },
  { key: "skill", label: "Skill Focus", color: "#3B82F6" },
  { key: "game", label: "Game / Activity", color: "#10B981" },
  { key: "cooldown", label: "Cool-down", color: "#8B5CF6" },
];

const SECTION_COLORS = {
  warmup: "#F59E0B",
  skill: "#3B82F6",
  game: "#10B981",
  cooldown: "#8B5CF6",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const getYoutubeId = (url) => {
  if (!url) return null;
  const m = String(url).match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return m && m[2].length === 11 ? m[2] : null;
};

const getThumbnailUri = (drill) => {
  if (!drill) return null;
  const ytId = getYoutubeId(drill.youtubeUrl || drill.videoUrl);
  if (ytId) return `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
  if (Array.isArray(drill.imageUrls) && drill.imageUrls[0]) return drill.imageUrls[0];
  if (drill.imageUrl) return drill.imageUrl;
  return null;
};

const parseDurationToMins = (str) => {
  if (!str) return 0;
  if (typeof str === "number") return str;
  const clean = String(str).trim();
  if (clean.includes(":")) {
    const [m, s] = clean.split(":").map(Number);
    return (m || 0) + Math.round((s || 0) / 60);
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

const openVideo = (url) => {
  if (!url) return;
  Linking.openURL(url).catch(() => {
    Alert.alert("Error", "Could not open video URL.");
  });
};

// ─── Section Pill ─────────────────────────────────────────────────────────────
function SectionPill({ sectionKey, onSelect, selected }) {
  const s = SECTIONS.find((sec) => sec.key === sectionKey);
  const color = SECTION_COLORS[sectionKey] || DESIGN_TOKENS.sessionBlue;
  return (
    <TouchableOpacity
      style={[
        styles.sectionPill,
        {
          borderColor: color,
          backgroundColor: selected ? color : "#FFF",
        },
      ]}
      onPress={() => onSelect(sectionKey)}
    >
      <Text variant="small" weight="700" color={selected ? "#FFF" : color}>
        {s?.label || sectionKey}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen Component ────────────────────────────────────────────────────
export default function TrainingPlansScreen({ navigation, route }) {
  const { user, profile } = useAuth();
  const { activeClubId, userRole, isClubLeader, isClubStaff, userGroupIds } = useClub();

  const normalizedRole = String(userRole || "").trim().toLowerCase();
  const isAdmin = normalizedRole === "owner" || normalizedRole === "admin";
  const canManagePlans =
    isClubLeader ||
    isClubStaff ||
    ["owner", "admin", "coach", "manager"].includes(normalizedRole);

  // Tabs: Coaches get Sessions / Plans / Plan Builder; Players get Sessions / Plans
  const TABS = canManagePlans ? ["Sessions", "Plans", "Plan Builder"] : ["Sessions", "Plans"];

  // ── Data State ──────────────────────────────────────────────────────────────
  const [drills, setDrills] = useState([]);
  const [trainingPlans, setTrainingPlans] = useState([]);
  const [trainingSessions, setTrainingSessions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Navigation & Filter State ───────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(route?.params?.initialTab || 0);
  const [planFilter, setPlanFilter] = useState("all"); // 'all' | 'active' | 'templates' | 'draft'
  const [planSearchQuery, setPlanSearchQuery] = useState("");
  const [expandedPlanId, setExpandedPlanId] = useState(null);

  // ── Modals State ────────────────────────────────────────────────────────────
  const [viewingSession, setViewingSession] = useState(null); // Full session detail modal
  const [scheduleModalPlan, setScheduleModalPlan] = useState(null); // Plan to schedule
  const [scheduleTeamId, setScheduleTeamId] = useState("");
  const [scheduleDate, setScheduleDate] = useState(""); // YYYY-MM-DD
  const [scheduleTime, setScheduleTime] = useState("18:00");
  const [scheduleLocation, setScheduleLocation] = useState("");
  const [scheduleLocked, setScheduleLocked] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  // ── Plan Builder Form State ─────────────────────────────────────────────────
  const [editingPlan, setEditingPlan] = useState(null);
  const [planTitle, setPlanTitle] = useState("");
  const [planTeamId, setPlanTeamId] = useState("");
  const [planObjective, setPlanObjective] = useState("");
  const [planStatus, setPlanStatus] = useState("active");
  const [isTemplate, setIsTemplate] = useState(false);
  const [builderItems, setBuilderItems] = useState([]); // { drillId, sortOrder, section, durationOverride, notes }
  const [builderDrillSearch, setBuilderDrillSearch] = useState("");
  const [builderCategory, setBuilderCategory] = useState("all");
  const [saving, setSaving] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);

  // ── Subscriptions ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeClubId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const unsubDrills = subscribeToDrills(
      activeClubId,
      (data) => {
        setDrills(data || []);
        setLoading(false);
      },
      { userGroupIds, userId: user?.uid || "", isAdmin }
    );

    const unsubPlans = subscribeToTrainingPlans(
      activeClubId,
      (data) => setTrainingPlans(data || []),
      { userGroupIds, userId: user?.uid || "", isAdmin }
    );

    const unsubSessions = subscribeToTrainingSessions(
      activeClubId,
      (data) => setTrainingSessions(data || []),
      { userGroupIds, userId: user?.uid || "", isAdmin }
    );

    const unsubTeams = subscribeToTeams(activeClubId, (data) =>
      setTeams(data || [])
    );

    return () => {
      unsubDrills?.();
      unsubPlans?.();
      unsubSessions?.();
      unsubTeams?.();
    };
  }, [activeClubId, user?.uid, userGroupIds, isAdmin]);

  // Handle incoming route params (e.g. from DrillsScreen "Add to Plan")
  useEffect(() => {
    if (route?.params?.selectedDrillIds && Array.isArray(route.params.selectedDrillIds)) {
      const incomingIds = route.params.selectedDrillIds;
      if (incomingIds.length > 0) {
        const newItems = incomingIds.map((id, index) => ({
          drillId: id,
          sortOrder: index,
          section: "skill",
          durationOverride: null,
          notes: "",
        }));
        setBuilderItems(newItems);
        if (canManagePlans) {
          setActiveTab(2); // Jump to Plan Builder tab
        }
      }
    }
    if (route?.params?.initialTab !== undefined) {
      setActiveTab(route.params.initialTab);
    }
  }, [route?.params]);

  // Drill Map
  const drillById = useMemo(() => {
    const map = new Map();
    (drills || []).forEach((d) => map.set(d.id, d));
    return map;
  }, [drills]);

  // Live total duration calculation in builder
  const liveTotalMins = useMemo(() => {
    return builderItems.reduce((sum, item) => {
      const drill = drillById.get(item.drillId);
      const override = item.durationOverride;
      const mins =
        override != null && override !== ""
          ? Number(override)
          : Number(drill?.durationMins || parseDurationToMins(drill?.duration) || 10);
      return sum + (isNaN(mins) ? 0 : mins);
    }, 0);
  }, [builderItems, drillById]);

  // Filtered Plans
  const filteredPlans = useMemo(() => {
    const q = planSearchQuery.toLowerCase().trim();
    return (trainingPlans || []).filter((p) => {
      const matchQ =
        !q ||
        p.title?.toLowerCase().includes(q) ||
        p.teamName?.toLowerCase().includes(q) ||
        p.objective?.toLowerCase().includes(q);
      if (!matchQ) return false;

      if (planFilter === "templates") return Boolean(p.isTemplate);
      if (planFilter === "active") return p.status === "active";
      if (planFilter === "draft") return p.status === "draft";
      return true;
    });
  }, [trainingPlans, planSearchQuery, planFilter]);

  // Filtered Drills in Builder Panel
  const filteredBuilderDrills = useMemo(() => {
    const q = builderDrillSearch.toLowerCase().trim();
    return (drills || []).filter((d) => {
      const matchQ =
        !q ||
        d.title?.toLowerCase().includes(q) ||
        d.category?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q);
      if (!matchQ) return false;
      if (builderCategory !== "all" && (d.category || "").toLowerCase() !== builderCategory.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [drills, builderDrillSearch, builderCategory]);

  const selectedTeam = useMemo(
    () => (teams || []).find((t) => t.id === planTeamId),
    [teams, planTeamId]
  );

  // ── Builder Actions ─────────────────────────────────────────────────────────
  const resetForm = () => {
    setEditingPlan(null);
    setPlanTitle("");
    setPlanTeamId("");
    setPlanObjective("");
    setPlanStatus("active");
    setIsTemplate(false);
    setBuilderItems([]);
    setBuilderDrillSearch("");
  };

  const populateFormFromPlan = (plan) => {
    setEditingPlan(plan);
    setPlanTitle(plan.title || "");
    setPlanTeamId(plan.teamId || "");
    setPlanObjective(plan.objective || plan.description || "");
    setPlanStatus(plan.status || "active");
    setIsTemplate(Boolean(plan.isTemplate));

    if (Array.isArray(plan.planItems) && plan.planItems.length > 0) {
      const sorted = [...plan.planItems].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      setBuilderItems(sorted);
    } else if (Array.isArray(plan.drillIds)) {
      setBuilderItems(
        plan.drillIds.map((drillId, idx) => ({
          drillId,
          sortOrder: idx,
          section: "skill",
          durationOverride: null,
          notes: "",
        }))
      );
    }
  };

  const handleEditPlan = (plan) => {
    populateFormFromPlan(plan);
    setActiveTab(canManagePlans ? 2 : 1);
  };

  const handleDeletePlan = (plan) => {
    Alert.alert(
      "Delete Plan",
      `Are you sure you want to delete "${plan.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTrainingPlan(activeClubId, plan.id);
            } catch {
              Alert.alert("Error", "Could not delete training plan.");
            }
          },
        },
      ]
    );
  };

  const toggleDrillInBuilder = (drillId) => {
    setBuilderItems((prev) => {
      const exists = prev.some((it) => it.drillId === drillId);
      if (exists) {
        return prev
          .filter((it) => it.drillId !== drillId)
          .map((it, idx) => ({ ...it, sortOrder: idx }));
      }
      return [
        ...prev,
        {
          drillId,
          sortOrder: prev.length,
          section: "skill",
          durationOverride: null,
          notes: "",
        },
      ];
    });
  };

  const moveBuilderItem = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= builderItems.length) return;
    const next = [...builderItems];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    setBuilderItems(next.map((item, idx) => ({ ...item, sortOrder: idx })));
  };

  const updateBuilderItem = (drillId, patch) => {
    setBuilderItems((prev) =>
      prev.map((it) => (it.drillId === drillId ? { ...it, ...patch } : it))
    );
  };

  const handleSavePlan = async (saveAsTemplate = false) => {
    if (!activeClubId) return;
    if (!planTitle.trim()) {
      Alert.alert("Missing Title", "Please enter a plan title.");
      return;
    }
    if (builderItems.length === 0) {
      Alert.alert("No Drills", "Please select at least one drill for this plan.");
      return;
    }

    const payload = {
      title: planTitle.trim(),
      teamId: planTeamId || "",
      teamName: selectedTeam?.name || "",
      objective: planObjective.trim(),
      description: planObjective.trim(),
      drillIds: builderItems.map((i) => i.drillId),
      planItems: builderItems.map((item, idx) => ({ ...item, sortOrder: idx })),
      durationMins: liveTotalMins,
      status: saveAsTemplate ? "active" : planStatus,
      isTemplate: saveAsTemplate || isTemplate,
    };

    setSaving(true);
    try {
      if (editingPlan?.id) {
        await updateTrainingPlan(activeClubId, editingPlan.id, payload);
        Alert.alert("Success", "Training plan updated successfully.");
      } else {
        await createTrainingPlan(activeClubId, {
          ...payload,
          createdBy: user?.uid || "",
          createdByName: profile?.displayName || profile?.email || "",
        });
        Alert.alert("Success", "Training plan created successfully.");
      }
      resetForm();
      setActiveTab(1); // Go to Plans tab
    } catch (err) {
      Alert.alert("Error", err?.message || "Could not save training plan.");
    } finally {
      setSaving(false);
    }
  };

  // ── Scheduling Actions ───────────────────────────────────────────────────────
  const openScheduleModal = (plan) => {
    setScheduleModalPlan(plan);
    setScheduleTeamId(plan?.teamId || "");
    const today = new Date().toISOString().slice(0, 10);
    setScheduleDate(today);
    setScheduleTime("18:00");
    setScheduleLocation("");
    setScheduleLocked(false);
  };

  const handleConfirmSchedule = async () => {
    if (!scheduleModalPlan) return;
    if (!scheduleDate) {
      Alert.alert("Date Required", "Please enter a session date (YYYY-MM-DD).");
      return;
    }

    setScheduling(true);
    try {
      const targetTeam = (teams || []).find((t) => t.id === scheduleTeamId);
      const scheduledAt = `${scheduleDate}T${scheduleTime || "18:00"}:00`;

      await createTrainingSession(activeClubId, {
        planId: scheduleModalPlan.id,
        planTitle: scheduleModalPlan.title,
        teamId: scheduleTeamId || "",
        teamName: targetTeam?.name || scheduleModalPlan.teamName || "Club Wide",
        scheduledAt,
        location: scheduleLocation || "Club Ground",
        locked: scheduleLocked,
        createdBy: user?.uid || "",
      });

      Alert.alert(
        "Session Scheduled",
        `Training session scheduled on ${scheduleDate}. Pushed to team calendar and notifications sent.`
      );
      setScheduleModalPlan(null);
      setActiveTab(0); // Switch to Sessions tab
    } catch (err) {
      Alert.alert("Error", err?.message || "Failed to schedule session.");
    } finally {
      setScheduling(false);
    }
  };

  const handleDeleteSession = (session) => {
    Alert.alert(
      "Cancel Session",
      `Cancel the training session scheduled for ${session.planTitle || "Team"}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Cancel Session",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTrainingSession(activeClubId, session.id);
            } catch {
              Alert.alert("Error", "Could not cancel session.");
            }
          },
        },
      ]
    );
  };

  // ── Tab 0: Scheduled Sessions (Player / Parent / Coach View) ────────────────
  const renderSessionsTab = () => {
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.tabBanner}>
          <CalendarDays size={20} color={DESIGN_TOKENS.sessionBlue} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text variant="body" weight="700">
              Team Training Sessions
            </Text>
            <Text variant="small" color={theme.colors.textSecondary}>
              Tap any session to view the complete drill plan and video demonstrations.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={DESIGN_TOKENS.primaryTeal} />
          </View>
        ) : trainingSessions.length === 0 ? (
          <View style={styles.emptyState}>
            <CalendarDays size={48} color={theme.colors.border} />
            <Text variant="h4" style={{ marginTop: 14 }}>
              No Scheduled Sessions
            </Text>
            <Text variant="small" style={{ marginTop: 6, textAlign: "center" }}>
              {canManagePlans
                ? "Schedule your first session using the Plans tab."
                : "Your coach has not scheduled any training sessions yet."}
            </Text>
            {canManagePlans && (
              <Button
                title="Go to Plans"
                style={{ marginTop: 18, backgroundColor: DESIGN_TOKENS.primaryTeal }}
                onPress={() => setActiveTab(1)}
              />
            )}
          </View>
        ) : (
          <FlatList
            data={trainingSessions}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 120 }}
            renderItem={({ item }) => {
              const plan = (trainingPlans || []).find((p) => p.id === item.planId);
              const dt = item.scheduledAt ? new Date(item.scheduledAt) : null;
              const formattedDate = dt
                ? dt.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })
                : "Scheduled Date";
              const formattedTime = dt
                ? dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "";

              return (
                <Card style={[styles.sessionCard, { borderLeftColor: DESIGN_TOKENS.sessionBlue }]}>
                  <TouchableOpacity
                    onPress={() => setViewingSession({ session: item, plan })}
                    activeOpacity={0.75}
                  >
                    <View style={styles.sessionHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", gap: 6, marginBottom: 4 }}>
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: "#DBEAFE", borderColor: DESIGN_TOKENS.sessionBlue },
                            ]}
                          >
                            <Text variant="small" weight="700" color={DESIGN_TOKENS.sessionBlue}>
                              SCHEDULED
                            </Text>
                          </View>
                          {item.locked && (
                            <View style={[styles.statusBadge, { backgroundColor: "#F3F4F6", borderColor: "#D1D5DB" }]}>
                              <Lock size={10} color="#4B5563" />
                              <Text variant="small" weight="700" color="#4B5563" style={{ marginLeft: 3 }}>
                                LOCKED
                              </Text>
                            </View>
                          )}
                        </View>

                        <Text variant="h3">{item.planTitle || plan?.title || "Training Session"}</Text>
                        {item.teamName && (
                          <View style={styles.planMeta}>
                            <Users size={12} color={theme.colors.textSecondary} />
                            <Text variant="small" color={theme.colors.textSecondary} style={{ marginLeft: 4 }}>
                              {item.teamName}
                            </Text>
                          </View>
                        )}
                      </View>

                      {canManagePlans && (
                        <TouchableOpacity
                          style={styles.deleteIconBtn}
                          onPress={() => handleDeleteSession(item)}
                        >
                          <Trash2 size={16} color={theme.colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={styles.sessionDetailsRow}>
                      <View style={styles.planMetaItem}>
                        <Calendar size={13} color={DESIGN_TOKENS.primaryTeal} />
                        <Text variant="small" weight="600" style={{ marginLeft: 4 }}>
                          {formattedDate} {formattedTime ? `· ${formattedTime}` : ""}
                        </Text>
                      </View>
                      {item.location && (
                        <View style={styles.planMetaItem}>
                          <Tag size={13} color={theme.colors.textSecondary} />
                          <Text variant="small" style={{ marginLeft: 4 }}>
                            {item.location}
                          </Text>
                        </View>
                      )}
                      {plan?.durationMins ? (
                        <View style={styles.planMetaItem}>
                          <Timer size={13} color={DESIGN_TOKENS.sessionBlue} />
                          <Text variant="small" weight="600" color={DESIGN_TOKENS.sessionBlue} style={{ marginLeft: 4 }}>
                            {plan.durationMins} min
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {plan?.objective ? (
                      <Text variant="small" numberOfLines={2} style={styles.sessionObjective}>
                        {plan.objective}
                      </Text>
                    ) : null}

                    <View style={styles.openPlanCta}>
                      <Text variant="small" weight="700" color={DESIGN_TOKENS.primaryTeal}>
                        Open Training Plan & Drills →
                      </Text>
                    </View>
                  </TouchableOpacity>
                </Card>
              );
            }}
          />
        )}
      </View>
    );
  };

  // ── Tab 1: Plans List ────────────────────────────────────────────────────────
  const renderPlansTab = () => {
    return (
      <View style={{ flex: 1 }}>
        {/* Search & Filter Chips */}
        <View style={styles.searchBarWrap}>
          <Search size={16} color={theme.colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search plans by title or team..."
            placeholderTextColor={theme.colors.textSecondary}
            value={planSearchQuery}
            onChangeText={setPlanSearchQuery}
          />
          {planSearchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setPlanSearchQuery("")}>
              <X size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Pills: All / Active / Templates / Drafts */}
        <View style={styles.filterPillRow}>
          {[
            ["all", "All Plans"],
            ["active", "Active"],
            ["templates", "Templates"],
            ["draft", "Drafts"],
          ].map(([val, lbl]) => {
            const active = planFilter === val;
            return (
              <TouchableOpacity
                key={val}
                style={[
                  styles.filterPill,
                  active && { backgroundColor: DESIGN_TOKENS.primaryTeal, borderColor: DESIGN_TOKENS.primaryTeal },
                ]}
                onPress={() => setPlanFilter(val)}
              >
                <Text variant="small" weight="600" color={active ? "#FFF" : theme.colors.textSecondary}>
                  {lbl}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={DESIGN_TOKENS.primaryTeal} />
          </View>
        ) : filteredPlans.length === 0 ? (
          <View style={styles.emptyState}>
            <ClipboardList size={48} color={theme.colors.border} />
            <Text variant="h4" style={{ marginTop: 14 }}>
              No Plans Found
            </Text>
            <Text variant="small" style={{ marginTop: 6, textAlign: "center" }}>
              {planSearchQuery
                ? `No plans matching "${planSearchQuery}"`
                : "Create your first plan from drills in the library."}
            </Text>
            {canManagePlans && (
              <Button
                title="Create Training Plan"
                style={{ marginTop: 18, backgroundColor: DESIGN_TOKENS.primaryTeal }}
                onPress={() => {
                  resetForm();
                  setActiveTab(2);
                }}
              />
            )}
          </View>
        ) : (
          <FlatList
            data={filteredPlans}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 120 }}
            renderItem={({ item }) => {
              const isExpanded = expandedPlanId === item.id;
              const statusColor =
                item.status === "active"
                  ? DESIGN_TOKENS.successGreen
                  : item.isTemplate
                  ? DESIGN_TOKENS.sessionBlue
                  : DESIGN_TOKENS.warningOrange;

              const planItems =
                Array.isArray(item.planItems) && item.planItems.length > 0
                  ? item.planItems
                  : (item.drillIds || []).map((id, idx) => ({
                      drillId: id,
                      sortOrder: idx,
                      section: "skill",
                    }));

              const totalMins =
                item.durationMins ||
                planItems.reduce((sum, it) => {
                  const d = drillById.get(it.drillId);
                  return sum + (it.durationOverride || d?.durationMins || parseDurationToMins(d?.duration) || 10);
                }, 0);

              return (
                <Card style={styles.planCard}>
                  {/* Status header bar */}
                  <View style={[styles.planCardTopBar, { backgroundColor: statusColor }]} />

                  <TouchableOpacity
                    onPress={() => setExpandedPlanId(isExpanded ? null : item.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.planCardTitleRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <View style={{ flexDirection: "row", gap: 6, marginBottom: 4 }}>
                          {item.isTemplate && (
                            <View style={[styles.statusBadge, { backgroundColor: "#DBEAFE", borderColor: DESIGN_TOKENS.sessionBlue }]}>
                              <Text variant="small" weight="700" color={DESIGN_TOKENS.sessionBlue}>
                                TEMPLATE
                              </Text>
                            </View>
                          )}
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: statusColor + "18", borderColor: statusColor },
                            ]}
                          >
                            <Text variant="small" weight="700" color={statusColor}>
                              {(item.status || "draft").toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        <Text variant="h3">{item.title}</Text>
                        {item.teamName ? (
                          <View style={styles.planMeta}>
                            <Users size={12} color={theme.colors.textSecondary} />
                            <Text variant="small" style={{ marginLeft: 4 }}>
                              {item.teamName}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={{ alignItems: "flex-end" }}>
                        <View style={[styles.durationBadge, { backgroundColor: DESIGN_TOKENS.primaryTeal }]}>
                          <Clock size={11} color="#FFF" />
                          <Text variant="small" weight="700" color="#FFF" style={{ marginLeft: 3 }}>
                            {totalMins}m
                          </Text>
                        </View>
                        <Text variant="small" color={theme.colors.textSecondary} style={{ marginTop: 4 }}>
                          {planItems.length} drills
                        </Text>
                      </View>
                    </View>

                    {item.objective ? (
                      <Text variant="small" numberOfLines={isExpanded ? undefined : 2} style={styles.planObjective}>
                        {item.objective}
                      </Text>
                    ) : null}

                    {/* Expand Trigger */}
                    <View style={styles.expandRow}>
                      <Text variant="small" color={DESIGN_TOKENS.primaryTeal} weight="700">
                        {isExpanded ? "Hide progression" : "View progression & video links"}
                      </Text>
                      {isExpanded ? (
                        <ChevronUp size={15} color={DESIGN_TOKENS.primaryTeal} />
                      ) : (
                        <ChevronDown size={15} color={DESIGN_TOKENS.primaryTeal} />
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Drills List */}
                  {isExpanded && (
                    <View style={styles.drillList}>
                      {planItems
                        .slice()
                        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                        .map((planItem, idx) => {
                          const drill = drillById.get(planItem.drillId);
                          if (!drill) return null;
                          const sColor = SECTION_COLORS[planItem.section] || DESIGN_TOKENS.sessionBlue;
                          const dur = planItem.durationOverride || drill.durationMins || parseDurationToMins(drill.duration) || 10;
                          const thumbUri = getThumbnailUri(drill);

                          return (
                            <View key={planItem.drillId + idx} style={[styles.drillRow, { borderLeftColor: sColor }]}>
                              <View style={styles.drillThumbWrap}>
                                {thumbUri ? (
                                  <Image source={{ uri: thumbUri }} style={styles.drillThumb} />
                                ) : (
                                  <View style={styles.drillThumbPlaceholder}>
                                    <Video size={16} color="#94A3B8" />
                                  </View>
                                )}
                              </View>

                              <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text variant="body" weight="700">
                                  {idx + 1}. {drill.title}
                                </Text>

                                <View style={styles.drillRowMeta}>
                                  <View style={[styles.sectionTag, { backgroundColor: sColor + "20" }]}>
                                    <Text variant="small" weight="700" color={sColor}>
                                      {SECTIONS.find((s) => s.key === planItem.section)?.label || planItem.section}
                                    </Text>
                                  </View>
                                  <Text variant="small" color={theme.colors.textSecondary} style={{ marginLeft: 6 }}>
                                    {dur} min
                                  </Text>
                                </View>

                                {planItem.notes ? (
                                  <Text variant="small" color={theme.colors.textSecondary} style={{ marginTop: 2, fontStyle: "italic" }}>
                                    Note: {planItem.notes}
                                  </Text>
                                ) : null}
                              </View>

                              {(drill.youtubeUrl || drill.videoUrl) && (
                                <TouchableOpacity
                                  style={styles.watchVideoBtn}
                                  onPress={() => openVideo(drill.youtubeUrl || drill.videoUrl)}
                                >
                                  <Play size={12} color="#DC2626" />
                                  <Text variant="small" weight="700" color="#DC2626" style={{ marginLeft: 3 }}>
                                    Watch
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          );
                        })}
                    </View>
                  )}

                  {/* Actions Row */}
                  <View style={styles.planActions}>
                    {canManagePlans && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: "#DBEAFE" }]}
                        onPress={() => openScheduleModal(item)}
                      >
                        <CalendarDays size={14} color={DESIGN_TOKENS.sessionBlue} />
                        <Text variant="small" weight="700" color={DESIGN_TOKENS.sessionBlue} style={{ marginLeft: 4 }}>
                          Schedule Session
                        </Text>
                      </TouchableOpacity>
                    )}

                    {canManagePlans && (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleEditPlan(item)}
                      >
                        <Edit2 size={14} color={DESIGN_TOKENS.primaryTeal} />
                        <Text variant="small" weight="700" color={DESIGN_TOKENS.primaryTeal} style={{ marginLeft: 4 }}>
                          Edit
                        </Text>
                      </TouchableOpacity>
                    )}

                    {canManagePlans && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnDanger]}
                        onPress={() => handleDeletePlan(item)}
                      >
                        <Trash2 size={14} color={theme.colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                </Card>
              );
            }}
          />
        )}
      </View>
    );
  };

  // ── Tab 2: Plan Builder (Coaches / Staff) ───────────────────────────────────
  const renderPlanBuilderTab = () => {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
          {editingPlan && (
            <View style={styles.editBanner}>
              <Edit2 size={14} color={DESIGN_TOKENS.primaryTeal} />
              <Text variant="small" weight="700" color={DESIGN_TOKENS.primaryTeal} style={{ marginLeft: 6, flex: 1 }}>
                Editing: {editingPlan.title}
              </Text>
              <TouchableOpacity onPress={resetForm}>
                <X size={16} color={DESIGN_TOKENS.primaryTeal} />
              </TouchableOpacity>
            </View>
          )}

          {/* Title */}
          <View style={styles.fieldGroup}>
            <Text variant="small" weight="700" style={styles.fieldLabel}>
              Plan Title *
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 60-min High Intensity Possession Session"
              placeholderTextColor={theme.colors.textSecondary}
              value={planTitle}
              onChangeText={setPlanTitle}
            />
          </View>

          {/* Team Dropdown */}
          <View style={styles.fieldGroup}>
            <Text variant="small" weight="700" style={styles.fieldLabel}>
              Team
            </Text>
            <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowTeamPicker(true)}>
              <Users size={16} color={theme.colors.textSecondary} />
              <Text
                variant="body"
                style={{ flex: 1, marginLeft: 10 }}
                color={planTeamId ? theme.colors.text : theme.colors.textSecondary}
              >
                {selectedTeam?.name || "— All Teams / Club Wide —"}
              </Text>
              <ChevronDown size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Objective */}
          <View style={styles.fieldGroup}>
            <Text variant="small" weight="700" style={styles.fieldLabel}>
              Session Objective & Coaching Notes
            </Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Key focus points, goals, variations for this session..."
              placeholderTextColor={theme.colors.textSecondary}
              value={planObjective}
              onChangeText={setPlanObjective}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Reusable Template Checkbox */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setIsTemplate((t) => !t)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, isTemplate && styles.checkboxChecked]}>
              {isTemplate && <Check size={13} color="#FFF" strokeWidth={3} />}
            </View>
            <Text variant="body" weight="600" style={{ marginLeft: 10 }}>
              Mark as Reusable Club Template
            </Text>
          </TouchableOpacity>

          {/* ── Ordered Session Items ── */}
          <View style={styles.fieldGroup}>
            <View style={styles.fieldLabelRow}>
              <Text variant="h3">
                Session Progression ({builderItems.length})
              </Text>
              <View style={[styles.durationBadge, { backgroundColor: DESIGN_TOKENS.primaryTeal }]}>
                <Timer size={12} color="#FFF" />
                <Text variant="small" weight="700" color="#FFF" style={{ marginLeft: 4 }}>
                  {liveTotalMins} min total
                </Text>
              </View>
            </View>

            {builderItems.length === 0 ? (
              <Card style={styles.emptyDrillCard}>
                <Layers size={32} color={theme.colors.border} />
                <Text variant="small" color={theme.colors.textSecondary} style={{ marginTop: 8, textAlign: "center" }}>
                  No drills added yet. Pick drills from the library below ↓
                </Text>
              </Card>
            ) : (
              builderItems.map((item, idx) => {
                const drill = drillById.get(item.drillId);
                const sColor = SECTION_COLORS[item.section] || DESIGN_TOKENS.sessionBlue;
                const dur = item.durationOverride || drill?.durationMins || parseDurationToMins(drill?.duration) || 10;

                return (
                  <View key={item.drillId + idx} style={[styles.builderItemCard, { borderLeftColor: sColor }]}>
                    <View style={styles.builderItemHeader}>
                      <View style={[styles.orderIndexBadge, { backgroundColor: sColor }]}>
                        <Text variant="small" weight="800" color="#FFF">
                          {idx + 1}
                        </Text>
                      </View>

                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text variant="body" weight="700">
                          {drill?.title || "Drill"}
                        </Text>
                        <Text variant="small" color={theme.colors.textSecondary}>
                          {drill?.category || "Drill"} · {dur} min
                        </Text>
                      </View>

                      {/* Reorder Buttons */}
                      <View style={styles.reorderControls}>
                        <TouchableOpacity
                          disabled={idx === 0}
                          onPress={() => moveBuilderItem(idx, -1)}
                          style={[styles.reorderBtn, idx === 0 && { opacity: 0.3 }]}
                        >
                          <ArrowUp size={14} color={theme.colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          disabled={idx === builderItems.length - 1}
                          onPress={() => moveBuilderItem(idx, 1)}
                          style={[styles.reorderBtn, idx === builderItems.length - 1 && { opacity: 0.3 }]}
                        >
                          <ArrowDown size={14} color={theme.colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => toggleDrillInBuilder(item.drillId)}
                          style={[styles.reorderBtn, { backgroundColor: "#FEE2E2" }]}
                        >
                          <X size={14} color={theme.colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Section Selector Pills */}
                    <View style={styles.sectionPillsContainer}>
                      {SECTIONS.map((sec) => (
                        <SectionPill
                          key={sec.key}
                          sectionKey={sec.key}
                          selected={item.section === sec.key}
                          onSelect={(key) => updateBuilderItem(item.drillId, { section: key })}
                        />
                      ))}
                    </View>

                    {/* Duration override & notes */}
                    <View style={styles.itemConfigRow}>
                      <View style={styles.durationInputWrap}>
                        <Clock size={12} color={theme.colors.textSecondary} />
                        <TextInput
                          style={styles.durationInput}
                          placeholder={`${drill?.durationMins || 10}m`}
                          placeholderTextColor={theme.colors.textSecondary}
                          value={item.durationOverride ? String(item.durationOverride) : ""}
                          onChangeText={(v) =>
                            updateBuilderItem(item.drillId, {
                              durationOverride: v ? Number(v) : null,
                            })
                          }
                          keyboardType="numeric"
                          maxLength={3}
                        />
                        <Text variant="small" color={theme.colors.textSecondary}>
                          min
                        </Text>
                      </View>

                      <TextInput
                        style={styles.itemNotesInput}
                        placeholder="Coaching notes for this step..."
                        placeholderTextColor={theme.colors.textSecondary}
                        value={item.notes || ""}
                        onChangeText={(v) => updateBuilderItem(item.drillId, { notes: v })}
                      />
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* ── Drill Library Picker Panel ── */}
          <View style={styles.fieldGroup}>
            <Text variant="h3" style={{ marginBottom: 8 }}>
              Add from Drill Library
            </Text>

            <View style={styles.searchBarWrap}>
              <Search size={14} color={theme.colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search drills by keyword or category..."
                placeholderTextColor={theme.colors.textSecondary}
                value={builderDrillSearch}
                onChangeText={setBuilderDrillSearch}
              />
            </View>

            {filteredBuilderDrills.map((drill) => {
              const inPlan = builderItems.some((it) => it.drillId === drill.id);
              const thumbUri = getThumbnailUri(drill);

              return (
                <TouchableOpacity
                  key={drill.id}
                  style={[styles.libraryPickerCard, inPlan && styles.libraryPickerCardSelected]}
                  onPress={() => toggleDrillInBuilder(drill.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.drillThumbWrap}>
                    {thumbUri ? (
                      <Image source={{ uri: thumbUri }} style={styles.drillThumb} />
                    ) : (
                      <View style={styles.drillThumbPlaceholder}>
                        <Video size={16} color="#94A3B8" />
                      </View>
                    )}
                  </View>

                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text variant="body" weight={inPlan ? "700" : "500"}>
                      {drill.title}
                    </Text>
                    <Text variant="small" color={theme.colors.textSecondary}>
                      {drill.category || "General"} · {drill.durationMins || 10} min
                    </Text>
                  </View>

                  <View style={[styles.checkbox, inPlan && styles.checkboxChecked]}>
                    {inPlan ? <Check size={12} color="#FFF" strokeWidth={3} /> : <Plus size={12} color="#94A3B8" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Save buttons */}
          <View style={styles.saveBtnRow}>
            <Button
              title={saving ? "Saving..." : editingPlan ? "Update Plan" : "Save Plan"}
              onPress={() => handleSavePlan(false)}
              disabled={saving}
              style={{ flex: 1, backgroundColor: DESIGN_TOKENS.primaryTeal, marginRight: 8 }}
            />
            <Button
              title="Save as Template"
              variant="outline"
              onPress={() => handleSavePlan(true)}
              disabled={saving}
              style={{ flex: 1, marginLeft: 8 }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  // ── Session Detail Viewer Modal (Player / Parent Fast Read-Only) ────────────
  const renderSessionDetailModal = () => {
    if (!viewingSession) return null;
    const { session, plan } = viewingSession;
    const dt = session.scheduledAt ? new Date(session.scheduledAt) : null;
    const planItems =
      Array.isArray(plan?.planItems) && plan.planItems.length > 0
        ? plan.planItems
        : (plan?.drillIds || []).map((id, idx) => ({ drillId: id, sortOrder: idx, section: "skill" }));

    return (
      <Modal visible={!!viewingSession} animationType="slide" onRequestClose={() => setViewingSession(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={styles.modalHeaderBar}>
            <View style={{ flex: 1 }}>
              <Text variant="small" weight="700" color={DESIGN_TOKENS.sessionBlue}>
                SCHEDULED TRAINING SESSION
              </Text>
              <Text variant="h2">{session.planTitle || plan?.title || "Session"}</Text>
            </View>
            <TouchableOpacity onPress={() => setViewingSession(null)} style={styles.closeModalBtn}>
              <X size={20} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 60 }}>
            {/* Meta details */}
            <Card style={styles.sessionMetaCard}>
              <View style={styles.sessionMetaRow}>
                <CalendarDays size={16} color={DESIGN_TOKENS.primaryTeal} />
                <Text variant="body" weight="700" style={{ marginLeft: 8 }}>
                  {dt ? dt.toLocaleString() : "Upcoming"}
                </Text>
              </View>
              {session.teamName && (
                <View style={[styles.sessionMetaRow, { marginTop: 6 }]}>
                  <Users size={16} color={theme.colors.textSecondary} />
                  <Text variant="body" style={{ marginLeft: 8 }}>
                    {session.teamName}
                  </Text>
                </View>
              )}
              {session.location && (
                <View style={[styles.sessionMetaRow, { marginTop: 6 }]}>
                  <Tag size={16} color={theme.colors.textSecondary} />
                  <Text variant="body" style={{ marginLeft: 8 }}>
                    {session.location}
                  </Text>
                </View>
              )}
            </Card>

            {plan?.objective ? (
              <Card style={{ marginBottom: 14 }}>
                <Text variant="small" weight="700" color={theme.colors.textSecondary} style={{ marginBottom: 4 }}>
                  SESSION OBJECTIVE & NOTES
                </Text>
                <Text variant="body" style={{ lineHeight: 22 }}>
                  {plan.objective}
                </Text>
              </Card>
            ) : null}

            {/* Drills Section Progression */}
            <Text variant="h3" style={{ marginVertical: 10 }}>
              Session Drills ({planItems.length})
            </Text>

            {planItems
              .slice()
              .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
              .map((item, idx) => {
                const drill = drillById.get(item.drillId);
                if (!drill) return null;
                const sColor = SECTION_COLORS[item.section] || DESIGN_TOKENS.sessionBlue;
                const dur = item.durationOverride || drill.durationMins || parseDurationToMins(drill.duration) || 10;
                const thumbUri = getThumbnailUri(drill);

                return (
                  <Card key={item.drillId + idx} style={[styles.modalDrillCard, { borderLeftColor: sColor }]}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                      <View style={styles.drillThumbWrapLarge}>
                        {thumbUri ? (
                          <Image source={{ uri: thumbUri }} style={styles.drillThumbLarge} />
                        ) : (
                          <View style={styles.drillThumbPlaceholderLarge}>
                            <Video size={20} color="#94A3B8" />
                          </View>
                        )}
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <View style={[styles.sectionTag, { backgroundColor: sColor + "20" }]}>
                            <Text variant="small" weight="700" color={sColor}>
                              {SECTIONS.find((s) => s.key === item.section)?.label || item.section}
                            </Text>
                          </View>
                          <Text variant="small" color={theme.colors.textSecondary}>
                            {dur} min
                          </Text>
                        </View>

                        <Text variant="h4">{idx + 1}. {drill.title}</Text>

                        {drill.description ? (
                          <Text variant="small" color={theme.colors.textSecondary} style={{ marginTop: 4, lineHeight: 18 }}>
                            {drill.description}
                          </Text>
                        ) : null}

                        {item.notes ? (
                          <Text variant="small" color={DESIGN_TOKENS.primaryTeal} weight="600" style={{ marginTop: 4 }}>
                            Coach note: {item.notes}
                          </Text>
                        ) : null}

                        {(drill.youtubeUrl || drill.videoUrl) && (
                          <TouchableOpacity
                            style={styles.modalWatchBtn}
                            onPress={() => openVideo(drill.youtubeUrl || drill.videoUrl)}
                          >
                            <PlayCircle size={16} color="#DC2626" />
                            <Text variant="small" weight="700" color="#DC2626" style={{ marginLeft: 6 }}>
                              Watch Video Demonstration
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </Card>
                );
              })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  // ── Schedule Session Modal ──────────────────────────────────────────────────
  const renderScheduleModal = () => {
    return (
      <Modal
        visible={!!scheduleModalPlan}
        transparent
        animationType="fade"
        onRequestClose={() => setScheduleModalPlan(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setScheduleModalPlan(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text variant="h3">Schedule Session</Text>
                <Text variant="small" color={theme.colors.textSecondary}>
                  {scheduleModalPlan?.title}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setScheduleModalPlan(null)}>
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Team Picker */}
            <View style={styles.fieldGroup}>
              <Text variant="small" weight="700" style={styles.fieldLabel}>
                Team
              </Text>
              <TouchableOpacity
                style={styles.dropdownBtn}
                onPress={() => setShowTeamPicker(true)}
              >
                <Users size={16} color={theme.colors.textSecondary} />
                <Text variant="body" style={{ flex: 1, marginLeft: 10 }}>
                  {(teams || []).find((t) => t.id === scheduleTeamId)?.name || "Select Team"}
                </Text>
                <ChevronDown size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Date */}
            <View style={styles.fieldGroup}>
              <Text variant="small" weight="700" style={styles.fieldLabel}>
                Date (YYYY-MM-DD) *
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="2026-11-04"
                placeholderTextColor={theme.colors.textSecondary}
                value={scheduleDate}
                onChangeText={setScheduleDate}
                maxLength={10}
              />
            </View>

            {/* Time */}
            <View style={styles.fieldGroup}>
              <Text variant="small" weight="700" style={styles.fieldLabel}>
                Start Time
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="18:00"
                placeholderTextColor={theme.colors.textSecondary}
                value={scheduleTime}
                onChangeText={setScheduleTime}
                maxLength={5}
              />
            </View>

            {/* Location */}
            <View style={styles.fieldGroup}>
              <Text variant="small" weight="700" style={styles.fieldLabel}>
                Location / Pitch
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Field 1, Training Ground"
                placeholderTextColor={theme.colors.textSecondary}
                value={scheduleLocation}
                onChangeText={setScheduleLocation}
              />
            </View>

            {/* Lock Checkbox */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setScheduleLocked((l) => !l)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, scheduleLocked && styles.checkboxChecked]}>
                {scheduleLocked && <Check size={12} color="#FFF" strokeWidth={3} />}
              </View>
              <Text variant="small" weight="600" style={{ marginLeft: 8 }}>
                Lock session instance against future plan edits
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActionRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setScheduleModalPlan(null)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title={scheduling ? "Scheduling..." : "Save & Schedule"}
                onPress={handleConfirmSchedule}
                disabled={scheduling}
                style={{ flex: 1, marginLeft: 8, backgroundColor: DESIGN_TOKENS.sessionBlue }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  // ── Team Picker Modal ────────────────────────────────────────────────────────
  const renderTeamPickerModal = () => {
    return (
      <Modal
        visible={showTeamPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTeamPicker(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowTeamPicker(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text variant="h3">Select Team</Text>
              <TouchableOpacity onPress={() => setShowTeamPicker(false)}>
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={teams}
              keyExtractor={(t) => t.id}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => {
                const isActive = item.id === (scheduleModalPlan ? scheduleTeamId : planTeamId);
                return (
                  <TouchableOpacity
                    style={[styles.teamPickerRow, isActive && styles.teamPickerRowActive]}
                    onPress={() => {
                      if (scheduleModalPlan) setScheduleTeamId(item.id);
                      else setPlanTeamId(item.id);
                      setShowTeamPicker(false);
                    }}
                  >
                    <Text variant="body" weight={isActive ? "700" : "500"}>
                      {item.name}
                    </Text>
                    {isActive && <CheckCircle2 size={18} color={DESIGN_TOKENS.primaryTeal} />}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  // ── Root Render ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Screen Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text variant="h2">Training Plans</Text>
          <Text variant="small" color={theme.colors.textSecondary}>
            {canManagePlans
              ? "Build structured sessions and schedule team training"
              : "View scheduled sessions and training drill plans"}
          </Text>
        </View>

        {canManagePlans && activeTab !== 2 && (
          <TouchableOpacity
            style={[styles.headerAddBtn, { backgroundColor: DESIGN_TOKENS.primaryTeal }]}
            onPress={() => {
              resetForm();
              setActiveTab(2);
            }}
          >
            <Plus size={20} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs Bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab, idx) => {
          const active = activeTab === idx;
          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabItem,
                active && { borderBottomColor: DESIGN_TOKENS.primaryTeal, borderBottomWidth: 3 },
              ]}
              onPress={() => setActiveTab(idx)}
            >
              <Text
                variant="body"
                weight={active ? "700" : "500"}
                color={active ? DESIGN_TOKENS.primaryTeal : theme.colors.textSecondary}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Active Tab Screen */}
      {activeTab === 0 && renderSessionsTab()}
      {activeTab === 1 && renderPlansTab()}
      {activeTab === 2 && canManagePlans && renderPlanBuilderTab()}

      {/* Modals */}
      {renderSessionDetailModal()}
      {renderScheduleModal()}
      {renderTeamPickerModal()}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerAddBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: theme.spacing.sm,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#BFDBFE",
  },
  searchBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 8,
    margin: theme.spacing.md,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    marginHorizontal: theme.spacing.sm,
    fontSize: 14,
    color: theme.colors.text,
    paddingVertical: 0,
  },
  filterPillRow: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.md,
    marginBottom: 8,
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  // Plan Card
  planCard: {
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 0,
    overflow: "hidden",
  },
  planCardTopBar: {
    height: 4,
    width: "100%",
  },
  planCardTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: theme.spacing.md,
    paddingBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  planMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  planObjective: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: 8,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  expandRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: 4,
  },
  drillList: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: "#F8FAFC",
  },
  drillRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + "60",
    borderLeftWidth: 4,
  },
  drillThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#0F172A",
  },
  drillThumb: {
    width: "100%",
    height: "100%",
  },
  drillThumbPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  drillRowMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  sectionTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  watchVideoBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#FEE2E2",
    borderRadius: 6,
    marginLeft: 6,
  },
  planActions: {
    flexDirection: "row",
    padding: theme.spacing.sm,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.secondary,
  },
  actionBtnDanger: {
    backgroundColor: "#FFF5F5",
  },
  // Session Cards
  sessionCard: {
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 4,
  },
  sessionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  deleteIconBtn: {
    padding: 6,
  },
  sessionDetailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginVertical: 8,
  },
  planMetaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  sessionObjective: {
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  openPlanCta: {
    marginTop: 4,
  },
  // Builder Form Styles
  formContainer: {
    padding: theme.spacing.md,
    paddingBottom: 160,
  },
  editBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDFA",
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.primaryTeal + "40",
  },
  fieldGroup: {
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    marginBottom: 6,
    color: theme.colors.text,
  },
  fieldLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: DESIGN_TOKENS.primaryTeal,
    borderColor: DESIGN_TOKENS.primaryTeal,
  },
  emptyDrillCard: {
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
  },
  // Builder Item Card
  builderItemCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 4,
    borderRadius: theme.radius.md,
    padding: 10,
    marginBottom: 8,
  },
  builderItemHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  orderIndexBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  reorderControls: {
    flexDirection: "row",
    gap: 4,
  },
  reorderBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionPillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  sectionPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
  },
  itemConfigRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    alignItems: "center",
  },
  durationInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    backgroundColor: theme.colors.background,
  },
  durationInput: {
    width: 44,
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontSize: 13,
    textAlign: "center",
    color: theme.colors.text,
  },
  itemNotesInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
  libraryPickerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    marginBottom: 6,
  },
  libraryPickerCardSelected: {
    borderColor: DESIGN_TOKENS.primaryTeal,
    backgroundColor: "#F0FDFA",
  },
  saveBtnRow: {
    flexDirection: "row",
    marginTop: theme.spacing.md,
  },
  // Modal Styles
  modalHeaderBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  closeModalBtn: {
    padding: 6,
  },
  sessionMetaCard: {
    marginBottom: 14,
    backgroundColor: "#F8FAFC",
  },
  sessionMetaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalDrillCard: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 4,
  },
  drillThumbWrapLarge: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#0F172A",
  },
  drillThumbLarge: {
    width: "100%",
    height: "100%",
  },
  drillThumbPlaceholderLarge: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalWatchBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#FEE2E2",
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  modalActionRow: {
    flexDirection: "row",
    marginTop: theme.spacing.md,
  },
  teamPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  teamPickerRowActive: {
    backgroundColor: "#F0FDFA",
  },
});
