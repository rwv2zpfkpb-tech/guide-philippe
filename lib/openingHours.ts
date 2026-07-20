import tzlookup from "tz-lookup";

// Computes "geöffnet/geschlossen" locally from the persisted Google weekday
// strings (restaurants.google_opening_hours) instead of a live Places API
// call — those strings change rarely, so re-fetching them on every page view
// just to read today's status was wasted requests. Google's own "openNow"
// signal is itself just this same weekly schedule evaluated against the
// current time (barring holiday special-hours, which this app never fetched
// via regularOpeningHours anyway), so recomputing it from the stored text is
// equivalent in the cases this app already handled.
//
// Expects the same "Tag: Zeiten"-format Google returns for
// languageCode=de (e.g. "Montag: 12:00–14:30 Uhr, 18:00–22:00 Uhr",
// "Montag: Geschlossen", "Montag: 24 Stunden geöffnet"), ordered Monday
// first — matches the weekday-highlight logic already used in
// app/restaurant/[id]/page.tsx.
//
// The hours describe the *restaurant's* local time, not the server's or the
// visitor's — a server running in UTC (e.g. Vercel) reading `Date.getHours()`
// directly would be 1–2h off from Germany alone, and hardcoding "Europe/
// Berlin" would silently misjudge any restaurant outside that zone. Instead
// the timezone is resolved from the restaurant's own `lat`/`lng` via
// `tz-lookup` (pure offline geo→IANA-timezone lookup, no network/API call —
// keeps this cheap and matches the app's "spare Google requests" stance from
// Roadmap-Schritt 26). Falls back to Europe/Berlin when no coordinates are
// set (e.g. a manually captured restaurant without a map pin) since that is
// this guide's default locale.

export type OpeningStatus = {
  open: boolean | null;
  /** End of the currently active time range ("22:30 Uhr"), only set when
   *  `open` is true and today has a concrete closing time (not 24h-open). */
  until: string | null;
  /** Next time the restaurant opens again, only set when `open` is false.
   *  "08:00 Uhr" if later today, "Montag, 08:00 Uhr" if on a different day.
   *  null if unknown (no data) or already found to be closed all week. */
  opensAt: string | null;
};

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

const WEEKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // Montag first, matches WEEKDAYS
const FALLBACK_TIMEZONE = "Europe/Berlin";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Best-effort IANA timezone for a restaurant, derived from its coordinates. */
function resolveTimeZone(lat: number | null | undefined, lng: number | null | undefined): string {
  if (lat == null || lng == null) return FALLBACK_TIMEZONE;
  try {
    return tzlookup(lat, lng);
  } catch {
    return FALLBACK_TIMEZONE; // e.g. coordinates over open ocean
  }
}

function getLocalDateParts(now: Date, timeZone: string): { dayIndex: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  return { dayIndex: WEEKDAY_ORDER.indexOf(weekday), minutes: hour * 60 + minute };
}

type DayHours =
  | { kind: "24h" }
  | { kind: "closed" }
  | {
      kind: "ranges";
      ranges: { startH: number; startM: number; endH: number; endM: number; startMinutes: number; endMinutes: number }[];
    };

function parseDayHours(desc: string | undefined): DayHours {
  if (!desc) return { kind: "closed" };
  const sep = desc.indexOf(":");
  const hoursPart = sep === -1 ? "" : desc.slice(sep + 1).trim();
  if (!hoursPart || /geschlossen/i.test(hoursPart)) return { kind: "closed" };
  if (/24 stunden/i.test(hoursPart)) return { kind: "24h" };

  const matches = hoursPart.match(/\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}/g);
  if (!matches || matches.length === 0) return { kind: "closed" };

  const ranges = matches.map((range) => {
    const [start, end] = range.split(/[–-]/).map((t) => t.trim());
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    if (endMinutes <= startMinutes) endMinutes += 24 * 60; // over Mitternacht hinweg
    return { startH, startM, endH, endM, startMinutes, endMinutes };
  });
  return { kind: "ranges", ranges };
}

function findNextOpening(weekdayDescriptions: string[], todayIndex: number, nowMinutes: number): string | null {
  const today = parseDayHours(weekdayDescriptions[todayIndex]);
  if (today.kind === "ranges") {
    const later = today.ranges
      .filter((r) => r.startMinutes > nowMinutes)
      .sort((a, b) => a.startMinutes - b.startMinutes)[0];
    if (later) return `${pad(later.startH)}:${pad(later.startM)} Uhr`;
  }

  for (let offset = 1; offset <= 7; offset++) {
    const dayIdx = (todayIndex + offset) % 7;
    const day = parseDayHours(weekdayDescriptions[dayIdx]);
    if (day.kind === "24h") return `${WEEKDAYS[dayIdx]}, 00:00 Uhr`;
    if (day.kind === "ranges" && day.ranges.length > 0) {
      const earliest = [...day.ranges].sort((a, b) => a.startMinutes - b.startMinutes)[0];
      return `${WEEKDAYS[dayIdx]}, ${pad(earliest.startH)}:${pad(earliest.startM)} Uhr`;
    }
  }
  return null;
}

export function getOpeningStatus(
  weekdayDescriptions: string[] | null | undefined,
  coords?: { lat: number | null | undefined; lng: number | null | undefined } | null,
  now: Date = new Date()
): OpeningStatus {
  if (!weekdayDescriptions || weekdayDescriptions.length === 0) return { open: null, until: null, opensAt: null };

  const timeZone = resolveTimeZone(coords?.lat, coords?.lng);
  const { dayIndex, minutes: nowMinutes } = getLocalDateParts(now, timeZone);
  if (dayIndex === -1 || !weekdayDescriptions[dayIndex]) return { open: null, until: null, opensAt: null };

  const today = parseDayHours(weekdayDescriptions[dayIndex]);

  if (today.kind === "24h") return { open: true, until: null, opensAt: null };
  if (today.kind === "ranges") {
    for (const range of today.ranges) {
      if (nowMinutes >= range.startMinutes && nowMinutes < range.endMinutes) {
        return { open: true, until: `${pad(range.endH)}:${pad(range.endM)} Uhr`, opensAt: null };
      }
    }
  }

  return { open: false, until: null, opensAt: findNextOpening(weekdayDescriptions, dayIndex, nowMinutes) };
}
