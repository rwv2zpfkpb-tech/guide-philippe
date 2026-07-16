"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/utils/supabase/auth-helpers";
import { createClient } from "@/utils/supabase/server";
import { resolvePlaceForImport } from "@/app/actions/places";
import type { Restaurant } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CsvImportRow = {
  row: number; // 1-based, matches the CSV line (header = row 1)
  name: string;
  googlePlaceId: string | null;
  mapsUrl: string | null;
  note: string | null; // aus der "Note"/"Notiz"-Spalte, falls vorhanden — Vorbefüllung fürs Fazit
  match: "new" | "existing";
  existingId: string | null;
  existingName: string | null;
};

export type CsvImportSelection = {
  name: string;
  googlePlaceId: string | null;
  note: string | null;
};

// ── CSV parsing ───────────────────────────────────────────────────────────────
// Minimal RFC4180-ish parser (quoted fields, embedded commas/newlines, "" escapes)
// — good enough for the Google Takeout "Gespeicherte Orte" export (Title,Note,URL)
// without pulling in a dependency.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((v) => v !== "")) rows.push(row);
  }
  return rows;
}

// Google Maps URLs encode the place in a few different ways depending on the
// export/share path — try the two that show up in Takeout list exports.
function extractPlaceId(url: string): string | null {
  const direct = url.match(/place_id:([^&\s"]+)/);
  if (direct) return direct[1];
  const query = url.match(/query_place_id=([^&\s"]+)/);
  if (query) return decodeURIComponent(query[1]);
  return null;
}

// ── Preview (dry run): parse + match against existing restaurants ────────────

export async function previewCsvImport(csvText: string): Promise<CsvImportRow[]> {
  await requireAdmin();
  const supabase = await createClient();

  const rows = parseCsv(csvText.replace(/^﻿/, "").trim());
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  // Google Takeout benennt die Spalte je nach Kontosprache "Title" (EN) oder
  // "Titel" (DE) — "URL" ist in beiden Sprachen identisch.
  const titleIdx = header.findIndex((h) => h === "title" || h === "titel");
  const urlIdx = header.indexOf("url");
  // "Note"/"Notiz" ist optional — nur zur Fazit-Vorbefüllung, kein Pflichtfeld.
  const noteIdx = header.findIndex((h) => h === "note" || h === "notiz");

  if (titleIdx === -1 || urlIdx === -1) {
    throw new Error(
      "CSV-Format nicht erkannt — erwarte Spalten 'Title'/'Titel' und 'URL' (Google-Takeout-Export 'Gespeicherte Orte')."
    );
  }

  const { data: existing, error } = await supabase
    .from("restaurants")
    .select("id, name, google_place_id");
  if (error) throw new Error(error.message);

  const byPlaceId = new Map(
    (existing ?? []).filter((r) => r.google_place_id).map((r) => [r.google_place_id as string, r])
  );
  const byNameLower = new Map((existing ?? []).map((r) => [r.name.trim().toLowerCase(), r]));

  return rows
    .slice(1)
    .map((cols, i) => {
      const name = (cols[titleIdx] ?? "").trim();
      const mapsUrl = (cols[urlIdx] ?? "").trim();
      const note = noteIdx === -1 ? "" : (cols[noteIdx] ?? "").trim();
      return { row: i + 2, name, mapsUrl, note };
    })
    .filter((r) => r.name)
    .map((r) => {
      const placeId = r.mapsUrl ? extractPlaceId(r.mapsUrl) : null;
      const existingMatch =
        (placeId && byPlaceId.get(placeId)) || byNameLower.get(r.name.toLowerCase());

      return {
        row: r.row,
        name: r.name,
        googlePlaceId: placeId,
        mapsUrl: r.mapsUrl || null,
        note: r.note || null,
        match: existingMatch ? "existing" : "new",
        existingId: existingMatch?.id ?? null,
        existingName: existingMatch?.name ?? null,
      };
    });
}

// ── Confirm: insert the selected rows as draft restaurants ───────────────────
// Imported entries only have a name (+ maybe a place ID/Notiz) — never genug
// für eine sofortige Veröffentlichung — daher landen sie immer als "draft" mit
// einem ersten Aufenthalt (Invariante: jedes Restaurant hat ≥1
// restaurant_reviews-Zeile). Damit möglichst viel schon "eingepflegt" ist statt
// leer:
// - Kartendaten (google_place_id + lat/lng) werden pro Zeile per
//   `resolvePlaceForImport` aufgelöst (direkte ID-Auflösung, sonst Textsuche
//   nach dem Namen) — bestmöglicher Vorschlag, kein garantierter Treffer.
// - Ein vorhandener CSV-Kommentar ("Note"/"Notiz") wird direkt als Fazit des
//   Platzhalter-Aufenthalts übernommen statt leer zu bleiben.
// Der Admin prüft/korrigiert beides über den normalen Edit-Panel-Flow (inkl.
// Places-Autocomplete) und entfernt dort das „Als Entwurf speichern"-Häkchen,
// sobald der Eintrag fertig ist.

// `bulkSpoonRating` lets the admin set the same spoon rating (0–3) for every
// imported row in one go — useful when importing a Google-Maps-Liste that was
// itself curated to a single rating tier (e.g. a "Worth Mentioning"-only
// list), instead of having to correct all placeholder reviews afterwards in
// the edit panel. Defaults to 1 ("Remembering") to match prior behaviour when
// omitted.
export async function confirmCsvImport(
  selection: CsvImportSelection[],
  bulkSpoonRating?: 0 | 1 | 2 | 3
): Promise<Restaurant[]> {
  await requireAdmin();
  if (selection.length === 0) return [];
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const spoonRating = bulkSpoonRating ?? 1;

  // Pro Zeile einzeln inserted (statt Batch-Insert) — hält Restaurant und
  // Notiz eindeutig zusammen, unabhängig davon, ob PostgREST die Rückgabe-
  // Reihenfolge eines Bulk-Inserts garantiert.
  const inserted = await Promise.all(
    selection.map(async (s) => {
      const place = await resolvePlaceForImport(s.name, s.googlePlaceId).catch(() => null);

      const { data: restaurant, error } = await supabase
        .from("restaurants")
        .insert({
          name: s.name,
          google_place_id: place?.googlePlaceId ?? s.googlePlaceId,
          lat: place?.lat ?? null,
          lng: place?.lng ?? null,
          status: "draft" as const,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);

      const { error: reviewError } = await supabase.from("restaurant_reviews").insert({
        restaurant_id: restaurant.id,
        visited_at: today,
        spoon_rating: spoonRating,
        fazit: s.note ?? "",
      });
      if (reviewError) throw new Error(reviewError.message);

      // `restaurant` was fetched before the review insert above ran the
      // sync_restaurant_spoon_rating trigger, so it still carries the
      // pre-trigger default rating — patch it in-memory (same fix as
      // createRestaurant in restaurants.ts) so the admin table shows the
      // correct spoon emoji immediately instead of only after a refetch.
      return { ...restaurant, spoon_rating: spoonRating };
    })
  );

  revalidatePath("/", "layout");
  return inserted;
}
