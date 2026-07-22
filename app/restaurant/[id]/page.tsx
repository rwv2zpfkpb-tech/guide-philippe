import { notFound } from "next/navigation";
import Link from "next/link";
import { getRestaurantById, refreshGooglePlaceDataIfStale } from "@/app/actions/restaurants";
import { getPlaceDetails } from "@/app/actions/places";
import { getOpeningStatus } from "@/lib/openingHours";
import { DeleteCommentButton } from "@/components/DeleteCommentButton";
import { createClient } from "@/utils/supabase/server";
import {
  SPOON_RATINGS,
  SPOON_RATING_COLORS,
  REVIEW_CATEGORY_ORDER,
  REVIEW_CATEGORY_LABELS,
  computeAverageRating,
} from "@/lib/ratings";
import { PriceLevelDots } from "@/components/PriceLevelDots";
import { RatingDots } from "@/components/RatingDots";
import { StarRating } from "@/components/StarRating";
import { NavigateButton } from "@/components/NavigateButton";
import { BackButton } from "@/components/BackButton";
import { IconPin, IconEmptyState, IconPhone, IconGlobe } from "@/components/icons";
import type { ReviewWithCategories, RestaurantReviewCategory } from "@/types/database";
import CommentForm from "./CommentForm";

// ── Fazit + Kategorie-Blöcke eines einzelnen Aufenthalts ───────────────────────
// Wiederverwendet für den aktuellen Aufenthalt und jeden Eintrag in "Vorherige
// Aufenthalte" (dort innerhalb eines <details>-Elements).
function ReviewContent({ review }: { review: ReviewWithCategories }) {
  const categories = REVIEW_CATEGORY_ORDER
    .map((cat) => review.categories.find((c) => c.category === cat))
    .filter((c): c is RestaurantReviewCategory => !!c?.body?.trim());

  // Headline = first sentence (styled large as a pull-quote), body = the
  // remainder. Previously the full fazit was repeated verbatim below the
  // headline, so the first sentence appeared twice on the page.
  const fazit = review.fazit?.trim() ?? "";
  const firstStop = fazit.indexOf(".");
  const headline = firstStop === -1 ? fazit : fazit.slice(0, firstStop + 1);
  const rest = firstStop === -1 ? "" : fazit.slice(firstStop + 1).trim();

  return (
    <div>
      {fazit && (
        <article style={{ marginBottom: categories.length ? 36 : 0 }}>
          <div
            style={{
              fontFamily: "var(--font-cormorant)",
              fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
              fontWeight: 500,
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
              color: "var(--c-ink)",
              marginBottom: rest ? 16 : 0,
            }}
          >
            {headline}
          </div>
          {rest && (
            <p style={{ fontSize: "1rem", lineHeight: 1.75, color: "var(--c-ink)" }}>
              {rest}
            </p>
          )}
        </article>
      )}

      {categories.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {categories.map((c) => (
            <div
              key={c.id}
              style={{
                border: "1px solid var(--c-n100)",
                borderRadius: 14,
                padding: "20px 22px",
                background: "var(--c-surface)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {c.heading?.trim() && (
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--c-n500)",
                      }}
                    >
                      {REVIEW_CATEGORY_LABELS[c.category]}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      letterSpacing: "0.02em",
                      color: "var(--c-ink)",
                    }}
                  >
                    {c.heading?.trim() || REVIEW_CATEGORY_LABELS[c.category]}
                  </span>
                </div>
                <RatingDots value={c.rating} min={1} max={5} size={7} />
              </div>
              <p style={{ fontSize: "0.875rem", lineHeight: 1.65, color: "var(--c-n600)" }}>
                {c.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let restaurant;
  try {
    restaurant = await getRestaurantById(id);
  } catch {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Nur noch Fotos kommen live von Google (nicht persistierbar) — Adresse/
  // Telefon/Website/Öffnungszeiten kommen aus der DB (befüllt beim
  // Bearbeiten im Admin-Panel/CSV-Import/"Von Google synchronisieren"),
  // damit nicht bei jedem Seitenaufruf ein zusätzlicher Places-Request
  // anfällt.
  const placeDetails = restaurant.google_place_id
    ? await getPlaceDetails(restaurant.google_place_id, { photosOnly: true }).catch(() => null)
    : null;

  // 6-Monate-Verfallsdatum (lib/googleSync.ts): sind die gespeicherten
  // Google-Daten abgelaufen, lädt dieser Aufruf Restaurant + Google-Daten
  // selbst serverseitig neu und schreibt sie zurück (s. Kommentar an der
  // Funktion in restaurants.ts, aus Sicherheitsgründen nimmt sie bewusst
  // nur die ID entgegen statt fertiger Objekte vom Aufrufer). No-op (gibt
  // `restaurant` unverändert zurück), solange die Daten noch frisch sind.
  const refreshed = await refreshGooglePlaceDataIfStale(restaurant.id);
  if (refreshed) restaurant = { ...restaurant, ...refreshed };

  const spoon = SPOON_RATINGS[restaurant.spoon_rating];
  const spoonColors = SPOON_RATING_COLORS[restaurant.spoon_rating];
  const firstPhoto = placeDetails?.photoUris?.[0] ?? null;

  const phone = restaurant.phone;
  const website = restaurant.website;
  const weekdayDescriptions = restaurant.google_opening_hours;
  const { open: openNow, until: openUntil, opensAt: openOpensAt } = getOpeningStatus(weekdayDescriptions, {
    lat: restaurant.lat,
    lng: restaurant.lng,
  });

  const [currentReview, ...pastReviews] = restaurant.reviews;
  const averageRating = computeAverageRating(restaurant.comments.map((c) => c.secondary_rating));

  return (
    <>
      {/* ── BACK ─────────────────────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 40px 0" }}>
        <BackButton fallbackHref="/" label="Zurück" />
      </div>

      {/* ── HERO IMAGE ──────────────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: "18px auto 0", padding: "0 40px" }}>
        <div
          style={{
            width: "100%",
            aspectRatio: "16 / 6",
            borderRadius: 22,
            overflow: "hidden",
            position: "relative",
            background: firstPhoto
              ? undefined
              : `repeating-linear-gradient(-45deg, var(--c-n100), var(--c-n100) 1px, var(--c-n50) 1px, var(--c-n50) 18px)`,
            border: "1px solid var(--c-n100)",
          }}
        >
          {firstPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={firstPhoto}
              alt={`${restaurant.name} Foto`}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                fontFamily: "monospace",
                fontSize: 11,
                color: "var(--c-n300)",
                letterSpacing: "0.1em",
              }}
            >
              restaurant photo
            </div>
          )}

          {/* Additional photos strip — insgesamt genau 3 Google-Fotos (Hero + 2) */}
          {placeDetails && placeDetails.photoUris.length > 1 && (
            <div
              style={{
                position: "absolute",
                bottom: 14,
                right: 14,
                display: "flex",
                gap: 6,
              }}
            >
              {placeDetails.photoUris.slice(1, 3).map((uri, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={uri}
                  alt=""
                  style={{
                    width: 60,
                    height: 48,
                    objectFit: "cover",
                    borderRadius: 6,
                    border: "2px solid white",
                    boxShadow: "var(--s-sm)",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── RESTAURANT IDENTITY ─────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 40px 32px" }}>
        <div
          className="restaurant-hero-row"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 48,
            flexWrap: "wrap",
          }}
        >
          {/* Left: name + meta */}
          <div style={{ flex: 1, minWidth: 280 }}>
            {/* Cuisine eyebrow (left) + price level (right) share one row so
                the price sits directly opposite the cuisine label instead of
                being buried in the small meta line below — and is styled
                large/bold rather than matching the cuisine eyebrow's tiny
                caps, so it doesn't get lost. */}
            {(restaurant.cuisine || restaurant.price_level != null) && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  marginBottom: 10,
                  flexWrap: "wrap",
                }}
              >
                {restaurant.cuisine ? (
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: "var(--c-gold)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 24,
                        height: 1,
                        background: "var(--c-gold-light)",
                        flexShrink: 0,
                      }}
                    />
                    {restaurant.cuisine}
                  </div>
                ) : (
                  <span />
                )}
                {restaurant.price_level != null && (
                  <div
                    style={{
                      fontFamily: "var(--font-cormorant)",
                      fontSize: "1.75rem",
                      fontWeight: 700,
                      lineHeight: 1,
                      color: "var(--c-ink)",
                    }}
                  >
                    <PriceLevelDots level={restaurant.price_level} />
                  </div>
                )}
              </div>
            )}

            {restaurant.status === "draft" && (
              <div
                style={{
                  display: "inline-block",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--c-gold)",
                  background: "var(--c-gold-light)",
                  borderRadius: 4,
                  padding: "3px 8px",
                  marginBottom: 10,
                }}
              >
                Entwurf — nur für Admins sichtbar
              </div>
            )}

            <h1
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: "clamp(2.5rem, 5vw, 4rem)",
                fontWeight: 600,
                lineHeight: 1.0,
                letterSpacing: "-0.02em",
                color: "var(--c-ink)",
                marginBottom: 18,
              }}
            >
              {restaurant.name}
            </h1>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                fontSize: "0.8125rem",
                color: "var(--c-n500)",
                lineHeight: 1,
              }}
            >
              {restaurant.address && (
                <>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: "var(--c-n400)",
                    }}
                  >
                    <IconPin size={14} />
                  </span>
                  <span>{restaurant.address}</span>
                  {openNow !== null && (
                    <span style={{ color: "var(--c-n300)" }}>·</span>
                  )}
                </>
              )}
              {openNow !== null && (
                <span
                  style={{
                    color: openNow ? "oklch(45% 0.12 145)" : "oklch(45% 0.12 25)",
                  }}
                >
                  {openNow
                    ? `Jetzt geöffnet${openUntil ? `, bis ${openUntil}` : ""}`
                    : `Geschlossen${openOpensAt ? `, öffnet wieder ${openOpensAt}` : ""}`}
                </span>
              )}
            </div>

            {(restaurant.lat != null && restaurant.lng != null) || phone || website ? (
              <div style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 10 }}>
                {restaurant.lat != null && restaurant.lng != null && (
                  <NavigateButton
                    name={restaurant.name}
                    lat={restaurant.lat}
                    lng={restaurant.lng}
                    googlePlaceId={restaurant.google_place_id}
                  />
                )}
                {phone && (
                  <a
                    href={`tel:${phone.replace(/\s+/g, "")}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 9,
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      padding: "12px 22px",
                      borderRadius: 9999,
                      border: "1.5px solid var(--c-n200)",
                      color: "var(--c-ink)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <IconPhone size={16} />
                    Anrufen
                  </a>
                )}
                {website && (
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 9,
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      padding: "12px 22px",
                      borderRadius: 9999,
                      border: "1.5px solid var(--c-n200)",
                      color: "var(--c-ink)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <IconGlobe size={16} />
                    Website
                  </a>
                )}
              </div>
            ) : null}
          </div>

          {/* Right: spoon verdict — color-coded by rating tier (SPOON_RATING_COLORS)
              so the box itself signals good/mediocre/bad at a glance, not just the emoji. */}
          <div
            className="restaurant-hero-verdict"
            style={{
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 16,
            }}
          >
            <div
              style={{
                background: spoonColors.bg,
                border: `1px solid ${spoonColors.border}`,
                borderRadius: 14,
                padding: "22px 28px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                minWidth: 190,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "2.75rem", lineHeight: 1 }}>{spoon.emoji}</div>
              <RatingDots value={restaurant.spoon_rating} max={3} size={8} color={spoonColors.text} />
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: spoonColors.text,
                }}
              >
                {spoon.labelShort}
              </div>
              <div
                style={{ fontSize: 10, color: "var(--c-n400)", letterSpacing: "0.06em" }}
              >
                Guide Philippe Rating
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: "var(--c-n100)" }} />

      {/* ── CONTENT COLUMN ──────────────────────────────── */}
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "0 40px",
        }}
      >
        {/* Opening hours — collapsed by default (details/summary, closed unless
            "open" is set), a chevron makes the expandability obvious. Google
            liefert "Tag: Zeiten"-Strings (Mo–So); hier in zwei Spalten
            aufgeteilt und der heutige Wochentag hervorgehoben. */}
        {weekdayDescriptions && weekdayDescriptions.length > 0 && (
          <div style={{ padding: "40px 0 0" }}>
            <details
              className="oh-details"
              style={{
                border: "1px solid var(--c-n100)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "14px 18px",
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "var(--c-n400)",
                }}
              >
                <span>Öffnungszeiten</span>
                <svg
                  className="oh-chevron"
                  width="14"
                  height="14"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="var(--c-n400)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <polyline points="5 7 10 12 15 7" />
                </svg>
              </summary>
              <div style={{ borderTop: "1px solid var(--c-n100)" }}>
                {weekdayDescriptions.map((d, i) => {
                  const sep = d.indexOf(":");
                  const day = sep === -1 ? d : d.slice(0, sep);
                  const hours = sep === -1 ? "" : d.slice(sep + 1).trim();
                  const todayIndex = (new Date().getDay() + 6) % 7; // 0=Montag … 6=Sonntag
                  const isToday = i === todayIndex;

                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 16,
                        fontSize: "0.875rem",
                        padding: "9px 16px",
                        background: isToday ? "var(--c-gold-light)" : "transparent",
                        color: isToday ? "var(--c-ink)" : "var(--c-n600)",
                        fontWeight: isToday ? 600 : 400,
                        borderBottom:
                          i < weekdayDescriptions.length - 1
                            ? "1px solid var(--c-n100)"
                            : "none",
                      }}
                    >
                      <span>{day}</span>
                      <span>{hours}</span>
                    </div>
                  );
                })}
              </div>
            </details>
          </div>
        )}

        {/* Manueller Öffnungszeiten-Fallback — nur wenn Google keine
            gespeicherten Öffnungszeiten liefert (kein google_place_id,
            fehlgeschlagener Lookup/Sync, oder Google kennt die
            Öffnungszeiten schlicht nicht). */}
        {(!weekdayDescriptions || weekdayDescriptions.length === 0) && restaurant.opening_hours && (
          <div style={{ padding: "40px 0 0" }}>
            <div
              style={{
                border: "1px solid var(--c-n100)",
                borderRadius: 12,
                padding: "14px 18px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "var(--c-n400)",
                  marginBottom: 8,
                }}
              >
                Öffnungszeiten
              </div>
              <p style={{ fontSize: "0.875rem", color: "var(--c-n600)", whiteSpace: "pre-line" }}>
                {restaurant.opening_hours}
              </p>
            </div>
          </div>
        )}

        {/* Editorial review — aktuellster Aufenthalt */}
        {currentReview && (currentReview.fazit || currentReview.categories.length > 0) && (
          <article style={{ padding: "64px 0 56px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 28,
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--c-burg)",
              }}
            >
              <span
                style={{ flex: 1, height: 1, background: "oklch(83% 0.030 17)" }}
              />
              Redaktionelle Bewertung
              <span
                style={{ flex: 1, height: 1, background: "oklch(83% 0.030 17)" }}
              />
            </div>

            <ReviewContent review={currentReview} />
          </article>
        )}

        {/* Vorherige Aufenthalte — ausklappbar, vor den Nutzerbewertungen */}
        {pastReviews.length > 0 && (
          <section style={{ padding: "0 0 56px" }} aria-label="Vorherige Aufenthalte">
            <div
              style={{
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--c-n400)",
                marginBottom: 18,
              }}
            >
              Vorherige Aufenthalte
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {pastReviews.map((rev) => {
                const revSpoon = SPOON_RATINGS[rev.spoon_rating];
                return (
                  <details
                    key={rev.id}
                    style={{
                      border: "1px solid var(--c-n100)",
                      borderRadius: 14,
                      padding: "18px 22px",
                      background: "var(--c-surface)",
                    }}
                  >
                    <summary
                      style={{
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        fontSize: "0.9375rem",
                        fontWeight: 500,
                        color: "var(--c-ink)",
                      }}
                    >
                      Vorheriger Aufenthalt am{" "}
                      {new Date(rev.visited_at).toLocaleDateString("de-DE")}
                      <span style={{ fontSize: "1.1rem" }}>{revSpoon.emoji}</span>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          color: "var(--c-gold)",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {revSpoon.labelShort}
                      </span>
                    </summary>
                    <div style={{ marginTop: 22 }}>
                      <ReviewContent review={rev} />
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        )}

        {/* Comments ornament */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            margin: "40px 0 56px",
          }}
        >
          <div style={{ flex: 1, height: 1, background: "var(--c-n100)" }} />
          <div
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "var(--c-gold)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-cormorant)",
              fontSize: "0.875rem",
              fontStyle: "italic",
              color: "var(--c-n400)",
              whiteSpace: "nowrap",
              letterSpacing: "0.04em",
            }}
          >
            Leser-Erfahrungen
          </span>
          <div
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "var(--c-gold)",
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, height: 1, background: "var(--c-n100)" }} />
        </div>

        {/* ── COMMENTS ──────────────────────────────────── */}
        <section aria-label="Kommentare">
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 28,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 20, flexWrap: "wrap" }}>
              <h2
                style={{
                  fontFamily: "var(--font-cormorant)",
                  fontSize: "2rem",
                  fontWeight: 500,
                  color: "var(--c-ink)",
                }}
              >
                Leser-Erfahrungen
              </h2>
              <StarRating average={averageRating} />
            </div>
            <span style={{ fontSize: "0.8125rem", color: "var(--c-n400)" }}>
              {restaurant.comments.length}{" "}
              {restaurant.comments.length === 1 ? "Rezension" : "Rezensionen"}
            </span>
          </div>

          {/* Comment form or login prompt */}
          {user ? (
            <CommentForm restaurantId={restaurant.id} />
          ) : (
            <div
              style={{
                border: "1px solid var(--c-n100)",
                borderRadius: 14,
                padding: "40px 36px",
                textAlign: "center",
                marginBottom: 44,
                background: "var(--c-surface)",
                boxShadow: "var(--s-sm)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16, opacity: 0.6, color: "var(--c-n400)" }}>
                <IconEmptyState size={32} />
              </div>
              <div
                style={{
                  fontFamily: "var(--font-cormorant)",
                  fontSize: "1.5rem",
                  fontWeight: 500,
                  color: "var(--c-ink)",
                  marginBottom: 10,
                }}
              >
                Teile deine Erfahrung
              </div>
              <p
                style={{
                  fontSize: "0.9375rem",
                  color: "var(--c-n500)",
                  lineHeight: 1.65,
                  maxWidth: 340,
                  margin: "0 auto 28px",
                }}
              >
                Melde dich an, um eine Rezension zu hinterlassen.
              </p>
              <Link
                href="/login"
                style={{
                  display: "inline-block",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  padding: "10px 24px",
                  borderRadius: 8,
                  border: "1.5px solid var(--c-burg)",
                  background: "transparent",
                  color: "var(--c-burg)",
                }}
              >
                Anmelden
              </Link>
            </div>
          )}

          {/* Comment list */}
          <div>
            {restaurant.comments.length === 0 && (
              <p
                style={{
                  fontSize: "0.9375rem",
                  color: "var(--c-n400)",
                  padding: "24px 0",
                }}
              >
                Noch keine Rezensionen.
              </p>
            )}

            {restaurant.comments.map((comment) => {
              const isOwner = user?.id === comment.user_id;
              const initials = (comment.profiles?.username ?? "?")
                .slice(0, 2)
                .toUpperCase();

              return (
                <div
                  key={comment.id}
                  style={{
                    display: "flex",
                    gap: 16,
                    padding: "26px 0",
                    borderBottom: "1px solid var(--c-n100)",
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "var(--c-ink)",
                      color: "var(--c-bg)",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>

                  {/* Body */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 6,
                        gap: 12,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.9375rem",
                          fontWeight: 500,
                          color: "var(--c-ink)",
                        }}
                      >
                        {comment.profiles?.username ?? "Anonym"}
                      </span>
                      {isOwner && (
                        <DeleteCommentButton commentId={comment.id} restaurantId={restaurant.id} />
                      )}
                    </div>

                    {comment.secondary_rating != null && (
                      <div style={{ display: "flex", gap: 2, marginBottom: 12 }}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: "1rem",
                              color:
                                i <= comment.secondary_rating!
                                  ? "var(--c-gold)"
                                  : "var(--c-n200)",
                              lineHeight: 1,
                            }}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    )}

                    <p
                      style={{
                        fontSize: "0.9375rem",
                        lineHeight: 1.70,
                        color: "var(--c-ink)",
                      }}
                    >
                      {comment.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div style={{ height: 80 }} />
      </div>
    </>
  );
}
