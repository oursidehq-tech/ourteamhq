import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Search,
  Plus,
  Calendar as CalendarIcon,
  MapPin,
  CheckCircle,
  ClipboardList,
  Repeat,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Users,
  Trash2,
  X,
  AlignLeft,
  Tag,
  CalendarDays,
} from "lucide-react-native";
import { Text } from "../components/ui/Typography";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Avatar } from "../components/ui/Avatar";
import { theme } from "../theme/theme";
import { useClub } from "../contexts/ClubContext";
import { useAuth } from "../contexts/AuthContext";
import { useTabBarAnimation } from "../contexts/TabBarAnimationContext";
import { subscribeToEvents, deleteEvent } from "../services/eventService";
import {
  subscribeToVisibleTasks,
  subscribeToVisibleRosters,
} from "../services/managementService";
import {
  parseIsoDate,
  toIsoDateLocal,
  addDaysToIsoDate,
  buildOccurrenceDates,
  describeRecurrence,
  hasRecurrence,
  todayIsoDate,
} from "../utils/recurrence";

/* ------------------------------------------------------------------ */
/* Date helpers                                                        */
/* ------------------------------------------------------------------ */

const WEEKDAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
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

const getWeekDatesForDate = (dateStr) => {
  const anchor = parseIsoDate(dateStr) || new Date();
  const startOfWeek = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate(),
  );
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const todayKey = todayIsoDate();

  return WEEKDAY_SHORT.map((day, index) => {
    const date = new Date(startOfWeek.getTime());
    date.setDate(startOfWeek.getDate() + index);
    const fullDate = toIsoDateLocal(date);
    return {
      day,
      date: String(date.getDate()),
      fullDate,
      isToday: fullDate === todayKey,
    };
  });
};

const getMonthGrid = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const todayKey = todayIsoDate();
  const dates = [];

  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i -= 1) {
    const d = new Date(year, month - 1, prevMonthLastDay - i);
    const fullDate = toIsoDateLocal(d);
    dates.push({
      day: d.getDate(),
      fullDate,
      isCurrentMonth: false,
      isToday: fullDate === todayKey,
    });
  }

  for (let i = 1; i <= lastDay.getDate(); i += 1) {
    const d = new Date(year, month, i);
    const fullDate = toIsoDateLocal(d);
    dates.push({
      day: i,
      fullDate,
      isCurrentMonth: true,
      isToday: fullDate === todayKey,
    });
  }

  const remaining = (7 - (dates.length % 7)) % 7;
  for (let i = 1; i <= remaining; i += 1) {
    const d = new Date(year, month + 1, i);
    const fullDate = toIsoDateLocal(d);
    dates.push({
      day: i,
      fullDate,
      isCurrentMonth: false,
      isToday: fullDate === todayKey,
    });
  }

  return dates;
};

const formatLongDate = (value) => {
  if (!value) return "Date TBC";
  const d = parseIsoDate(value);
  if (!d) return value;
  return `${WEEKDAY_LONG[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
};

const formatGroupHeader = (value) => {
  if (!value) return "No date";
  const d = parseIsoDate(value);
  if (!d) return value;
  const todayKey = todayIsoDate();
  const tomorrowKey = addDaysToIsoDate(todayKey, 1);
  if (value === todayKey) return "Today";
  if (value === tomorrowKey) return "Tomorrow";
  return `${WEEKDAY_SHORT[d.getDay()]} · ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
};

/* ------------------------------------------------------------------ */
/* Presentation helpers                                                */
/* ------------------------------------------------------------------ */

const TYPE_COLORS = {
  training: "#007AFF",
  game: theme.colors.primary,
  match: theme.colors.primary,
  fixtures: theme.colors.primary,
  task: theme.colors.error,
  roster: "#6B7280",
  shift: "#6B7280",
  event: "#FF9500",
  meeting: "#5856D6",
};

const getEventColor = (type) =>
  TYPE_COLORS[String(type || "").toLowerCase()] || theme.colors.primary;

const getTypeLabel = (item) => {
  const type = String(item?.eventType || "event").toLowerCase();
  if (type === "game" || type === "match") return "FIXTURE";
  if (type === "roster" || type === "shift") return "SHIFT";
  return type.toUpperCase();
};

const formatItemTime = (item) => {
  if (item?.isAllDay) return "All day";
  const raw = String(item?.startTime || "").trim();
  if (!raw) return "";
  if (raw.toLowerCase() === "all day") return "All day";
  if (item?.endTime) return `${raw} – ${item.endTime}`;
  return raw;
};

const FILTERS = ["All", "Fixtures", "Training", "Tasks", "Rosters"];

const FILTER_DOT_COLORS = {
  Fixtures: theme.colors.primary,
  Training: "#007AFF",
  Tasks: theme.colors.error,
  Rosters: "#6B7280",
};

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                         */
/* ------------------------------------------------------------------ */

const DayDots = ({ items = [], active = false, max = 3 }) => {
  if (!items.length) return null;
  const shown = items.slice(0, max);
  const extra = items.length - shown.length;

  return (
    <View style={styles.dotRow}>
      {shown.map((item, index) => (
        <View
          key={`${item.id || index}`}
          style={[
            styles.dot,
            {
              backgroundColor: active
                ? theme.colors.white
                : getEventColor(item.eventType),
            },
          ]}
        />
      ))}
      {extra > 0 ? (
        <Text
          style={[styles.dotMore, active ? { color: theme.colors.white } : null]}
        >
          +{extra}
        </Text>
      ) : null}
    </View>
  );
};

const DetailRow = ({ icon, label, value, multiline = false }) => {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text variant="small" color={theme.colors.textSecondary}>
          {label}
        </Text>
        <Text
          variant="body"
          weight="600"
          style={multiline ? { lineHeight: 21, fontWeight: "400" } : null}
        >
          {value}
        </Text>
      </View>
    </View>
  );
};

export default function CalendarScreen({ navigation }) {
  const { activeClubId, activeClub, userRole, userGroupIds } = useClub();
  const { user, profile } = useAuth();
  const normalizedRole = String(userRole || "").trim().toLowerCase();
  const isAdmin = normalizedRole === "owner" || normalizedRole === "admin";

  const myTeamIds = useMemo(() => {
    const memberships = Array.isArray(profile?.clubMemberships)
      ? profile.clubMemberships
      : [];
    const membership = memberships.find((m) => m.clubId === activeClubId);
    return Array.isArray(membership?.teamIds) ? membership.teamIds : [];
  }, [profile?.clubMemberships, activeClubId]);

  const myGroupIds = useMemo(() => {
    const memberships = Array.isArray(profile?.clubMemberships)
      ? profile.clubMemberships
      : [];
    const membership = memberships.find((m) => m.clubId === activeClubId);
    return Array.isArray(membership?.groupIds) ? membership.groupIds : [];
  }, [profile?.clubMemberships, activeClubId]);

  // Serialized keys keep the subscription effect stable across renders.
  const myTeamIdsKey = JSON.stringify(myTeamIds);
  const myGroupIdsKey = JSON.stringify(myGroupIds);

  const { setCollapsed } = useTabBarAnimation();
  const [activeFilter, setActiveFilter] = useState("All");
  const [calendarPanelTab, setCalendarPanelTab] = useState("schedule");
  const [viewMode, setViewMode] = useState("week");
  const [selectedFullDate, setSelectedFullDate] = useState(() =>
    toIsoDateLocal(new Date()),
  );
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(() =>
    new Date().getFullYear(),
  );
  // Track the week anchor (always a Sunday) independently for reliable navigation
  const [currentWeekSunday, setCurrentWeekSunday] = useState(() => {
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());
    return toIsoDateLocal(sunday);
  });

  const weekDates = useMemo(
    () => getWeekDatesForDate(currentWeekSunday),
    [currentWeekSunday],
  );
  const monthDates = useMemo(
    () => getMonthGrid(currentYear, currentMonth),
    [currentYear, currentMonth],
  );
  const monthYearLabel = `${MONTH_NAMES[currentMonth]} ${currentYear}`;
  const [allEvents, setAllEvents] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [allRosters, setAllRosters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const contentScrollRef = useRef(null);
  const listAutoScrollDoneRef = useRef(false);

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

  const goToToday = useCallback(() => {
    const today = todayIsoDate();
    const d = parseIsoDate(today) || new Date();
    setSelectedFullDate(today);
    setCurrentMonth(d.getMonth());
    setCurrentYear(d.getFullYear());
    const sunday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    sunday.setDate(sunday.getDate() - sunday.getDay());
    setCurrentWeekSunday(toIsoDateLocal(sunday));
  }, []);

  // Navigate the week strip by delta weeks, keeping the selected weekday.
  const navigateWeek = useCallback(
    (deltaWeeks) => {
      const baseSunday = parseIsoDate(currentWeekSunday) || new Date();
      const nextSunday = new Date(baseSunday.getTime());
      nextSunday.setDate(baseSunday.getDate() + deltaWeeks * 7);
      setCurrentWeekSunday(toIsoDateLocal(nextSunday));

      const selected = parseIsoDate(selectedFullDate) || baseSunday;
      const nextSelected = new Date(selected.getTime());
      nextSelected.setDate(selected.getDate() + deltaWeeks * 7);
      setSelectedFullDate(toIsoDateLocal(nextSelected));
    },
    [currentWeekSunday, selectedFullDate],
  );

  // Navigate the month calendar by a given number of months (direct update)
  const navigateMonth = useCallback(
    (delta) => {
      let newMonth = currentMonth + delta;
      let newYear = currentYear;
      if (newMonth > 11) {
        newMonth -= 12;
        newYear += 1;
      } else if (newMonth < 0) {
        newMonth += 12;
        newYear -= 1;
      }
      setCurrentMonth(newMonth);
      setCurrentYear(newYear);

      // Keep the selected day-of-month when possible.
      const selected = parseIsoDate(selectedFullDate) || new Date();
      const lastDay = new Date(newYear, newMonth + 1, 0).getDate();
      const day = Math.min(selected.getDate(), lastDay);
      setSelectedFullDate(toIsoDateLocal(new Date(newYear, newMonth, day)));
    },
    [currentMonth, currentYear, selectedFullDate],
  );

  const goToPrevPeriod = useCallback(() => {
    if (viewMode === "week") {
      navigateWeek(-1);
      return;
    }
    navigateMonth(-1);
  }, [viewMode, navigateWeek, navigateMonth]);

  const goToNextPeriod = useCallback(() => {
    if (viewMode === "week") {
      navigateWeek(1);
      return;
    }
    navigateMonth(1);
  }, [viewMode, navigateWeek, navigateMonth]);

  // Selecting a day keeps the week strip, month grid and header in sync.
  const selectDate = useCallback((fullDate) => {
    setSelectedFullDate(fullDate);
    const d = parseIsoDate(fullDate);
    if (!d) return;
    const sunday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    sunday.setDate(sunday.getDate() - sunday.getDay());
    setCurrentWeekSunday(toIsoDateLocal(sunday));
    setCurrentMonth(d.getMonth());
    setCurrentYear(d.getFullYear());
  }, []);

  useEffect(() => {
    if (!activeClubId) {
      setAllEvents([]);
      setAllTasks([]);
      setAllRosters([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const unsubscribeEvents = subscribeToEvents(
      activeClubId,
      (newEvents) => {
        setAllEvents(newEvents || []);
        setLoading(false);
      },
      {
        teamIds: myTeamIds,
        groupIds: myGroupIds,
        isAdmin,
      },
    );
    const unsubscribeTasks = subscribeToVisibleTasks(
      activeClubId,
      (newTasks) => {
        setAllTasks(newTasks || []);
      },
      { userGroupIds, userId: user?.uid || "", scope: "all", isAdmin },
    );
    const unsubscribeRosters = subscribeToVisibleRosters(
      activeClubId,
      (newRosters) => {
        setAllRosters(newRosters || []);
        setLoading(false);
      },
      { userGroupIds, userId: user?.uid || "", scope: "all", isAdmin },
    );

    return () => {
      unsubscribeEvents?.();
      unsubscribeTasks?.();
      unsubscribeRosters?.();
    };
    // myTeamIds / myGroupIds are recreated on every render, so depend on
    // their serialized form instead to avoid re-subscribing constantly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId, userGroupIds, user?.uid, isAdmin, myTeamIdsKey, myGroupIdsKey]);

  const visibleTasks = allTasks;
  const visibleRosters = allRosters;

  /* ---------------- item building ---------------- */

  const rangeStart = useMemo(() => {
    if (viewMode === "month") return monthDates[0]?.fullDate || selectedFullDate;
    if (viewMode === "week") return weekDates[0]?.fullDate || selectedFullDate;
    return todayIsoDate();
  }, [viewMode, monthDates, weekDates, selectedFullDate]);

  const rangeEnd = useMemo(() => {
    if (viewMode === "month") {
      return monthDates[monthDates.length - 1]?.fullDate || selectedFullDate;
    }
    if (viewMode === "week") {
      return weekDates[weekDates.length - 1]?.fullDate || selectedFullDate;
    }
    return addDaysToIsoDate(todayIsoDate(), 120);
  }, [viewMode, monthDates, weekDates, selectedFullDate]);

  const buildItems = useCallback(
    (startDate, endDate) => {
      const eventItems = (allEvents || []).flatMap((event) => {
        const baseDate = event.startDate || event.date;
        if (!baseDate) return [];
        const occurrenceDates = buildOccurrenceDates(
          baseDate,
          event.recurringRule,
          startDate,
          endDate,
          { endDate: event.endDate || event.date },
        );

        return occurrenceDates.map((occurrenceDate) => ({
          id: `event-${event.id}-${occurrenceDate}`,
          source: "event",
          sourceId: event.id,
          originalItem: event,
          title: event.title || "Untitled event",
          subtitle: event.location || "",
          description: event.description || "",
          date: occurrenceDate,
          baseDate,
          recurringRule: event.recurringRule || null,
          startTime: event.isAllDay ? "All day" : event.startTime || "",
          endTime: event.isAllDay ? "" : event.endTime || "",
          eventType: event.type || "event",
          isRecurring: hasRecurrence(event.recurringRule),
          isAllDay: !!event.isAllDay,
          location: event.location || "",
          assignedGroupName: event.assignedGroupName || "",
          assignedUserNames: event.assignedUserNames || [],
          openToAll: !!event.openToAll,
        }));
      });

      const taskItems = (visibleTasks || []).flatMap((task) => {
        const baseDate = task.startDate || task.dueDate;
        if (!baseDate) return [];
        const occurrenceDates = buildOccurrenceDates(
          baseDate,
          task.recurringRule,
          startDate,
          endDate,
          { endDate: task.endDate || task.dueDate },
        );

        return occurrenceDates.map((occurrenceDate) => ({
          id: `task-${task.id}-${occurrenceDate}`,
          source: "task",
          sourceId: task.id,
          originalItem: task,
          title: task.title || "Untitled task",
          subtitle: task.assigneeName
            ? `Assigned: ${task.assigneeName}`
            : "Unassigned",
          description: task.description || "",
          date: occurrenceDate,
          baseDate,
          recurringRule: task.recurringRule || null,
          startTime: task.isAllDay ? "All day" : task.startTime || "",
          endTime: task.isAllDay ? "" : task.endTime || "",
          eventType: "task",
          priority: task.priority || "medium",
          isRecurring: hasRecurrence(task.recurringRule),
          isAllDay: !!task.isAllDay,
        }));
      });

      const rosterItems = (visibleRosters || []).flatMap((roster) => {
        if (!roster?.date) return [];
        const occurrenceDates = buildOccurrenceDates(
          roster.date,
          roster.recurringRule,
          startDate,
          endDate,
        );
        const shifts = Array.isArray(roster.shifts) ? roster.shifts : [];

        return occurrenceDates.flatMap((occurrenceDate) => {
          if (shifts.length === 0) {
            return [
              {
                id: `roster-${roster.id}-${occurrenceDate}`,
                source: "roster",
                sourceId: roster.id,
                originalItem: roster,
                title: roster.title || "Roster day",
                subtitle: "Roster Day",
                description: "",
                date: occurrenceDate,
                baseDate: roster.date,
                recurringRule: roster.recurringRule || null,
                startTime: "",
                endTime: "",
                eventType: "roster",
                isRecurring: hasRecurrence(roster.recurringRule),
                isAllDay: false,
              },
            ];
          }

          return shifts.map((shift, index) => ({
            id: `roster-${roster.id}-${occurrenceDate}-${index}`,
            source: "roster",
            sourceId: roster.id,
            originalItem: roster,
            title: `${roster.title || "Roster"} – ${shift.role || "Shift"}`,
            subtitle: shift.filledByName || "Open shift",
            description: "",
            date: occurrenceDate,
            baseDate: roster.date,
            recurringRule: roster.recurringRule || null,
            startTime: shift.startTime || "",
            endTime: shift.endTime || "",
            eventType: "roster",
            isRecurring: hasRecurrence(roster.recurringRule),
            isAllDay: false,
          }));
        });
      });

      return [...eventItems, ...taskItems, ...rosterItems];
    },
    [allEvents, visibleTasks, visibleRosters],
  );

  const applyFilter = useCallback(
    (items) => {
      if (activeFilter === "Fixtures") {
        return items.filter((item) => {
          if (item.source !== "event") return false;
          const value = String(item.eventType || "").toLowerCase();
          return value === "game" || value === "match" || value === "fixtures";
        });
      }
      if (activeFilter === "Training") {
        return items.filter(
          (item) =>
            item.source === "event" &&
            String(item.eventType || "").toLowerCase() === "training",
        );
      }
      if (activeFilter === "Tasks") {
        return items.filter((item) => item.source === "task");
      }
      if (activeFilter === "Rosters") {
        return items.filter((item) => item.source === "roster");
      }
      return items;
    },
    [activeFilter],
  );

  const sortItems = useCallback((items) => {
    return [...items].sort((a, b) => {
      const aKey = `${a.date || "9999-12-31"} ${a.startTime || "99:99"}`;
      const bKey = `${b.date || "9999-12-31"} ${b.startTime || "99:99"}`;
      return aKey.localeCompare(bKey);
    });
  }, []);

  /** Items for the currently visible week / month (or the next 120 days). */
  const calendarItems = useMemo(() => {
    const items = applyFilter(buildItems(rangeStart, rangeEnd));
    return sortItems(items).slice(0, 600);
  }, [applyFilter, buildItems, rangeStart, rangeEnd, sortItems]);

  /** Flat upcoming list for the "List" view. */
  const listItems = useMemo(() => {
    const start = todayIsoDate();
    const end = addDaysToIsoDate(start, 120);
    const items = applyFilter(buildItems(start, end));
    return sortItems(items).slice(0, 600);
  }, [applyFilter, buildItems, sortItems]);

  /** date -> items[] lookup used by the week strip and month grid. */
  const itemsByDate = useMemo(() => {
    const map = new Map();
    calendarItems.forEach((item) => {
      if (!item.date) return;
      if (!map.has(item.date)) map.set(item.date, []);
      map.get(item.date).push(item);
    });
    return map;
  }, [calendarItems]);

  const activeItems = useMemo(() => {
    if (viewMode === "list") return listItems;
    if (viewMode === "week") {
      // Week view focuses on the tapped day so multiple events on the same
      // day are all visible together.
      return calendarItems.filter((item) => item.date === selectedFullDate);
    }
    return calendarItems;
  }, [viewMode, listItems, calendarItems, selectedFullDate]);

  /** Grouped by date so multiple events on the same day render together. */
  const groupedItems = useMemo(() => {
    const groups = [];
    const index = new Map();
    activeItems.forEach((item) => {
      const key = item.date || "";
      if (!index.has(key)) {
        index.set(key, { date: key, items: [] });
        groups.push(index.get(key));
      }
      index.get(key).items.push(item);
    });
    return groups;
  }, [activeItems]);

  const upcomingClubEvents = useMemo(() => {
    const today = todayIsoDate();
    const horizon = addDaysToIsoDate(today, 90);

    return (allEvents || [])
      .filter((event) => {
        const type = String(event.type || "").toLowerCase();
        return type !== "game" && type !== "match";
      })
      .map((event) => {
        const baseDate = event.startDate || event.date;
        const occurrenceDates = buildOccurrenceDates(
          baseDate,
          event.recurringRule,
          today,
          horizon,
          { endDate: event.endDate || event.date },
        );
        const nextOccurrenceDate =
          occurrenceDates[0] || baseDate || event.date || "";
        return {
          ...event,
          nextOccurrenceDate,
          occurrenceCount: occurrenceDates.length,
        };
      })
      .filter((event) => !!event.nextOccurrenceDate)
      .sort((a, b) => {
        const aKey = `${a.nextOccurrenceDate} ${a.startTime || ""}`;
        const bKey = `${b.nextOccurrenceDate} ${b.startTime || ""}`;
        return aKey.localeCompare(bKey);
      })
      .slice(0, 6);
  }, [allEvents]);

  const nextUpcomingEvent = upcomingClubEvents[0] || null;

  /* ---------------- interactions ---------------- */

  const handleAddEvent = useCallback(() => {
    if (activeFilter === "Tasks") {
      navigation.navigate("CreateItem", {
        title: "Create New Task",
        type: "Task",
        initialTaskDate: selectedFullDate,
      });
      return;
    }

    if (activeFilter === "Rosters") {
      navigation.navigate("CreateItem", {
        title: "Create New Shift",
        type: "Shift",
        initialShiftDate: selectedFullDate,
      });
      return;
    }

    navigation.navigate("CreateItem", {
      title: "Add New Event",
      type: "Event",
      initialEventDate: selectedFullDate,
    });
  }, [activeFilter, navigation, selectedFullDate]);

  const openItemDetails = useCallback(
    (item) => {
      if (!item) return;
      if (item.source === "task" && item.originalItem) {
        navigation.navigate("Tasks", { openTask: item.originalItem });
        return;
      }
      setSelectedItem(item);
    },
    [navigation],
  );

  const openEventDetails = useCallback((event) => {
    if (!event) return;
    const baseDate = event.startDate || event.date || "";
    setSelectedItem({
      id: `event-${event.id}-${event.nextOccurrenceDate || baseDate}`,
      source: "event",
      sourceId: event.id,
      originalItem: event,
      title: event.title || "Untitled event",
      subtitle: event.location || "",
      description: event.description || "",
      date: event.nextOccurrenceDate || baseDate,
      baseDate,
      recurringRule: event.recurringRule || null,
      startTime: event.isAllDay ? "All day" : event.startTime || "",
      endTime: event.isAllDay ? "" : event.endTime || "",
      eventType: event.type || "event",
      isRecurring: hasRecurrence(event.recurringRule),
      isAllDay: !!event.isAllDay,
      location: event.location || "",
      assignedGroupName: event.assignedGroupName || "",
      assignedUserNames: event.assignedUserNames || [],
      openToAll: !!event.openToAll,
    });
  }, []);

  const handleDeleteSelected = useCallback(() => {
    const item = selectedItem;
    if (!item || item.source !== "event" || !activeClubId) return;

    Alert.alert(
      "Delete event",
      item.isRecurring
        ? "This will delete the event and all of its repeating occurrences. Continue?"
        : "Are you sure you want to delete this event?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteEvent(activeClubId, item.sourceId);
              setSelectedItem(null);
            } catch (error) {
              Alert.alert("Error", "Could not delete this event right now.");
            }
          },
        },
      ],
    );
  }, [selectedItem, activeClubId]);

  useEffect(() => {
    if (viewMode === "list" && !listAutoScrollDoneRef.current) {
      contentScrollRef.current?.scrollToEnd({ animated: false });
      listAutoScrollDoneRef.current = true;
      return;
    }

    if (viewMode !== "list") {
      listAutoScrollDoneRef.current = false;
    }
  }, [viewMode, listItems.length]);

  const handleScrollToUpcoming = useCallback(() => {
    contentScrollRef.current?.scrollToEnd({ animated: true });
  }, []);

  const renderItemCard = (item) => {
    const color = getEventColor(item.eventType);
    const timeLabel = formatItemTime(item) || "—";

    return (
      <TouchableOpacity
        key={item.id}
        activeOpacity={0.85}
        onPress={() => openItemDetails(item)}
      >
        <Card style={[styles.eventCard, { borderLeftColor: color }]}>
          <View style={styles.eventMain}>
            <View style={styles.eventTime}>
              <Text variant="h4" style={{ fontSize: 13 }}>
                {timeLabel}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
              <View style={styles.eventTitleRow}>
                <View style={styles.eventTitleWrap}>
                  <Text variant="body" weight="600" style={{ flexShrink: 1 }}>
                    {item.title}
                  </Text>
                  {item.isRecurring ? (
                    <Repeat
                      color={theme.colors.textSecondary}
                      size={12}
                      style={{ marginLeft: 6 }}
                    />
                  ) : null}
                </View>
                <View
                  style={[styles.eventBadge, { backgroundColor: `${color}20` }]}
                >
                  <Text
                    variant="small"
                    style={{ fontSize: 10, fontWeight: "700", color }}
                  >
                    {getTypeLabel(item)}
                  </Text>
                </View>
              </View>
              {item.subtitle ? (
                <View style={styles.eventSubtitleRow}>
                  {item.source === "task" ? (
                    <CheckCircle color={theme.colors.textSecondary} size={14} />
                  ) : item.source === "roster" ? (
                    <ClipboardList
                      color={theme.colors.textSecondary}
                      size={14}
                    />
                  ) : (
                    <MapPin color={theme.colors.textSecondary} size={14} />
                  )}
                  <Text
                    variant="small"
                    color={theme.colors.textSecondary}
                    style={{ marginLeft: 4, flexShrink: 1 }}
                    numberOfLines={1}
                  >
                    {item.subtitle}
                  </Text>
                </View>
              ) : null}
            </View>
            <ChevronRight
              color={theme.colors.border}
              size={18}
              style={{ marginLeft: 4 }}
            />
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const detailColor = getEventColor(selectedItem?.eventType);
  const detailRecurrence = selectedItem?.recurringRule
    ? describeRecurrence(selectedItem.recurringRule, selectedItem.baseDate)
    : "";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
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
            size={36}
            isClub
          />
          <View style={{ marginLeft: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TouchableOpacity
                onPress={goToPrevPeriod}
                style={styles.chevronBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ChevronLeft color={theme.colors.text} size={20} />
              </TouchableOpacity>
              <Text variant="h3" style={{ marginHorizontal: 4 }}>
                {monthYearLabel}
              </Text>
              <TouchableOpacity
                onPress={goToNextPeriod}
                style={styles.chevronBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ChevronRight color={theme.colors.text} size={20} />
              </TouchableOpacity>
            </View>
            <Text variant="small" color={theme.colors.textSecondary}>
              {activeClub?.name || "Club"}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate("Search")}
          >
            <Search color={theme.colors.text} size={22} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, styles.addBtn]}
            onPress={handleAddEvent}
          >
            <Plus color={theme.colors.white} size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={contentScrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
        scrollEventThrottle={16}
        onScroll={handleTabBarScroll}
      >
        {/* View Toggle */}
        <View style={styles.viewToggleContainer}>
          <View style={styles.toggleRow}>
            {["week", "month", "list"].map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.toggleBtn,
                  viewMode === mode && styles.toggleBtnActive,
                ]}
                onPress={() => setViewMode(mode)}
              >
                <Text
                  variant="h4"
                  color={
                    viewMode === mode
                      ? theme.colors.text
                      : theme.colors.textSecondary
                  }
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.todayBtn} onPress={goToToday}>
            <Text variant="small" weight="600" color={theme.colors.primary}>
              Today
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.panelToggleWrap}>
          <View style={styles.panelToggleRow}>
            {[
              { key: "schedule", label: "Schedule" },
              { key: "upcoming", label: "Upcoming" },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.panelToggleBtn,
                  calendarPanelTab === tab.key && styles.panelToggleBtnActive,
                ]}
                onPress={() => setCalendarPanelTab(tab.key)}
              >
                <Text
                  variant="h4"
                  color={
                    calendarPanelTab === tab.key
                      ? theme.colors.text
                      : theme.colors.textSecondary
                  }
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Week date strip */}
        {calendarPanelTab === "schedule" && viewMode === "week" && (
          <View style={styles.dateStrip}>
            {weekDates.map((item) => {
              const isActive = selectedFullDate === item.fullDate;
              const dayItems = itemsByDate.get(item.fullDate) || [];
              return (
                <TouchableOpacity
                  key={item.fullDate}
                  style={[
                    styles.dateBox,
                    isActive && styles.dateBoxActive,
                    item.isToday && !isActive && styles.dateBoxToday,
                  ]}
                  onPress={() => selectDate(item.fullDate)}
                  activeOpacity={0.8}
                >
                  <Text
                    variant="small"
                    color={
                      isActive
                        ? theme.colors.white
                        : item.isToday
                          ? theme.colors.primary
                          : theme.colors.textSecondary
                    }
                    style={{ fontSize: 10, fontWeight: "600" }}
                  >
                    {item.day}
                  </Text>
                  <Text
                    variant="h3"
                    color={isActive ? theme.colors.white : theme.colors.text}
                    style={{ marginTop: 2, fontSize: 17 }}
                  >
                    {item.date}
                  </Text>
                  <DayDots items={dayItems} active={isActive} max={3} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Full month grid */}
        {calendarPanelTab === "schedule" && viewMode === "month" && (
          <View style={{ backgroundColor: theme.colors.surface }}>
            <View style={styles.monthDayHeaders}>
              {WEEKDAY_SHORT.map((d) => (
                <Text key={d} style={styles.monthDayHeaderText}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={styles.monthGrid}>
              {monthDates.map((item) => {
                const isSelected = item.fullDate === selectedFullDate;
                const dayItems = itemsByDate.get(item.fullDate) || [];
                return (
                  <TouchableOpacity
                    key={item.fullDate}
                    style={[
                      styles.monthCell,
                      isSelected && styles.monthCellSelected,
                      item.isToday && !isSelected && styles.monthCellToday,
                    ]}
                    onPress={() => selectDate(item.fullDate)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.monthCellText,
                        !item.isCurrentMonth && { opacity: 0.3 },
                        isSelected && { color: theme.colors.white },
                        item.isToday &&
                          !isSelected && {
                            color: theme.colors.primary,
                            fontWeight: "700",
                          },
                      ]}
                    >
                      {item.day}
                    </Text>
                    <DayDots items={dayItems} active={isSelected} max={3} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
        >
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterBadge,
                  isActive && styles.filterBadgeActive,
                ]}
                onPress={() => setActiveFilter(filter)}
              >
                {isActive && filter === "All" ? null : (
                  <View
                    style={[
                      styles.filterDot,
                      {
                        backgroundColor:
                          FILTER_DOT_COLORS[filter] || theme.colors.primary,
                      },
                    ]}
                  />
                )}
                <Text
                  variant="body"
                  color={isActive ? theme.colors.white : theme.colors.text}
                  weight={isActive ? "600" : "400"}
                  style={isActive || filter === "All" ? {} : { marginLeft: 6 }}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Content */}
        <View style={styles.content}>
          {calendarPanelTab === "upcoming" ? (
            <>
              <Text
                variant="small"
                weight="600"
                color={theme.colors.textSecondary}
                style={{ marginBottom: theme.spacing.sm }}
              >
                UPCOMING CLUB EVENTS
              </Text>
              {upcomingClubEvents.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <Text variant="small" color={theme.colors.textSecondary}>
                    No upcoming events scheduled.
                  </Text>
                </Card>
              ) : (
                upcomingClubEvents.map((event) => {
                  const color = getEventColor(event.type);
                  return (
                    <TouchableOpacity
                      key={`upcoming-${event.id}`}
                      activeOpacity={0.85}
                      onPress={() => openEventDetails(event)}
                    >
                      <Card
                        style={[
                          styles.upcomingEventCard,
                          { borderLeftWidth: 4, borderLeftColor: color },
                        ]}
                      >
                        <View style={styles.eventTitleRow}>
                          <Text
                            variant="body"
                            weight="600"
                            style={{ flex: 1 }}
                            numberOfLines={2}
                          >
                            {event.title || "Club Event"}
                          </Text>
                          {hasRecurrence(event.recurringRule) ? (
                            <Repeat
                              color={theme.colors.textSecondary}
                              size={13}
                            />
                          ) : null}
                        </View>
                        <View style={styles.eventSubtitleRow}>
                          <CalendarDays
                            color={theme.colors.textSecondary}
                            size={13}
                          />
                          <Text
                            variant="small"
                            color={theme.colors.textSecondary}
                            style={{ marginLeft: 5 }}
                          >
                            {formatLongDate(event.nextOccurrenceDate)}
                            {event.isAllDay
                              ? " • All day"
                              : event.startTime
                                ? ` • ${event.startTime}`
                                : ""}
                          </Text>
                        </View>
                        {event.location ? (
                          <View style={styles.eventSubtitleRow}>
                            <MapPin
                              color={theme.colors.textSecondary}
                              size={13}
                            />
                            <Text
                              variant="small"
                              color={theme.colors.textSecondary}
                              style={{ marginLeft: 5 }}
                              numberOfLines={1}
                            >
                              {event.location}
                            </Text>
                          </View>
                        ) : null}
                      </Card>
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          ) : (
            <>
              {nextUpcomingEvent ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => openEventDetails(nextUpcomingEvent)}
                >
                  <Card style={styles.nextUpCard}>
                    <View style={styles.nextUpHeader}>
                      <Text
                        variant="small"
                        weight="600"
                        color={theme.colors.primary}
                      >
                        NEXT UP
                      </Text>
                      <ChevronRight
                        color={theme.colors.textSecondary}
                        size={16}
                      />
                    </View>
                    <Text variant="body" weight="600" style={{ marginTop: 4 }}>
                      {nextUpcomingEvent.title || "Club Event"}
                    </Text>
                    <Text
                      variant="small"
                      color={theme.colors.textSecondary}
                      style={{ marginTop: 2 }}
                    >
                      {formatLongDate(nextUpcomingEvent.nextOccurrenceDate)}
                      {nextUpcomingEvent.isAllDay
                        ? " • All day"
                        : nextUpcomingEvent.startTime
                          ? ` • ${nextUpcomingEvent.startTime}`
                          : ""}
                      {nextUpcomingEvent.location
                        ? ` • ${nextUpcomingEvent.location}`
                        : ""}
                    </Text>
                  </Card>
                </TouchableOpacity>
              ) : null}

              <View style={styles.listHeaderRow}>
                <Text variant="small" weight="600">
                  {viewMode === "list"
                    ? "UPCOMING"
                    : viewMode === "week"
                      ? formatLongDate(selectedFullDate).toUpperCase()
                      : monthYearLabel.toUpperCase()}
                </Text>
                {activeItems.length > 0 ? (
                  <View style={styles.countPill}>
                    <Text
                      variant="small"
                      weight="700"
                      color={theme.colors.primary}
                      style={{ fontSize: 11 }}
                    >
                      {activeItems.length}
                    </Text>
                  </View>
                ) : null}
              </View>

              {viewMode === "list" && listItems.length > 0 ? (
                <TouchableOpacity
                  style={styles.scrollToUpcomingBtn}
                  onPress={handleScrollToUpcoming}
                >
                  <Text
                    variant="small"
                    weight="600"
                    color={theme.colors.primary}
                  >
                    Scroll to Upcoming Events
                  </Text>
                </TouchableOpacity>
              ) : null}

              {loading ? (
                <ActivityIndicator
                  size="large"
                  color={theme.colors.primary}
                  style={{ marginTop: theme.spacing.xl * 2 }}
                />
              ) : activeItems.length === 0 ? (
                <View style={styles.emptyState}>
                  <CalendarIcon color={theme.colors.border} size={48} />
                  <Text
                    variant="h4"
                    color={theme.colors.textSecondary}
                    style={{ marginTop: theme.spacing.md, textAlign: "center" }}
                  >
                    No calendar items scheduled.
                  </Text>
                  <Text
                    variant="body"
                    color={theme.colors.textSecondary}
                    style={{ marginTop: 4, textAlign: "center" }}
                  >
                    Tap the + button to add an event, task, or shift for this
                    date.
                  </Text>
                  <Button
                    title="Add Event"
                    onPress={handleAddEvent}
                    style={{ marginTop: theme.spacing.lg }}
                  />
                </View>
              ) : (
                groupedItems.map((group) => (
                  <View key={group.date || "undated"} style={styles.groupWrap}>
                    <View style={styles.groupHeader}>
                      <Text
                        variant="small"
                        weight="700"
                        color={theme.colors.textSecondary}
                        style={{ fontSize: 11, letterSpacing: 0.4 }}
                      >
                        {formatGroupHeader(group.date).toUpperCase()}
                      </Text>
                      <View style={styles.groupLine} />
                      <Text
                        variant="small"
                        color={theme.colors.textSecondary}
                        style={{ fontSize: 11 }}
                      >
                        {group.items.length}
                      </Text>
                    </View>
                    {group.items.map(renderItemCard)}
                  </View>
                ))
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Details sheet */}
      <Modal
        visible={!!selectedItem}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setSelectedItem(null)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View
                style={[
                  styles.sheetIconCircle,
                  { backgroundColor: `${detailColor}1A` },
                ]}
              >
                {selectedItem?.source === "task" ? (
                  <CheckCircle color={detailColor} size={20} />
                ) : selectedItem?.source === "roster" ? (
                  <ClipboardList color={detailColor} size={20} />
                ) : (
                  <CalendarDays color={detailColor} size={20} />
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text variant="h4" numberOfLines={3}>
                  {selectedItem?.title || "Details"}
                </Text>
                <View style={styles.sheetBadgeRow}>
                  <View
                    style={[
                      styles.sheetBadge,
                      { backgroundColor: `${detailColor}1A` },
                    ]}
                  >
                    <Text
                      variant="small"
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: detailColor,
                      }}
                    >
                      {getTypeLabel(selectedItem)}
                    </Text>
                  </View>
                  {selectedItem?.isRecurring ? (
                    <View style={styles.sheetBadgeRecurring}>
                      <Repeat color={theme.colors.textSecondary} size={11} />
                      <Text
                        variant="small"
                        color={theme.colors.textSecondary}
                        style={{ fontSize: 10, marginLeft: 4 }}
                      >
                        Recurring
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <TouchableOpacity
                style={styles.sheetClose}
                onPress={() => setSelectedItem(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X color={theme.colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 420 }}
              showsVerticalScrollIndicator={false}
            >
              <DetailRow
                icon={
                  <CalendarDays color={theme.colors.textSecondary} size={16} />
                }
                label="Date"
                value={formatLongDate(selectedItem?.date)}
              />
              <DetailRow
                icon={<Clock3 color={theme.colors.textSecondary} size={16} />}
                label="Time"
                value={formatItemTime(selectedItem) || "Not specified"}
              />
              <DetailRow
                icon={<MapPin color={theme.colors.textSecondary} size={16} />}
                label="Location"
                value={selectedItem?.location || selectedItem?.subtitle}
              />
              <DetailRow
                icon={<Users color={theme.colors.textSecondary} size={16} />}
                label="Assigned to"
                value={
                  selectedItem?.openToAll
                    ? "Everyone in the club"
                    : selectedItem?.assignedGroupName ||
                      (Array.isArray(selectedItem?.assignedUserNames) &&
                      selectedItem.assignedUserNames.length > 0
                        ? selectedItem.assignedUserNames.join(", ")
                        : "")
                }
              />
              <DetailRow
                icon={<Repeat color={theme.colors.textSecondary} size={16} />}
                label="Repeats"
                value={detailRecurrence}
              />
              <DetailRow
                icon={<Tag color={theme.colors.textSecondary} size={16} />}
                label="Priority"
                value={
                  selectedItem?.source === "task"
                    ? String(selectedItem?.priority || "").toUpperCase()
                    : ""
                }
              />
              <DetailRow
                icon={<AlignLeft color={theme.colors.textSecondary} size={16} />}
                label="Notes"
                value={selectedItem?.description}
                multiline
              />
            </ScrollView>

            <View style={styles.sheetActions}>
              {isAdmin && selectedItem?.source === "event" ? (
                <TouchableOpacity
                  style={styles.deleteAction}
                  onPress={handleDeleteSelected}
                >
                  <Trash2 color={theme.colors.error} size={16} />
                  <Text
                    variant="body"
                    weight="600"
                    color={theme.colors.error}
                    style={{ marginLeft: 6 }}
                  >
                    Delete
                  </Text>
                </TouchableOpacity>
              ) : null}
              <Button
                title="Close"
                onPress={() => setSelectedItem(null)}
                style={{ flex: 1, marginLeft: theme.spacing.sm }}
              />
            </View>
          </View>
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
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    padding: theme.spacing.sm,
    marginLeft: theme.spacing.xs,
  },
  addBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.full,
    padding: 8,
  },
  chevronBtn: {
    padding: 4,
  },
  viewToggleContainer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  todayBtn: {
    position: "absolute",
    right: theme.spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  panelToggleWrap: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
  },
  panelToggleRow: {
    flexDirection: "row",
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 4,
  },
  panelToggleBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full,
  },
  panelToggleBtnActive: {
    backgroundColor: theme.colors.surface,
    ...theme.shadows.small,
  },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 4,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.full,
  },
  toggleBtnActive: {
    backgroundColor: theme.colors.surface,
    ...theme.shadows.small,
  },
  dateStrip: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dateBox: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 68,
    borderRadius: theme.radius.md,
  },
  dateBoxActive: {
    backgroundColor: theme.colors.primary,
  },
  dateBoxToday: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  dotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    minHeight: 8,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 1,
  },
  dotMore: {
    fontSize: 8,
    fontWeight: "700",
    color: theme.colors.textSecondary,
    marginLeft: 2,
  },
  filtersContainer: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filtersContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
  },
  filterBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
  },
  filterBadgeActive: {
    backgroundColor: theme.colors.text,
    borderColor: theme.colors.text,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  content: {
    padding: theme.spacing.md,
  },
  emptyCard: {
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  emptyState: {
    alignItems: "center",
    marginTop: theme.spacing.xl * 2,
    paddingHorizontal: theme.spacing.md,
  },
  nextUpCard: {
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  nextUpHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  upcomingEventCard: {
    marginBottom: theme.spacing.xs,
  },
  listHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  countPill: {
    minWidth: 22,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    backgroundColor: `${theme.colors.primary}18`,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollToUpcomingBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  groupWrap: {
    marginBottom: theme.spacing.sm,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  groupLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.sm,
  },
  eventCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },
  eventMain: {
    flexDirection: "row",
    alignItems: "center",
  },
  eventTime: {
    width: 78,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    paddingRight: theme.spacing.xs,
    justifyContent: "center",
    alignItems: "center",
  },
  eventTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eventTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  eventSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  eventBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  monthDayHeaders: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  monthDayHeaderText: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: 4,
  },
  monthCell: {
    width: "14.285%",
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  monthCellSelected: {
    backgroundColor: theme.colors.primary,
  },
  monthCellToday: {
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  monthCellText: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.text,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
    ...theme.shadows.medium,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: theme.spacing.sm,
  },
  sheetIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  sheetBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  sheetBadgeRecurring: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
  },
  sheetClose: {
    padding: 4,
    marginLeft: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  detailIcon: {
    width: 28,
    paddingTop: 2,
  },
  sheetActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing.lg,
  },
  deleteAction: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: `${theme.colors.error}40`,
    backgroundColor: `${theme.colors.error}0D`,
  },
});
