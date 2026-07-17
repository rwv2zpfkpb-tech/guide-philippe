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
export function isOpenNow(
  weekdayDescriptions: string[] | null | undefined,
  now: Date = new Date()
): boolean | null {
  if (!weekdayDescriptions || weekdayDescriptions.length === 0) return null;

  const dayIndex = (now.getDay() + 6) % 7; // 0 = Montag … 6 = Sonntag
  const today = weekdayDescriptions[dayIndex];
  if (!today) return null;

  const sep = today.indexOf(":");
  const hoursPart = sep === -1 ? "" : today.slice(sep + 1).trim();
  if (!hoursPart || /geschlossen/i.test(hoursPart)) return false;
  if (/24 stunden/i.test(hoursPart)) return true;

  const ranges = hoursPart.match(/\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}/g);
  if (!ranges || ranges.length === 0) return false;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  for (const range of ranges) {
    const [start, end] = range.split(/[–-]/).map((t) => t.trim());
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    if (endMinutes <= startMinutes) endMinutes += 24 * 60; // over Mitternacht hinweg
    if (nowMinutes >= startMinutes && nowMinutes < endMinutes) return true;
  }
  return false;
}
