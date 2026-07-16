"use client";

import { useTransition, useRef, useState } from "react";
import { addComment } from "@/app/actions/comments";

const STAR_LABELS = [
  "Nicht empfehlenswert",
  "Schlecht",
  "Unterdurchschnittlich",
  "Gut",
  "Sehr gut",
  "Ausgezeichnet",
];

const MAX_LENGTH = 150;

interface CommentFormProps {
  restaurantId: string;
}

export default function CommentForm({ restaurantId }: CommentFormProps) {
  const [isPending, startTransition] = useTransition();
  const [rating, setRating] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const active = hover ?? rating;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || rating === null) return;

    startTransition(async () => {
      await addComment(restaurantId, trimmed, rating);
      formRef.current?.reset();
      setContent("");
      setRating(null);
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      style={{
        background: "white",
        border: "1px solid var(--c-n100)",
        borderRadius: 14,
        padding: 26,
        marginBottom: 44,
        boxShadow: "var(--s-sm)",
      }}
    >
      {/* Star rating (0–5) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 3,
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          onClick={() => setRating(0)}
          onMouseEnter={() => setHover(0)}
          onMouseLeave={() => setHover(null)}
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            lineHeight: 1,
            background: "none",
            border: `1.5px solid ${active === 0 ? "var(--c-gold)" : "var(--c-n200)"}`,
            color: active === 0 ? "var(--c-gold)" : "var(--c-n400)",
            borderRadius: "50%",
            width: 22,
            height: 22,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            cursor: "pointer",
            marginRight: 5,
            transition: "color 0.1s, border-color 0.1s, transform 0.1s",
            transform: active === 0 ? "scale(1.05)" : "scale(1)",
          }}
          aria-label="0 Sterne – nicht empfehlenswert"
        >
          0
        </button>

        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setRating(i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{
              fontSize: "1.375rem",
              lineHeight: 1,
              background: "none",
              border: "none",
              color: active !== null && i <= active ? "var(--c-gold)" : "var(--c-n200)",
              padding: "2px 3px",
              cursor: "pointer",
              transition: "color 0.1s, transform 0.1s",
              transform: active !== null && i <= active ? "scale(1.05)" : "scale(1)",
            }}
            aria-label={`${i} Sterne`}
          >
            ★
          </button>
        ))}
        <span
          style={{
            fontSize: "0.75rem",
            color: rating !== null ? "var(--c-gold)" : "var(--c-n400)",
            marginLeft: 10,
            letterSpacing: "0.04em",
            transition: "color 0.15s",
          }}
        >
          {rating !== null ? STAR_LABELS[rating] : "Bewertung auswählen"}
        </span>
      </div>

      {/* Text area */}
      <textarea
        name="content"
        required
        rows={4}
        maxLength={MAX_LENGTH}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Teile deine Erfahrung — was ist aufgefallen, was hat überrascht, was würdest du einem Freund sagen…"
        style={{
          width: "100%",
          fontFamily: "inherit",
          fontSize: "0.9375rem",
          lineHeight: 1.65,
          padding: "14px 16px",
          border: "1px solid var(--c-n200)",
          borderRadius: 8,
          background: "var(--c-bg)",
          color: "var(--c-ink)",
          outline: "none",
          resize: "vertical",
          minHeight: 112,
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "var(--c-gold)";
          e.target.style.boxShadow = "var(--s-focus)";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "var(--c-n200)";
          e.target.style.boxShadow = "none";
        }}
      />
      <p
        style={{
          marginTop: 6,
          textAlign: "right",
          fontSize: "0.6875rem",
          color: "var(--c-n400)",
        }}
      >
        {content.length}/{MAX_LENGTH}
      </p>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginTop: 10,
        }}
      >
        <span
          style={{
            fontSize: "0.75rem",
            color: "var(--c-n400)",
            lineHeight: 1.5,
            flex: 1,
          }}
        >
          Deine Bewertung ist unabhängig vom offiziellen{" "}
          <em style={{ fontStyle: "normal", color: "var(--c-gold)" }}>Spoon-Score</em>.
        </span>
        <button
          type="submit"
          disabled={isPending || rating === null}
          style={{
            fontSize: "0.875rem",
            fontWeight: 500,
            padding: "10px 24px",
            flexShrink: 0,
            borderRadius: 8,
            border: "none",
            background: "var(--c-ink)",
            color: "var(--c-bg)",
            cursor: isPending || rating === null ? "default" : "pointer",
            opacity: isPending || rating === null ? 0.45 : 1,
            transition: "background 0.2s, transform 0.2s, box-shadow 0.2s",
          }}
        >
          {isPending ? "Speichern…" : "Rezension posten"}
        </button>
      </div>
    </form>
  );
}
