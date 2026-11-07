/**
 * Shared recurrence engine (web admin).
 *
 * A recurring rule looks like:
 * {
 *   frequency: "daily" | "weekly" | "monthly" | "yearly",
 *   interval: 1,                 // every N days/weeks/months/years
 *   weekDays: [0..6],            // weekly only, 0 = Sunday
 *   monthlyMode: "same_day" | "nth_weekday",
 *   untilDate: "YYYY-MM-DD",     // inclusive end date
 *   count: 10,                   // stop after N occurrences
 * }
 *
 * All dates are handled as local calendar days (no timezone drift).
 */

const MS_PER_DAY = 86400000;
const ISO_DATE_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})/;

/** Parse a "YYYY-MM-DD" string into a local Date at midnight. */
export const parseIsoDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  const match = String(value).trim().match(ISO_DATE_RE);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return null;
  // Guard against overflow (e.g. 2026-02-31 -> Mar 3)
  if (date.getMonth() !== month || date.getDate() !== day) return null;
  return date;
};

/** Format a Date as a local "YYYY-MM-DD" string. */
export const toIsoDateLocal = (date) => {
  if (!date || Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** Today as "YYYY-MM-DD". */
export const todayIsoDate = () => toIsoDateLocal(new Date());

/** Add N days to a Date (returns a new Date). */
export const addDays = (date, days) => {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
};

/** Add N days to an ISO date string. */
export const addDaysToIsoDate = (isoDate, days) => {
  const base = parseIsoDate(isoDate);
  if (!base) return isoDate;
  return toIsoDateLocal(addDays(base, days));
};

/** Number of days in a given month (month is 0-based). */
export const daysInMonth = (year, month) =>
  new Date(year, month + 1, 0).getDate();

/**
 * Absolute day index for a Date. Uses UTC math on the local calendar
 * components so DST transitions never shift the result by a day.
 */
const dayIndex = (date) =>
  Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY,
  );

/** Whole-day difference (to - from). */
export const daysBetween = (from, to) => dayIndex(to) - dayIndex(from);

/** Sunday that starts the week containing `date`. */
export const startOfWeek = (date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
};

/** 1-based week-of-month index (1..5). */
export const getWeekOfMonth = (date) => Math.floor((date.getDate() - 1) / 7) + 1;

const normalizeWeekDays = (value) => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => parseInt(entry, 10))
        .filter((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 6),
    ),
  ).sort((a, b) => a - b);
};

/** True when the rule actually describes a repeating schedule. */
export const hasRecurrence = (rule) => {
  if (!rule || typeof rule !== "object") return false;
  const frequency = String(rule.frequency || "").toLowerCase();
  if (!frequency) return false;
  return ["daily", "weekly", "monthly", "yearly"].includes(frequency);
};

/**
 * Does `dateStr` fall on an occurrence of the event/task/roster?
 *
 * @param {string} baseDateStr  Anchor date ("YYYY-MM-DD")
 * @param {object|null} rule    Recurrence rule (null for one-off items)
 * @param {string} dateStr      Date to test ("YYYY-MM-DD")
 * @param {object} options      { endDate } — for multi-day one-off items
 */
export const occursOnDate = (baseDateStr, rule, dateStr, options = {}) => {
  const base = parseIsoDate(baseDateStr);
  const target = parseIsoDate(dateStr);
  if (!base || !target) return false;

  const baseIdx = dayIndex(base);
  const targetIdx = dayIndex(target);

  // ---- One-off item (optionally spanning several days) ----
  if (!hasRecurrence(rule)) {
    const spanEnd = parseIsoDate(options?.endDate || "");
    if (spanEnd && dayIndex(spanEnd) > baseIdx) {
      return targetIdx >= baseIdx && targetIdx <= dayIndex(spanEnd);
    }
    return targetIdx === baseIdx;
  }

  // ---- Recurring item ----
  if (targetIdx < baseIdx) return false;

  const until = parseIsoDate(rule.untilDate || "");
  if (until && targetIdx > dayIndex(until)) return false;

  const frequency = String(rule.frequency || "").toLowerCase();
  const interval = Math.max(1, parseInt(rule.interval, 10) || 1);
  const diff = targetIdx - baseIdx;

  if (frequency === "daily") {
    return diff % interval === 0;
  }

  if (frequency === "weekly") {
    const weekDiff = Math.round(
      (dayIndex(startOfWeek(target)) - dayIndex(startOfWeek(base))) / 7,
    );
    if (weekDiff < 0 || weekDiff % interval !== 0) return false;

    const weekDays = normalizeWeekDays(rule.weekDays);
    if (weekDays.length > 0) {
      return weekDays.includes(target.getDay());
    }
    return target.getDay() === base.getDay();
  }

  if (frequency === "monthly") {
    const monthDiff =
      (target.getFullYear() - base.getFullYear()) * 12 +
      (target.getMonth() - base.getMonth());
    if (monthDiff < 0 || monthDiff % interval !== 0) return false;

    const mode = String(rule.monthlyMode || "same_day").toLowerCase();
    if (mode === "nth_weekday") {
      return (
        target.getDay() === base.getDay() &&
        getWeekOfMonth(target) === getWeekOfMonth(base)
      );
    }

    // "same day of month", clamped to the last day for short months
    const lastDay = daysInMonth(target.getFullYear(), target.getMonth());
    return target.getDate() === Math.min(base.getDate(), lastDay);
  }

  if (frequency === "yearly") {
    const yearDiff = target.getFullYear() - base.getFullYear();
    if (yearDiff < 0 || yearDiff % interval !== 0) return false;
    if (target.getMonth() !== base.getMonth()) return false;
    const lastDay = daysInMonth(target.getFullYear(), target.getMonth());
    return target.getDate() === Math.min(base.getDate(), lastDay);
  }

  return false;
};

const MAX_SCAN_DAYS = 4000; // ~11 years of daily scanning

/**
 * All occurrence dates of an item inside [rangeStartStr, rangeEndStr].
 * Returns an array of "YYYY-MM-DD" strings, ascending.
 */
export const buildOccurrenceDates = (
  baseDateStr,
  rule,
  rangeStartStr,
  rangeEndStr,
  options = {},
) => {
  const base = parseIsoDate(baseDateStr);
  if (!base) return [];

  const rangeStart = parseIsoDate(rangeStartStr) || base;
  const rangeEnd = parseIsoDate(rangeEndStr) || rangeStart;
  if (dayIndex(rangeEnd) < dayIndex(rangeStart)) return [];

  const recurring = hasRecurrence(rule);
  const limit = recurring ? Math.max(0, parseInt(rule.count, 10) || 0) : 0;

  // When a count limit exists we must count from the anchor date, otherwise
  // we can start scanning at the beginning of the requested range.
  const scanStart =
    limit > 0
      ? base
      : dayIndex(rangeStart) > dayIndex(base)
        ? rangeStart
        : base;

  const rangeStartIdx = dayIndex(rangeStart);
  const rangeEndIdx = dayIndex(rangeEnd);

  const results = [];
  let seen = 0;
  let cursor = new Date(
    scanStart.getFullYear(),
    scanStart.getMonth(),
    scanStart.getDate(),
  );
  let guard = 0;

  while (dayIndex(cursor) <= rangeEndIdx && guard < MAX_SCAN_DAYS) {
    const iso = toIsoDateLocal(cursor);
    if (occursOnDate(baseDateStr, rule, iso, options)) {
      seen += 1;
      if (limit > 0 && seen > limit) break;
      if (dayIndex(cursor) >= rangeStartIdx) results.push(iso);
    }
    cursor = addDays(cursor, 1);
    guard += 1;
  }

  return results;
};

/** First occurrence on or after `fromStr` (or null). */
export const getNextOccurrence = (
  baseDateStr,
  rule,
  fromStr,
  options = {},
  horizonDays = 730,
) => {
  const from = parseIsoDate(fromStr) || new Date();
  const horizon = addDays(from, horizonDays);
  const dates = buildOccurrenceDates(
    baseDateStr,
    rule,
    toIsoDateLocal(from),
    toIsoDateLocal(horizon),
    options,
  );
  return dates[0] || null;
};

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
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
const ORDINAL_WORDS = ["first", "second", "third", "fourth", "fifth"];

const formatRuleDate = (isoDate) => {
  const date = parseIsoDate(isoDate);
  if (!date) return "";
  return `${date.getDate()} ${MONTH_SHORT[date.getMonth()]} ${date.getFullYear()}`;
};

/** Human readable summary of a recurrence rule. */
export const describeRecurrence = (rule, baseDateStr) => {
  if (!hasRecurrence(rule)) return "Does not repeat";

  const frequency = String(rule.frequency || "").toLowerCase();
  const interval = Math.max(1, parseInt(rule.interval, 10) || 1);
  const base = parseIsoDate(baseDateStr);
  let summary = "";

  if (frequency === "daily") {
    summary = interval === 1 ? "Every day" : `Every ${interval} days`;
  } else if (frequency === "weekly") {
    const weekDays = normalizeWeekDays(rule.weekDays);
    const daysLabel =
      weekDays.length > 0
        ? weekDays.map((day) => WEEKDAY_SHORT[day]).join(", ")
        : base
          ? WEEKDAY_FULL[base.getDay()]
          : "";
    const prefix = interval === 1 ? "Every week" : `Every ${interval} weeks`;
    summary = daysLabel ? `${prefix} on ${daysLabel}` : prefix;
  } else if (frequency === "monthly") {
    const prefix = interval === 1 ? "Every month" : `Every ${interval} months`;
    const mode = String(rule.monthlyMode || "same_day").toLowerCase();
    if (mode === "nth_weekday" && base) {
      const ordinal =
        ORDINAL_WORDS[
          Math.min(getWeekOfMonth(base) - 1, ORDINAL_WORDS.length - 1)
        ];
      summary = `${prefix} on the ${ordinal} ${WEEKDAY_FULL[base.getDay()]}`;
    } else if (base) {
      summary = `${prefix} on day ${base.getDate()}`;
    } else {
      summary = prefix;
    }
  } else if (frequency === "yearly") {
    const prefix = interval === 1 ? "Every year" : `Every ${interval} years`;
    summary = base
      ? `${prefix} on ${base.getDate()} ${MONTH_SHORT[base.getMonth()]}`
      : prefix;
  } else {
    summary = "Repeats";
  }

  const until = parseIsoDate(rule.untilDate || "");
  if (until) {
    summary += ` · until ${formatRuleDate(rule.untilDate)}`;
  } else {
    const count = parseInt(rule.count, 10);
    if (Number.isFinite(count) && count > 0) {
      summary += ` · ${count} time${count === 1 ? "" : "s"}`;
    }
  }

  return summary;
};

/**
 * Expand a list of source records into dated occurrences inside a range.
 *
 * @param {Array} records        Source docs
 * @param {object} config
 * @param {Function} config.getBaseDate   (record) => "YYYY-MM-DD"
 * @param {Function} config.getRule       (record) => rule|null
 * @param {Function} config.getEndDate    (record) => "YYYY-MM-DD"|undefined
 * @param {Function} config.mapItem       (record, occurrenceDate) => item
 * @param {string} rangeStart
 * @param {string} rangeEnd
 */
export const expandRecords = (
  records = [],
  { getBaseDate, getRule, getEndDate, mapItem },
  rangeStart,
  rangeEnd,
) => {
  const out = [];
  (records || []).forEach((record) => {
    const baseDate = getBaseDate(record);
    if (!baseDate) return;
    const dates = buildOccurrenceDates(
      baseDate,
      getRule(record),
      rangeStart,
      rangeEnd,
      { endDate: getEndDate ? getEndDate(record) : undefined },
    );
    dates.forEach((occurrenceDate) => {
      const mapped = mapItem(record, occurrenceDate);
      if (Array.isArray(mapped)) out.push(...mapped);
      else if (mapped) out.push(mapped);
    });
  });
  return out;
};

/** Sort items by date then start time. */
export const sortByDateTime = (items = []) =>
  [...items].sort((a, b) => {
    const aKey = `${a.date || "9999-12-31"} ${a.startTime || a.time || "99:99"}`;
    const bKey = `${b.date || "9999-12-31"} ${b.startTime || b.time || "99:99"}`;
    return aKey.localeCompare(bKey);
  });

/** Group items into a Map<date, items[]>. */
export const groupItemsByDate = (items = []) => {
  const map = new Map();
  items.forEach((item) => {
    const key = item?.date || "";
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
};
