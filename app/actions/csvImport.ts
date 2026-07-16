"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/utils/supabase/auth-helpers";
import { createClient } from "@/utils/supabase/server";
import type { Restaurant } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CsvImportRow = {
  row: number; // 1-based, matches the CSV line (header = row 1)
  name: string;
  googlePlaceId: string | null;
  mapsUrl: string | null;
  match: "new" | "existing";
  existingId: string | null;
  existingName: string | null;
};

export type CsvImportSelection = {
  name: string;
  googlePlaceId: string | null;
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
  const titleIdx = header.indexOf("title");
  const urlIdx = header.indexOf("url");

  if (titleIdx === -1 || urlIdx === -1) {
    throw new Error(
      "CSV-Format nicht erkannt — erwarte Spalten 'Title' und 'URL' (Google-Takeout-Export 'Gespeicherte Orte')."
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
      return { row: i + 2, name, mapsUrl };
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
        match: existingMatch ? "existing" : "new",
        existingId: existingMatch?.id ?? null,
        existingName: existingMatch?.name ?? null,
      };
    });
}

// ── Confirm: insert the selected rows as draft restaurants ───────────────────
// Imported entries only have a name (+ maybe a place ID) — never enough to
// publish straight away — so they always land as "draft" with a placeholder
// first review (invariant: every restaurant has ≥1 restaurant_reviews row).
// The admin fills in cuisine/price/rating/fazit via the normal edit panel and
// flips the "Als Entwurf speichern" checkbox off once it's ready.

export async function confirmCsvImport(selection: CsvImportSelection[]): Promise<Restaurant[]> {
  await requireAdmin();
  if (selection.length === 0) return [];
  const supabase = await createClient();

  const { data: inserted, error } = await supabase
    .from("restaurants")
    .insert(
      selection.map((s) => ({
        name: s.name,
        google_place_id: s.googlePlaceId,
        status: "draft" as const,
      }))
    )
    .select();

  if (error) throw new Error(error.message);

  const today = new Date().toISOString().slice(0, 10);
  const { error: reviewError } = await supabase.from("restaurant_reviews").insert(
    inserted.map((r) => ({
      restaurant_id: r.id,
      visited_at: today,
      spoon_rating: 1,
      fazit: "",
    }))
  );
  if (reviewError) throw new Error(reviewError.message);

  revalidatePath("/", "layout");
  return inserted;
}
