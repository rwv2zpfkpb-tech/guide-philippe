import Link from "next/link";
import type { Restaurant } from "@/types/database";

const SPOON: Record<number, { emoji: string; label: string }> = {
  0: { emoji: "🫗", label: "Not Recommended" },
  1: { emoji: "🥄", label: "Remembering" },
  2: { emoji: "🍴", label: "Worth Mentioning" },
  3: { emoji: "🍽️", label: "Absolute Recommendation" },
};

function PriceDisplay({ level }: { level: number }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: "0.02em" }}>
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          style={{ color: i <= level ? "var(--c-ink)" : "var(--c-n200)" }}
        >
          €
        </span>
      ))}
    </div>
  );
}

export default function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const spoon = SPOON[restaurant.spoon_rating];

  return (
    <Link
      href={`/restaurant/${restaurant.id}`}
      style={{
        background: "white",
        borderRadius: 14,
        border: "1px solid var(--c-n100)",
        boxShadow: "var(--s-sm)",
        overflow: "hidden",
        display: "block",
        transition: "box-shadow 0.25s var(--ease), transform 0.25s var(--ease), border-top-color 0.25s",
        textDecoration: "none",
      }}
      className="card-hover"
    >
      {/* Image placeholder */}
      <div
        style={{
          width: "100%",
          aspectRatio: "4 / 3",
          position: "relative",
          overflow: "hidden",
          background: `repeating-linear-gradient(
            -45deg,
            var(--c-n100), var(--c-n100) 1px,
            var(--c-n50) 1px, var(--c-n50) 14px
          )`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: 10,
            right: 10,
            background: "white",
            borderRadius: 4,
            padding: "4px 8px",
            fontSize: 15,
            lineHeight: 1,
            boxShadow: "var(--s-sm)",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
          title={spoon.label}
        >
          {spoon.emoji}
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: "14px 16px 18px" }}>
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
            <PriceDisplay level={restaurant.price_level} />
          ) : (
            <span />
          )}
          <div
            style={{
              fontSize: 11,
              color: "var(--c-n400)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 13 }}>{spoon.emoji}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
