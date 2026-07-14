import { notFound } from "next/navigation";
import Link from "next/link";
import { getRestaurantById } from "@/app/actions/restaurants";
import { getPlaceDetails } from "@/app/actions/places";
import { deleteComment } from "@/app/actions/comments";
import { createClient } from "@/utils/supabase/server";
import { SPOON_RATINGS } from "@/lib/ratings";
import { PriceLevelDots } from "@/components/PriceLevelDots";
import CommentForm from "./CommentForm";

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

  const placeDetails = restaurant.google_place_id
    ? await getPlaceDetails(restaurant.google_place_id).catch(() => null)
    : null;

  const spoon = SPOON_RATINGS[restaurant.spoon_rating];
  const firstPhoto = placeDetails?.photoUris?.[0] ?? null;

  return (
    <>
      {/* ── BACK / BREADCRUMB ───────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 40px 0" }}>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "var(--c-n500)",
            border: "1px solid var(--c-n200)",
            borderRadius: 9999,
            padding: "6px 16px 6px 12px",
            background: "white",
            boxShadow: "var(--s-sm)",
          }}
        >
          ← Alle Restaurants
        </Link>
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

          {/* Additional photos strip */}
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
              {placeDetails.photoUris.slice(1, 4).map((uri, i) => (
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
            {restaurant.cuisine && (
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "var(--c-gold)",
                  marginBottom: 10,
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
              {placeDetails?.formattedAddress && (
                <>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: "var(--c-n400)",
                    }}
                  >
                    📍
                  </span>
                  <span>{placeDetails.formattedAddress}</span>
                  <span style={{ color: "var(--c-n300)" }}>·</span>
                </>
              )}
              {restaurant.price_level != null && (
                <>
                  <span style={{ fontFamily: "var(--font-cormorant)", fontSize: "1rem", fontWeight: 500 }}>
                    <PriceLevelDots level={restaurant.price_level} />
                  </span>
                  <span style={{ color: "var(--c-n300)" }}>·</span>
                </>
              )}
              {placeDetails?.regularOpeningHours && (
                <span
                  style={{
                    color: placeDetails.regularOpeningHours.openNow
                      ? "oklch(45% 0.12 145)"
                      : "oklch(45% 0.12 25)",
                  }}
                >
                  {placeDetails.regularOpeningHours.openNow ? "Jetzt geöffnet" : "Geschlossen"}
                </span>
              )}
            </div>
          </div>

          {/* Right: spoon verdict */}
          <div
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
                background: "var(--c-burg-light)",
                border: "1px solid oklch(83% 0.030 17)",
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
              <div style={{ display: "flex", gap: 7 }}>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background:
                        i <= restaurant.spoon_rating
                          ? "var(--c-gold)"
                          : "var(--c-n200)",
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--c-gold)",
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
        {/* Opening hours detail */}
        {placeDetails?.regularOpeningHours?.weekdayDescriptions && (
          <div style={{ padding: "40px 0 0" }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--c-n400)",
                marginBottom: 14,
              }}
            >
              Öffnungszeiten
            </div>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {placeDetails.regularOpeningHours.weekdayDescriptions.map((d, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--c-n600)",
                    padding: "4px 0",
                    borderBottom: "1px solid var(--c-n100)",
                  }}
                >
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Editorial review */}
        {restaurant.official_review && (
          <article style={{ padding: "64px 0 56px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 22,
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

            <div
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: "clamp(1.75rem, 3vw, 2.625rem)",
                fontWeight: 500,
                lineHeight: 1.08,
                letterSpacing: "-0.01em",
                color: "var(--c-ink)",
                marginBottom: 32,
              }}
            >
              {restaurant.official_review.split(".")[0]}.
            </div>

            <p
              style={{
                fontSize: "1.0625rem",
                lineHeight: 1.78,
                color: "var(--c-ink)",
              }}
            >
              {restaurant.official_review}
            </p>
          </article>
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
            Reader Experiences
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
              marginBottom: 28,
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: "2rem",
                fontWeight: 500,
                color: "var(--c-ink)",
              }}
            >
              Reader Experiences
            </h2>
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
                background: "white",
                boxShadow: "var(--s-sm)",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: 16, opacity: 0.6 }}>🍴</div>
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
              const deleteAction = deleteComment.bind(null, comment.id, restaurant.id);
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
                        <form action={deleteAction} style={{ display: "inline" }}>
                          <button
                            type="submit"
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--c-n400)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              letterSpacing: "0.04em",
                            }}
                          >
                            Löschen
                          </button>
                        </form>
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
