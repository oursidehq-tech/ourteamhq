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
} from "lucide-react-native";
import { Text } from "../components/ui/Typography";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Avatar } from "../components/ui/Avatar";
import { theme } from "../theme/theme";
import { useClub } from "../contexts/ClubContext";
import { useAuth } from "../contexts/AuthContext";
import { useTabBarAnimation } from "../contexts/TabBarAnimationContext";
import { subscribeToEvents } from "../services/eventService";
import {
  subscribeToVisibleTasks,
  subscribeToVisibleRosters,
} from "../services/managementService";


const parseIsoDate = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toIsoDateLocal = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const addDaysToIsoDate = (isoDate, days) => {
  const base = parseIsoDate(isoDate);
  if (!base) return isoDate;
  const next = new Date(base);
  next.setDate(base.getDate() + days);
  return toIsoDateLocal(next);
};

const daysBetween = (from, to) => {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / 86400000);
};

const monthsBetween = (from, to) =>
  (to.getFullYear() - from.getFullYear()) * 12 +
  (to.getMonth() - from.getMonth());

const yearsBetween = (from, to) => to.getFullYear() - from.getFullYear();

const getWeekOfMonth = (date) => Math.floor((date.getDate() - 1) / 7) + 1;

const occursOnDate = (
  baseDateStr,
  recurringRule,
  selectedDateStr,
  options = {},
) => {
  if (!baseDateStr || !selectedDateStr) return false;
  const baseDate = parseIsoDate(baseDateStr);
  const selectedDate = parseIsoDate(selectedDateStr);
  if (!baseDate || !selectedDate) return false;

  const endDate = parseIsoDate(options?.endDate || "");

  if (!recurringRule) {
    if (endDate && endDate.getTime() >= baseDate.getTime()) {
      return (
        selectedDate.getTime() >= baseDate.getTime() &&
        selectedDate.getTime() <= endDate.getTime()
      );
    }
    return baseDateStr === selectedDateStr;
  }

  if (selectedDate.getTime() < baseDate.getTime()) return false;

  const untilDate = parseIsoDate(recurringRule?.untilDate || "");
  if (untilDate && selectedDate.getTime() > untilDate.getTime()) return false;

  const frequency = (recurringRule.frequency || "").toLowerCase();
  const interval = Math.max(1, parseInt(recurringRule.interval, 10) || 1);
  const dayDiff = daysBetween(baseDate, selectedDate);
  const monthDiff = monthsBetween(baseDate, selectedDate);
  const yearDiff = yearsBetween(baseDate, selectedDate);

  if (frequency === "daily") {
    return dayDiff % interval === 0;
  }

  if (frequency === "weekly") {
    const weekDiff = Math.floor(dayDiff / 7);
    if (weekDiff % interval !== 0) return false;

    const weekDays = Array.isArray(recurringRule.weekDays)
      ? recurringRule.weekDays
          .map((value) => parseInt(value, 10))
          .filter((value) => value >= 0 && value <= 6)
      : [];

    if (weekDays.length > 0) {
      return weekDays.includes(selectedDate.getDay());
    }

    return dayDiff % (7 * interval) === 0;
  }

  if (frequency === "monthly") {
    if (monthDiff < 0 || monthDiff % interval !== 0) return false;

    const monthlyMode = (recurringRule.monthlyMode || "same_day").toLowerCase();
    if (monthlyMode === "nth_weekday") {
      return (
        selectedDate.getDay() === baseDate.getDay() &&
        getWeekOfMonth(selectedDate) === getWeekOfMonth(baseDate)
      );
    }

    return selectedDate.getDate() === baseDate.getDate();
  }

  if (frequency === "yearly") {
    if (yearDiff < 0 || yearDiff % interval !== 0) return false;
    return (
      selectedDate.getMonth() === baseDate.getMonth() &&
      selectedDate.getDate() === baseDate.getDate()
    );
  }

  return false;
};

const buildOccurrenceDates = (
  baseDateStr,
  recurringRule,
  rangeStartStr,
  rangeEndStr,
  options = {},
) => {
  const baseDate = parseIsoDate(baseDateStr);
  if (!baseDate) return [];

  const rangeStart = parseIsoDate(rangeStartStr || baseDateStr) || baseDate;
  const rangeEnd = parseIsoDate(rangeEndStr || rangeStartStr || baseDateStr) || rangeStart;
  if (rangeEnd.getTime() < rangeStart.getTime()) return [];

  const cursor = new Date(Math.max(rangeStart.getTime(), baseDate.getTime()));
  const occurrences = [];
  let guard = 0;

  while (cursor.getTime() <= rangeEnd.getTime() && guard < 800) {
    const iso = toIsoDateLocal(cursor);
    if (occursOnDate(baseDateStr, recurringRule, iso, options)) {
      occurrences.push(iso);
    }
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  return occurrences;
};

const getWeekDatesForDate = (dateStr) => {
  const d = dateStr ? new Date(`${dateStr}T12:00:00`) : new Date();
  const dayOfWeek = d.getDay();
  const startOfWeek = new Date(d);
  startOfWeek.setDate(d.getDate() - dayOfWeek);
  const today = new Date();
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return days.map((day, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    return {
      day,
      date: date.getDate().toString(),
      fullDate: toIsoDateLocal(date),
      isToday: date.toDateString() === today.toDateString(),
    };
  });
};

const getMonthGrid = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const today = new Date();
  const dates = [];
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthLastDay - i);
    dates.push({
      day: d.getDate(),
      fullDate: toIsoDateLocal(d),
      isCurrentMonth: false,
      isToday: d.toDateString() === today.toDateString(),
    });
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i);
    dates.push({
      day: i,
      fullDate: toIsoDateLocal(d),
      isCurrentMonth: true,
      isToday: d.toDateString() === today.toDateString(),
    });
  }
  const remaining = (7 - (dates.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    dates.push({
      day: i,
      fullDate: toIsoDateLocal(d),
      isCurrentMonth: false,
      isToday: d.toDateString() === today.toDateString(),
    });
  }
  return dates;
};

const FILTERS = ["All", "Fixtures", "Training", "Tasks", "Rosters"];

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

export default function CalendarScreen({ navigation }) {
  const { activeClubId, activeClub, userRole, userGroupIds } = useClub();
  const { user, profile } = useAuth();
  const normalizedRole = String(userRole || "").trim().toLowerCase();
  const isAdmin = normalizedRole === "owner" || normalizedRole === "admin";
  const isPlayerOrParent = normalizedRole === "player" || normalizedRole === "parent";

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

  const moveSelectedDateByDays = useCallback(
    (deltaDays) => {
      const baseDate = parseIsoDate(selectedFullDate) || new Date();
      const nextDate = new Date(baseDate);
      nextDate.setDate(baseDate.getDate() + deltaDays);
      setSelectedFullDate(toIsoDateLocal(nextDate));
    },
    [selectedFullDate],
  );

  // Navigate the week strip directly by delta weeks (no closure staleness)
  const navigateWeek = useCallback(
    (deltaWeeks) => {
      const baseSunday = parseIsoDate(currentWeekSunday) || new Date();
      const nextSunday = new Date(baseSunday);
      nextSunday.setDate(baseSunday.getDate() + deltaWeeks * 7);
      const nextSundayStr = toIsoDateLocal(nextSunday);
      setCurrentWeekSunday(nextSundayStr);
      // Also set selectedFullDate to that Sunday so the selected highlight
      // moves into the new week.
      setSelectedFullDate(nextSundayStr);
    },
    [currentWeekSunday],
  );

  const moveSelectedDateByMonths = useCallback(
    (deltaMonths) => {
      const baseDate = parseIsoDate(selectedFullDate) || new Date();
      const targetMonthDate = new Date(
        baseDate.getFullYear(),
        baseDate.getMonth() + deltaMonths,
        1,
      );
      const lastDayInTargetMonth = new Date(
        targetMonthDate.getFullYear(),
        targetMonthDate.getMonth() + 1,
        0,
      ).getDate();
      const clampedDay = Math.min(baseDate.getDate(), lastDayInTargetMonth);
      const nextDate = new Date(
        targetMonthDate.getFullYear(),
        targetMonthDate.getMonth(),
        clampedDay,
      );
      setSelectedFullDate(toIsoDateLocal(nextDate));
    },
    [selectedFullDate],
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
      // Also update selectedFullDate to the 1st of the new month so the
      // selected-day highlight moves with navigation.
      const firstOfMonth = new Date(newYear, newMonth, 1);
      setSelectedFullDate(toIsoDateLocal(firstOfMonth));
    },
    [currentMonth, currentYear],
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

  // Sync the week Sunday anchor when user taps a day cell in the week strip
  const handleWeekDayPress = useCallback((fullDate) => {
    setSelectedFullDate(fullDate);
    // Reanchor the week to the Sunday of the tapped date
    const d = parseIsoDate(fullDate);
    if (d) {
      const sunday = new Date(d);
      sunday.setDate(d.getDate() - d.getDay());
      setCurrentWeekSunday(toIsoDateLocal(sunday));
    }
  }, []);

  // Keep currentMonth/currentYear in sync when selectedFullDate changes
  // (e.g. user taps a day cell in the month grid)
  useEffect(() => {
    const selectedDate = parseIsoDate(selectedFullDate);
    if (!selectedDate) return;
    const m = selectedDate.getMonth();
    const y = selectedDate.getFullYear();
    // Only sync when they actually differ to avoid overwriting navigateMonth
    setCurrentMonth((prev) => (prev !== m ? m : prev));
    setCurrentYear((prev) => (prev !== y ? y : prev));
  }, [selectedFullDate]);

  useEffect(() => {
    if (!activeClubId) {
      setAllEvents([]);
      setAllTasks([]);
      setAllRosters([]);
      setLoading(false);
      return;
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
        setAllTasks(newTasks);
      },
      { userGroupIds, userId: user?.uid || "", scope: "all", isAdmin },
    );
    const unsubscribeRosters = subscribeToVisibleRosters(
      activeClubId,
      (newRosters) => {
        setAllRosters(newRosters);
        setLoading(false);
      },
      { userGroupIds, userId: user?.uid || "", scope: "all", isAdmin },
    );

    return () => {
      unsubscribeEvents?.();
      unsubscribeTasks?.();
      unsubscribeRosters?.();
    };
  }, [activeClubId, userGroupIds, user?.uid, isAdmin]);

  // Group-filter tasks and rosters so members only see their group duties
  const visibleTasks = useMemo(() => allTasks, [allTasks]);
  const visibleRosters = useMemo(() => allRosters, [allRosters]);

  const calendarItems = useMemo(() => {
    // When filter is "All" and we're in week/month view, show ALL items
    // (not restricted to selected date) so user sees everything at a glance.
    // Individual category filters still work per selected date.
    const isAllFilter = activeFilter === "All";

    const occurrenceRangeStart =
      viewMode === "month"
        ? monthDates[0]?.fullDate || selectedFullDate
        : viewMode === "week"
          ? weekDates[0]?.fullDate || selectedFullDate
          : selectedFullDate;
    const occurrenceRangeEnd =
      viewMode === "month"
        ? monthDates[monthDates.length - 1]?.fullDate || selectedFullDate
        : viewMode === "week"
          ? weekDates[weekDates.length - 1]?.fullDate || selectedFullDate
          : selectedFullDate;
    const targetRangeStart = isAllFilter ? occurrenceRangeStart : selectedFullDate;
    const targetRangeEnd = isAllFilter ? occurrenceRangeEnd : selectedFullDate;

    const eventItems = allEvents.flatMap((e) => {
      const baseDate = e.startDate || e.date;
      const occurrenceDates = buildOccurrenceDates(
        baseDate,
        e.recurringRule,
        targetRangeStart,
        targetRangeEnd,
        {
          endDate: e.endDate || e.date,
        },
      );

      return occurrenceDates.map((occurrenceDate) => ({
        id: `event-${e.id}-${occurrenceDate}`,
        source: "event",
        sourceId: e.id,
        title: e.title,
        subtitle: e.location || "",
        description: e.description || "",
        date: occurrenceDate,
        startTime: e.isAllDay ? "All day" : e.startTime || e.time || "",
        endTime: e.isAllDay ? "" : e.endTime || "",
        eventType: e.type || "event",
        isRecurring: !!e.recurringRule,
        isAllDay: !!e.isAllDay,
      }));
    });

    const taskItems = visibleTasks.flatMap((t) => {
      const taskDate = t?.startDate || t?.dueDate;
      if (!taskDate) {
        return isAllFilter
          ? []
          : [
              {
                id: `task-${t.id}-undated`,
                source: "task",
                sourceId: t.id,
                originalItem: t,
                title: t.title,
                subtitle: t.assigneeName
                  ? `Assigned: ${t.assigneeName}`
                  : "Unassigned",
                description: t.description || "",
                date: "",
                startTime: t.isAllDay ? "All day" : t.startTime || "",
                endTime: t.isAllDay ? "" : t.endTime || "",
                eventType: "task",
                priority: t.priority || "medium",
                isRecurring: !!t.isRecurring || !!t.recurringRule,
                isAllDay: !!t.isAllDay,
              },
            ];
      }

      const occurrenceDates = buildOccurrenceDates(
        taskDate,
        t.recurringRule,
        targetRangeStart,
        targetRangeEnd,
      );

      return occurrenceDates.map((occurrenceDate) => ({
        id: `task-${t.id}-${occurrenceDate}`,
        source: "task",
        sourceId: t.id,
        originalItem: t,
        title: t.title,
        subtitle: t.assigneeName ? `Assigned: ${t.assigneeName}` : "Unassigned",
        description: t.description || "",
        date: occurrenceDate,
        startTime: t.isAllDay ? "All day" : t.startTime || "",
        endTime: t.isAllDay ? "" : t.endTime || "",
        eventType: "task",
        priority: t.priority || "medium",
        isRecurring: !!t.isRecurring || !!t.recurringRule,
        isAllDay: !!t.isAllDay,
      }));
    });

    const rosterItems = visibleRosters.flatMap((r) => {
      if (!r?.date) {
        return isAllFilter
          ? []
          : [
              {
                id: `roster-${r.id}`,
                source: "roster",
                sourceId: r.id,
                title: r.title,
                subtitle: "Roster Day",
                description: "",
                date: "",
                startTime: "",
                endTime: "",
                eventType: "roster",
                isRecurring: !!r.recurringRule,
                isAllDay: false,
              },
            ];
      }

      const occurrenceDates = buildOccurrenceDates(
        r.date,
        r.recurringRule,
        targetRangeStart,
        targetRangeEnd,
      );

      return occurrenceDates.flatMap((occurrenceDate) => {
        const shifts = r.shifts || [];
        if (shifts.length === 0) {
          return [
            {
              id: `roster-${r.id}-${occurrenceDate}`,
              source: "roster",
              sourceId: r.id,
              title: r.title,
              subtitle: "Roster Day",
              description: "",
              date: occurrenceDate,
              startTime: "",
              endTime: "",
              eventType: "roster",
              isRecurring: !!r.recurringRule,
              isAllDay: false,
            },
          ];
        }
        return shifts.map((shift, idx) => ({
          id: `roster-${r.id}-${occurrenceDate}-${idx}`,
          source: "roster",
          sourceId: r.id,
          title: `${r.title} - ${shift.role || "Shift"}`,
          subtitle: shift.filledByName || "Open shift",
          description: "",
          date: occurrenceDate,
          startTime: shift.startTime || "",
          endTime: shift.endTime || "",
          eventType: "roster",
          isRecurring: !!r.recurringRule,
          isAllDay: false,
        }));
      });
    });

    let items = [...eventItems, ...taskItems, ...rosterItems];
    if (activeFilter === "Fixtures") {
      items = items.filter((i) => {
        if (i.source !== "event") return false;
        const value = (i.eventType || "").toLowerCase();
        return value === "game" || value === "match" || value === "fixtures";
      });
    } else if (activeFilter === "Training") {
      items = items.filter(
        (i) =>
          i.source === "event" &&
          (i.eventType || "").toLowerCase() === "training",
      );
    } else if (activeFilter === "Tasks") {
      items = items.filter((i) => i.source === "task");
    } else if (activeFilter === "Rosters") {
      items = items.filter((i) => i.source === "roster");
    }

    return items
      .sort((a, b) => {
        // Sort by date first, then by time
        const aKey = `${a.date || "9999-12-31"} ${a.startTime || "99:99"}`;
        const bKey = `${b.date || "9999-12-31"} ${b.startTime || "99:99"}`;
        return aKey.localeCompare(bKey);
      })
      .slice(0, 200);
  }, [
    allEvents,
    visibleTasks,
    visibleRosters,
    selectedFullDate,
    activeFilter,
    monthDates,
    weekDates,
    viewMode,
  ]);

  const listItems = useMemo(() => {
    const listRangeStart = toIsoDateLocal(new Date());
    const listRangeEnd = addDaysToIsoDate(listRangeStart, 120);

    const eventItems = (allEvents || []).flatMap((e) => {
      const baseDate = e.startDate || e.date;
      const occurrenceDates = buildOccurrenceDates(
        baseDate,
        e.recurringRule,
        listRangeStart,
        listRangeEnd,
        {
          endDate: e.endDate || e.date,
        },
      );

      return occurrenceDates.map((occurrenceDate) => ({
        id: `event-${e.id}-${occurrenceDate}`,
        source: "event",
        sourceId: e.id,
        title: e.title,
        subtitle: e.location || "",
        description: e.description || "",
        date: occurrenceDate,
        startTime: e.isAllDay ? "All day" : e.startTime || e.time || "",
        endTime: e.isAllDay ? "" : e.endTime || "",
        eventType: e.type || "event",
        isRecurring: !!e.recurringRule,
        isAllDay: !!e.isAllDay,
      }));
    });

    const taskItems = (visibleTasks || []).flatMap((t) => {
      const baseDate = t.startDate || t.dueDate;
      const occurrenceDates = buildOccurrenceDates(
        baseDate,
        t.recurringRule,
        listRangeStart,
        listRangeEnd,
      );

      return occurrenceDates.map((occurrenceDate) => ({
        id: `task-${t.id}-${occurrenceDate}`,
        source: "task",
        sourceId: t.id,
        title: t.title,
        subtitle: t.assigneeName ? `Assigned: ${t.assigneeName}` : "Unassigned",
        description: t.description || "",
        date: occurrenceDate,
        startTime: t.isAllDay ? "All day" : t.startTime || "",
        endTime: t.isAllDay ? "" : t.endTime || "",
        eventType: "task",
        priority: t.priority || "medium",
        isRecurring: !!t.isRecurring || !!t.recurringRule,
        isAllDay: !!t.isAllDay,
      }));
    });

    const rosterItems = (visibleRosters || []).flatMap((r) => {
      const occurrenceDates = buildOccurrenceDates(
        r.date,
        r.recurringRule,
        listRangeStart,
        listRangeEnd,
      );
      const shifts = r.shifts || [];
      if (shifts.length === 0) {
        return occurrenceDates.map((occurrenceDate) => ({
          id: `roster-${r.id}-${occurrenceDate}`,
          source: "roster",
          sourceId: r.id,
          title: r.title,
          subtitle: "Roster Day",
          description: "",
          date: occurrenceDate,
          startTime: "",
          endTime: "",
          eventType: "roster",
          isRecurring: !!r.recurringRule,
          isAllDay: false,
        }));
      }

      return occurrenceDates.flatMap((occurrenceDate) =>
        shifts.map((shift, idx) => ({
          id: `roster-${r.id}-${occurrenceDate}-${idx}`,
          source: "roster",
          sourceId: r.id,
          title: `${r.title} - ${shift.role || "Shift"}`,
          subtitle: shift.filledByName || "Open shift",
          description: "",
          date: occurrenceDate,
          startTime: shift.startTime || "",
          endTime: shift.endTime || "",
          eventType: "roster",
          isRecurring: !!r.recurringRule,
          isAllDay: false,
        })),
      );
    });

    let items = [...eventItems, ...taskItems, ...rosterItems];
    if (activeFilter === "Fixtures") {
      items = items.filter((i) => {
        if (i.source !== "event") return false;
        const value = (i.eventType || "").toLowerCase();
        return value === "game" || value === "match" || value === "fixtures";
      });
    } else if (activeFilter === "Training") {
      items = items.filter(
        (i) =>
          i.source === "event" &&
          (i.eventType || "").toLowerCase() === "training",
      );
    } else if (activeFilter === "Tasks") {
      items = items.filter((i) => i.source === "task");
    } else if (activeFilter === "Rosters") {
      items = items.filter((i) => i.source === "roster");
    }

    return items
      .sort((a, b) => {
        const aKey = `${a.date || "9999-12-31"} ${a.startTime || "99:99"}`;
        const bKey = `${b.date || "9999-12-31"} ${b.startTime || "99:99"}`;
        return aKey.localeCompare(bKey);
      })
      .slice(0, 500);
  }, [allEvents, visibleTasks, visibleRosters, activeFilter]);

  const upcomingClubEvents = useMemo(() => {
    const today = toIsoDateLocal(new Date());
    const horizon = addDaysToIsoDate(today, 90);
    return (allEvents || [])
      .filter((event) => {
        const type = (event.type || "").toLowerCase();
        return type !== "game" && type !== "match";
      })
      .map((event) => {
        const baseDate = event.startDate || event.date;
        const occurrenceDates = buildOccurrenceDates(
          baseDate,
          event.recurringRule,
          today,
          horizon,
          {
            endDate: event.endDate || event.date,
          },
        );
        const nextOccurrenceDate = occurrenceDates[0] || baseDate || event.date || event.startDate || "";
        return {
          ...event,
          id: event.id,
          startDate: nextOccurrenceDate,
          date: nextOccurrenceDate,
          nextOccurrenceDate,
          recurrenceCount: occurrenceDates.length,
        };
      })
      .sort((a, b) => {
        const aKey = `${a.startDate || a.date || ""} ${a.startTime || ""}`;
        const bKey = `${b.startDate || b.date || ""} ${b.startTime || ""}`;
        return aKey.localeCompare(bKey);
      })
      .slice(0, 5);
  }, [allEvents]);

  const nextUpcomingEvent = upcomingClubEvents[0] || null;

  const getEventColor = (type) => {
    const colors = {
      training: "#007AFF",
      game: theme.colors.primary,
      match: theme.colors.primary,
      task: theme.colors.error,
      roster: "#6B7280",
      event: "#FF9500",
      meeting: "#5856D6",
    };
    return colors[type] || theme.colors.primary;
  };

  const formatShortDate = (value) => {
    if (!value) return "Date TBC";
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const formatItemTime = (item) => {
    if (item?.isAllDay) return "All day";
    const raw = String(item?.startTime || "").trim();
    if (!raw) return "";
    if (raw.toLowerCase() === "all day") return "All day";
    if (item?.endTime) return `${raw} - ${item.endTime}`;
    return raw;
  };

  const formatItemDateTime = (item) => {
    const dateLabel = formatShortDate(item?.date);
    const timeLabel = formatItemTime(item);
    return timeLabel ? `${dateLabel} • ${timeLabel}` : dateLabel;
  };

  const handleAddEvent = () => {
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
  };

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
              <TouchableOpacity onPress={goToPrevPeriod} style={{ padding: 4 }}>
                <ChevronLeft color={theme.colors.text} size={20} />
              </TouchableOpacity>
              <Text variant="h3" style={{ marginHorizontal: 6 }}>
                {monthYearLabel}
              </Text>
              <TouchableOpacity onPress={goToNextPeriod} style={{ padding: 4 }}>
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
            <Search color={theme.colors.text} size={24} />
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
            {weekDates.map((item, index) => {
              const isActive = selectedFullDate === item.fullDate;
              const hasEvents =
                allEvents.some((e) =>
                  occursOnDate(
                    e.startDate || e.date,
                    e.recurringRule,
                    item.fullDate,
                    {
                      endDate: e.endDate || e.date,
                    },
                  ),
                ) ||
                visibleTasks.some((t) =>
                  occursOnDate(
                    t.startDate || t.dueDate,
                    t.recurringRule,
                    item.fullDate,
                  ),
                ) ||
                visibleRosters.some((r) =>
                  occursOnDate(r.date, r.recurringRule, item.fullDate),
                );
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.dateBox, isActive && styles.dateBoxActive]}
                  onPress={() => handleWeekDayPress(item.fullDate)}
                >
                  <Text
                    variant="small"
                    color={
                      isActive ? theme.colors.white : theme.colors.textSecondary
                    }
                  >
                    {item.day}
                  </Text>
                  <Text
                    variant="h3"
                    color={isActive ? theme.colors.white : theme.colors.text}
                    style={{ marginTop: 4 }}
                  >
                    {item.date}
                  </Text>
                  {hasEvents && !isActive && (
                    <View style={styles.highlightDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Full month grid */}
        {calendarPanelTab === "schedule" && viewMode === "month" && (
          <View style={{ backgroundColor: theme.colors.surface }}>
            <View style={styles.monthDayHeaders}>
              {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
                <Text key={d} style={styles.monthDayHeaderText}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={styles.monthGrid}>
              {monthDates.map((item, idx) => {
                const isSelected = item.fullDate === selectedFullDate;
                const hasEvents =
                  allEvents.some((e) =>
                      occursOnDate(
                        e.startDate || e.date,
                        e.recurringRule,
                        item.fullDate,
                        {
                          endDate: e.endDate || e.date,
                        },
                      ),
                  ) ||
                  visibleTasks.some((t) =>
                    occursOnDate(
                      t.startDate || t.dueDate,
                      t.recurringRule,
                      item.fullDate,
                    ),
                  ) ||
                  visibleRosters.some((r) =>
                    occursOnDate(r.date, r.recurringRule, item.fullDate),
                  );
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.monthCell,
                      isSelected && styles.monthCellSelected,
                      item.isToday && !isSelected && styles.monthCellToday,
                    ]}
                    onPress={() => setSelectedFullDate(item.fullDate)}
                  >
                    <Text
                      style={[
                        styles.monthCellText,
                        !item.isCurrentMonth && { opacity: 0.3 },
                        isSelected && { color: "#fff" },
                        item.isToday &&
                          !isSelected && {
                            color: theme.colors.primary,
                            fontWeight: "700",
                          },
                      ]}
                    >
                      {item.day}
                    </Text>
                    {hasEvents && !isSelected && (
                      <View style={styles.highlightDot} />
                    )}
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
                          filter === "Fixtures"
                            ? theme.colors.primary
                            : filter === "Training"
                              ? "#007AFF"
                              : filter === "Tasks"
                                ? theme.colors.error
                                : "#6B7280",
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
                Upcoming Club Events
              </Text>
              {upcomingClubEvents.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <Text variant="small" color={theme.colors.textSecondary}>
                    No upcoming events scheduled.
                  </Text>
                </Card>
              ) : (
                upcomingClubEvents.map((event) => (
                  <Card
                    key={`upcoming-${event.id}`}
                    style={styles.upcomingEventCard}
                  >
                    <Text variant="body" weight="600">
                      {event.title || "Club Event"}
                    </Text>
                    <Text
                      variant="small"
                      color={theme.colors.textSecondary}
                      style={{ marginTop: 4 }}
                    >
                      {event.startDate || event.date || "Date TBC"}
                      {event.isAllDay
                        ? " • All day"
                        : event.startTime
                          ? ` • ${event.startTime}`
                          : ""}
                      {event.location ? ` • ${event.location}` : ""}
                    </Text>
                  </Card>
                ))
              )}
            </>
          ) : (
            <>
              {nextUpcomingEvent ? (
                <Card style={styles.nextUpCard}>
                  <Text variant="small" color={theme.colors.textSecondary}>
                    Next up
                  </Text>
                  <Text variant="body" weight="600" style={{ marginTop: 4 }}>
                    {nextUpcomingEvent.title || "Club Event"}
                  </Text>
                  <Text
                    variant="small"
                    color={theme.colors.textSecondary}
                    style={{ marginTop: 2 }}
                  >
                    {nextUpcomingEvent.startDate ||
                      nextUpcomingEvent.date ||
                      "Date TBC"}
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
              ) : null}

              <Text
                variant="small"
                weight="600"
                style={{ marginBottom: theme.spacing.md }}
              >
                {viewMode !== "list"
                  ? selectedFullDate || "Select a date"
                  : "Latest items (scroll up for past)"}
              </Text>

              {viewMode === "list" && listItems.length > 0 ? (
                <TouchableOpacity
                  style={styles.scrollToUpcomingBtn}
                  onPress={handleScrollToUpcoming}
                >
                  <Text variant="small" weight="600" color={theme.colors.primary}>
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
              ) : (viewMode !== "list" ? calendarItems : listItems).length ===
                0 ? (
                <View
                  style={{
                    alignItems: "center",
                    marginTop: theme.spacing.xl * 2,
                  }}
                >
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
                (viewMode !== "list" ? calendarItems : listItems).map(
                  (item) => {
                    const color = getEventColor(item.eventType);
                    const dateLabel = formatShortDate(item.date);
                    const timeLabel = formatItemTime(item) || "—";
                    const handleItemPress = (item) => {
                      if (item.source === "task" && item.originalItem) {
                        navigation.navigate("Tasks", {
                          openTask: item.originalItem,
                        });
                        return;
                      }
                      setSelectedItem(item);
                    };
                    return (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.85}
                        onPress={() => handleItemPress(item)}
                      >
                        <Card
                          style={[styles.eventCard, { borderLeftColor: color }]}
                        >
                          <View style={styles.eventMain}>
                            <View style={styles.eventTime}>
                              <Text
                                variant="small"
                                color={theme.colors.textSecondary}
                                style={{ fontSize: 10, marginBottom: 2 }}
                              >
                                {dateLabel}
                              </Text>
                              <Text variant="h4" style={{ fontSize: 13 }}>
                                {timeLabel}
                              </Text>
                            </View>
                            <View
                              style={{ flex: 1, marginLeft: theme.spacing.md }}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                }}
                              >
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    flex: 1,
                                    marginRight: 8,
                                  }}
                                >
                                  <Text
                                    variant="body"
                                    weight="600"
                                    style={{ flexShrink: 1 }}
                                  >
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
                                  style={[
                                    styles.eventBadge,
                                    { backgroundColor: color + "20" },
                                  ]}
                                >
                                  <Text
                                    variant="small"
                                    style={{
                                      fontSize: 10,
                                      fontWeight: "700",
                                      color,
                                    }}
                                  >
                                    {(item.eventType || "event").toUpperCase()}
                                  </Text>
                                </View>
                              </View>
                              {item.subtitle ? (
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    marginTop: 4,
                                  }}
                                >
                                  {item.source === "task" ? (
                                    <CheckCircle
                                      color={theme.colors.textSecondary}
                                      size={14}
                                    />
                                  ) : item.source === "roster" ? (
                                    <ClipboardList
                                      color={theme.colors.textSecondary}
                                      size={14}
                                    />
                                  ) : (
                                    <MapPin
                                      color={theme.colors.textSecondary}
                                      size={14}
                                    />
                                  )}
                                  <Text
                                    variant="small"
                                    color={theme.colors.textSecondary}
                                    style={{ marginLeft: 4 }}
                                  >
                                    {item.subtitle}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                        </Card>
                      </TouchableOpacity>
                    );
                  },
                )
              )}
            </>
          )}
        </View>
      </ScrollView>
      <Modal
        visible={!!selectedItem}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setSelectedItem(null)}
          />
          <View style={styles.modalCard}>
            <Text variant="h4">{selectedItem?.title || "Details"}</Text>
            <View style={styles.modalRow}>
              <Text variant="small" color={theme.colors.textSecondary}>
                Type
              </Text>
              <Text variant="body" weight="600">
                {(selectedItem?.eventType || "event").toUpperCase()}
              </Text>
            </View>
            <View style={styles.modalRow}>
              <Text variant="small" color={theme.colors.textSecondary}>
                Date & Time
              </Text>
              <Text variant="body" weight="600">
                {formatItemDateTime(selectedItem)}
              </Text>
            </View>
            {selectedItem?.subtitle ? (
              <View style={styles.modalRow}>
                <Text variant="small" color={theme.colors.textSecondary}>
                  Details
                </Text>
                <Text variant="body" weight="600">
                  {selectedItem.subtitle}
                </Text>
              </View>
            ) : null}
            {selectedItem?.description ? (
              <View style={styles.modalRow}>
                <Text variant="small" color={theme.colors.textSecondary}>
                  Notes
                </Text>
                <Text variant="body" style={{ lineHeight: 20 }}>
                  {selectedItem.description}
                </Text>
              </View>
            ) : null}
            <Button
              title="Close"
              onPress={() => setSelectedItem(null)}
              style={{ marginTop: theme.spacing.md }}
            />
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
  viewToggleContainer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
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
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dateBox: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 60,
    borderRadius: theme.radius.md,
  },
  dateBoxActive: {
    backgroundColor: theme.colors.primary,
  },
  highlightDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#FF9500",
    marginTop: 4,
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
  nextUpCard: {
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  upcomingEventCard: {
    marginBottom: theme.spacing.xs,
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
    width: 75,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    paddingRight: theme.spacing.xs,
    justifyContent: "center",
    alignItems: "center",
  },
  eventBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalCard: {
    width: "86%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.medium,
  },
  modalRow: {
    marginTop: theme.spacing.sm,
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
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  monthCellSelected: {
    backgroundColor: theme.colors.primary,
    borderRadius: 22,
  },
  monthCellToday: {
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: 22,
  },
  monthCellText: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.text,
  },
});
