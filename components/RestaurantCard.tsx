import Link from "next/link";
import type { Restaurant } from "@/types/database";
import { SPOON_RATINGS, SPOON_RATING_COLORS } from "@/lib/ratings";
import { PriceLevelDots } from "@/components/PriceLevelDots";

// No image — restaurant photos are only shown on the detail page (live from
// Google Places). Cards here are text-first; the top accent bar + label
// color-code the spoon rating tier (SPOON_RATING_COLORS) instead.
export default function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const spoon = SPOON_RATINGS[restaurant.spoon_rating];
  const colors = SPOON_RATING_COLORS[restaurant.spoon_rating];

  return (
    <Link
      href={`/restaurant/${restaurant.id}`}
      style={{
        background: "var(--c-surface)",
        borderRadius: 14,
        border: "1px solid var(--c-n100)",
        borderTop: `3px solid ${colors.border}`,
        boxShadow: "var(--s-sm)",
        overflow: "hidden",
        display: "block",
        transition: "box-shadow 0.25s var(--ease), transform 0.25s var(--ease)",
        textDecoration: "none",
      }}
      className="card-hover"
    >
      <div style={{ padding: "16px 16px 14px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-cormorant)",
              fontSize: "1.175rem",
              fontWeight: 600,
              lineHeight: 1.2,
              color: "var(--c-ink)",
              marginBottom: 4,
            }}
          >
            {restaurant.name}
          </div>
          <span style={{ fontSize: "1.3rem", lineHeight: 1, flexShrink: 0 }} title={spoon.label}>
            {spoon.emoji}
          </span>
        </div>

        {/* Nur sichtbar, wenn ein Admin den "Entwürfe in der Suche zeigen"-
            Toggle aktiviert hat (s. app/actions/restaurants.ts) — sonst
            würden normale Nutzer diese Karten ohnehin nie zu sehen bekommen. */}
        {restaurant.status === "draft" && (
          <div
            style={{
              display: "inline-block",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--c-gold)",
              background: "var(--c-gold-light)",
              borderRadius: 4,
              padding: "2px 6px",
              marginBottom: 8,
            }}
          >
            Entwurf
          </div>
        )}

        {restaurant.cuisine && (
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.13em",
              textTransform: "uppercase",
              color: "var(--c-gold)",
              marginBottom: 14,
            }}
          >
            {restaurant.cuisine}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 12,
            borderTop: "1px solid var(--c-n100)",
          }}
        >
          {restaurant.price_level != null ? (
            <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: "0.02em" }}>
              <PriceLevelDots level={restaurant.price_level} />
            </div>
          ) : (
            <span />
          )}
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: colors.text,
            }}
          >
            {spoon.labelShort}
          </span>
        </div>
      </div>
    </Link>
  );
}
