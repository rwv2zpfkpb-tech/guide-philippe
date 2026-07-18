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

export type OpeningStatus = {
  open: boolean | null;
  /** End of the currently active time range ("22:30 Uhr"), only set when
   *  `open` is true and today has a concrete closing time (not 24h-open). */
  until: string | null;
};

export function getOpeningStatus(
  weekdayDescriptions: string[] | null | undefined,
  now: Date = new Date()
): OpeningStatus {
  if (!weekdayDescriptions || weekdayDescriptions.length === 0) return { open: null, until: null };

  const dayIndex = (now.getDay() + 6) % 7; // 0 = Montag … 6 = Sonntag
  const today = weekdayDescriptions[dayIndex];
  if (!today) return { open: null, until: null };

  const sep = today.indexOf(":");
  const hoursPart = sep === -1 ? "" : today.slice(sep + 1).trim();
  if (!hoursPart || /geschlossen/i.test(hoursPart)) return { open: false, until: null };
  if (/24 stunden/i.test(hoursPart)) return { open: true, until: null };

  const ranges = hoursPart.match(/\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}/g);
  if (!ranges || ranges.length === 0) return { open: false, until: null };

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  for (const range of ranges) {
    const [start, end] = range.split(/[–-]/).map((t) => t.trim());
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    if (endMinutes <= startMinutes) endMinutes += 24 * 60; // over Mitternacht hinweg
    if (nowMinutes >= startMinutes && nowMinutes < endMinutes) {
      const until = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")} Uhr`;
      return { open: true, until };
    }
  }
  return { open: false, until: null };
}
