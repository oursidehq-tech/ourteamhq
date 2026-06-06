import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Save, Camera, Plus, Trash2 } from "lucide-react-native";
import { Calendar } from "react-native-calendars";
import { TimePickerModal } from "../../components/ui/TimePickerModal";
import { Text } from "../../components/ui/Typography";
import { Button } from "../../components/ui/Button";
import { theme } from "../../theme/theme";
import { useClub } from "../../contexts/ClubContext";
import { useAuth } from "../../contexts/AuthContext";
import { createTeam, assignMembersToTeam } from "../../services/teamService";
import { getTeams } from "../../services/teamService";
import { createEvent } from "../../services/eventService";
import { createTask } from "../../services/managementService";
import { createRoster } from "../../services/managementService";
import {
  createTaskTemplate,
  updateTaskTemplate,
} from "../../services/managementService";
import {
  createRosterTemplate,
  updateRosterTemplate,
} from "../../services/managementService";
import { createTrade } from "../../services/managementService";
import { getGroups } from "../../services/managementService";
import { createProduct, updateProduct } from "../../services/shopService";
import { uploadProductImage } from "../../services/storageService";
import { getClubMembers } from "../../services/clubService";
import * as ImagePicker from "expo-image-picker";

const normalizeVisibility = (value) => {
  const normalized = (value || "club").toLowerCase();
  if (normalized === "public") return "public";
  if (normalized === "network") return "network";
  return "club";
};

const parseVariants = (rawInput, fallbackStock) => {
  const baseStock = parseInt(fallbackStock, 10);
  const normalizedBaseStock = Number.isFinite(baseStock) ? baseStock : -1;
  const tokens = rawInput
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return [{ label: "One Size", stock: normalizedBaseStock }];
  }

  return tokens
    .map((token) => {
      const [labelPart, stockPart] = token.split(":");
      const label = (labelPart || "").trim();
      const parsedStock = parseInt((stockPart || "").trim(), 10);
      const variantStock = Number.isFinite(parsedStock)
        ? parsedStock
        : normalizedBaseStock;
      return {
        label,
        stock: variantStock,
      };
    })
    .filter((variant) => !!variant.label);
};

const normalizeIsoDateInput = (value) => {
  const input = (value || "").trim();
  if (!input) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  // Accept YYYY/MM/DD and normalize to YYYY-MM-DD.
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(input)) {
    return input.replace(/\//g, "-");
  }

  return "";
};

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const ORDINAL_WORDS = ["first", "second", "third", "fourth", "fifth"];

const parseIsoDateAtMidday = (value) => {
  const normalized = normalizeIsoDateInput(value);
  if (!normalized) return null;
  const parsed = new Date(`${normalized}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatIsoDateLabel = (value) => {
  const date = parseIsoDateAtMidday(value);
  if (!date) return "";
  return `${date.getDate()} ${MONTH_SHORT[date.getMonth()]} ${date.getFullYear()}`;
};

const getWeekdayName = (value) => {
  const date = parseIsoDateAtMidday(value);
  if (!date) return "";
  return WEEKDAY_FULL[date.getDay()] || "";
};

const getWeekdayIndex = (value) => {
  const date = parseIsoDateAtMidday(value);
  if (!date) return null;
  return date.getDay();
};

const getNthWeekdayLabel = (value) => {
  const date = parseIsoDateAtMidday(value);
  if (!date) return "";
  const weekOfMonth = Math.floor((date.getDate() - 1) / 7) + 1;
  const ordinal =
    ORDINAL_WORDS[Math.min(weekOfMonth - 1, ORDINAL_WORDS.length - 1)];
  const weekday = WEEKDAY_FULL[date.getDay()] || "day";
  return `On every ${ordinal} ${weekday}`;
};

const parseMeridiemTimeToMinutes = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();
  if (hour < 1 || hour > 12 || minutes < 0 || minutes > 59) return null;
  if (hour === 12) hour = 0;
  if (meridiem === "PM") hour += 12;
  return hour * 60 + minutes;
};

const normalizeRepeatInterval = (value) => {
  const parsed = parseInt(value, 10);
  return Math.max(1, Number.isFinite(parsed) ? parsed : 1);
};

const normalizeEventRepeatRule = ({
  repeatPreset,
  customRepeatFrequency,
  customRepeatInterval,
  customMonthlyMode,
  customRepeatWeekDays,
  baseDate,
  customRepeatEnds,
  customRepeatEndDate,
}) => {
  const weekdayIndex = getWeekdayIndex(baseDate);
  const customInterval = normalizeRepeatInterval(customRepeatInterval);

  if (repeatPreset === "none") {
    return null;
  }

  if (repeatPreset === "daily") {
    return { frequency: "daily", interval: 1 };
  }

  if (repeatPreset === "weekly") {
    return {
      frequency: "weekly",
      interval: 1,
      weekDays: Number.isInteger(weekdayIndex) ? [weekdayIndex] : undefined,
    };
  }

  if (repeatPreset === "monthly") {
    return {
      frequency: "monthly",
      interval: 1,
      monthlyMode: "same_day",
    };
  }

  if (repeatPreset === "yearly") {
    return {
      frequency: "yearly",
      interval: 1,
    };
  }

  if (repeatPreset === "custom") {
    const frequency = (customRepeatFrequency || "weekly").toLowerCase();
    const base = {
      frequency,
      interval: customInterval,
    };

    // Apply ends settings
    if (customRepeatEnds === "date" && customRepeatEndDate) {
      const normalized = normalizeIsoDateInput(customRepeatEndDate);
      if (normalized) {
        base.untilDate = normalized;
      }
    }

    if (frequency === "weekly") {
      const days =
        Array.isArray(customRepeatWeekDays) && customRepeatWeekDays.length > 0
          ? customRepeatWeekDays
          : Number.isInteger(weekdayIndex)
            ? [weekdayIndex]
            : undefined;
      return {
        ...base,
        weekDays: days,
      };
    }

    if (frequency === "monthly") {
      return {
        ...base,
        monthlyMode: customMonthlyMode || "same_day",
      };
    }

    return base;
  }

  return null;
};

const CreateItemScreen = ({ navigation, route }) => {
  const { activeClubId, isClubStaff } = useClub();
  const { user, profile, isSuperAdmin } = useAuth();
  const canManageClubItems = isClubStaff || isSuperAdmin;
  const {
    title: routeTitle,
    type = "Event",
    initialEventDate,
    initialTaskDate,
    initialShiftDate,
    prefillDate,
    isTemplate: isShiftTemplate,
    initialData,
    initialCreateAsTemplate,
  } = route.params || {};
  const title = routeTitle || `Create ${type}`;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [eventStartDate, setEventStartDate] = useState(
    initialEventDate || prefillDate || "",
  );
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventAllDay, setEventAllDay] = useState(true);
  const [isAllDay, setIsAllDay] = useState(true);
  const [location, setLocation] = useState("");
  const [eventCategory, setEventCategory] = useState("event");
  const [eventOpenToAll, setEventOpenToAll] = useState(false);
  const [selectedEventGroupIds, setSelectedEventGroupIds] = useState([]);
  const [selectedEventUserIds, setSelectedEventUserIds] = useState([]);
  const [selectedEventGroups, setSelectedEventGroups] = useState([]);
  const [selectedEventUsers, setSelectedEventUsers] = useState([]);
  const [taskStartDate, setTaskStartDate] = useState(
    initialTaskDate || prefillDate || "",
  );
  const [taskEndDate, setTaskEndDate] = useState("");
  const [taskAllDay, setTaskAllDay] = useState(true);
  const [priority, setPriority] = useState("medium");
  const [openToAll, setOpenToAll] = useState(false);
  const [selectedTaskGroupIds, setSelectedTaskGroupIds] = useState([]);
  const [selectedTaskGroups, setSelectedTaskGroups] = useState([]);
  const [shiftStartDate, setShiftStartDate] = useState(
    initialShiftDate || prefillDate || "",
  );
  const [shiftEndDate, setShiftEndDate] = useState("");
  const [shiftAllDay, setShiftAllDay] = useState(true);
  const [selectedShiftGroupIds, setSelectedShiftGroupIds] = useState([]);
  const [selectedShiftGroups, setSelectedShiftGroups] = useState([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState("weekly");
  const [recurringInterval, setRecurringInterval] = useState("1");
  const [repeatPreset, setRepeatPreset] = useState("none");
  const [customRepeatFrequency, setCustomRepeatFrequency] = useState("weekly");
  const [customRepeatInterval, setCustomRepeatInterval] = useState("1");
  const [customMonthlyMode, setCustomMonthlyMode] = useState("same_day");
  const [customRepeatWeekDays, setCustomRepeatWeekDays] = useState([]);
  const [customRepeatEnds, setCustomRepeatEnds] = useState("never"); // 'never' | 'date' | 'count'
  const [customRepeatEndDate, setCustomRepeatEndDate] = useState("");
  const [customRepeatCount, setCustomRepeatCount] = useState("10");
  const [taskChecklistItems, setTaskChecklistItems] = useState([]);
  const [checklistInput, setChecklistInput] = useState("");
  const [rosterShifts, setRosterShifts] = useState([
    { role: "", startTime: "", endTime: "" },
  ]);
  const [editingShiftIndex, setEditingShiftIndex] = useState(null);
  const [datePickerTarget, setDatePickerTarget] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimeModal, setShowStartTimeModal] = useState(false);
  const [showEndTimeModal, setShowEndTimeModal] = useState(false);
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [showRepeatPresetModal, setShowRepeatPresetModal] = useState(false);
  const [showCustomRepeatModal, setShowCustomRepeatModal] = useState(false);
  const [showSelectedEventUsersModal, setShowSelectedEventUsersModal] =
    useState(false);
  const [loading, setLoading] = useState(false);
  const [ageGroup, setAgeGroup] = useState("");
  const [category, setCategory] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [price, setPrice] = useState("");
  const [assignedGroupId, setAssignedGroupId] = useState("");
  const [assignedGroupIds, setAssignedGroupIds] = useState([]);
  const [assignedGroupName, setAssignedGroupName] = useState("");
  const [assignedGroupType, setAssignedGroupType] = useState("Team");
  const [assignmentMode, setAssignmentMode] = useState("group");
  const [assigneeId, setAssigneeId] = useState("");
  const [assigneeName, setAssigneeName] = useState("");
  const [shiftOpenToAll, setShiftOpenToAll] = useState(false);
  const [createAsTemplate, setCreateAsTemplate] = useState(
    type === "Shift" ? !!isShiftTemplate : !!initialCreateAsTemplate,
  );
  const [visibility, setVisibility] = useState("club");
  const [postageOption, setPostageOption] = useState("post");
  const [productDetails, setProductDetails] = useState("");
  const [variantsInput, setVariantsInput] = useState("");
  const [stock, setStock] = useState("");
  const [productImageUri, setProductImageUri] = useState("");
  const [additionalImageUris, setAdditionalImageUris] = useState([]);
  const [sizeGuideImageUri, setSizeGuideImageUri] = useState("");
  const [clubPlayers, setClubPlayers] = useState([]);
  const [teamGroups, setTeamGroups] = useState([]);
  const [loadingTeamGroups, setLoadingTeamGroups] = useState(false);
  const [assignableMembers, setAssignableMembers] = useState([]);
  const [loadingAssignableMembers, setLoadingAssignableMembers] =
    useState(false);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState("");
  const [eventUserSearchQuery, setEventUserSearchQuery] = useState("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [allGroups, setAllGroups] = useState([]);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [groupPickerMode, setGroupPickerMode] = useState("single");
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [drillDifficulty, setDrillDifficulty] = useState("Intermediate");
  const [drillDuration, setDrillDuration] = useState("20");
  const [drillVideoUrls, setDrillVideoUrls] = useState([""]);
  const [drillImageUrls, setDrillImageUrls] = useState([""]);
  const [drillImagePreviews, setDrillImagePreviews] = useState([]);

  const isEditMode = !!initialData;
  const isTemplate =
    isShiftTemplate || (initialData && !!initialData.isTemplate);

  const repeatBaseDate =
    type === "Task"
      ? taskStartDate
      : type === "Shift"
        ? shiftStartDate
        : eventStartDate;

  const repeatWeekdayName = useMemo(
    () => getWeekdayName(repeatBaseDate),
    [repeatBaseDate],
  );

  const repeatMonthlyWeekdayLabel = useMemo(
    () => getNthWeekdayLabel(repeatBaseDate),
    [repeatBaseDate],
  );

  const repeatSummaryLabel = useMemo(() => {
    if (repeatPreset === "none") return "Does not repeat";
    if (repeatPreset === "daily") return "Every Day";
    if (repeatPreset === "weekly") {
      return repeatWeekdayName
        ? `Every Week on ${repeatWeekdayName}`
        : "Every Week";
    }
    if (repeatPreset === "monthly") return "Every Month";
    if (repeatPreset === "yearly") return "Every Year";
    if (repeatPreset === "custom") {
      const freq = (customRepeatFrequency || "weekly").toLowerCase();
      const interval = normalizeRepeatInterval(customRepeatInterval);
      const unit =
        freq === "daily"
          ? interval === 1
            ? "day"
            : "days"
          : freq === "weekly"
            ? interval === 1
              ? "week"
              : "weeks"
            : freq === "monthly"
              ? interval === 1
                ? "month"
                : "months"
              : interval === 1
                ? "year"
                : "years";
      return `Every ${interval} ${unit}`;
    }
    return "Does not repeat";
  }, [
    repeatPreset,
    repeatWeekdayName,
    customRepeatFrequency,
    customRepeatInterval,
  ]);

  useEffect(() => {
    if (type !== "Event") return;
    if (!eventStartDate && initialEventDate) {
      setEventStartDate(initialEventDate);
    }
    if (!eventEndDate && (eventStartDate || initialEventDate)) {
      setEventEndDate(eventStartDate || initialEventDate);
    }
  }, [type, eventStartDate, eventEndDate, initialEventDate]);

  useEffect(() => {
    if (type !== "Event") return;
    if (isAllDay) {
      setStartTime("");
      setEndTime("");
    }
  }, [isAllDay, type]);

  useEffect(() => {
    if (type !== "Task") return;
    if (!taskStartDate && initialTaskDate) {
      setTaskStartDate(initialTaskDate);
    }
    if (!taskEndDate && (taskStartDate || initialTaskDate)) {
      setTaskEndDate(taskStartDate || initialTaskDate);
    }
  }, [type, taskStartDate, taskEndDate, initialTaskDate]);

  useEffect(() => {
    if (type !== "Task") return;
    if (taskAllDay) {
      setStartTime("");
      setEndTime("");
    }
  }, [taskAllDay, type]);

  useEffect(() => {
    if (type !== "Task") return;
    if (!initialData) return;

    const startDate =
      initialData.startDate || initialData.dueDate || initialTaskDate || "";
    const endDate =
      initialData.endDate || initialData.startDate || initialData.dueDate || "";

    setName(initialData.name || initialData.title || "");
    setDescription(initialData.description || "");
    setTaskStartDate(startDate);
    setTaskEndDate(endDate || startDate);
    setTaskAllDay(!!initialData.isAllDay);
    setStartTime(initialData.startTime || "");
    setEndTime(initialData.endTime || "");
    setPriority(initialData.defaultPriority || initialData.priority || "medium");
    setOpenToAll(!!initialData.openToAll);

    const assignedIds = Array.isArray(initialData.assignedGroupIds)
      ? initialData.assignedGroupIds
      : initialData.assignedGroupId
        ? [initialData.assignedGroupId]
        : initialData.teamId
          ? [initialData.teamId]
          : [];
    setSelectedTaskGroupIds(assignedIds);

    if (Array.isArray(initialData.checklistItems)) {
      setTaskChecklistItems(initialData.checklistItems);
    }

    if (initialData.recurringRule) {
      const frequency = String(initialData.recurringRule.frequency || "").toLowerCase();
      const interval = initialData.recurringRule.interval || 1;
      const isPreset = ["daily", "weekly", "monthly", "yearly"].includes(frequency) && interval === 1;

      if (isPreset) {
        setRepeatPreset(frequency);
      } else {
        setRepeatPreset("custom");
        setCustomRepeatFrequency(frequency || "weekly");
        setCustomRepeatInterval(String(interval || 1));
        if (frequency === "weekly" && Array.isArray(initialData.recurringRule.weekDays)) {
          setCustomRepeatWeekDays(initialData.recurringRule.weekDays);
        }
        if (frequency === "monthly" && initialData.recurringRule.monthlyMode) {
          setCustomMonthlyMode(initialData.recurringRule.monthlyMode);
        }
        if (initialData.recurringRule.untilDate) {
          setCustomRepeatEnds("date");
          setCustomRepeatEndDate(initialData.recurringRule.untilDate);
        } else {
          setCustomRepeatEnds("never");
        }
      }
    } else {
      setRepeatPreset("none");
    }
  }, [type, initialData, initialTaskDate]);

  useEffect(() => {
    if (type !== "Shift") return;
    if (!shiftStartDate && initialShiftDate) {
      setShiftStartDate(initialShiftDate);
    }
    if (!shiftEndDate && (shiftStartDate || initialShiftDate)) {
      setShiftEndDate(shiftStartDate || initialShiftDate);
    }
  }, [type, shiftStartDate, shiftEndDate, initialShiftDate]);

  useEffect(() => {
    if (type !== "Shift") return;
    if (shiftAllDay) {
      setStartTime("");
      setEndTime("");
    }
  }, [shiftAllDay, type]);

  useEffect(() => {
    if (type !== "Shift") return;
    // Always sync template flag from route param
    setCreateAsTemplate(!!isShiftTemplate);
    if (initialData) {
      setName(initialData.name || initialData.title || "");
      setDescription(initialData.description || "");
      setShiftStartDate(initialData.startDate || initialData.date || "");
      setShiftEndDate(initialData.endDate || initialData.startDate || "");
      setShiftAllDay(!!initialData.isAllDay);
      setShiftOpenToAll(!!initialData.openToAll);
      if (Array.isArray(initialData.shifts) && initialData.shifts.length > 0) {
        setRosterShifts(initialData.shifts);
      }
      if (Array.isArray(initialData.assignedGroupIds)) {
        setSelectedShiftGroupIds(initialData.assignedGroupIds);
      }
    }
  }, [type, initialData, isShiftTemplate]);

  useEffect(() => {
    if (type !== "Drill") return;
    if (initialData) {
      setName(initialData.title || "");
      setDescription(initialData.description || "");
      setCategory(initialData.category || "General");
      setDrillDifficulty(initialData.difficulty || "Intermediate");
      setDrillDuration(String(initialData.durationMins || "20"));
      setDrillVideoUrls(
        Array.isArray(initialData.videoUrls) && initialData.videoUrls.length > 0
          ? initialData.videoUrls
          : [initialData.videoUrl || ""],
      );
      setDrillImageUrls(
        Array.isArray(initialData.imageUrls) && initialData.imageUrls.length > 0
          ? initialData.imageUrls
          : [""],
      );
      if (Array.isArray(initialData.assignedGroupIds)) {
        setSelectedTaskGroupIds(initialData.assignedGroupIds);
      }
    }
  }, [type, initialData]);

  useEffect(() => {
    if (type === "Shift") return;
    if (typeof initialCreateAsTemplate === "undefined") return;
    setCreateAsTemplate(!!initialCreateAsTemplate);
  }, [type, initialCreateAsTemplate]);

  useEffect(() => {
    let cancelled = false;

    const loadClubPlayers = async () => {
      if (type !== "Team" || !activeClubId) {
        setClubPlayers([]);
        setSelectedPlayerIds([]);
        return;
      }

      setLoadingPlayers(true);
      try {
        const members = await getClubMembers(activeClubId);
        const playersOnly = (members || []).filter(
          (member) => (member?.role || "").toLowerCase() === "player",
        );
        const sourceRows = playersOnly.length > 0 ? playersOnly : members || [];

        if (!cancelled) {
          setClubPlayers(sourceRows);
        }
      } catch {
        if (!cancelled) {
          setClubPlayers([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingPlayers(false);
        }
      }
    };

    loadClubPlayers();

    return () => {
      cancelled = true;
    };
  }, [type, activeClubId]);

  useEffect(() => {
    setAssignmentMode("group");
    setAssigneeId("");
    setAssigneeName("");
    setAssigneeSearchQuery("");
    setEventUserSearchQuery("");
  }, [type]);

  useEffect(() => {
    let cancelled = false;

    const loadAssignableMembers = async () => {
      if (
        !["Task", "Shift", "Event", "Drill"].includes(type) ||
        !activeClubId
      ) {
        setAssignableMembers([]);
        return;
      }

      setLoadingAssignableMembers(true);
      try {
        const members = await getClubMembers(activeClubId);
        if (!cancelled) {
          setAssignableMembers(Array.isArray(members) ? members : []);
        }
      } catch {
        if (!cancelled) {
          setAssignableMembers([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingAssignableMembers(false);
        }
      }
    };

    loadAssignableMembers();

    return () => {
      cancelled = true;
    };
  }, [type, activeClubId]);

  useEffect(() => {
    let cancelled = false;

    const loadTeamsAndGroups = async () => {
      if (
        !["Task", "Shift", "Event", "Drill"].includes(type) ||
        !activeClubId
      ) {
        setTeamGroups([]);
        setAllGroups([]);
        return;
      }

      setLoadingTeamGroups(true);
      try {
        const [teams, groups] = await Promise.all([
          getTeams(activeClubId),
          getGroups(activeClubId).catch(() => []),
        ]);
        if (!cancelled) {
          setTeamGroups(Array.isArray(teams) ? teams : []);
          setAllGroups(Array.isArray(groups) ? groups : []);
        }
      } catch {
        if (!cancelled) {
          setTeamGroups([]);
          setAllGroups([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingTeamGroups(false);
        }
      }
    };

    loadTeamsAndGroups();

    return () => {
      cancelled = true;
    };
  }, [type, activeClubId]);

  const handleSelectDate = (target = "single") => {
    setDatePickerTarget(target);
    setShowDatePicker(true);
  };

  const handleRepeatPresetSelect = (preset) => {
    if (preset === "custom") {
      setRepeatPreset("custom");
      setShowRepeatPresetModal(false);
      setShowCustomRepeatModal(true);
      return;
    }
    setRepeatPreset(preset);
    setShowRepeatPresetModal(false);
  };

  const handleSaveCustomRepeat = () => {
    const normalizedInterval = normalizeRepeatInterval(customRepeatInterval);
    setCustomRepeatInterval(String(normalizedInterval));
    setRepeatPreset("custom");
    setShowCustomRepeatModal(false);
  };

  const getMemberLabel = (member) => {
    const name = member?.displayName || member?.name || member?.fullName || "";
    const email = member?.email || "";
    if (name && email && name.toLowerCase() !== email.toLowerCase()) {
      return `${name} (${email})`;
    }
    return name || email || member?.id || "Member";
  };
  const getMemberSearchText = (member) =>
    `${getMemberLabel(member)} ${member?.email || ""} ${member?.name || ""} ${member?.fullName || ""}`.toLowerCase();

  const filteredClubPlayers = clubPlayers.filter((member) => {
    const query = playerSearchQuery.trim().toLowerCase();
    if (!query) return true;
    return getMemberSearchText(member).includes(query);
  });

  const togglePlayerSelection = (memberId) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId],
    );
  };

  const filteredAssignableMembers = assignableMembers
    .filter((member) => {
      const query = assigneeSearchQuery.trim().toLowerCase();
      if (!query) return true;
      return getMemberSearchText(member).includes(query);
    })
    .sort((a, b) => {
      const query = assigneeSearchQuery.trim().toLowerCase();
      if (!query) return 0;
      const aName = (a.displayName || a.name || a.fullName || "").toLowerCase();
      const bName = (b.displayName || b.name || b.fullName || "").toLowerCase();
      const aStarts = aName.startsWith(query);
      const bStarts = bName.startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return aName.localeCompare(bName);
    });

  const filteredEventAssignableMembers = useMemo(() => {
    const query = eventUserSearchQuery.trim().toLowerCase();
    if (!query) return [];

    return assignableMembers
      .filter((member) => getMemberSearchText(member).includes(query))
      .sort((a, b) => {
        const aName = (
          a.displayName ||
          a.name ||
          a.fullName ||
          ""
        ).toLowerCase();
        const bName = (
          b.displayName ||
          b.name ||
          b.fullName ||
          ""
        ).toLowerCase();
        const aStarts = aName.startsWith(query);
        const bStarts = bName.startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return aName.localeCompare(bName);
      })
      .slice(0, 30);
  }, [assignableMembers, eventUserSearchQuery]);

  // Build combined list of teams + groups for the dropdown picker
  const combinedGroupOptions = (() => {
    const options = [];
    (teamGroups || []).forEach((team) => {
      options.push({
        id: team.id,
        name: team.name || team.id,
        type: "Team",
      });
    });
    (allGroups || []).forEach((group) => {
      // Avoid duplicates if a group shares an id with a team
      if (options.some((o) => o.id === (group.groupId || group.id))) return;
      options.push({
        id: group.groupId || group.id,
        name: group.groupName || group.groupId || group.id,
        type: group.groupType || "Group",
      });
    });
    return options;
  })();

  const filteredGroupOptions = combinedGroupOptions.filter((g) => {
    const q = groupSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (g.name || "").toLowerCase().includes(q) ||
      (g.id || "").toLowerCase().includes(q) ||
      (g.type || "").toLowerCase().includes(q)
    );
  });

  const selectedEventGroupOptions = combinedGroupOptions.filter((group) =>
    selectedEventGroupIds.includes(group.id),
  );

  const selectedTaskGroupOptions = combinedGroupOptions.filter((group) =>
    selectedTaskGroupIds.includes(group.id),
  );

  const selectedShiftGroupOptions = combinedGroupOptions.filter((group) =>
    selectedShiftGroupIds.includes(group.id),
  );

  const selectedEventUserOptions = useMemo(() => {
    return selectedEventUserIds
      .map((userId) => assignableMembers.find((m) => m.id === userId))
      .filter((member) => !!member);
  }, [selectedEventUserIds, assignableMembers]);

  const toggleEventGroupSelection = (groupId) => {
    setSelectedEventGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    );
  };

  const toggleTaskGroupSelection = (groupId) => {
    setSelectedTaskGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    );
  };

  const toggleShiftGroupSelection = (groupId) => {
    setSelectedShiftGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    );
  };

  const toggleEventUserSelection = (memberId) => {
    setSelectedEventUserIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId],
    );
  };

  const renderGroupSelector = () => (
    <>
      <Text variant="h4" style={styles.label}>
        Select Team or Group
      </Text>
      <TouchableOpacity
        style={[
          styles.input,
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          },
        ]}
        onPress={() => {
          setGroupPickerMode("single");
          setGroupSearchQuery("");
          setShowGroupPicker(true);
        }}
      >
        <Text
          color={
            assignedGroupName ? theme.colors.text : theme.colors.textSecondary
          }
          style={{ flex: 1 }}
        >
          {assignedGroupName
            ? `${assignedGroupName}${assignedGroupId ? ` (${assignedGroupId})` : ""}`
            : "Tap to select a team or group..."}
        </Text>
        <Text variant="small" color={theme.colors.primary} weight="600">
          {assignedGroupName ? "Change" : "Select"}
        </Text>
      </TouchableOpacity>

      {assignedGroupName ? (
        <TouchableOpacity
          style={{ marginBottom: theme.spacing.md }}
          onPress={() => {
            setAssignedGroupId("");
            setAssignedGroupName("");
          }}
        >
          <Text variant="small" color={theme.colors.error} weight="600">
            Clear Selection
          </Text>
        </TouchableOpacity>
      ) : null}
    </>
  );

  const handleCalendarDayPress = (day) => {
    if (!day?.dateString) return;

    if (
      type === "Event" &&
      (datePickerTarget === "eventStart" || datePickerTarget === "eventEnd")
    ) {
      if (datePickerTarget === "eventStart") {
        setEventStartDate(day.dateString);
        if (!eventEndDate || day.dateString > eventEndDate) {
          setEventEndDate(day.dateString);
        }
      } else {
        if (eventStartDate && day.dateString < eventStartDate) {
          Alert.alert(
            "Invalid End Date",
            "End date cannot be earlier than start date.",
          );
          return;
        }
        setEventEndDate(day.dateString);
      }
      setShowDatePicker(false);
      return;
    }

    if (
      type === "Shift" &&
      (datePickerTarget === "shiftStart" || datePickerTarget === "shiftEnd")
    ) {
      if (datePickerTarget === "shiftStart") {
        setShiftStartDate(day.dateString);
        if (!shiftEndDate || day.dateString > shiftEndDate) {
          setShiftEndDate(day.dateString);
        }
      } else {
        if (shiftStartDate && day.dateString < shiftStartDate) {
          Alert.alert(
            "Invalid End Date",
            "End date cannot be earlier than start date.",
          );
          return;
        }
        setShiftEndDate(day.dateString);
      }
      setShowDatePicker(false);
      return;
    }

    if (
      type === "Task" &&
      (datePickerTarget === "taskStart" || datePickerTarget === "taskEnd")
    ) {
      if (datePickerTarget === "taskStart") {
        setTaskStartDate(day.dateString);
        if (!taskEndDate || day.dateString > taskEndDate) {
          setTaskEndDate(day.dateString);
        }
      } else {
        if (taskStartDate && day.dateString < taskStartDate) {
          Alert.alert(
            "Invalid End Date",
            "End date cannot be earlier than start date.",
          );
          return;
        }
        setTaskEndDate(day.dateString);
      }
      setShowDatePicker(false);
      return;
    }

    setDateTime(day.dateString);
    setShowDatePicker(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(
        "Required",
        `Please enter a name for the ${type.toLowerCase()}.`,
      );
      return;
    }
    if (!activeClubId) {
      Alert.alert("Error", "No active club selected.");
      return;
    }

    if (["Team", "Task", "Shift"].includes(type) && !canManageClubItems) {
      Alert.alert(
        "Not allowed",
        "Only club staff can create teams, tasks, or roster shifts.",
      );
      return;
    }

    if (type === "Event") {
      const normalizedStartDate = normalizeIsoDateInput(eventStartDate);
      const normalizedEndDate = normalizeIsoDateInput(
        eventEndDate || eventStartDate,
      );

      if (!normalizedStartDate || !normalizedEndDate) {
        Alert.alert(
          "Invalid Date",
          "Please select a valid start and end date.",
        );
        return;
      }

      if (normalizedEndDate < normalizedStartDate) {
        Alert.alert(
          "Invalid Date Range",
          "End date cannot be earlier than start date.",
        );
        return;
      }

      if (!isAllDay) {
        if (!startTime.trim() || !endTime.trim()) {
          Alert.alert(
            "Time Required",
            "Please select both start and end time, or enable All Day.",
          );
          return;
        }

        const startMinutes = parseMeridiemTimeToMinutes(startTime);
        const endMinutes = parseMeridiemTimeToMinutes(endTime);
        if (startMinutes === null || endMinutes === null) {
          Alert.alert(
            "Invalid Time",
            "Please select valid start and end times.",
          );
          return;
        }

        if (
          normalizedStartDate === normalizedEndDate &&
          endMinutes <= startMinutes
        ) {
          Alert.alert(
            "Invalid Time Range",
            "End time must be after start time on the same day.",
          );
          return;
        }
      }

      if (
        !eventOpenToAll &&
        selectedEventGroupIds.length === 0 &&
        selectedEventUserIds.length === 0
      ) {
        Alert.alert(
          "Audience Required",
          "Select at least one team/group or one user, or enable Open To All.",
        );
        return;
      }
    }

    if (type === "Shift") {
      const normalizedShiftStart = normalizeIsoDateInput(shiftStartDate);
      const normalizedShiftEnd = normalizeIsoDateInput(
        shiftEndDate || shiftStartDate,
      );

      if (!normalizedShiftStart || !normalizedShiftEnd) {
        Alert.alert(
          "Invalid Date",
          "Please select a valid start and end date for the shift.",
        );
        return;
      }

      if (normalizedShiftEnd < normalizedShiftStart) {
        Alert.alert(
          "Invalid Date Range",
          "End date cannot be earlier than start date.",
        );
        return;
      }

      if (!shiftAllDay) {
        if (!startTime.trim() || !endTime.trim()) {
          Alert.alert(
            "Time Required",
            "Please select both start and end time, or enable All Day.",
          );
          return;
        }

        const startMinutes = parseMeridiemTimeToMinutes(startTime);
        const endMinutes = parseMeridiemTimeToMinutes(endTime);
        if (startMinutes === null || endMinutes === null) {
          Alert.alert(
            "Invalid Time",
            "Please select valid start and end times.",
          );
          return;
        }

        if (
          normalizedShiftStart === normalizedShiftEnd &&
          endMinutes <= startMinutes
        ) {
          Alert.alert(
            "Invalid Time Range",
            "End time must be after start time on the same day.",
          );
          return;
        }
      }

      if (
        !shiftOpenToAll &&
        selectedShiftGroupIds.length === 0 &&
        !createAsTemplate &&
        !isTemplate
      ) {
        Alert.alert(
          "Group Required",
          "Select at least one team/group or mark the shift as Open To All.",
        );
        return;
      }
    }

    setLoading(true);
    try {
      const createdBy = user?.uid || "";
      const normalizedGroupType =
        type === "Task" ? "Group" : assignedGroupType || "Team";
      const normalizedAssignedGroupId = (
        assignedGroupId.trim() ||
        (normalizedGroupType === "Committee"
          ? "committee"
          : normalizedGroupType === "Executive"
            ? "executive"
            : "")
      ).trim();
      const normalizedAssignedGroupName = (
        assignedGroupName.trim() ||
        (normalizedGroupType === "Committee"
          ? "Committee"
          : normalizedGroupType === "Executive"
            ? "Executive"
            : "")
      ).trim();

      // If assigning to a Team, also set teamId so item shows in team feed
      const derivedTeamId =
        normalizedGroupType === "Team" ? normalizedAssignedGroupId : null;

      if (
        type === "Task" &&
        !openToAll &&
        selectedTaskGroupIds.length === 0 &&
        !createAsTemplate &&
        !isTemplate
      ) {
        Alert.alert(
          "Group Required",
          "Select at least one team/group or mark the task as Open To All.",
        );
        setLoading(false);
        return;
      }

      switch (type) {
        case "Team":
          {
            const createdTeam = await createTeam(activeClubId, {
              name: name.trim(),
              ageGroup: ageGroup.trim(),
              description: description.trim(),
              createdBy,
            });

            if (selectedPlayerIds.length > 0) {
              await assignMembersToTeam(
                activeClubId,
                createdTeam.id,
                selectedPlayerIds,
              );
            }
          }
          break;
        case "Event":
          {
            const normalizedCategory = (eventCategory || "event").toLowerCase();
            const eventType =
              normalizedCategory === "fixtures"
                ? "game"
                : normalizedCategory === "training"
                  ? "training"
                  : normalizedCategory;

            const normalizedStartDate = normalizeIsoDateInput(eventStartDate);
            const normalizedEndDate = normalizeIsoDateInput(
              eventEndDate || eventStartDate,
            );

            const recurringRule = normalizeEventRepeatRule({
              repeatPreset,
              customRepeatFrequency,
              customRepeatInterval,
              customMonthlyMode,
              customRepeatWeekDays,
              baseDate: normalizedStartDate,
              customRepeatEnds,
              customRepeatEndDate,
            });

            const normalizedEventGroupIds = eventOpenToAll
              ? []
              : selectedEventGroupIds
                  .map((groupId) =>
                    String(groupId || "")
                      .trim()
                      .toLowerCase(),
                  )
                  .filter(Boolean);
            const groupNameById = new Map(
              combinedGroupOptions.map((group) => [
                String(group.id || "")
                  .trim()
                  .toLowerCase(),
                group.name || group.id,
              ]),
            );
            const selectedEventGroupNames = normalizedEventGroupIds
              .map((groupId) => groupNameById.get(groupId))
              .filter(Boolean);

            const normalizedEventUserIds = eventOpenToAll
              ? []
              : selectedEventUserIds
                  .map((memberId) => String(memberId || "").trim())
                  .filter(Boolean);
            const userNameById = new Map(
              assignableMembers.map((member) => [
                String(member.id || "").trim(),
                getMemberLabel(member),
              ]),
            );
            const selectedEventUserNames = normalizedEventUserIds
              .map((memberId) => userNameById.get(memberId))
              .filter(Boolean);

            await createEvent(activeClubId, {
              title: name.trim(),
              description: description.trim(),
              date: normalizedStartDate,
              startDate: normalizedStartDate,
              endDate: normalizedEndDate,
              isAllDay,
              startTime: isAllDay ? "" : startTime.trim(),
              endTime: isAllDay ? "" : endTime.trim(),
              location: location.trim(),
              type: eventType,
              category: normalizedCategory,
              teamId: null,
              assignedGroupId: normalizedEventGroupIds[0] || null,
              assignedGroupIds: normalizedEventGroupIds,
              assignedGroupName: selectedEventGroupNames.join(", "),
              groupType: "Group",
              openToAll: !!eventOpenToAll,
              assignedUserId: normalizedEventUserIds[0] || "",
              assignedUserName: selectedEventUserNames[0] || "",
              assignedUserIds: normalizedEventUserIds,
              assignedUserNames: selectedEventUserNames,
              recurringRule,
              createdBy,
            });
          }
          break;
        case "Task":
          if (createAsTemplate) {
            const normalizedTaskGroupIds = openToAll
              ? []
              : selectedTaskGroupIds
                  .map((groupId) =>
                    String(groupId || "")
                      .trim()
                      .toLowerCase(),
                  )
                  .filter(Boolean);
            const taskGroupNameById = new Map(
              combinedGroupOptions.map((group) => [
                String(group.id || "")
                  .trim()
                  .toLowerCase(),
                group.name || group.id,
              ]),
            );
            const selectedTaskGroupNames = normalizedTaskGroupIds
              .map((groupId) => taskGroupNameById.get(groupId))
              .filter(Boolean);
            const templatePayload = {
              name: name.trim(),
              description: description.trim(),
              defaultPriority: priority,
              assignedGroupId: normalizedTaskGroupIds[0] || null,
              assignedGroupIds: normalizedTaskGroupIds,
              assignedGroupName: selectedTaskGroupNames.join(", "),
              groupType: normalizedGroupType,
              openToAll,
              recurringRule: normalizeEventRepeatRule({
                repeatPreset,
                customRepeatFrequency,
                customRepeatInterval,
                customMonthlyMode,
                customRepeatWeekDays,
                baseDate: taskStartDate || initialTaskDate,
                customRepeatEnds,
                customRepeatEndDate,
              }),
              createdBy,
            };
            if (isEditMode && initialData?.id) {
              await updateTaskTemplate(
                activeClubId,
                initialData.id,
                templatePayload,
              );
            } else {
              await createTaskTemplate(activeClubId, templatePayload);
            }
          } else {
            const normalizedStartDate = normalizeIsoDateInput(taskStartDate);
            const normalizedEndDate = normalizeIsoDateInput(
              taskEndDate || taskStartDate,
            );

            if (!normalizedStartDate || !normalizedEndDate) {
              Alert.alert(
                "Invalid Date",
                "Please select a valid start and end date.",
              );
              setLoading(false);
              return;
            }

            if (normalizedEndDate < normalizedStartDate) {
              Alert.alert(
                "Invalid Date Range",
                "End date cannot be earlier than start date.",
              );
              setLoading(false);
              return;
            }

            if (!taskAllDay) {
              if (!startTime.trim() || !endTime.trim()) {
                Alert.alert(
                  "Time Required",
                  "Please select both start and end time, or enable All Day.",
                );
                setLoading(false);
                return;
              }

              const startMinutes = parseMeridiemTimeToMinutes(startTime);
              const endMinutes = parseMeridiemTimeToMinutes(endTime);
              if (startMinutes === null || endMinutes === null) {
                Alert.alert(
                  "Invalid Time",
                  "Please select valid start and end times.",
                );
                setLoading(false);
                return;
              }

              if (
                normalizedStartDate === normalizedEndDate &&
                endMinutes <= startMinutes
              ) {
                Alert.alert(
                  "Invalid Time Range",
                  "End time must be after start time on the same day.",
                );
                setLoading(false);
                return;
              }
            }

            const normalizedTaskGroupIds = openToAll
              ? []
              : selectedTaskGroupIds
                  .map((groupId) =>
                    String(groupId || "")
                      .trim()
                      .toLowerCase(),
                  )
                  .filter(Boolean);
            const taskGroupNameById = new Map(
              combinedGroupOptions.map((group) => [
                String(group.id || "")
                  .trim()
                  .toLowerCase(),
                group.name || group.id,
              ]),
            );
            const selectedTaskGroupNames = normalizedTaskGroupIds
              .map((groupId) => taskGroupNameById.get(groupId))
              .filter(Boolean);

            const recurringRule = normalizeEventRepeatRule({
              repeatPreset,
              customRepeatFrequency,
              customRepeatInterval,
              customMonthlyMode,
              customRepeatWeekDays,
              baseDate: normalizedStartDate,
              customRepeatEnds,
              customRepeatEndDate,
            });

            await createTask(activeClubId, {
              title: name.trim(),
              description:
                taskChecklistItems.length > 0
                  ? taskChecklistItems.map((item) => `- ${item}`).join("\n")
                  : description.trim(),
              priority,
              teamId: derivedTeamId,
              assignedGroupId: normalizedTaskGroupIds[0] || null,
              assignedGroupIds: normalizedTaskGroupIds,
              assignedGroupName: selectedTaskGroupNames.join(", "),
              groupType: normalizedGroupType,
              openToAll,
              createdBy,
              startDate: normalizedStartDate,
              endDate: normalizedEndDate,
              isAllDay: taskAllDay,
              startTime: taskAllDay ? "" : startTime.trim(),
              endTime: taskAllDay ? "" : endTime.trim(),
              dueDate: normalizedStartDate,
              isRecurring: !!recurringRule,
              recurringRule,
              checklistItems: taskChecklistItems,
            });
          }
          break;
        case "Shift":
          {
            const shiftGroupIds = shiftOpenToAll
              ? []
              : selectedShiftGroupIds
                  .map((id) =>
                    String(id || "")
                      .trim()
                      .toLowerCase(),
                  )
                  .filter(Boolean);
            const shiftGroupNames = shiftOpenToAll
              ? ""
              : selectedShiftGroupOptions.map((g) => g.name).join(", ");

            // For templates with no group selected, default to open-to-all
            const effectiveOpenToAll =
              shiftOpenToAll ||
              (createAsTemplate && shiftGroupIds.length === 0);

            const shiftsList =
              rosterShifts.filter((s) => s.role?.trim()).length > 0
                ? rosterShifts.map((s) => ({
                    ...s,
                    role: s.role?.trim() || name.trim(),
                    startTime:
                      s.startTime ||
                      (shiftAllDay ? "" : startTime.trim()) ||
                      "",
                    endTime:
                      s.endTime || (shiftAllDay ? "" : endTime.trim()) || "",
                  }))
                : [
                    {
                      role: name.trim(),
                      startTime: shiftAllDay ? "" : startTime.trim(),
                      endTime: shiftAllDay ? "" : endTime.trim(),
                    },
                  ];

            const rosterPayload = {
              name: name.trim(),
              title: name.trim(),
              description: description.trim(),
              startDate: shiftStartDate || dateTime.trim(),
              endDate: shiftEndDate || shiftStartDate || dateTime.trim(),
              isAllDay: shiftAllDay,
              startTime: shiftAllDay ? "" : startTime.trim(),
              endTime: shiftAllDay ? "" : endTime.trim(),
              assignedGroupId: effectiveOpenToAll
                ? null
                : shiftGroupIds[0] || null,
              assignedGroupIds: effectiveOpenToAll ? [] : shiftGroupIds,
              assignedGroupName: shiftGroupNames,
              groupType: "Team",
              openToAll: !!effectiveOpenToAll,
              shifts: shiftsList,
              createdBy,
              isTemplate: !!createAsTemplate,
            };

            if (isEditMode && initialData?.id) {
              if (isTemplate) {
                await updateRosterTemplate(
                  activeClubId,
                  initialData.id,
                  rosterPayload,
                );
              } else {
                // Future: support updateRoster(activeClubId, initialData.id, rosterPayload);
              }
            } else {
              if (createAsTemplate) {
                await createRosterTemplate(activeClubId, rosterPayload);
              } else {
                await createRoster(activeClubId, {
                  ...rosterPayload,
                  date: shiftStartDate || dateTime.trim(),
                });
              }
            }
          }
          break;
        case "Trade":
          await createTrade(activeClubId, {
            name: name.trim(),
            category: category.trim(),
            phone: phone.trim(),
            email: email.trim(),
            description: description.trim(),
            createdBy,
          });
          break;
        case "Product":
          {
            const variants = parseVariants(variantsInput, stock);
            const fallbackStock = parseInt(stock, 10);
            let createdProduct;
            try {
              createdProduct = await createProduct(activeClubId, {
                clubId: activeClubId,
                createdBy,
                createdByName: profile?.displayName || profile?.email || "",
                name: name.trim(),
                description: description.trim(),
                details: productDetails.trim(),
                price: parseFloat(price) || 0,
                category: category.trim() || "General",
                visibility: normalizeVisibility(visibility),
                postageOption,
                variants,
                stock: Number.isFinite(fallbackStock) ? fallbackStock : -1,
              });
            } catch (createErr) {
              // Surface Firestore errors (permission denied, offline, etc.) immediately
              throw createErr;
            }

            // Image uploads are best-effort — a Storage failure should NOT block
            // the product from being created successfully.
            try {
              const imageUpdates = {};
              const uploadedImageUrls = [];

              if (productImageUri) {
                const primaryUrl = await uploadProductImage(
                  activeClubId,
                  createdProduct.id,
                  productImageUri,
                );
                if (primaryUrl) {
                  imageUpdates.imageUrl = primaryUrl;
                  uploadedImageUrls.push(primaryUrl);
                }
              }

              for (let i = 0; i < additionalImageUris.length; i++) {
                const uri = additionalImageUris[i];
                if (!uri) continue;
                try {
                  const addUrl = await uploadProductImage(
                    activeClubId,
                    `${createdProduct.id}_extra_${i}`,
                    uri,
                  );
                  if (addUrl) uploadedImageUrls.push(addUrl);
                } catch {
                  // Skip individual failures
                }
              }

              if (uploadedImageUrls.length > 0) {
                imageUpdates.imageUrls = uploadedImageUrls;
              }

              if (sizeGuideImageUri) {
                const sizeUrl = await uploadProductImage(
                  activeClubId,
                  `${createdProduct.id}_size_guide`,
                  sizeGuideImageUri,
                );
                if (sizeUrl) imageUpdates.sizeGuideUrl = sizeUrl;
              }

              imageUpdates.imageOwnerUid = user?.uid || "";
              imageUpdates.imageOwnerName =
                profile?.displayName || profile?.email || "Unknown";

              if (Object.keys(imageUpdates).length > 2) {
                await updateProduct(
                  activeClubId,
                  createdProduct.id,
                  imageUpdates,
                );
              }
            } catch (uploadErr) {
              // Product is saved — just warn that images didn't upload
              console.warn(
                "Product image upload failed (product saved):",
                uploadErr?.message,
              );
            }
          }
          break;
        case "Drill":
          {
            const { createDrill, updateDrill } =
              await import("../../services/clubOperationsService");
            const drillData = {
              title: name.trim(),
              category: category.trim() || "General",
              difficulty: drillDifficulty,
              durationMins: parseInt(drillDuration, 10) || 20,
              description: description.trim(),
              videoUrls: drillVideoUrls.filter((u) => u.trim()),
              imageUrls: drillImageUrls.filter((u) => u.trim()),
              assignedGroupIds: selectedTaskGroupIds,
              createdBy,
            };

            if (isEditMode && initialData?.id) {
              await updateDrill(activeClubId, initialData.id, drillData);
            } else {
              await createDrill(activeClubId, drillData);
            }
          }
          break;
        default:
          Alert.alert("Error", `Unknown item type: ${type}`);
          setLoading(false);
          return;
      }

      Alert.alert(
        "Success",
        `${type} "${name}" ${isEditMode ? "updated" : "created"} successfully!`,
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      Alert.alert(
        "Error",
        err.message || `Failed to create ${type.toLowerCase()}.`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePickDrillImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Need camera roll access.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsMultipleSelection: true,
    });
    if (result.canceled) return;

    const assets = result.assets || [result];
    for (const asset of assets) {
      const key = `pre-${Date.now()}-${Math.random()}`;
      setDrillImagePreviews((prev) => [...prev, { key, uri: asset.uri }]);

      try {
        const { uploadDrillImage } =
          await import("../../services/storageService");
        const url = await uploadDrillImage(activeClubId, "temp", asset.uri);
        if (url) {
          setDrillImageUrls((prev) => [...prev, url]);
        }
      } catch (err) {
        Alert.alert("Upload Error", err.message);
      } finally {
        setDrillImagePreviews((prev) => prev.filter((p) => p.key !== key));
      }
    }
  };

  const activeDatePickerValue =
    type === "Event" &&
    (datePickerTarget === "eventStart" || datePickerTarget === "eventEnd")
      ? datePickerTarget === "eventEnd"
        ? eventEndDate || eventStartDate
        : eventStartDate
      : type === "Shift" &&
          (datePickerTarget === "shiftStart" || datePickerTarget === "shiftEnd")
        ? datePickerTarget === "shiftEnd"
          ? shiftEndDate || shiftStartDate
          : shiftStartDate
        : type === "Task" &&
            (datePickerTarget === "taskStart" || datePickerTarget === "taskEnd")
          ? datePickerTarget === "taskEnd"
            ? taskEndDate || taskStartDate
            : taskStartDate
          : dateTime;

  const datePickerTitle =
    type === "Event" && datePickerTarget === "eventStart"
      ? "Select Start Date"
      : type === "Event" && datePickerTarget === "eventEnd"
        ? "Select End Date"
        : type === "Shift" && datePickerTarget === "shiftStart"
          ? "Select Start Date"
          : type === "Shift" && datePickerTarget === "shiftEnd"
            ? "Select End Date"
            : type === "Task" && datePickerTarget === "taskStart"
              ? "Select Start Date"
              : type === "Task" && datePickerTarget === "taskEnd"
                ? "Select End Date"
                : type === "Task"
                  ? "Select Date"
                  : "Select Date";

  const repeatPresetOptions = [
    {
      key: "none",
      label: "Does not repeat",
      subtitle: "One-time event",
    },
    {
      key: "daily",
      label: "Every Day",
      subtitle: "Repeats daily",
    },
    {
      key: "weekly",
      label: "Every Week",
      subtitle: repeatWeekdayName
        ? `On ${repeatWeekdayName}`
        : "Weekly pattern",
    },
    {
      key: "monthly",
      label: "Every Month",
      subtitle: "Same calendar day each month",
    },
    {
      key: "yearly",
      label: "Every Year",
      subtitle: "Same day each year",
    },
    {
      key: "custom",
      label: "Custom",
      subtitle: "Set interval and pattern",
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft color={theme.colors.text} size={28} />
          </TouchableOpacity>
          <Text variant="h2">{title}</Text>
        </View>
        <TouchableOpacity onPress={handleSave}>
          <Save color={theme.colors.primary} size={24} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text variant="h4" style={styles.label}>
            {type} Name
          </Text>
          <TextInput
            style={styles.input}
            placeholder={`Enter ${type.toLowerCase()} name...`}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          {type !== "Task" ? (
            <>
              <Text variant="h4" style={styles.label}>
                Description
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={`Enter ${type.toLowerCase()} details...`}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </>
          ) : null}

          {type === "Event" && (
            <>
              <Text variant="h4" style={styles.label}>
                Category
              </Text>
              <View style={styles.segmentRow}>
                {[
                  { label: "Event", value: "event" },
                  { label: "Fixtures", value: "fixtures" },
                  { label: "Training", value: "training" },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.segmentBtn,
                      eventCategory === option.value && styles.segmentBtnActive,
                    ]}
                    onPress={() => setEventCategory(option.value)}
                  >
                    <Text
                      variant="small"
                      weight="600"
                      color={
                        eventCategory === option.value
                          ? theme.colors.white
                          : theme.colors.text
                      }
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text variant="h4" style={styles.label}>
                All Day
              </Text>
              <TouchableOpacity
                style={styles.allDayToggleRow}
                onPress={() => setIsAllDay((prev) => !prev)}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="600">
                    {isAllDay ? "All Day Event" : "Timed Event"}
                  </Text>
                  <Text variant="small" color={theme.colors.textSecondary}>
                    {isAllDay
                      ? "No start/end times required"
                      : "Set start and end times"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.switchTrack,
                    isAllDay && styles.switchTrackActive,
                  ]}
                >
                  <View
                    style={[
                      styles.switchThumb,
                      isAllDay && styles.switchThumbActive,
                    ]}
                  />
                </View>
              </TouchableOpacity>

              <Text variant="h4" style={styles.label}>
                Start Date
              </Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => handleSelectDate("eventStart")}
              >
                <Text
                  color={
                    eventStartDate
                      ? theme.colors.text
                      : theme.colors.textSecondary
                  }
                >
                  {formatIsoDateLabel(eventStartDate) || "Select start date"}
                </Text>
              </TouchableOpacity>

              {!isAllDay ? (
                <>
                  <Text variant="h4" style={styles.label}>
                    Start Time
                  </Text>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => setShowStartTimeModal(true)}
                  >
                    <Text
                      color={
                        startTime
                          ? theme.colors.text
                          : theme.colors.textSecondary
                      }
                    >
                      {startTime || "Select start time"}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}

              <Text variant="h4" style={styles.label}>
                End Date
              </Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => handleSelectDate("eventEnd")}
              >
                <Text
                  color={
                    eventEndDate
                      ? theme.colors.text
                      : theme.colors.textSecondary
                  }
                >
                  {formatIsoDateLabel(eventEndDate) || "Select end date"}
                </Text>
              </TouchableOpacity>

              {!isAllDay ? (
                <>
                  <Text variant="h4" style={styles.label}>
                    End Time
                  </Text>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => setShowEndTimeModal(true)}
                  >
                    <Text
                      color={
                        endTime ? theme.colors.text : theme.colors.textSecondary
                      }
                    >
                      {endTime || "Select end time"}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}

              <Text variant="h4" style={styles.label}>
                Repeat
              </Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowRepeatPresetModal(true)}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text color={theme.colors.text}>{repeatSummaryLabel}</Text>
                  <Text
                    variant="small"
                    color={theme.colors.primary}
                    weight="600"
                  >
                    Change
                  </Text>
                </View>
              </TouchableOpacity>

              {repeatPreset === "custom" ? (
                <Text
                  variant="small"
                  color={theme.colors.textSecondary}
                  style={{
                    marginTop: -theme.spacing.sm,
                    marginBottom: theme.spacing.lg,
                  }}
                >
                  {customRepeatFrequency === "monthly" &&
                  customMonthlyMode === "nth_weekday"
                    ? repeatMonthlyWeekdayLabel || "Monthly custom pattern"
                    : customRepeatFrequency === "weekly"
                      ? repeatWeekdayName
                        ? `On ${repeatWeekdayName}`
                        : "Weekly custom pattern"
                      : "Custom repeat configured"}
                </Text>
              ) : null}

              <Text variant="h4" style={styles.label}>
                Event Audience
              </Text>
              <TouchableOpacity
                style={styles.allDayToggleRow}
                onPress={() => setEventOpenToAll((prev) => !prev)}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="600">
                    {eventOpenToAll
                      ? "Open To All Members"
                      : "Restricted Audience"}
                  </Text>
                  <Text variant="small" color={theme.colors.textSecondary}>
                    {eventOpenToAll
                      ? "Everyone in the club can view this event"
                      : "Select specific teams/groups or users"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.switchTrack,
                    eventOpenToAll && styles.switchTrackActive,
                  ]}
                >
                  <View
                    style={[
                      styles.switchThumb,
                      eventOpenToAll && styles.switchThumbActive,
                    ]}
                  />
                </View>
              </TouchableOpacity>

              {!eventOpenToAll ? (
                <>
                  <Text variant="h4" style={styles.label}>
                    Teams / Groups (Multiple)
                  </Text>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => {
                      setGroupPickerMode("multi");
                      setGroupSearchQuery("");
                      setShowGroupPicker(true);
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text
                        color={
                          selectedEventGroupOptions.length > 0
                            ? theme.colors.text
                            : theme.colors.textSecondary
                        }
                        style={{ flex: 1, marginRight: 8 }}
                      >
                        {selectedEventGroupOptions.length > 0
                          ? `${selectedEventGroupOptions.length} selected`
                          : "Select one or more teams/groups"}
                      </Text>
                      <Text
                        variant="small"
                        color={theme.colors.primary}
                        weight="600"
                      >
                        Select
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {selectedEventGroupOptions.length > 0 ? (
                    <View style={styles.playersWrap}>
                      {selectedEventGroupOptions.map((group) => (
                        <TouchableOpacity
                          key={`event-group-${group.id}`}
                          style={styles.playerChip}
                          onPress={() => toggleEventGroupSelection(group.id)}
                        >
                          <Text variant="small" weight="600">
                            {group.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}

                  <Text variant="h4" style={styles.label}>
                    Individual Users (Multiple)
                  </Text>
                  <TextInput
                    style={styles.playerSearchInput}
                    placeholder="Search users by name or email..."
                    value={eventUserSearchQuery}
                    onChangeText={setEventUserSearchQuery}
                    autoCapitalize="none"
                  />

                  {loadingAssignableMembers ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.primary}
                      style={{ marginBottom: theme.spacing.md }}
                    />
                  ) : filteredEventAssignableMembers.length > 0 ? (
                    <View style={styles.playersWrap}>
                      {filteredEventAssignableMembers.map((member) => {
                        const selected = selectedEventUserIds.includes(
                          member.id,
                        );
                        return (
                          <TouchableOpacity
                            key={`event-user-${member.id}`}
                            style={[
                              styles.playerChip,
                              selected && styles.playerChipSelected,
                            ]}
                            onPress={() => toggleEventUserSelection(member.id)}
                          >
                            <Text
                              variant="small"
                              weight="600"
                              color={
                                selected
                                  ? theme.colors.white
                                  : theme.colors.text
                              }
                            >
                              {getMemberLabel(member)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <Text
                      variant="small"
                      color={theme.colors.textSecondary}
                      style={{ marginBottom: theme.spacing.md }}
                    >
                      No users available for selection.
                    </Text>
                  )}

                  {selectedEventUserOptions.length > 0 ? (
                    <TouchableOpacity
                      onPress={() => setShowSelectedEventUsersModal(true)}
                      style={{
                        paddingVertical: theme.spacing.md,
                        paddingHorizontal: theme.spacing.sm,
                        backgroundColor: "rgba(16, 139, 81, 0.08)",
                        borderRadius: theme.radius.md,
                        marginBottom: theme.spacing.md,
                      }}
                    >
                      <Text
                        variant="small"
                        weight="600"
                        color={theme.colors.primary}
                      >
                        {`✓ ${selectedEventUserOptions.length} user${selectedEventUserOptions.length === 1 ? "" : "s"} selected - Tap to view`}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : null}

              <Text variant="h4" style={styles.label}>
                Location
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Main Pitch"
                value={location}
                onChangeText={setLocation}
              />
            </>
          )}

          {type === "Team" && (
            <>
              <Text variant="h4" style={styles.label}>
                Age Group / Division
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. U15 Boys Premier"
                value={ageGroup}
                onChangeText={setAgeGroup}
              />

              <Text variant="h4" style={styles.label}>
                Add Players To Team
              </Text>
              <Text
                variant="small"
                color={theme.colors.textSecondary}
                style={styles.helperText}
              >
                Select players from your club member list.
              </Text>

              <TextInput
                style={styles.playerSearchInput}
                placeholder="Search players by name or email..."
                value={playerSearchQuery}
                onChangeText={setPlayerSearchQuery}
                autoCapitalize="none"
              />

              {loadingPlayers ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.primary}
                  style={{ marginBottom: theme.spacing.lg }}
                />
              ) : clubPlayers.length === 0 ? (
                <Text
                  variant="small"
                  color={theme.colors.textSecondary}
                  style={{ marginBottom: theme.spacing.lg }}
                >
                  No players found in Firebase for this club.
                </Text>
              ) : filteredClubPlayers.length === 0 ? (
                <Text
                  variant="small"
                  color={theme.colors.textSecondary}
                  style={{ marginBottom: theme.spacing.lg }}
                >
                  No players match your search.
                </Text>
              ) : (
                <View style={styles.playersWrap}>
                  {filteredClubPlayers.map((member) => {
                    const isSelected = selectedPlayerIds.includes(member.id);
                    return (
                      <TouchableOpacity
                        key={member.id}
                        style={[
                          styles.playerChip,
                          isSelected && styles.playerChipSelected,
                        ]}
                        onPress={() => togglePlayerSelection(member.id)}
                      >
                        <Text
                          variant="small"
                          weight="600"
                          color={
                            isSelected ? theme.colors.white : theme.colors.text
                          }
                        >
                          {getMemberLabel(member)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {type === "Task" && (
            <>
              <Text variant="h4" style={styles.label}>
                Assign to Teams / Groups (Multiple)
              </Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => {
                  setGroupPickerMode("multi");
                  setGroupSearchQuery("");
                  setShowGroupPicker(true);
                  setDatePickerTarget("taskGroups");
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    color={
                      selectedTaskGroupIds.length > 0
                        ? theme.colors.text
                        : theme.colors.textSecondary
                    }
                    style={{ flex: 1, marginRight: 8 }}
                  >
                    {selectedTaskGroupIds.length > 0
                      ? `${selectedTaskGroupIds.length} group(s) selected`
                      : "Select one or more teams/groups"}
                  </Text>
                  <Text
                    variant="small"
                    color={theme.colors.primary}
                    weight="600"
                  >
                    Select
                  </Text>
                </View>
              </TouchableOpacity>

              {selectedTaskGroupIds.length > 0 ? (
                <View
                  style={[
                    styles.playersWrap,
                    { marginBottom: theme.spacing.lg },
                  ]}
                >
                  {selectedTaskGroupOptions.map((group) => (
                    <TouchableOpacity
                      key={`task-group-chip-${group.id}`}
                      style={styles.playerChip}
                      onPress={() => toggleTaskGroupSelection(group.id)}
                    >
                      <Text variant="small" weight="600">
                        {group.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  openToAll && styles.toggleBtnActive,
                  { marginBottom: theme.spacing.lg },
                ]}
                onPress={() => setOpenToAll(!openToAll)}
              >
                <Text
                  variant="small"
                  weight="600"
                  color={openToAll ? theme.colors.white : theme.colors.text}
                >
                  Open To All Members
                </Text>
              </TouchableOpacity>

              <Text variant="h4" style={styles.label}>
                Checklist
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  marginBottom: theme.spacing.sm,
                }}
              >
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Add checklist item..."
                  value={checklistInput}
                  onChangeText={setChecklistInput}
                />
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    {
                      flex: 0,
                      width: 50,
                      backgroundColor: theme.colors.primary,
                      borderColor: theme.colors.primary,
                      marginRight: 0,
                    },
                  ]}
                  onPress={() => {
                    if (checklistInput.trim()) {
                      setTaskChecklistItems([
                        ...taskChecklistItems,
                        checklistInput.trim(),
                      ]);
                      setChecklistInput("");
                    }
                  }}
                >
                  <Plus color={theme.colors.white} size={20} />
                </TouchableOpacity>
              </View>

              {taskChecklistItems.length > 0 && (
                <View style={{ marginBottom: theme.spacing.lg }}>
                  {taskChecklistItems.map((item, index) => (
                    <View
                      key={`checklist-${index}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: theme.colors.surface,
                        padding: theme.spacing.sm,
                        borderRadius: theme.radius.sm,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        marginBottom: theme.spacing.xs,
                      }}
                    >
                      <Text variant="body" style={{ flex: 1 }}>
                        {item}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setTaskChecklistItems(
                            taskChecklistItems.filter((_, i) => i !== index),
                          );
                        }}
                      >
                        <Text color={theme.colors.error} weight="600">
                          Remove
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <Text variant="h4" style={styles.label}>
                All Day
              </Text>
              <TouchableOpacity
                style={styles.allDayToggleRow}
                onPress={() => setTaskAllDay((prev) => !prev)}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="600">
                    {taskAllDay ? "All Day Task" : "Timed Task"}
                  </Text>
                  <Text variant="small" color={theme.colors.textSecondary}>
                    {taskAllDay
                      ? "No specific time required"
                      : "Set start and end times"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.switchTrack,
                    taskAllDay && styles.switchTrackActive,
                  ]}
                >
                  <View
                    style={[
                      styles.switchThumb,
                      taskAllDay && styles.switchThumbActive,
                    ]}
                  />
                </View>
              </TouchableOpacity>

              <Text variant="h4" style={styles.label}>
                Start Date
              </Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => handleSelectDate("taskStart")}
              >
                <Text
                  color={
                    taskStartDate
                      ? theme.colors.text
                      : theme.colors.textSecondary
                  }
                >
                  {formatIsoDateLabel(taskStartDate) || "Select start date"}
                </Text>
              </TouchableOpacity>

              {!taskAllDay ? (
                <>
                  <Text variant="h4" style={styles.label}>
                    Start Time
                  </Text>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => setShowStartTimeModal(true)}
                  >
                    <Text
                      color={
                        startTime
                          ? theme.colors.text
                          : theme.colors.textSecondary
                      }
                    >
                      {startTime || "Select start time"}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}

              <Text variant="h4" style={styles.label}>
                End Date
              </Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => handleSelectDate("taskEnd")}
              >
                <Text
                  color={
                    taskEndDate ? theme.colors.text : theme.colors.textSecondary
                  }
                >
                  {formatIsoDateLabel(taskEndDate) || "Select end date"}
                </Text>
              </TouchableOpacity>

              {!taskAllDay ? (
                <>
                  <Text variant="h4" style={styles.label}>
                    End Time
                  </Text>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => setShowEndTimeModal(true)}
                  >
                    <Text
                      color={
                        endTime ? theme.colors.text : theme.colors.textSecondary
                      }
                    >
                      {endTime || "Select end time"}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}

              <Text variant="h4" style={styles.label}>
                Repeat
              </Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowRepeatPresetModal(true)}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text color={theme.colors.text}>{repeatSummaryLabel}</Text>
                  <Text
                    variant="small"
                    color={theme.colors.primary}
                    weight="600"
                  >
                    Change
                  </Text>
                </View>
              </TouchableOpacity>

              {repeatPreset === "custom" ? (
                <Text
                  variant="small"
                  color={theme.colors.textSecondary}
                  style={{
                    marginTop: -theme.spacing.sm,
                    marginBottom: theme.spacing.lg,
                  }}
                >
                  {customRepeatFrequency === "monthly" &&
                  customMonthlyMode === "nth_weekday"
                    ? repeatMonthlyWeekdayLabel || "Monthly custom pattern"
                    : customRepeatFrequency === "weekly"
                      ? repeatWeekdayName
                        ? `On ${repeatWeekdayName}`
                        : "Weekly custom pattern"
                      : "Custom repeat configured"}
                </Text>
              ) : null}

              <Text variant="h4" style={styles.label}>
                Priority
              </Text>
              <View
                style={{ flexDirection: "row", marginBottom: theme.spacing.lg }}
              >
                {["low", "medium", "high"].map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityBtn,
                      priority === p && styles.priorityBtnActive,
                    ]}
                    onPress={() => setPriority(p)}
                  >
                    <Text
                      variant="small"
                      weight="600"
                      color={
                        priority === p ? theme.colors.white : theme.colors.text
                      }
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  createAsTemplate && styles.toggleBtnActive,
                  { marginTop: theme.spacing.sm },
                ]}
                onPress={() => setCreateAsTemplate(!createAsTemplate)}
              >
                <Text
                  variant="small"
                  weight="600"
                  color={
                    createAsTemplate ? theme.colors.white : theme.colors.text
                  }
                >
                  Save as Template
                </Text>
              </TouchableOpacity>
            </>
          )}

          {type === "Shift" && (
            <>
              <Text variant="h4" style={styles.label}>
                Shift Audience
              </Text>
              <TouchableOpacity
                style={styles.allDayToggleRow}
                onPress={() => setShiftOpenToAll((prev) => !prev)}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="600">
                    {shiftOpenToAll
                      ? "Open To All Members"
                      : "Restricted Audience"}
                  </Text>
                  <Text variant="small" color={theme.colors.textSecondary}>
                    {shiftOpenToAll
                      ? "Everyone in the club can sign up"
                      : "Select specific teams or groups"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.switchTrack,
                    shiftOpenToAll && styles.switchTrackActive,
                  ]}
                >
                  <View
                    style={[
                      styles.switchThumb,
                      shiftOpenToAll && styles.switchThumbActive,
                    ]}
                  />
                </View>
              </TouchableOpacity>

              {!shiftOpenToAll ? (
                <>
                  <Text variant="h4" style={styles.label}>
                    Teams / Groups (Multiple)
                  </Text>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => {
                      setGroupPickerMode("multi");
                      setGroupSearchQuery("");
                      setShowGroupPicker(true);
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text
                        color={
                          selectedShiftGroupOptions.length > 0
                            ? theme.colors.text
                            : theme.colors.textSecondary
                        }
                        style={{ flex: 1, marginRight: 8 }}
                      >
                        {selectedShiftGroupOptions.length > 0
                          ? `${selectedShiftGroupOptions.length} group(s) selected`
                          : "Select one or more teams/groups"}
                      </Text>
                      <Text
                        variant="small"
                        color={theme.colors.primary}
                        weight="600"
                      >
                        Select
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {selectedShiftGroupOptions.length > 0 ? (
                    <View style={styles.playersWrap}>
                      {selectedShiftGroupOptions.map((group) => (
                        <TouchableOpacity
                          key={`shift-group-${group.id}`}
                          style={styles.playerChip}
                          onPress={() => toggleShiftGroupSelection(group.id)}
                        >
                          <Text variant="small" weight="600">
                            {group.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : null}

              <Text variant="h4" style={styles.label}>
                All Day
              </Text>
              <TouchableOpacity
                style={styles.allDayToggleRow}
                onPress={() => setShiftAllDay((prev) => !prev)}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="600">
                    {shiftAllDay ? "All Day Shift" : "Timed Shift"}
                  </Text>
                  <Text variant="small" color={theme.colors.textSecondary}>
                    {shiftAllDay
                      ? "No start/end times required"
                      : "Set start and end times"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.switchTrack,
                    shiftAllDay && styles.switchTrackActive,
                  ]}
                >
                  <View
                    style={[
                      styles.switchThumb,
                      shiftAllDay && styles.switchThumbActive,
                    ]}
                  />
                </View>
              </TouchableOpacity>

              <Text variant="h4" style={styles.label}>
                Start Date
              </Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => handleSelectDate("shiftStart")}
              >
                <Text
                  color={
                    shiftStartDate
                      ? theme.colors.text
                      : theme.colors.textSecondary
                  }
                >
                  {formatIsoDateLabel(shiftStartDate) || "Select start date"}
                </Text>
              </TouchableOpacity>

              {!shiftAllDay ? (
                <>
                  <Text variant="h4" style={styles.label}>
                    Start Time
                  </Text>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => setShowStartTimeModal(true)}
                  >
                    <Text
                      color={
                        startTime
                          ? theme.colors.text
                          : theme.colors.textSecondary
                      }
                    >
                      {startTime || "Select start time"}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}

              <Text variant="h4" style={styles.label}>
                End Date
              </Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => handleSelectDate("shiftEnd")}
              >
                <Text
                  color={
                    shiftEndDate
                      ? theme.colors.text
                      : theme.colors.textSecondary
                  }
                >
                  {formatIsoDateLabel(shiftEndDate) || "Select end date"}
                </Text>
              </TouchableOpacity>

              {!shiftAllDay ? (
                <>
                  <Text variant="h4" style={styles.label}>
                    End Time
                  </Text>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => setShowEndTimeModal(true)}
                  >
                    <Text
                      color={
                        endTime ? theme.colors.text : theme.colors.textSecondary
                      }
                    >
                      {endTime || "Select end time"}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}

              <Text variant="h4" style={styles.label}>
                Repeat
              </Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowRepeatPresetModal(true)}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text color={theme.colors.text}>{repeatSummaryLabel}</Text>
                  <Text
                    variant="small"
                    color={theme.colors.primary}
                    weight="600"
                  >
                    Change
                  </Text>
                </View>
              </TouchableOpacity>

              {repeatPreset === "custom" ? (
                <Text
                  variant="small"
                  color={theme.colors.textSecondary}
                  style={{
                    marginTop: -theme.spacing.sm,
                    marginBottom: theme.spacing.lg,
                  }}
                >
                  {customRepeatFrequency === "monthly" &&
                  customMonthlyMode === "nth_weekday"
                    ? repeatMonthlyWeekdayLabel || "Monthly custom pattern"
                    : customRepeatFrequency === "weekly"
                      ? repeatWeekdayName
                        ? `On ${repeatWeekdayName}`
                        : "Weekly custom pattern"
                      : "Custom repeat configured"}
                </Text>
              ) : null}

              {isShiftTemplate ? (
                <Text
                  variant="small"
                  color={theme.colors.textSecondary}
                  style={{ marginBottom: theme.spacing.md }}
                >
                  This will create a reusable roster template.
                </Text>
              ) : null}

              <Text variant="h4" style={styles.label}>
                Roster Roles / Shifts
              </Text>
              <Text
                variant="small"
                color={theme.colors.textSecondary}
                style={{ marginBottom: theme.spacing.sm }}
              >
                Define the different roles or slots available for this roster.
              </Text>

              {rosterShifts.map((shift, idx) => (
                <View
                  key={`roster-shift-${idx}`}
                  style={{ marginBottom: theme.spacing.md }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <TextInput
                      style={[styles.input, { flex: 1, marginBottom: 0 }]}
                      placeholder="Role (e.g. Canteen, Field Setup)"
                      value={shift.role}
                      onChangeText={(val) => {
                        const next = [...rosterShifts];
                        next[idx].role = val;
                        setRosterShifts(next);
                      }}
                    />
                    {rosterShifts.length > 1 && (
                      <TouchableOpacity
                        onPress={() => {
                          const next = rosterShifts.filter((_, i) => i !== idx);
                          setRosterShifts(next);
                        }}
                        style={{ padding: 8 }}
                      >
                        <Trash2 color={theme.colors.error} size={20} />
                      </TouchableOpacity>
                    )}
                  </View>
                  {!shiftAllDay && (
                    <View
                      style={{ flexDirection: "row", gap: 8, marginTop: 8 }}
                    >
                      <TouchableOpacity
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                        onPress={() => {
                          setDatePickerTarget("shiftRowStart");
                          setEditingShiftIndex(idx);
                          setShowStartTimeModal(true);
                        }}
                      >
                        <Text
                          variant="small"
                          color={
                            shift.startTime
                              ? theme.colors.text
                              : theme.colors.textSecondary
                          }
                        >
                          {shift.startTime || "Start Time"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                        onPress={() => {
                          setDatePickerTarget("shiftRowEnd");
                          setEditingShiftIndex(idx);
                          setShowEndTimeModal(true);
                        }}
                      >
                        <Text
                          variant="small"
                          color={
                            shift.endTime
                              ? theme.colors.text
                              : theme.colors.textSecondary
                          }
                        >
                          {shift.endTime || "End Time"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}

              <Button
                title="Add Another Role"
                variant="outline"
                size="small"
                icon={<Plus size={16} color={theme.colors.primary} />}
                onPress={() =>
                  setRosterShifts([
                    ...rosterShifts,
                    { role: "", startTime: "", endTime: "" },
                  ])
                }
                style={{ marginBottom: theme.spacing.lg }}
              />

              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  createAsTemplate && styles.toggleBtnActive,
                  { marginTop: theme.spacing.sm },
                ]}
                onPress={() => setCreateAsTemplate(!createAsTemplate)}
              >
                <Text
                  variant="small"
                  weight="600"
                  color={
                    createAsTemplate ? theme.colors.white : theme.colors.text
                  }
                >
                  Save as Template
                </Text>
              </TouchableOpacity>
            </>
          )}

          {type === "Trade" && (
            <>
              <Text variant="h4" style={styles.label}>
                Category
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Plumbing, Electrical"
                value={category}
                onChangeText={setCategory}
              />
              <Text variant="h4" style={styles.label}>
                Phone
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 555-0198"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <Text variant="h4" style={styles.label}>
                Email
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. contact@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </>
          )}

          {type === "Product" && (
            <>
              <Text variant="h4" style={styles.label}>
                Product Image
              </Text>
              {/* Primary product image */}
              <TouchableOpacity
                style={styles.imagePickerBtn}
                onPress={async () => {
                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ["images"],
                    allowsEditing: true,
                    quality: 0.85,
                    aspect: [1, 1],
                  });
                  if (!result.canceled && result.assets?.[0]?.uri) {
                    setProductImageUri(result.assets[0].uri);
                  }
                }}
              >
                {productImageUri ? (
                  <Image
                    source={{ uri: productImageUri }}
                    style={styles.previewImage}
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Camera color={theme.colors.textSecondary} size={20} />
                    <Text
                      variant="small"
                      color={theme.colors.textSecondary}
                      style={{ marginTop: 6 }}
                    >
                      Add Cover Image
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Additional images (up to 4) */}
              <Text variant="h4" style={styles.label}>
                Additional Images
              </Text>
              <Text
                variant="small"
                color={theme.colors.textSecondary}
                style={{ marginBottom: theme.spacing.sm }}
              >
                Add up to 4 more photos for this product
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: theme.spacing.sm,
                  marginBottom: theme.spacing.lg,
                }}
              >
                {[0, 1, 2, 3].map((idx) => {
                  const uri = additionalImageUris[idx];
                  return (
                    <View key={idx} style={{ position: "relative" }}>
                      <TouchableOpacity
                        style={{
                          width: 76,
                          height: 76,
                          borderRadius: theme.radius.sm,
                          borderWidth: 1,
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.surface,
                          overflow: "hidden",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        onPress={async () => {
                          const result =
                            await ImagePicker.launchImageLibraryAsync({
                              mediaTypes: ["images"],
                              allowsEditing: true,
                              quality: 0.85,
                              aspect: [1, 1],
                            });
                          if (!result.canceled && result.assets?.[0]?.uri) {
                            setAdditionalImageUris((prev) => {
                              const updated = [...prev];
                              updated[idx] = result.assets[0].uri;
                              return updated;
                            });
                          }
                        }}
                      >
                        {uri ? (
                          <Image
                            source={{ uri }}
                            style={{
                              width: "100%",
                              height: "100%",
                              resizeMode: "cover",
                            }}
                          />
                        ) : (
                          <Camera
                            color={theme.colors.textSecondary}
                            size={20}
                          />
                        )}
                      </TouchableOpacity>
                      {uri ? (
                        <TouchableOpacity
                          onPress={() => {
                            setAdditionalImageUris((prev) => {
                              const updated = [...prev];
                              updated[idx] = "";
                              return updated;
                            });
                          }}
                          style={{
                            position: "absolute",
                            top: -6,
                            right: -6,
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: theme.colors.error || "#e53e3e",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            variant="small"
                            color="#fff"
                            weight="700"
                            style={{ fontSize: 11, lineHeight: 14 }}
                          >
                            ✕
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              <Text variant="h4" style={styles.label}>
                Size Guide Image
              </Text>
              <TouchableOpacity
                style={styles.imagePickerBtn}
                onPress={async () => {
                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ["images"],
                    allowsEditing: true,
                    quality: 0.85,
                    aspect: [4, 5],
                  });
                  if (!result.canceled && result.assets?.[0]?.uri) {
                    setSizeGuideImageUri(result.assets[0].uri);
                  }
                }}
              >
                {sizeGuideImageUri ? (
                  <Image
                    source={{ uri: sizeGuideImageUri }}
                    style={styles.previewImage}
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Camera color={theme.colors.textSecondary} size={20} />
                    <Text
                      variant="small"
                      color={theme.colors.textSecondary}
                      style={{ marginTop: 6 }}
                    >
                      Add Size Guide Image
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text variant="h4" style={styles.label}>
                Price ($)
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 29.99"
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
              />
              <Text variant="h4" style={styles.label}>
                Category
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Apparel, Equipment"
                value={category}
                onChangeText={setCategory}
              />

              <Text variant="h4" style={styles.label}>
                Product Details
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={
                  "Include details like fit, fabric, construction, care instructions."
                }
                value={productDetails}
                onChangeText={setProductDetails}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />

              <Text variant="h4" style={styles.label}>
                Visibility
              </Text>
              <View style={styles.segmentRow}>
                {["club", "network", "public"].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.segmentBtn,
                      visibility === option && styles.segmentBtnActive,
                    ]}
                    onPress={() => setVisibility(option)}
                  >
                    <Text
                      variant="small"
                      weight="600"
                      color={
                        visibility === option
                          ? theme.colors.white
                          : theme.colors.text
                      }
                    >
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text variant="h4" style={styles.label}>
                Postage Option
              </Text>
              <View style={styles.segmentRow}>
                {[
                  { key: "post", label: "Can Post" },
                  { key: "pickup", label: "Pick Up" },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.segmentBtn,
                      postageOption === option.key && styles.segmentBtnActive,
                    ]}
                    onPress={() => setPostageOption(option.key)}
                  >
                    <Text
                      variant="small"
                      weight="600"
                      color={
                        postageOption === option.key
                          ? theme.colors.white
                          : theme.colors.text
                      }
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text variant="h4" style={styles.label}>
                Variants
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={"One variant per line, e.g.\nS:8\nM:10\nL:5"}
                value={variantsInput}
                onChangeText={setVariantsInput}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Text variant="h4" style={styles.label}>
                Fallback Stock
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 25 (use -1 for unlimited)"
                value={stock}
                onChangeText={setStock}
                keyboardType="number-pad"
              />
            </>
          )}

          {type === "Drill" && (
            <>
              <Text variant="h4" style={styles.label}>
                Drill Category
              </Text>
              <View style={styles.segmentRow}>
                {[
                  "Warm-up",
                  "Technical",
                  "Tactical",
                  "Fitness",
                  "Game",
                  "General",
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.segmentBtn,
                      category === opt && styles.segmentBtnActive,
                    ]}
                    onPress={() => setCategory(opt)}
                  >
                    <Text
                      variant="small"
                      weight="600"
                      color={
                        category === opt
                          ? theme.colors.white
                          : theme.colors.text
                      }
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text variant="h4" style={styles.label}>
                Difficulty
              </Text>
              <View style={styles.segmentRow}>
                {["Beginner", "Intermediate", "Advanced", "Professional"].map(
                  (opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.segmentBtn,
                        drillDifficulty === opt && styles.segmentBtnActive,
                      ]}
                      onPress={() => setDrillDifficulty(opt)}
                    >
                      <Text
                        variant="small"
                        weight="600"
                        color={
                          drillDifficulty === opt
                            ? theme.colors.white
                            : theme.colors.text
                        }
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ),
                )}
              </View>

              <Text variant="h4" style={styles.label}>
                Duration (minutes)
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 20"
                value={drillDuration}
                onChangeText={setDrillDuration}
                keyboardType="number-pad"
              />

              <Text variant="h4" style={styles.label}>
                Video URLs
              </Text>
              {drillVideoUrls.map((url, idx) => (
                <View
                  key={`vid-${idx}`}
                  style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}
                >
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="https://youtube.com/..."
                    value={url}
                    onChangeText={(val) => {
                      const next = [...drillVideoUrls];
                      next[idx] = val;
                      setDrillVideoUrls(next);
                    }}
                  />
                  {drillVideoUrls.length > 1 && (
                    <TouchableOpacity
                      onPress={() =>
                        setDrillVideoUrls(
                          drillVideoUrls.filter((_, i) => i !== idx),
                        )
                      }
                      style={[
                        styles.segmentBtn,
                        {
                          flex: 0,
                          width: 44,
                          marginRight: 0,
                          backgroundColor: theme.colors.error + "20",
                          borderColor: theme.colors.error + "40",
                        },
                      ]}
                    >
                      <Text color={theme.colors.error}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <Button
                title="+ Add Video URL"
                variant="outline"
                size="small"
                onPress={() => setDrillVideoUrls([...drillVideoUrls, ""])}
                style={{ marginBottom: 16 }}
              />

              <Text variant="h4" style={styles.label}>
                Photos
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                {drillImageUrls
                  .filter((u) => u && u.trim())
                  .map((url, idx) => (
                    <View
                      key={`img-${idx}`}
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 8,
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <Image
                        source={{ uri: url }}
                        style={{ width: "100%", height: "100%" }}
                      />
                      <TouchableOpacity
                        onPress={() =>
                          setDrillImageUrls(
                            drillImageUrls.filter((u) => u !== url),
                          )
                        }
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          backgroundColor: "rgba(0,0,0,0.5)",
                          borderRadius: 10,
                          width: 20,
                          height: 20,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: "#fff", fontSize: 10 }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                {drillImagePreviews.map((p) => (
                  <View
                    key={p.key}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 8,
                      backgroundColor: "#eee",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.primary}
                    />
                  </View>
                ))}
                <TouchableOpacity
                  onPress={handlePickDrillImage}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 8,
                    borderStyle: "dashed",
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: theme.colors.surface,
                  }}
                >
                  <Plus color={theme.colors.textSecondary} size={24} />
                </TouchableOpacity>
              </View>

              <Text variant="h4" style={styles.label}>
                Audience (Teams / Groups)
              </Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => {
                  setGroupPickerMode("multi");
                  setGroupSearchQuery("");
                  setShowGroupPicker(true);
                }}
              >
                <Text
                  color={
                    selectedTaskGroupIds.length > 0
                      ? theme.colors.text
                      : theme.colors.textSecondary
                  }
                >
                  {selectedTaskGroupIds.length > 0
                    ? `${selectedTaskGroupIds.length} groups selected`
                    : "Select audience..."}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <Modal
            visible={showGroupPicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowGroupPicker(false)}
          >
            <View
              style={[
                styles.dateModalOverlay,
                { justifyContent: "flex-end", padding: 0 },
              ]}
            >
              <View
                style={[
                  styles.dateModalCard,
                  {
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                    height: "80%",
                  },
                ]}
              >
                <View
                  style={{
                    padding: theme.spacing.lg,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.border,
                  }}
                >
                  <Text variant="h3">
                    {groupPickerMode === "multi"
                      ? "Select Teams / Groups"
                      : "Select Team or Group"}
                  </Text>
                </View>

                <View style={{ padding: theme.spacing.md }}>
                  <TextInput
                    style={[styles.input, { marginBottom: 0 }]}
                    placeholder={
                      groupPickerMode === "multi"
                        ? "Search and select multiple teams/groups..."
                        : "Search teams and groups..."
                    }
                    value={groupSearchQuery}
                    onChangeText={setGroupSearchQuery}
                  />
                </View>

                <ScrollView
                  contentContainerStyle={{ padding: theme.spacing.md }}
                >
                  {filteredGroupOptions.length === 0 ? (
                    <Text
                      variant="body"
                      color={theme.colors.textSecondary}
                      style={{
                        textAlign: "center",
                        marginTop: theme.spacing.xl,
                      }}
                    >
                      No matching teams or groups found.
                    </Text>
                  ) : (
                    filteredGroupOptions.map((group) => (
                      <TouchableOpacity
                        key={group.id}
                        style={{
                          paddingVertical: theme.spacing.md,
                          borderBottomWidth: 1,
                          borderBottomColor: theme.colors.border,
                          flexDirection: "row",
                          alignItems: "center",
                        }}
                        onPress={() => {
                          if (groupPickerMode === "multi") {
                            if (type === "Task") {
                              toggleTaskGroupSelection(group.id);
                            } else if (type === "Shift") {
                              toggleShiftGroupSelection(group.id);
                            } else {
                              toggleEventGroupSelection(group.id);
                            }
                            return;
                          }

                          setAssignedGroupId(group.id);
                          setAssignedGroupName(group.name);
                          setAssignedGroupType(group.type);
                          setShowGroupPicker(false);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text variant="body" weight="600">
                            {group.name}
                          </Text>
                          <Text
                            variant="small"
                            color={theme.colors.textSecondary}
                          >
                            {group.type}
                          </Text>
                        </View>
                        {(groupPickerMode === "multi"
                          ? type === "Task"
                            ? selectedTaskGroupIds.includes(group.id)
                            : type === "Shift"
                              ? selectedShiftGroupIds.includes(group.id)
                              : selectedEventGroupIds.includes(group.id)
                          : assignedGroupId === group.id) && (
                          <Text
                            variant="small"
                            color={theme.colors.primary}
                            weight="700"
                          >
                            Selected
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>

                {groupPickerMode === "multi" ? (
                  <View style={[styles.repeatFooterRow, { paddingBottom: 24 }]}>
                    <Button
                      title="Clear"
                      variant="outline"
                      size="small"
                      style={styles.repeatFooterBtn}
                      onPress={() =>
                        type === "Task"
                          ? setSelectedTaskGroupIds([])
                          : type === "Shift"
                            ? setSelectedShiftGroupIds([])
                            : setSelectedEventGroupIds([])
                      }
                    />
                    <Button
                      title="Done"
                      size="small"
                      style={styles.repeatFooterBtn}
                      onPress={() => setShowGroupPicker(false)}
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.footer,
                      { padding: theme.spacing.md, alignItems: "center" },
                    ]}
                    onPress={() => setShowGroupPicker(false)}
                  >
                    <Text variant="body" weight="600" color={theme.colors.text}>
                      Close
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Modal>

          <Modal
            visible={
              showRepeatPresetModal && ["Event", "Task", "Shift"].includes(type)
            }
            transparent
            animationType="fade"
            onRequestClose={() => setShowRepeatPresetModal(false)}
          >
            <View style={styles.dateModalOverlay}>
              <View style={styles.dateModalCard}>
                <Text variant="h4" style={styles.dateModalTitle}>
                  Repeat
                </Text>
                <ScrollView
                  style={{ maxHeight: 340 }}
                  contentContainerStyle={{
                    paddingHorizontal: theme.spacing.md,
                  }}
                >
                  {repeatPresetOptions.map((option) => (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.repeatOptionRow,
                        repeatPreset === option.key &&
                          styles.repeatOptionRowActive,
                      ]}
                      onPress={() => handleRepeatPresetSelect(option.key)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text variant="body" weight="600">
                          {option.label}
                        </Text>
                        <Text
                          variant="small"
                          color={theme.colors.textSecondary}
                        >
                          {option.subtitle}
                        </Text>
                      </View>
                      {repeatPreset === option.key ? (
                        <Text
                          variant="small"
                          color={theme.colors.primary}
                          weight="700"
                        >
                          Selected
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={styles.dateModalCloseBtn}
                  onPress={() => setShowRepeatPresetModal(false)}
                >
                  <Text
                    variant="body"
                    weight="600"
                    color={theme.colors.primary}
                  >
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal
            visible={
              showCustomRepeatModal && ["Event", "Task", "Shift"].includes(type)
            }
            transparent
            animationType="slide"
            onRequestClose={() => setShowCustomRepeatModal(false)}
          >
            <View
              style={[
                styles.dateModalOverlay,
                { justifyContent: "flex-end", padding: 0 },
              ]}
            >
              <View
                style={[
                  styles.dateModalCard,
                  {
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                    maxHeight: "92%",
                  },
                ]}
              >
                {/* Header */}
                <View style={styles.customRepeatHeader}>
                  <TouchableOpacity
                    onPress={() => setShowCustomRepeatModal(false)}
                    style={styles.customRepeatHeaderBtn}
                  >
                    <Text variant="body" color={theme.colors.primary}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <Text variant="h4">Custom Recurrence</Text>
                  <TouchableOpacity
                    onPress={handleSaveCustomRepeat}
                    style={styles.customRepeatHeaderBtn}
                  >
                    <Text
                      variant="body"
                      weight="700"
                      color={theme.colors.primary}
                    >
                      Done
                    </Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  contentContainerStyle={{ paddingBottom: 32 }}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Summary Label */}
                  <View style={styles.customRepeatSummaryRow}>
                    <Text variant="small" color={theme.colors.textSecondary}>
                      ↻
                    </Text>
                    <Text variant="body" weight="600" style={{ marginLeft: 8 }}>
                      {(() => {
                        const freq = customRepeatFrequency || "weekly";
                        const interval =
                          normalizeRepeatInterval(customRepeatInterval);
                        const unitMap = {
                          daily: interval === 1 ? "day" : "days",
                          weekly: interval === 1 ? "week" : "weeks",
                          monthly: interval === 1 ? "month" : "months",
                          yearly: interval === 1 ? "year" : "years",
                        };
                        return `Every ${interval} ${unitMap[freq] || freq}`;
                      })()}
                    </Text>
                  </View>

                  {/* Scroll Picker for Interval + Frequency */}
                  <View style={styles.scrollPickerContainer}>
                    {/* Number Column */}
                    <ScrollView
                      style={styles.scrollPickerColumn}
                      showsVerticalScrollIndicator={false}
                      snapToInterval={48}
                      decelerationRate="fast"
                    >
                      {Array.from({ length: 30 }, (_, i) => i + 1).map(
                        (num) => {
                          const isSelected =
                            normalizeRepeatInterval(customRepeatInterval) ===
                            num;
                          return (
                            <TouchableOpacity
                              key={num}
                              style={[
                                styles.scrollPickerItem,
                                isSelected && styles.scrollPickerItemSelected,
                              ]}
                              onPress={() =>
                                setCustomRepeatInterval(String(num))
                              }
                            >
                              <Text
                                variant="body"
                                weight={isSelected ? "700" : "400"}
                                color={
                                  isSelected
                                    ? theme.colors.text
                                    : theme.colors.textSecondary
                                }
                                style={[
                                  { fontSize: isSelected ? 17 : 15 },
                                  !isSelected && {
                                    opacity: Math.max(
                                      0.3,
                                      1 -
                                        Math.abs(
                                          normalizeRepeatInterval(
                                            customRepeatInterval,
                                          ) - num,
                                        ) *
                                          0.25,
                                    ),
                                  },
                                ]}
                              >
                                {num}
                              </Text>
                            </TouchableOpacity>
                          );
                        },
                      )}
                    </ScrollView>

                    {/* Frequency Column */}
                    <ScrollView
                      style={styles.scrollPickerColumn}
                      showsVerticalScrollIndicator={false}
                      snapToInterval={48}
                      decelerationRate="fast"
                    >
                      {[
                        { key: "daily", label: "day", labelPlural: "days" },
                        { key: "weekly", label: "week", labelPlural: "weeks" },
                        {
                          key: "monthly",
                          label: "month",
                          labelPlural: "months",
                        },
                        { key: "yearly", label: "year", labelPlural: "years" },
                      ].map((freq) => {
                        const interval =
                          normalizeRepeatInterval(customRepeatInterval);
                        const displayLabel =
                          interval === 1 ? freq.label : freq.labelPlural;
                        const isSelected = customRepeatFrequency === freq.key;
                        return (
                          <TouchableOpacity
                            key={freq.key}
                            style={[
                              styles.scrollPickerItem,
                              isSelected && styles.scrollPickerItemSelected,
                            ]}
                            onPress={() => setCustomRepeatFrequency(freq.key)}
                          >
                            <Text
                              variant="body"
                              weight={isSelected ? "700" : "400"}
                              color={
                                isSelected
                                  ? theme.colors.text
                                  : theme.colors.textSecondary
                              }
                              style={[
                                { fontSize: isSelected ? 17 : 15 },
                                !isSelected && { opacity: 0.5 },
                              ]}
                            >
                              {displayLabel}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Weekly: Day selector */}
                  {customRepeatFrequency === "weekly" ? (
                    <View style={styles.customRepeatSection}>
                      <Text
                        variant="small"
                        weight="600"
                        color={theme.colors.textSecondary}
                        style={styles.customRepeatSectionTitle}
                      >
                        ON
                      </Text>
                      <View style={styles.weekDayRow}>
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                          (label, idx) => {
                            const selected = customRepeatWeekDays.includes(idx);
                            return (
                              <TouchableOpacity
                                key={idx}
                                onPress={() => {
                                  setCustomRepeatWeekDays((prev) =>
                                    prev.includes(idx)
                                      ? prev.filter((d) => d !== idx)
                                      : [...prev, idx].sort((a, b) => a - b),
                                  );
                                }}
                                style={[
                                  styles.weekDayCircle,
                                  selected && styles.weekDayCircleActive,
                                ]}
                              >
                                <Text
                                  variant="small"
                                  weight="700"
                                  color={
                                    selected
                                      ? theme.colors.white
                                      : theme.colors.textSecondary
                                  }
                                >
                                  {label}
                                </Text>
                              </TouchableOpacity>
                            );
                          },
                        )}
                      </View>
                    </View>
                  ) : null}

                  {/* Monthly: Pattern */}
                  {customRepeatFrequency === "monthly" ? (
                    <View style={styles.customRepeatSection}>
                      <Text
                        variant="small"
                        weight="600"
                        color={theme.colors.textSecondary}
                        style={styles.customRepeatSectionTitle}
                      >
                        MONTHLY PATTERN
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.customRepeatOptionRow,
                          customMonthlyMode === "same_day" &&
                            styles.customRepeatOptionRowActive,
                        ]}
                        onPress={() => setCustomMonthlyMode("same_day")}
                      >
                        <View style={styles.customRepeatRadio}>
                          {customMonthlyMode === "same_day" && (
                            <View style={styles.customRepeatRadioDot} />
                          )}
                        </View>
                        <Text variant="body">On the same day each month</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.customRepeatOptionRow,
                          customMonthlyMode === "nth_weekday" &&
                            styles.customRepeatOptionRowActive,
                        ]}
                        onPress={() => setCustomMonthlyMode("nth_weekday")}
                      >
                        <View style={styles.customRepeatRadio}>
                          {customMonthlyMode === "nth_weekday" && (
                            <View style={styles.customRepeatRadioDot} />
                          )}
                        </View>
                        <Text variant="body">
                          {repeatMonthlyWeekdayLabel ||
                            "On every selected weekday"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {/* Ends Section */}
                  <View style={styles.customRepeatSection}>
                    <Text
                      variant="small"
                      weight="600"
                      color={theme.colors.textSecondary}
                      style={styles.customRepeatSectionTitle}
                    >
                      ENDS
                    </Text>

                    {/* Doesn't end */}
                    <TouchableOpacity
                      style={[
                        styles.customRepeatOptionRow,
                        customRepeatEnds === "never" &&
                          styles.customRepeatOptionRowActive,
                      ]}
                      onPress={() => setCustomRepeatEnds("never")}
                    >
                      <View style={styles.customRepeatRadio}>
                        {customRepeatEnds === "never" && (
                          <View style={styles.customRepeatRadioDot} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="body">Doesn't end</Text>
                      </View>
                    </TouchableOpacity>

                    {/* On a specific date */}
                    <TouchableOpacity
                      style={[
                        styles.customRepeatOptionRow,
                        customRepeatEnds === "date" &&
                          styles.customRepeatOptionRowActive,
                      ]}
                      onPress={() => setCustomRepeatEnds("date")}
                    >
                      <View style={styles.customRepeatRadio}>
                        {customRepeatEnds === "date" && (
                          <View style={styles.customRepeatRadioDot} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="body">On date</Text>
                        {customRepeatEnds === "date" ? (
                          <TextInput
                            style={[
                              styles.input,
                              {
                                marginTop: 8,
                                marginBottom: 0,
                                paddingVertical: 8,
                                fontSize: 14,
                              },
                            ]}
                            value={customRepeatEndDate}
                            onChangeText={setCustomRepeatEndDate}
                            placeholder="YYYY-MM-DD"
                            keyboardType="numbers-and-punctuation"
                          />
                        ) : null}
                      </View>
                    </TouchableOpacity>

                    {/* After N occurrences */}
                    <TouchableOpacity
                      style={[
                        styles.customRepeatOptionRow,
                        customRepeatEnds === "count" &&
                          styles.customRepeatOptionRowActive,
                      ]}
                      onPress={() => setCustomRepeatEnds("count")}
                    >
                      <View style={styles.customRepeatRadio}>
                        {customRepeatEnds === "count" && (
                          <View style={styles.customRepeatRadioDot} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="body">After</Text>
                        {customRepeatEnds === "count" ? (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              marginTop: 8,
                            }}
                          >
                            <TextInput
                              style={[
                                styles.input,
                                {
                                  width: 80,
                                  marginBottom: 0,
                                  paddingVertical: 8,
                                  fontSize: 14,
                                  textAlign: "center",
                                },
                              ]}
                              value={customRepeatCount}
                              onChangeText={setCustomRepeatCount}
                              keyboardType="number-pad"
                              placeholder="10"
                            />
                            <Text
                              variant="body"
                              color={theme.colors.textSecondary}
                              style={{ marginLeft: 10 }}
                            >
                              occurrences
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>
          </Modal>

          <Modal
            visible={
              showDatePicker && ["Event", "Task", "Shift"].includes(type)
            }
            transparent
            animationType="fade"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.dateModalOverlay}>
              <View style={styles.dateModalCard}>
                <Text variant="h4" style={styles.dateModalTitle}>
                  {datePickerTitle}
                </Text>
                <Calendar
                  current={
                    normalizeIsoDateInput(activeDatePickerValue) || undefined
                  }
                  onDayPress={handleCalendarDayPress}
                  markedDates={
                    normalizeIsoDateInput(activeDatePickerValue)
                      ? {
                          [normalizeIsoDateInput(activeDatePickerValue)]: {
                            selected: true,
                            selectedColor: theme.colors.primary,
                          },
                        }
                      : undefined
                  }
                  theme={{
                    todayTextColor: theme.colors.primary,
                    selectedDayBackgroundColor: theme.colors.primary,
                    arrowColor: theme.colors.primary,
                    textDayFontWeight: "500",
                    textMonthFontWeight: "700",
                  }}
                />
                <TouchableOpacity
                  style={styles.dateModalCloseBtn}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text
                    variant="body"
                    weight="600"
                    color={theme.colors.primary}
                  >
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <TimePickerModal
            visible={showStartTimeModal}
            onClose={() => {
              setShowStartTimeModal(false);
              setEditingShiftIndex(null);
            }}
            onSelect={(val) => {
              if (editingShiftIndex !== null) {
                const next = [...rosterShifts];
                next[editingShiftIndex].startTime = val;
                setRosterShifts(next);
                setEditingShiftIndex(null);
              } else {
                setStartTime(val);
              }
              setShowStartTimeModal(false);
            }}
            selectedTime={
              editingShiftIndex !== null
                ? rosterShifts[editingShiftIndex]?.startTime || ""
                : startTime
            }
            title="Start Time"
          />
          <TimePickerModal
            visible={showEndTimeModal}
            onClose={() => {
              setShowEndTimeModal(false);
              setEditingShiftIndex(null);
            }}
            onSelect={(val) => {
              if (editingShiftIndex !== null) {
                const next = [...rosterShifts];
                next[editingShiftIndex].endTime = val;
                setRosterShifts(next);
                setEditingShiftIndex(null);
              } else {
                setEndTime(val);
              }
              setShowEndTimeModal(false);
            }}
            selectedTime={
              editingShiftIndex !== null
                ? rosterShifts[editingShiftIndex]?.endTime || ""
                : endTime
            }
            title="End Time"
          />
        </ScrollView>
        <View style={styles.footer}>
          <Button
            title={
              loading
                ? isEditMode
                  ? "Updating..."
                  : "Creating..."
                : isEditMode
                  ? `Update ${type}`
                  : `Create ${type}`
            }
            onPress={handleSave}
            style={{ width: "100%" }}
            disabled={loading}
          />
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showSelectedEventUsersModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSelectedEventUsersModal(false)}
      >
        <View style={styles.usersModalOverlay}>
          <View style={styles.usersModalCard}>
            <View style={styles.usersModalHeader}>
              <View>
                <Text variant="h3" weight="700">
                  Selected Users
                </Text>
                <Text variant="small" color={theme.colors.textSecondary}>
                  {selectedEventUserOptions.length} user
                  {selectedEventUserOptions.length === 1 ? "" : "s"} selected
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSelectedEventUsersModal(false)}
                style={styles.usersModalCloseBtn}
              >
                <Text variant="body" weight="600" color={theme.colors.primary}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>

            {selectedEventUserOptions.length === 0 ? (
              <View style={styles.usersModalEmpty}>
                <Text
                  variant="small"
                  color={theme.colors.textSecondary}
                  style={{ textAlign: "center" }}
                >
                  No users selected
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.usersModalScroll}
                contentContainerStyle={styles.usersModalContent}
                showsVerticalScrollIndicator={true}
              >
                {selectedEventUserOptions.map((member) => (
                  <View key={member.id} style={styles.userItemContainer}>
                    <View style={{ flex: 1 }}>
                      <Text variant="body" weight="600">
                        {member.displayName ||
                          member.name ||
                          member.fullName ||
                          "Unknown"}
                      </Text>
                      <Text
                        variant="small"
                        color={theme.colors.textSecondary}
                        style={{ marginTop: 4 }}
                      >
                        {member.email || "No email"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        setSelectedEventUserIds((prev) =>
                          prev.filter((id) => id !== member.id),
                        )
                      }
                      style={styles.userRemoveBtn}
                    >
                      <Text
                        variant="small"
                        weight="600"
                        color={theme.colors.error}
                      >
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    marginRight: theme.spacing.sm,
  },
  content: {
    padding: theme.spacing.xl,
    paddingBottom: 100,
  },
  label: {
    marginBottom: theme.spacing.sm,
    color: theme.colors.textSecondary,
  },
  helperText: {
    marginBottom: theme.spacing.sm,
  },
  playerSearchInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  textArea: {
    minHeight: 120,
  },
  priorityBtn: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
    borderRadius: theme.radius.sm,
  },
  priorityBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  toggleBtn: {
    paddingVertical: theme.spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    marginBottom: theme.spacing.md,
  },
  toggleBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  allDayToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.lg,
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.border,
    padding: 2,
    justifyContent: "center",
  },
  switchTrackActive: {
    backgroundColor: theme.colors.primary,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    alignSelf: "flex-start",
  },
  switchThumbActive: {
    alignSelf: "flex-end",
  },
  imagePickerBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    marginBottom: theme.spacing.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
  },
  imagePlaceholder: {
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: {
    width: "100%",
    height: 220,
    resizeMode: "cover",
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: theme.spacing.md,
  },
  segmentBtn: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
  },
  segmentBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  playersWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: theme.spacing.lg,
  },
  playerChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  playerChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  dateModalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    paddingBottom: 24,
  },
  dateModalTitle: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  dateModalCloseBtn: {
    alignItems: "center",
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  repeatOptionRow: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    flexDirection: "row",
    alignItems: "center",
  },
  repeatOptionRowActive: {
    borderColor: theme.colors.primary,
    backgroundColor: "rgba(16, 139, 81, 0.08)",
  },
  repeatHintCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  repeatFooterRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  repeatFooterBtn: {
    flex: 1,
  },
  footer: {
    padding: theme.spacing.xl,
    paddingBottom: Platform.OS === "ios" ? 40 : theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  // Custom Repeat Modal - Google Calendar Style
  customRepeatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  customRepeatHeaderBtn: {
    minWidth: 60,
  },
  customRepeatSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  scrollPickerContainer: {
    flexDirection: "row",
    height: 240,
    overflow: "hidden",
    marginVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  scrollPickerColumn: {
    flex: 1,
  },
  scrollPickerItem: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  scrollPickerItemSelected: {
    backgroundColor: "rgba(16,139,81,0.08)",
    borderRadius: theme.radius.sm,
  },
  customRepeatSection: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: 16,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  customRepeatSectionTitle: {
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  weekDayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  weekDayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  weekDayCircleActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  customRepeatOptionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  customRepeatOptionRowActive: {
    backgroundColor: "rgba(16,139,81,0.04)",
  },
  customRepeatRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
  },
  customRepeatRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  // Selected Users Modal
  usersModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  usersModalCard: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    maxHeight: "85%",
    flexDirection: "column",
    flex: 1,
  },
  usersModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  usersModalCloseBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  usersModalScroll: {
    flex: 1,
    minHeight: 200,
  },
  usersModalEmpty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
    paddingVertical: theme.spacing.lg,
  },
  usersModalContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  userItemContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
  },
  userRemoveBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: "rgba(255, 76, 76, 0.1)",
    borderRadius: theme.radius.sm,
  },
});

export default CreateItemScreen;
