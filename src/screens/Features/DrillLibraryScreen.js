import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ShieldCheck,
  Trophy,
  Users,
  Video,
  ChevronLeft,
  ChevronDown,
  ImagePlus,
  Camera,
  Plus,
  PlayCircle,
  Settings,
  Search,
} from "lucide-react-native";
import { Calendar } from "react-native-calendars";
import * as ImagePicker from "expo-image-picker";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Text } from "../../components/ui/Typography";
import { TimePickerModal } from "../../components/ui/TimePickerModal";
import { useAuth } from "../../contexts/AuthContext";
import { useClub } from "../../contexts/ClubContext";
import { theme } from "../../theme/theme";
import { subscribeToEvents } from "../../services/eventService";
import {
  subscribeToVisibleRosters,
  subscribeToVisibleTasks,
} from "../../services/managementService";
import { subscribeToTeams } from "../../services/teamService";
import {
  createChecklist,
  createDrill,
  updateDrill,
  deleteDrill,
  createTrainingPlan,
  updateTrainingPlan,
  getPlayerProfile,
  subscribeToChecklists,
  subscribeToDrills,
  subscribeToFamilyProfile,
  subscribeToParentPlayerProfiles,
  subscribeToTeamCompliance,
  subscribeToTrainingPlans,
  toggleChecklistItemDone,
  upsertFamilyProfile,
  upsertPlayerProfile,
  upsertTeamCompliance,
} from "../../services/clubOperationsService";
import { uploadDrillImage } from "../../services/storageService";

const TABS = [
  "Volunteer",
  "Checklist",
  "Compliance",
  "Drills",
  "Create Plan",
  "Plans",
  "Family",
];

const textToChecklistItems = (raw) =>
  String(raw || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((label, index) => ({
      id: `new-${Date.now()}-${index}`,
      label,
      required: true,
      done: false,
    }));

export default function ClubOperationsScreen({ navigation, route }) {
  const { user, profile } = useAuth();
  const { activeClubId, activeClub, userRole, userGroupIds } = useClub();
  const insets = useSafeAreaInsets();

  const [tabIndex, setTabIndex] = useState(route?.params?.initialTab || 0);

  const [tasks, setTasks] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [teamRows, setTeamRows] = useState([]);
  const [complianceRows, setComplianceRows] = useState([]);
  const [drills, setDrills] = useState([]);
  const [trainingPlans, setTrainingPlans] = useState([]);
  const [familyProfile, setFamilyProfile] = useState(null);
  const [events, setEvents] = useState([]);

  const [checklistTitle, setChecklistTitle] = useState("");
  const [checklistCategory, setChecklistCategory] = useState("game-day");
  const [checklistStartDate, setChecklistStartDate] = useState("");
  const [checklistEndDate, setChecklistEndDate] = useState("");
  const [checklistAllDay, setChecklistAllDay] = useState(false);
  const [checklistStartTime, setChecklistStartTime] = useState("");
  const [checklistEndTime, setChecklistEndTime] = useState("");
  const [checklistDateTarget, setChecklistDateTarget] = useState("start");
  const [showChecklistStartTimeModal, setShowChecklistStartTimeModal] =
    useState(false);
  const [showChecklistEndTimeModal, setShowChecklistEndTimeModal] =
    useState(false);
  const [checklistItemsText, setChecklistItemsText] = useState("");
  const [selectedChecklistGroupIds, setSelectedChecklistGroupIds] = useState(
    [],
  );
  const [showChecklistDatePicker, setShowChecklistDatePicker] = useState(false);
  const [checklistItems, setChecklistItems] = useState([]);
  const [newChecklistItemText, setNewChecklistItemText] = useState("");

  const [drillVideoUrl, setDrillVideoUrl] = useState("");
  const [drillImagePreviews, setDrillImagePreviews] = useState([]); // local URIs for instant preview
  const [uploadingDrillImage, setUploadingDrillImage] = useState(false);
  const [planTitle, setPlanTitle] = useState("");
  const [planObjective, setPlanObjective] = useState("");
  const [planDate, setPlanDate] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedDrillIds, setSelectedDrillIds] = useState([]);
  const [editingTrainingPlan, setEditingTrainingPlan] = useState(null);
  const [showPlanDatePicker, setShowPlanDatePicker] = useState(false);
  const [activeDrillModal, setActiveDrillModal] = useState(null);
  const [activePlanModal, setActivePlanModal] = useState(null);
  const [showDrillDropdown, setShowDrillDropdown] = useState(false);
  const [drillSearchQuery, setDrillSearchQuery] = useState("");

  const [newChildName, setNewChildName] = useState("");
  const [newChildTeamId, setNewChildTeamId] = useState("");
  const [newChildLinkedPlayerUid, setNewChildLinkedPlayerUid] = useState("");
  const [newChildNeedsApproval, setNewChildNeedsApproval] = useState(true);
  const [childrenDraft, setChildrenDraft] = useState([]);
  const [parentPlayerProfiles, setParentPlayerProfiles] = useState([]);

  const [editingComplianceTeamId, setEditingComplianceTeamId] = useState("");
  const [newComplianceRole, setNewComplianceRole] = useState("");

  const normalizedRole = String(userRole || "").trim().toLowerCase();
  const isAdmin = normalizedRole === "owner" || normalizedRole === "admin";
  const isStaff = [
    "owner",
    "admin",
    "coach",
    "manager",
    "executive",
    "committee",
    "volunteer",
    "president",
    "vice president",
    "secretary",
    "treasurer",
    "registrar",
    "coordinator",
  ].includes(normalizedRole);

  useEffect(() => {
    if (!activeClubId) return;

    const unsubTasks = subscribeToVisibleTasks(activeClubId, setTasks, {
      userGroupIds,
      userId: user?.uid || "",
      scope: "all",
    });
    const unsubRosters = subscribeToVisibleRosters(activeClubId, setRosters, {
      userGroupIds,
      userId: user?.uid || "",
      scope: "all",
    });
    const unsubChecklists = subscribeToChecklists(activeClubId, setChecklists, {
      userGroupIds,
      userId: user?.uid || "",
      isAdmin,
    });
    const unsubCompliance = subscribeToTeamCompliance(
      activeClubId,
      setComplianceRows,
    );
    const unsubTeams = subscribeToTeams(activeClubId, setTeamRows);
    const unsubDrills = subscribeToDrills(activeClubId, setDrills, {
      userGroupIds,
      userId: user?.uid || "",
      isAdmin,
    });
    const unsubPlans = subscribeToTrainingPlans(activeClubId, setTrainingPlans, {
      userGroupIds,
      userId: user?.uid || "",
      isAdmin,
    });
    const unsubFamily = subscribeToFamilyProfile(
      activeClubId,
      user?.uid || "",
      setFamilyProfile,
    );
    const unsubParentProfiles = subscribeToParentPlayerProfiles(
      activeClubId,
      user?.uid || "",
      setParentPlayerProfiles,
    );
    const unsubEvents = subscribeToEvents(activeClubId, setEvents);

    return () => {
      unsubTasks?.();
      unsubRosters?.();
      unsubChecklists?.();
      unsubCompliance?.();
      unsubTeams?.();
      unsubDrills?.();
      unsubPlans?.();
      unsubFamily?.();
      unsubParentProfiles?.();
      unsubEvents?.();
    };
  }, [activeClubId, user?.uid, userGroupIds]);

  useEffect(() => {
    if (familyProfile?.children) {
      setChildrenDraft(familyProfile.children);
    }
  }, [familyProfile]);

  useEffect(() => {
    if (checklistAllDay) {
      setChecklistStartTime("");
      setChecklistEndTime("");
    }
  }, [checklistAllDay]);

  const openTasks = useMemo(
    () => (tasks || []).filter((task) => task.status !== "completed"),
    [tasks],
  );

  const openShiftCount = useMemo(() => {
    return (rosters || []).reduce((acc, roster) => {
      const count = (roster.shifts || []).filter(
        (shift) => !shift.filledBy,
      ).length;
      return acc + count;
    }, 0);
  }, [rosters]);

  const volunteerLeaderboard = useMemo(() => {
    const map = new Map();

    (tasks || []).forEach((task) => {
      if (task.status !== "completed") return;
      const uid = task.assigneeId || task.assignedUserId || "unknown";
      const name =
        task.assigneeName ||
        task.assignedUserName ||
        task.assigneeId ||
        "Member";
      if (!map.has(uid)) {
        map.set(uid, {
          uid,
          name,
          tasksCompleted: 0,
          shiftsFilled: 0,
          score: 0,
        });
      }
      const row = map.get(uid);
      row.tasksCompleted += 1;
      row.score += 2;
    });

    (rosters || []).forEach((roster) => {
      (roster.shifts || []).forEach((shift) => {
        if (!shift.filledBy) return;
        const uid = shift.filledBy;
        const name = shift.filledByName || shift.filledBy || "Member";
        if (!map.has(uid)) {
          map.set(uid, {
            uid,
            name,
            tasksCompleted: 0,
            shiftsFilled: 0,
            score: 0,
          });
        }
        const row = map.get(uid);
        row.shiftsFilled += 1;
        row.score += 1;
      });
    });

    return Array.from(map.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [tasks, rosters]);

  const complianceByTeamId = useMemo(() => {
    const map = new Map();
    (complianceRows || []).forEach((row) => map.set(row.teamId, row));
    return map;
  }, [complianceRows]);

  const drillById = useMemo(() => {
    const map = new Map();
    (drills || []).forEach((drill) => map.set(drill.id, drill));
    return map;
  }, [drills]);

  const saveChecklist = async (itemsOverride) => {
    if (!activeClubId) return;
    if (!checklistTitle.trim()) {
      Alert.alert("Missing title", "Please add a checklist title.");
      return;
    }
    if (selectedChecklistGroupIds.length === 0) {
      Alert.alert(
        "Missing team",
        "Please assign the checklist to at least one team.",
      );
      return;
    }

    if (!checklistStartDate || !checklistEndDate) {
      Alert.alert(
        "Missing dates",
        "Please select a start and end date for the checklist.",
      );
      return;
    }

    if (!checklistAllDay) {
      if (!checklistStartTime || !checklistEndTime) {
        Alert.alert(
          "Missing times",
          "Please select start and end times or enable All Day.",
        );
        return;
      }
    }

    const items =
      Array.isArray(itemsOverride) && itemsOverride.length > 0
        ? itemsOverride
        : textToChecklistItems(checklistItemsText);

    if (items.length === 0) {
      Alert.alert("Missing items", "Please add at least one checklist item.");
      return;
    }

    const selectedTeams = (teamRows || []).filter((team) =>
      selectedChecklistGroupIds.includes(team.id),
    );
    const assignedGroupNames = selectedTeams.map((t) => t.name).join(", ");

    try {
      await createChecklist(activeClubId, {
        title: checklistTitle,
        category: checklistCategory,
        dueDate: checklistEndDate,
        startDate: checklistStartDate,
        endDate: checklistEndDate,
        isAllDay: checklistAllDay,
        startTime: checklistAllDay ? "" : checklistStartTime,
        endTime: checklistAllDay ? "" : checklistEndTime,
        appliesTo: "team",
        teamId: selectedChecklistGroupIds[0] || "",
        teamName: selectedTeams[0]?.name || "",
        assignedGroupIds: selectedChecklistGroupIds,
        assignedGroupNames,
        items,
        createdBy: user?.uid || "",
        createdByName: profile?.displayName || profile?.email || "",
      });
      setChecklistTitle("");
      setChecklistStartDate("");
      setChecklistEndDate("");
      setChecklistAllDay(false);
      setChecklistStartTime("");
      setChecklistEndTime("");
      setChecklistItemsText("");
      setChecklistItems([]);
      setSelectedChecklistGroupIds([]);
    } catch (err) {
      console.error("Checklist creation error:", err);
      Alert.alert(
        "Error",
        err?.message ||
        "Could not create checklist right now. Please check your permissions and try again.",
      );
    }
  };

  const saveTrainingPlan = async () => {
    if (!activeClubId) return;
    if (!planTitle.trim()) {
      Alert.alert("Missing title", "Please add a training plan title.");
      return;
    }
    if (!selectedTeamId) {
      Alert.alert(
        "Team required",
        "Please select a team for this training plan.",
      );
      return;
    }
    if (selectedDrillIds.length === 0) {
      Alert.alert("Missing drills", "Select at least one drill.");
      return;
    }

    const selectedTeam = (teamRows || []).find(
      (team) => team.id === selectedTeamId,
    );

    try {
      if (editingTrainingPlan?.id) {
        await updateTrainingPlan(activeClubId, editingTrainingPlan.id, {
          title: planTitle,
          objective: planObjective,
          sessionDate: planDate,
          teamId: selectedTeamId,
          teamName: selectedTeam?.name || "",
          drillIds: selectedDrillIds,
        });
        Alert.alert("Success", "Training plan updated.");
      } else {
        await createTrainingPlan(activeClubId, {
          title: planTitle,
          objective: planObjective,
          sessionDate: planDate,
          teamId: selectedTeamId,
          teamName: selectedTeam?.name || "",
          drillIds: selectedDrillIds,
          createdBy: user?.uid || "",
        });
        Alert.alert("Success", "Training plan created.");
      }
      setPlanTitle("");
      setPlanObjective("");
      setPlanDate("");
      setSelectedDrillIds([]);
      setSelectedTeamId("");
      setEditingTrainingPlan(null);
      setTabIndex(5);
    } catch {
      Alert.alert(
        "Error",
        editingTrainingPlan
          ? "Could not update training plan."
          : "Could not create training plan.",
      );
    }
  };

  const toggleTeamComplianceRole = async (team, roleName) => {
    if (!activeClubId || !isStaff) return;
    const current = complianceByTeamId.get(team.id) || {};
    const requiredRoles =
      Array.isArray(current.requiredRoles) && current.requiredRoles.length > 0
        ? current.requiredRoles
        : ["Coach Accredited", "Manager", "Safety Officer", "Sports Trainer"];
    const assignedRoles = Array.isArray(current.assignedRoles)
      ? current.assignedRoles
      : [];

    const isAssigned = assignedRoles.includes(roleName);
    const nextAssigned = isAssigned
      ? assignedRoles.filter((r) => r !== roleName)
      : [...assignedRoles, roleName];

    try {
      await upsertTeamCompliance(activeClubId, {
        teamId: team.id,
        teamName: team.name || "",
        coachAccredited: !!current.coachAccredited,
        managerAssigned: !!current.managerAssigned,
        safetyOfficerAssigned: !!current.safetyOfficerAssigned,
        sportsTrainerAssigned: !!current.sportsTrainerAssigned,
        requiredRoles,
        assignedRoles: nextAssigned,
        notes: current.notes || "",
        updatedBy: user?.uid || "",
      });
    } catch {
      Alert.alert("Error", "Could not toggle role status.");
    }
  };

  const addComplianceRole = async (team) => {
    if (!activeClubId || !newComplianceRole.trim()) return;
    const current = complianceByTeamId.get(team.id) || {};
    const requiredRoles =
      Array.isArray(current.requiredRoles) && current.requiredRoles.length > 0
        ? current.requiredRoles
        : ["Coach Accredited", "Manager", "Safety Officer", "Sports Trainer"];

    const roleName = newComplianceRole.trim();
    if (requiredRoles.includes(roleName)) {
      setNewComplianceRole("");
      return;
    }

    try {
      await upsertTeamCompliance(activeClubId, {
        teamId: team.id,
        teamName: team.name || "",
        coachAccredited: !!current.coachAccredited,
        managerAssigned: !!current.managerAssigned,
        safetyOfficerAssigned: !!current.safetyOfficerAssigned,
        sportsTrainerAssigned: !!current.sportsTrainerAssigned,
        requiredRoles: [...requiredRoles, roleName],
        assignedRoles: Array.isArray(current.assignedRoles)
          ? current.assignedRoles
          : [],
        notes: current.notes || "",
        updatedBy: user?.uid || "",
      });
      setNewComplianceRole("");
    } catch {
      Alert.alert("Error", "Could not add role.");
    }
  };

  const removeComplianceRole = async (team, roleName) => {
    if (!activeClubId) return;
    const current = complianceByTeamId.get(team.id) || {};
    const requiredRoles =
      Array.isArray(current.requiredRoles) && current.requiredRoles.length > 0
        ? current.requiredRoles
        : ["Coach Accredited", "Manager", "Safety Officer", "Sports Trainer"];
    const assignedRoles = Array.isArray(current.assignedRoles)
      ? current.assignedRoles
      : [];

    try {
      await upsertTeamCompliance(activeClubId, {
        teamId: team.id,
        teamName: team.name || "",
        coachAccredited: !!current.coachAccredited,
        managerAssigned: !!current.managerAssigned,
        safetyOfficerAssigned: !!current.safetyOfficerAssigned,
        sportsTrainerAssigned: !!current.sportsTrainerAssigned,
        requiredRoles: requiredRoles.filter((r) => r !== roleName),
        assignedRoles: assignedRoles.filter((r) => r !== roleName),
        notes: current.notes || "",
        updatedBy: user?.uid || "",
      });
    } catch {
      Alert.alert("Error", "Could not remove role.");
    }
  };

  const addChild = async () => {
    if (!activeClubId) return;
    if (!newChildName.trim()) {
      Alert.alert("Missing name", "Add a child name first.");
      return;
    }

    const playerId = `player-${Date.now()}`;
    const selectedTeam = (teamRows || []).find(
      (row) => row.id === newChildTeamId,
    );
    const childRecord = {
      id: playerId,
      playerId,
      name: newChildName.trim(),
      teamId: newChildTeamId,
      ageGroup: "",
      linkedPlayerUserUid: newChildLinkedPlayerUid.trim(),
      requireParentApprovalForPayments: newChildNeedsApproval,
    };

    const nextChildren = [...childrenDraft, childRecord];

    try {
      await upsertPlayerProfile(activeClubId, playerId, {
        playerName: childRecord.name,
        teamId: childRecord.teamId,
        teamName: selectedTeam?.name || "",
        ageGroup: childRecord.ageGroup,
        linkedPlayerUserUid: childRecord.linkedPlayerUserUid,
        paymentPolicy: {
          requireParentApprovalForPayments:
            childRecord.requireParentApprovalForPayments,
        },
        parentLinks: [
          {
            uid: user?.uid || "",
            name: profile?.displayName || profile?.email || "",
            relationship: "parent",
          },
        ],
      });

      await upsertFamilyProfile(activeClubId, {
        parentUid: user?.uid || "",
        parentName: profile?.displayName || profile?.email || "",
        children: nextChildren,
      });
      setChildrenDraft(nextChildren);
      setNewChildName("");
      setNewChildTeamId("");
      setNewChildLinkedPlayerUid("");
      setNewChildNeedsApproval(true);
    } catch {
      Alert.alert("Error", "Could not add child profile.");
    }
  };

  const toggleChildPaymentApproval = async (child) => {
    if (!activeClubId) return;
    const playerId = child?.playerId || child?.id;
    if (!playerId) return;

    try {
      const profileRow = await getPlayerProfile(activeClubId, playerId);
      const current =
        profileRow?.paymentPolicy?.requireParentApprovalForPayments !== false;
      const next = !current;
      const selectedTeam = (teamRows || []).find(
        (row) => row.id === (profileRow?.teamId || child?.teamId || ""),
      );

      await upsertPlayerProfile(activeClubId, playerId, {
        playerName: profileRow?.playerName || child?.name || "",
        teamId: profileRow?.teamId || child?.teamId || "",
        teamName: profileRow?.teamName || selectedTeam?.name || "",
        ageGroup: profileRow?.ageGroup || child?.ageGroup || "",
        linkedPlayerUserUid:
          profileRow?.linkedPlayerUserUid || child?.linkedPlayerUserUid || "",
        parentLinks: profileRow?.parentLinks || [
          {
            uid: user?.uid || "",
            name: profile?.displayName || profile?.email || "",
            relationship: "parent",
          },
        ],
        paymentPolicy: {
          requireParentApprovalForPayments: next,
        },
      });

      const nextChildren = (childrenDraft || []).map((row) => {
        const rowId = row?.playerId || row?.id;
        if (rowId !== playerId) return row;
        return {
          ...row,
          requireParentApprovalForPayments: next,
        };
      });

      await upsertFamilyProfile(activeClubId, {
        parentUid: user?.uid || "",
        parentName: profile?.displayName || profile?.email || "",
        children: nextChildren,
      });
      setChildrenDraft(nextChildren);
    } catch {
      Alert.alert("Error", "Could not update payment approval policy.");
    }
  };

  const removeChild = async (childId) => {
    if (!activeClubId) return;
    const nextChildren = childrenDraft.filter((child) => child.id !== childId);

    try {
      const profileRow = await getPlayerProfile(activeClubId, childId);
      if (profileRow) {
        const remainingParents = (profileRow.parentLinks || []).filter(
          (row) => row?.uid !== (user?.uid || ""),
        );
        const selectedTeam = (teamRows || []).find(
          (row) => row.id === (profileRow.teamId || ""),
        );

        await upsertPlayerProfile(activeClubId, childId, {
          playerName: profileRow.playerName || "",
          teamId: profileRow.teamId || "",
          teamName: profileRow.teamName || selectedTeam?.name || "",
          ageGroup: profileRow.ageGroup || "",
          linkedPlayerUserUid: profileRow.linkedPlayerUserUid || "",
          parentLinks: remainingParents,
          paymentPolicy: {
            requireParentApprovalForPayments:
              profileRow?.paymentPolicy?.requireParentApprovalForPayments !==
              false,
          },
        });
      }

      await upsertFamilyProfile(activeClubId, {
        parentUid: user?.uid || "",
        parentName: profile?.displayName || profile?.email || "",
        children: nextChildren,
      });
      setChildrenDraft(nextChildren);
    } catch {
      Alert.alert("Error", "Could not remove child profile.");
    }
  };

  const renderBadge = (label, active = true) => (
    <View
      style={[
        styles.badge,
        { backgroundColor: active ? "#E8F8EF" : "#F3F4F6" },
      ]}
    >
      <Text
        variant="small"
        weight="600"
        color={active ? theme.colors.primary : theme.colors.textSecondary}
      >
        {label}
      </Text>
    </View>
  );

  const renderVolunteerTab = () => (
    <>
      <Card style={styles.panelCard}>
        <Text variant="h3">Volunteer & Duty Management</Text>
        <Text variant="small" style={{ marginTop: 6 }}>
          Live overview of open duties and volunteer contributions.
        </Text>
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text variant="h2">{openTasks.length}</Text>
            <Text variant="small">Open Tasks</Text>
          </View>
          <View style={styles.statCard}>
            <Text variant="h2">{openShiftCount}</Text>
            <Text variant="small">Open Shifts</Text>
          </View>
        </View>
        <View style={styles.rowGap}>
          <Button
            title="Open Tasks"
            size="small"
            onPress={() => navigation.navigate("Tasks")}
          />
          <Button
            title="Open Rosters"
            variant="outline"
            size="small"
            onPress={() => navigation.navigate("Rostering")}
          />
        </View>
      </Card>

      <Card style={styles.panelCard}>
        <View style={styles.sectionHeaderRow}>
          <Trophy color={theme.colors.primary} size={20} />
          <Text variant="h4" style={{ marginLeft: 8 }}>
            Volunteer Leaderboard
          </Text>
        </View>
        {volunteerLeaderboard.length === 0 ? (
          <Text variant="small" style={{ marginTop: 8 }}>
            No completed duties yet.
          </Text>
        ) : (
          volunteerLeaderboard.map((row, index) => (
            <View key={row.uid} style={styles.rankRow}>
              <Text variant="body" weight="700" style={{ width: 24 }}>
                {index + 1}
              </Text>
              <View style={{ flex: 1 }}>
                <Text variant="body" weight="600">
                  {row.name}
                </Text>
                <Text variant="small">
                  {row.tasksCompleted} completed tasks | {row.shiftsFilled}{" "}
                  shifts
                </Text>
              </View>
              {renderBadge(`${row.score} pts`)}
            </View>
          ))
        )}
      </Card>
    </>
  );

  const renderChecklistTab = () => (
    <>
      {isStaff ? (
        <Card style={styles.panelCard}>
          <Text variant="h4">Create Compliance Checklist</Text>

          {/* Title */}
          <TextInput
            style={styles.input}
            placeholder="Checklist title (e.g. Pre-season Setup)"
            value={checklistTitle}
            onChangeText={setChecklistTitle}
          />

          {/* Category chips */}
          <Text
            variant="small"
            weight="600"
            style={{ marginTop: 8, marginBottom: 6 }}
          >
            Category
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, marginBottom: 12 }}
          >
            {["game-day", "pre-season", "training", "event", "admin"].map(
              (cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.selectChip,
                    checklistCategory === cat ? styles.selectChipActive : null,
                  ]}
                  onPress={() => setChecklistCategory(cat)}
                >
                  <Text
                    variant="small"
                    weight="700"
                    color={
                      checklistCategory === cat
                        ? theme.colors.white
                        : theme.colors.text
                    }
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </ScrollView>

          {/* Schedule */}
          <Text variant="small" weight="600" style={{ marginBottom: 6 }}>
            Schedule
          </Text>
          <TouchableOpacity
            style={styles.allDayToggleRow}
            onPress={() => setChecklistAllDay((prev) => !prev)}
          >
            <View style={{ flex: 1 }}>
              <Text variant="body" weight="600">
                {checklistAllDay ? "All Day Checklist" : "Timed Checklist"}
              </Text>
              <Text variant="small" color={theme.colors.textSecondary}>
                {checklistAllDay
                  ? "No start/end times required"
                  : "Set start and end times"}
              </Text>
            </View>
            <View
              style={[
                styles.switchTrack,
                checklistAllDay && styles.switchTrackActive,
              ]}
            >
              <View
                style={[
                  styles.switchThumb,
                  checklistAllDay && styles.switchThumbActive,
                ]}
              />
            </View>
          </TouchableOpacity>

          <Text variant="small" weight="600" style={{ marginBottom: 6 }}>
            Start Date
          </Text>
          <TouchableOpacity
            style={[
              styles.input,
              {
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              },
            ]}
            onPress={() => {
              setChecklistDateTarget("start");
              setShowChecklistDatePicker(true);
            }}
          >
            <Text
              color={
                checklistStartDate
                  ? theme.colors.text
                  : theme.colors.textSecondary
              }
            >
              {checklistStartDate || "Select start date"}
            </Text>
            <CalendarDays size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          {!checklistAllDay ? (
            <>
              <Text variant="small" weight="600" style={{ marginBottom: 6 }}>
                Start Time
              </Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowChecklistStartTimeModal(true)}
              >
                <Text
                  color={
                    checklistStartTime
                      ? theme.colors.text
                      : theme.colors.textSecondary
                  }
                >
                  {checklistStartTime || "Select start time"}
                </Text>
              </TouchableOpacity>
            </>
          ) : null}

          <Text variant="small" weight="600" style={{ marginBottom: 6 }}>
            End Date
          </Text>
          <TouchableOpacity
            style={[
              styles.input,
              {
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              },
            ]}
            onPress={() => {
              setChecklistDateTarget("end");
              setShowChecklistDatePicker(true);
            }}
          >
            <Text
              color={
                checklistEndDate
                  ? theme.colors.text
                  : theme.colors.textSecondary
              }
            >
              {checklistEndDate || "Select end date"}
            </Text>
            <CalendarDays size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          {!checklistAllDay ? (
            <>
              <Text variant="small" weight="600" style={{ marginBottom: 6 }}>
                End Time
              </Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowChecklistEndTimeModal(true)}
              >
                <Text
                  color={
                    checklistEndTime
                      ? theme.colors.text
                      : theme.colors.textSecondary
                  }
                >
                  {checklistEndTime || "Select end time"}
                </Text>
              </TouchableOpacity>
            </>
          ) : null}

          {/* Checklist Items */}
          <Text
            variant="small"
            weight="600"
            style={{ marginTop: 8, marginBottom: 6 }}
          >
            Checklist Items
          </Text>
          {checklistItems.map((item, idx) => (
            <View
              key={item.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <CheckCircle2
                size={16}
                color={theme.colors.primary}
                style={{ marginRight: 8 }}
              />
              <Text variant="small" style={{ flex: 1 }}>
                {item.label}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  setChecklistItems((prev) => prev.filter((_, i) => i !== idx))
                }
                style={{ padding: 4 }}
              >
                <Text variant="small" color={theme.colors.error} weight="700">
                  ✕
                </Text>
              </TouchableOpacity>
            </View>
          ))}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <TextInput
              style={[styles.input, { flex: 1, marginTop: 0, marginBottom: 0 }]}
              placeholder="Add checklist item..."
              value={newChecklistItemText}
              onChangeText={setNewChecklistItemText}
              returnKeyType="done"
              onSubmitEditing={() => {
                const label = newChecklistItemText.trim();
                if (!label) return;
                setChecklistItems((prev) => [
                  ...prev,
                  {
                    id: `item-${Date.now()}`,
                    label,
                    required: true,
                    done: false,
                  },
                ]);
                setNewChecklistItemText("");
              }}
            />
            <TouchableOpacity
              style={[
                styles.selectChip,
                styles.selectChipActive,
                { marginBottom: 0, marginRight: 0 },
              ]}
              onPress={() => {
                const label = newChecklistItemText.trim();
                if (!label) return;
                setChecklistItems((prev) => [
                  ...prev,
                  {
                    id: `item-${Date.now()}`,
                    label,
                    required: true,
                    done: false,
                  },
                ]);
                setNewChecklistItemText("");
              }}
            >
              <Text variant="small" weight="700" color={theme.colors.white}>
                Add
              </Text>
            </TouchableOpacity>
          </View>

          {/* Assign Team */}
          <Text variant="small" style={{ marginBottom: 6, marginTop: 4 }}>
            Assign to Teams or Groups (Sharing)
          </Text>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 12 }}
          >
            {(teamRows || []).map((team) => {
              const isActive = selectedChecklistGroupIds.includes(team.id);
              return (
                <TouchableOpacity
                  key={`check-team-${team.id}`}
                  style={[
                    styles.selectChip,
                    isActive ? styles.selectChipActive : null,
                  ]}
                  onPress={() =>
                    setSelectedChecklistGroupIds((prev) =>
                      isActive
                        ? prev.filter((id) => id !== team.id)
                        : [...prev, team.id],
                    )
                  }
                >
                  <Text
                    variant="small"
                    weight="700"
                    color={isActive ? theme.colors.white : theme.colors.text}
                  >
                    {team.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Button
            title="Create Checklist"
            size="small"
            onPress={() => {
              const mergedItems = [
                ...checklistItems,
                ...textToChecklistItems(checklistItemsText),
              ];
              saveChecklist(mergedItems);
            }}
          />
        </Card>
      ) : null}

      {(checklists || []).map((checklist) => {
        const doneCount = (checklist.items || []).filter(
          (item) => item.done,
        ).length;
        const totalCount = (checklist.items || []).length;

        return (
          <Card key={checklist.id} style={styles.panelCard}>
            <View style={styles.sectionHeaderRow}>
              <ClipboardCheck color={theme.colors.primary} size={20} />
              <View style={{ marginLeft: 8, flex: 1 }}>
                <Text variant="h4">{checklist.title}</Text>
                <Text variant="small">
                  {checklist.category || "general"} | {doneCount}/{totalCount}{" "}
                  done
                </Text>
                <Text variant="small" color={theme.colors.textSecondary}>
                  Team: {checklist.teamName || checklist.teamId || "Unassigned"}
                </Text>
              </View>
              {renderBadge(
                checklist.dueDate || "No due date",
                !!checklist.dueDate,
              )}
            </View>

            {(checklist.items || []).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.checkRow}
                onPress={async () => {
                  try {
                    await toggleChecklistItemDone(
                      activeClubId,
                      checklist.id,
                      item.id,
                      {
                        done: !item.done,
                        userId: user?.uid || "",
                        userName: profile?.displayName || profile?.email || "",
                      },
                    );
                  } catch (err) {
                    console.error("Checklist toggle error:", err);
                    Alert.alert(
                      "Error",
                      err?.message ||
                      "Could not update checklist item. Please try again.",
                    );
                  }
                }}
              >
                <CheckCircle2
                  size={18}
                  color={item.done ? theme.colors.primary : theme.colors.border}
                />
                <Text
                  variant="body"
                  style={[
                    { marginLeft: 8, flex: 1 },
                    item.done ? styles.doneText : null,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </Card>
        );
      })}
    </>
  );

  const renderTeamComplianceTab = () => (
    <>
      {(teamRows || []).map((team) => {
        const row = complianceByTeamId.get(team.id) || {};

        return (
          <Card key={team.id} style={styles.panelCard}>
            <View style={styles.sectionHeaderRow}>
              <ShieldCheck color={theme.colors.primary} size={20} />
              <View
                style={{
                  marginLeft: 8,
                  flex: 1,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View>
                  <Text variant="h4">{team.name}</Text>
                  <Text variant="small">Team compliance roles</Text>
                </View>
                {isStaff && (
                  <Button
                    title={
                      editingComplianceTeamId === team.id
                        ? "Done"
                        : "Edit Roles"
                    }
                    variant="outline"
                    size="small"
                    onPress={() =>
                      setEditingComplianceTeamId(
                        editingComplianceTeamId === team.id ? "" : team.id,
                      )
                    }
                  />
                )}
              </View>
            </View>

            {editingComplianceTeamId === team.id && (
              <View
                style={{
                  marginBottom: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <TextInput
                  style={[
                    styles.input,
                    { flex: 1, marginBottom: 0, paddingVertical: 6 },
                  ]}
                  placeholder="New Role (e.g. U6 Helper)"
                  value={newComplianceRole}
                  onChangeText={setNewComplianceRole}
                />
                <Button
                  title="Add"
                  size="small"
                  onPress={() => addComplianceRole(team)}
                />
              </View>
            )}

            <View style={styles.complianceGrid}>
              {(Array.isArray(row.requiredRoles) && row.requiredRoles.length > 0
                ? row.requiredRoles
                : [
                  "Coach Accredited",
                  "Manager",
                  "Safety Officer",
                  "Sports Trainer",
                ]
              ).map((roleName) => {
                const assignedRoles = Array.isArray(row.assignedRoles)
                  ? row.assignedRoles
                  : [];

                let isAssignedBadge = assignedRoles.includes(roleName);
                if (
                  roleName === "Coach Accredited" &&
                  row.coachAccredited &&
                  !assignedRoles.includes(roleName)
                )
                  isAssignedBadge = true;
                if (
                  roleName === "Manager" &&
                  row.managerAssigned &&
                  !assignedRoles.includes(roleName)
                )
                  isAssignedBadge = true;
                if (
                  roleName === "Safety Officer" &&
                  row.safetyOfficerAssigned &&
                  !assignedRoles.includes(roleName)
                )
                  isAssignedBadge = true;
                if (
                  roleName === "Sports Trainer" &&
                  row.sportsTrainerAssigned &&
                  !assignedRoles.includes(roleName)
                )
                  isAssignedBadge = true;

                return (
                  <View
                    key={roleName}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 8,
                      marginRight: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <TouchableOpacity
                      style={[
                        styles.complianceChip,
                        { marginBottom: 0, marginRight: 4 },
                      ]}
                      onPress={() => toggleTeamComplianceRole(team, roleName)}
                    >
                      {renderBadge(roleName, isAssignedBadge)}
                    </TouchableOpacity>
                    {editingComplianceTeamId === team.id && (
                      <TouchableOpacity
                        onPress={() => removeComplianceRole(team, roleName)}
                        style={{ padding: 4 }}
                      >
                        <Text
                          variant="small"
                          color={theme.colors.error}
                          weight="700"
                        >
                          X
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          </Card>
        );
      })}
    </>
  );

  const renderDrillLibraryTab = () => (
    <>
      <Card style={styles.panelCard}>
        <View style={styles.sectionHeaderRow}>
          <Video color={theme.colors.primary} size={20} />
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginLeft: 8,
            }}
          >
            <Text variant="h4">Drill Library</Text>
          </View>
        </View>

        <View style={styles.searchBarWrap}>
          <Search
            color={theme.colors.textSecondary}
            size={18}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.drillSearchInput}
            placeholder="Search drills by title or category..."
            placeholderTextColor={theme.colors.textSecondary}
            value={drillSearchQuery}
            onChangeText={setDrillSearchQuery}
          />
        </View>

        {(drills || [])
          .filter((d) => {
            if (!drillSearchQuery.trim()) return true;
            const q = drillSearchQuery.toLowerCase();
            return (
              d.title?.toLowerCase().includes(q) ||
              d.category?.toLowerCase().includes(q)
            );
          })
          .map((drill) => (
            <TouchableOpacity
              key={drill.id}
              style={styles.drillListItem}
              onPress={() => setActiveDrillModal(drill)}
            >
              <View style={styles.drillItemInfo}>
                <Text variant="body" weight="700" style={styles.drillItemTitle}>
                  {drill.title}
                </Text>
                <Text variant="small" color={theme.colors.textSecondary}>
                  Shared with:{" "}
                  {drill.assignedGroupNames ||
                    drill.teamName ||
                    drill.teamId ||
                    "Club"}
                </Text>
              </View>
              <View style={styles.drillItemActions}>
                {drill.videoUrl ? (
                  <TouchableOpacity
                    style={styles.drillActionBtn}
                    onPress={() => Linking.openURL(drill.videoUrl)}
                  >
                    <PlayCircle size={18} color={theme.colors.primary} />
                    <Text
                      variant="small"
                      color={theme.colors.primary}
                      weight="700"
                      style={{ marginLeft: 4 }}
                    >
                      Watch
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {isStaff && (
                  <TouchableOpacity
                    style={styles.drillActionBtn}
                    onPress={() => {
                      navigation.navigate("CreateItem", {
                        type: "Drill",
                        title: "Edit Drill",
                        initialData: drill,
                      });
                    }}
                  >
                    <Settings size={16} color={theme.colors.primary} />
                    <Text
                      variant="small"
                      color={theme.colors.primary}
                      weight="700"
                      style={{ marginLeft: 4 }}
                    >
                      Edit/Share
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          ))}
      </Card>
    </>
  );

  const renderCreatePlanTab = () => (
    <>
      {isStaff ? (
        <Card style={styles.panelCard}>
          <Text variant="h4">
            {editingTrainingPlan
              ? "Edit Training Plan"
              : "Create Training Plan"}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Plan title"
            value={planTitle}
            onChangeText={setPlanTitle}
          />
          <TextInput
            style={styles.input}
            placeholder="Objective"
            value={planObjective}
            onChangeText={setPlanObjective}
          />
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowPlanDatePicker(true)}
          >
            <Text
              color={planDate ? theme.colors.text : theme.colors.textSecondary}
            >
              {planDate || "Session date (YYYY-MM-DD)"}
            </Text>
          </TouchableOpacity>

          <Text variant="small" weight="700" style={{ marginBottom: 8 }}>
            Team
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 10 }}
          >
            {(teamRows || []).map((team) => (
              <TouchableOpacity
                key={team.id}
                style={[
                  styles.selectChip,
                  selectedTeamId === team.id ? styles.selectChipActive : null,
                ]}
                onPress={() => setSelectedTeamId(team.id)}
              >
                <Text
                  variant="small"
                  weight="700"
                  color={
                    selectedTeamId === team.id
                      ? theme.colors.white
                      : theme.colors.text
                  }
                >
                  {team.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text variant="small" weight="700" style={{ marginBottom: 8 }}>
            Select Drills
          </Text>
          <TouchableOpacity
            style={[
              styles.input,
              {
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 0,
                marginBottom: 16,
              },
            ]}
            onPress={() => setShowDrillDropdown(true)}
          >
            <Text
              color={
                selectedDrillIds.length > 0
                  ? theme.colors.text
                  : theme.colors.textSecondary
              }
            >
              {selectedDrillIds.length > 0
                ? `${selectedDrillIds.length} drills selected`
                : "Choose Drills..."}
            </Text>
            <ChevronDown size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <View style={{ flexDirection: "row", gap: 10 }}>
            {editingTrainingPlan ? (
              <Button
                title="Cancel"
                size="small"
                variant="outline"
                onPress={() => {
                  setPlanTitle("");
                  setPlanObjective("");
                  setPlanDate("");
                  setSelectedDrillIds([]);
                  setSelectedTeamId("");
                  setEditingTrainingPlan(null);
                  setTabIndex(5);
                }}
                style={{ flex: 1 }}
              />
            ) : null}
            <Button
              title={editingTrainingPlan ? "Update Plan" : "Create Plan"}
              size="small"
              onPress={saveTrainingPlan}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      ) : null}
    </>
  );

  const renderTrainingPlansTab = () => (
    <>
      <Card style={styles.panelCard}>
        <Text variant="h4">Saved Training Plans</Text>
        {(trainingPlans || []).length === 0 ? (
          <Text variant="small" style={{ marginTop: 8 }}>
            No training plans yet.
          </Text>
        ) : (
          (trainingPlans || []).map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={styles.planRow}
              onPress={() => setActivePlanModal(plan)}
            >
              <View style={{ flex: 1 }}>
                <Text variant="body" weight="600">
                  {plan.title}
                </Text>
                <Text variant="small">
                  {plan.teamName || "Club"} | {plan.sessionDate || "No date"}
                </Text>
                <Text variant="small">
                  {(plan.drillIds || []).length} drills
                </Text>
              </View>
              <View style={styles.planDrillsCol}>
                {(plan.drillIds || []).slice(0, 3).map((drillId) => {
                  const drill = drillById.get(drillId);
                  return (
                    <Text
                      key={drillId}
                      variant="small"
                      color={theme.colors.textSecondary}
                    >
                      - {drill?.title || "Drill"}
                    </Text>
                  );
                })}
              </View>
            </TouchableOpacity>
          ))
        )}
      </Card>
    </>
  );

  const renderFamilyTab = () => (
    <>
      <Card style={styles.panelCard}>
        <Text variant="h4">Parent My Family Dashboard</Text>
        <Text variant="small" style={{ marginTop: 6 }}>
          Player profile is the source of truth, with optional player login and
          parent approval controls.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Player name"
          value={newChildName}
          onChangeText={setNewChildName}
        />
        <TextInput
          style={styles.input}
          placeholder="Optional player login UID"
          value={newChildLinkedPlayerUid}
          onChangeText={setNewChildLinkedPlayerUid}
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[
            styles.selectChip,
            { alignSelf: "flex-start", marginTop: 10 },
          ]}
          onPress={() => setNewChildNeedsApproval((prev) => !prev)}
        >
          <Text variant="small" weight="700">
            Parent approval for payments: {newChildNeedsApproval ? "On" : "Off"}
          </Text>
        </TouchableOpacity>

        <Text variant="small" weight="700" style={{ marginBottom: 8 }}>
          Child Team
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(teamRows || []).map((team) => (
            <TouchableOpacity
              key={team.id}
              style={[
                styles.selectChip,
                newChildTeamId === team.id ? styles.selectChipActive : null,
              ]}
              onPress={() => setNewChildTeamId(team.id)}
            >
              <Text
                variant="small"
                weight="700"
                color={
                  newChildTeamId === team.id
                    ? theme.colors.white
                    : theme.colors.text
                }
              >
                {team.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ marginTop: 12 }}>
          <Button title="Add Child" size="small" onPress={addChild} />
        </View>
      </Card>

      {(parentPlayerProfiles.length > 0
        ? parentPlayerProfiles
        : childrenDraft
      ).map((child) => {
        const childEvents = (events || [])
          .filter((event) => {
            if (event.openToAll === true) return true;
            if (!child.teamId) return true;
            return event.teamId === child.teamId;
          })
          .slice(0, 5);

        return (
          <Card key={child.id} style={styles.panelCard}>
            <View style={styles.sectionHeaderRow}>
              <Users color={theme.colors.primary} size={20} />
              <View style={{ marginLeft: 8, flex: 1 }}>
                <Text variant="h4">{child.name}</Text>
                <Text variant="small">
                  {(teamRows || []).find((team) => team.id === child.teamId)
                    ?.name || "No team selected"}
                </Text>
                <Text variant="small" style={{ marginTop: 2 }}>
                  Login linked: {child?.linkedPlayerUserUid ? "Yes" : "No"} |
                  Payment approval:{" "}
                  {child?.paymentPolicy?.requireParentApprovalForPayments ===
                    false || child?.requireParentApprovalForPayments === false
                    ? "Off"
                    : "On"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => removeChild(child.id)}>
                <Text variant="small" color={theme.colors.error} weight="700">
                  Remove
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.rowGap}>
              <Button
                title="Toggle Payment Approval"
                size="small"
                variant="outline"
                onPress={() => toggleChildPaymentApproval(child)}
              />
            </View>

            <View style={{ marginTop: 10 }}>
              <Text variant="small" weight="700">
                Upcoming Activities
              </Text>
              {childEvents.length === 0 ? (
                <Text variant="small" style={{ marginTop: 6 }}>
                  No upcoming activities.
                </Text>
              ) : (
                childEvents.map((event) => (
                  <View
                    key={`${child.id}-${event.id}`}
                    style={styles.activityRow}
                  >
                    <CalendarDays
                      size={14}
                      color={theme.colors.textSecondary}
                    />
                    <Text variant="small" style={{ marginLeft: 8, flex: 1 }}>
                      {event.title || "Event"} | {event.date || "TBD"}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </Card>
        );
      })}
    </>
  );

  const getHeaderTitle = () => {
    switch (tabIndex) {
      case 0:
        return "Volunteer Hub";
      case 1:
        return "Checklists";
      case 2:
        return "Compliance";
      case 3:
        return "Drill Library";
      case 4:
        return "Create Training Plan";
      case 5:
        return "Training Plans";
      case 6:
        return "Family Hub";
      default:
        return "Club Operations";
    }
  };

  const getHeaderDesc = () => {
    switch (tabIndex) {
      case 0:
        return "Manage tasks and duty assignments.";
      case 1:
        return "Create and assign team checklists.";
      case 2:
        return "Manage team roles and policies.";
      case 3:
        return "Browse and manage training drills.";
      case 4:
        return "Build a structured training session.";
      case 5:
        return "View saved team training plans.";
      case 6:
        return "Manage family profiles and limits.";
      default:
        return "";
    }
  };

  const renderTabs = () => (
    <View style={styles.tabsWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsScrollContent}
      >
        {TABS.map((tab, idx) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.topTabChip,
              tabIndex === idx ? styles.topTabChipActive : null,
            ]}
            onPress={() => setTabIndex(idx)}
          >
            <Text
              style={[
                styles.topTabChipLabel,
                {
                  color:
                    tabIndex === idx ? theme.colors.white : theme.colors.text,
                },
              ]}
              weight={tabIndex === idx ? "700" : "500"}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingRight: 48 }}>
          <TouchableOpacity
            style={{ marginRight: 12, padding: 4 }}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft color={theme.colors.text} size={26} />
          </TouchableOpacity>
          <Avatar
            source={
              activeClub?.logoUrl
                ? { uri: activeClub.logoUrl }
                : {
                  uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    activeClub?.name || "Club",
                  )}&background=108B51&color=fff&size=150`,
                }
            }
            size={40}
            isClub
          />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text variant="h3" numberOfLines={1}>{getHeaderTitle()}</Text>
            <Text variant="small" color={theme.colors.textSecondary} numberOfLines={1}>
              {getHeaderDesc()}
            </Text>
          </View>
        </View>

        {tabIndex === 3 && isStaff && (
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => {
              navigation.navigate("CreateItem", {
                type: "Drill",
                title: "Create Drill",
              });
            }}
          >
            <Plus color={theme.colors.white} size={24} />
          </TouchableOpacity>
        )}
      </View>

      {renderTabs()}

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {tabIndex === 0 ? renderVolunteerTab() : null}
        {tabIndex === 1 ? renderChecklistTab() : null}
        {tabIndex === 2 ? renderTeamComplianceTab() : null}
        {tabIndex === 3 ? renderDrillLibraryTab() : null}
        {tabIndex === 4 ? renderCreatePlanTab() : null}
        {tabIndex === 5 ? renderTrainingPlansTab() : null}
      </ScrollView>


      {/* Plan Date Modal */}
      <Modal
        visible={showPlanDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPlanDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalTitle}>
              <Text variant="h4">Select Date</Text>
            </View>
            <Calendar
              onDayPress={(day) => {
                setPlanDate(day.dateString);
                setShowPlanDatePicker(false);
              }}
              markedDates={
                planDate
                  ? {
                    [planDate]: {
                      selected: true,
                      selectedColor: theme.colors.primary,
                    },
                  }
                  : {}
              }
              theme={{
                todayTextColor: theme.colors.primary,
                arrowColor: theme.colors.primary,
                textDayFontWeight: "500",
                textMonthFontWeight: "600",
                textDayHeaderFontWeight: "600",
              }}
            />
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowPlanDatePicker(false)}
            >
              <Text variant="body" weight="600" color={theme.colors.primary}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Drill Detail Modal */}
      <Modal
        visible={!!activeDrillModal}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveDrillModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: "80%" }]}>
            <ScrollView contentContainerStyle={{ padding: theme.spacing.xl }}>
              <Text variant="h3">{activeDrillModal?.title}</Text>
              <Text variant="small" style={{ marginBottom: 12 }}>
                {activeDrillModal?.category} | {activeDrillModal?.difficulty} |{" "}
                {activeDrillModal?.durationMins} mins
              </Text>
              {activeDrillModal?.description ? (
                <Text
                  style={{
                    marginTop: 10,
                    lineHeight: 22,
                    color: theme.colors.text,
                  }}
                >
                  {activeDrillModal.description}
                </Text>
              ) : null}

              {activeDrillModal?.assignedGroupNames ||
                activeDrillModal?.teamName ? (
                <View style={{ marginTop: 20 }}>
                  <Text
                    variant="small"
                    weight="600"
                    style={{ marginBottom: 4 }}
                  >
                    Shared with
                  </Text>
                  <Text variant="small" color={theme.colors.textSecondary}>
                    {activeDrillModal.assignedGroupNames ||
                      activeDrillModal.teamName}
                  </Text>
                </View>
              ) : null}

              {(
                activeDrillModal?.videoUrls || [activeDrillModal?.videoUrl]
              ).filter(Boolean).length > 0 ? (
                <View style={{ marginTop: 20 }}>
                  <Text
                    variant="small"
                    weight="600"
                    style={{ marginBottom: 8 }}
                  >
                    Videos (
                    {
                      (
                        activeDrillModal?.videoUrls || [
                          activeDrillModal?.videoUrl,
                        ]
                      ).filter(Boolean).length
                    }
                    )
                  </Text>
                  {(activeDrillModal?.videoUrls || [activeDrillModal?.videoUrl])
                    .filter(Boolean)
                    .map((url, idx) => (
                      <Button
                        key={`video-${idx}`}
                        title={`Watch Video ${idx + 1}`}
                        variant="outline"
                        size="small"
                        style={{ marginBottom: 8 }}
                        onPress={() => Linking.openURL(url)}
                      />
                    ))}
                </View>
              ) : null}

              {isStaff ? (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 20 }}>
                  <Button
                    title="Edit"
                    variant="outline"
                    size="small"
                    style={{ flex: 1 }}
                    onPress={() => {
                      const drill = activeDrillModal;
                      setActiveDrillModal(null);
                      navigation.navigate("CreateItem", {
                        type: "Drill",
                        title: "Edit Drill",
                        initialData: drill,
                      });
                    }}
                  />
                  <Button
                    title="Share"
                    variant="outline"
                    size="small"
                    style={{ flex: 1 }}
                    onPress={() => {
                      const drill = activeDrillModal;
                      setActiveDrillModal(null);
                      navigation.navigate("CreateItem", {
                        type: "Drill",
                        title: "Share Drill",
                        initialData: drill,
                      });
                    }}
                  />
                  <Button
                    title="Delete"
                    variant="outline"
                    size="small"
                    style={{ flex: 1 }}
                    onPress={() => {
                      Alert.alert(
                        "Delete Drill",
                        "Are you sure you want to delete this drill?",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: async () => {
                              try {
                                await deleteDrill(
                                  activeClubId,
                                  activeDrillModal.id,
                                );
                                Alert.alert("Success", "Drill deleted");
                                setActiveDrillModal(null);
                              } catch {
                                Alert.alert("Error", "Could not delete drill");
                              }
                            },
                          },
                        ],
                      );
                    }}
                  />
                </View>
              ) : null}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setActiveDrillModal(null)}
            >
              <Text variant="body" weight="600" color={theme.colors.primary}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Plan Detail Modal */}
      <Modal
        visible={!!activePlanModal}
        transparent
        animationType="slide"
        onRequestClose={() => setActivePlanModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: "80%" }]}>
            <ScrollView contentContainerStyle={{ padding: theme.spacing.xl }}>
              <Text variant="h3">{activePlanModal?.title}</Text>
              <Text variant="small" style={{ marginBottom: 12 }}>
                {activePlanModal?.teamName || "Club"} |{" "}
                {activePlanModal?.sessionDate || "No date"}
              </Text>
              {activePlanModal?.objective ? (
                <Text
                  style={{
                    marginTop: 10,
                    lineHeight: 22,
                    fontStyle: "italic",
                    color: theme.colors.text,
                  }}
                >
                  "{activePlanModal.objective}"
                </Text>
              ) : null}

              <Text variant="h4" style={{ marginTop: 20, marginBottom: 10 }}>
                Drills ({activePlanModal?.drillIds?.length || 0})
              </Text>
              {(activePlanModal?.drillIds || []).map((drillId, idx) => {
                const drill = drillById.get(drillId);
                return (
                  <View
                    key={`${drillId}-${idx}`}
                    style={{
                      marginBottom: 16,
                      padding: 12,
                      backgroundColor: theme.colors.background,
                      borderRadius: theme.radius.sm,
                    }}
                  >
                    <Text variant="body" weight="600">
                      {idx + 1}. {drill?.title || "Unknown Drill"}
                    </Text>
                    {drill?.category && (
                      <Text variant="small">
                        {drill.category} • {drill.durationMins}m
                      </Text>
                    )}
                    {drill?.description && (
                      <Text
                        variant="small"
                        style={{ marginTop: 6 }}
                        numberOfLines={3}
                      >
                        {drill.description}
                      </Text>
                    )}
                  </View>
                );
              })}

              {isStaff ? (
                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    marginTop: 20,
                    flexWrap: "wrap",
                  }}
                >
                  <Button
                    title="Edit"
                    variant="outline"
                    size="small"
                    style={{ flex: 1, minWidth: 80 }}
                    onPress={() => {
                      if (!activePlanModal) return;
                      setEditingTrainingPlan(activePlanModal);
                      setPlanTitle(activePlanModal.title || "");
                      setPlanObjective(activePlanModal.objective || "");
                      setPlanDate(activePlanModal.sessionDate || "");
                      setSelectedTeamId(activePlanModal.teamId || "");
                      setSelectedDrillIds(
                        Array.isArray(activePlanModal.drillIds)
                          ? activePlanModal.drillIds
                          : [],
                      );
                      setActivePlanModal(null);
                      setTabIndex(4);
                    }}
                  />
                  <Button
                    title="Share"
                    variant="outline"
                    size="small"
                    style={{ flex: 1, minWidth: 80 }}
                    onPress={() => {
                      setShowSharePlanModal(activePlanModal);
                    }}
                  />
                  <Button
                    title="Delete"
                    variant="outline"
                    size="small"
                    style={{ flex: 1, minWidth: 80 }}
                    onPress={() => {
                      Alert.alert(
                        "Delete Plan",
                        "Are you sure you want to delete this training plan?",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: async () => {
                              try {
                                const { deleteTrainingPlan } =
                                  await import("../../services/clubOperationsService");
                                await deleteTrainingPlan(
                                  activeClubId,
                                  activePlanModal.id,
                                );
                                Alert.alert("Success", "Training plan deleted");
                                setActivePlanModal(null);
                              } catch {
                                Alert.alert(
                                  "Error",
                                  "Could not delete training plan",
                                );
                              }
                            },
                          },
                        ],
                      );
                    }}
                  />
                </View>
              ) : null}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setActivePlanModal(null)}
            >
              <Text variant="body" weight="600" color={theme.colors.primary}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Drill Selection Dropdown Modal */}
      <Modal
        visible={showDrillDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDrillDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: "70%" }]}>
            <View style={styles.modalTitle}>
              <Text variant="h4">Select Drills</Text>
            </View>
            <FlatList
              data={drills || []}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: theme.spacing.md }}
              renderItem={({ item }) => {
                const selected = selectedDrillIds.includes(item.id);
                const isShared = (item.assignedGroupIds || []).includes(
                  selectedTeamId,
                );
                return (
                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.colors.background,
                    }}
                    onPress={() => {
                      setSelectedDrillIds((prev) =>
                        prev.includes(item.id)
                          ? prev.filter((id) => id !== item.id)
                          : [...prev, item.id],
                      );
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text variant="body" weight="600">
                        {item.title}
                      </Text>
                      <Text
                        variant="small"
                        color={
                          isShared
                            ? theme.colors.primary
                            : theme.colors.textSecondary
                        }
                        weight={isShared ? "700" : "400"}
                      >
                        {isShared
                          ? "✓ Shared with this team"
                          : item.category || "General"}
                      </Text>
                    </View>
                    {selected && (
                      <CheckCircle2 size={20} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowDrillDropdown(false)}
            >
              <Text variant="body" weight="600" color={theme.colors.primary}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Checklist Date Picker */}
      <Modal
        visible={showChecklistDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowChecklistDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { padding: theme.spacing.md }]}>
            <Text
              variant="h4"
              style={{
                marginBottom: theme.spacing.md,
                paddingHorizontal: theme.spacing.sm,
              }}
            >
              {checklistDateTarget === "end"
                ? "Select End Date"
                : "Select Start Date"}
            </Text>
            <Calendar
              onDayPress={(day) => {
                if (checklistDateTarget === "end") {
                  setChecklistEndDate(day.dateString);
                } else {
                  setChecklistStartDate(day.dateString);
                  if (!checklistEndDate || day.dateString > checklistEndDate) {
                    setChecklistEndDate(day.dateString);
                  }
                }
                setShowChecklistDatePicker(false);
              }}
              markedDates={{
                ...(checklistStartDate
                  ? {
                    [checklistStartDate]: {
                      selected: true,
                      selectedColor: theme.colors.primary,
                    },
                  }
                  : {}),
                ...(checklistEndDate && checklistEndDate !== checklistStartDate
                  ? {
                    [checklistEndDate]: {
                      selected: true,
                      selectedColor: theme.colors.primary,
                    },
                  }
                  : {}),
              }}
              theme={{
                todayTextColor: theme.colors.primary,
                arrowColor: theme.colors.primary,
                textDayFontWeight: "500",
                textMonthFontWeight: "600",
                textDayHeaderFontWeight: "600",
              }}
            />
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowChecklistDatePicker(false)}
            >
              <Text variant="body" weight="600" color={theme.colors.primary}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TimePickerModal
        visible={showChecklistStartTimeModal}
        onClose={() => setShowChecklistStartTimeModal(false)}
        onSelect={setChecklistStartTime}
        selectedTime={checklistStartTime}
        title="Start Time"
      />
      <TimePickerModal
        visible={showChecklistEndTimeModal}
        onClose={() => setShowChecklistEndTimeModal(false)}
        onSelect={setChecklistEndTime}
        selectedTime={checklistEndTime}
        title="End Time"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    position: 'relative',
  },
  headerActionBtn: {
    position: 'absolute',
    right: theme.spacing.md,
    top: theme.spacing.md,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsWrap: {
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabsScrollContent: {
    paddingHorizontal: theme.spacing.md,
    alignItems: "center",
  },
  topTabChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  topTabChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  topTabChipLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: 2,
    paddingBottom: 100,
  },
  panelCard: {
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    alignItems: "center",
  },
  rowGap: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    marginTop: 10,
    color: theme.colors.text,
  },
  multilineInput: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  doneText: {
    textDecorationLine: "line-through",
    opacity: 0.55,
  },
  complianceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    gap: 8,
  },
  complianceChip: {
    marginBottom: 2,
  },
  drillListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + "40",
  },
  drillItemInfo: {
    flex: 1,
  },
  drillItemTitle: {
    marginBottom: 2,
    color: theme.colors.text,
  },
  drillItemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  drillActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary + "10",
  },
  searchBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 20,
    paddingHorizontal: 14,
    height: 44,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  drillSearchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text,
    height: "100%",
    paddingVertical: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
  },
  modalTitle: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalCloseBtn: {
    alignItems: "center",
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  drillFab: {
    position: "absolute",
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 99,
  },
});
