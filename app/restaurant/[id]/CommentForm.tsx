"use client";

import { useTransition, useRef, useState } from "react";
import { addComment } from "@/app/actions/comments";

const STAR_LABELS: Record<number, string> = {
  1: "Schlecht",
  2: "Unterdurchschnittlich",
  3: "Gut",
  4: "Sehr gut",
  5: "Ausgezeichnet",
};

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
        background: "var(--c-surface)",
        border: "1px solid var(--c-n100)",
        borderRadius: 14,
        padding: 26,
        marginBottom: 44,
        boxShadow: "var(--s-sm)",
      }}
    >
      {/* Star rating (1–5) */}
      <div
        className="comment-rating-row"
        role="group"
        aria-label="Bewertung auswählen"
        style={{
          marginBottom: 16,
        }}
      >
        <div className="comment-stars">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setRating(i)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              aria-pressed={rating === i}
              className="comment-star-button"
              style={{
                fontSize: "1.375rem",
                lineHeight: 1,
                background: "none",
                border: "none",
                color: active !== null && i <= active ? "var(--c-gold)" : "var(--c-n200)",
                width: 44,
                height: 44,
                padding: 0,
                cursor: "pointer",
                transition: "color 0.1s, transform 0.1s",
                transform: active !== null && i <= active ? "scale(1.05)" : "scale(1)",
              }}
              aria-label={i === 1 ? "1 Stern" : `${i} Sterne`}
            >
              ★
            </button>
          ))}
        </div>
        <span
          style={{
            fontSize: "0.75rem",
            color: rating !== null ? "var(--c-gold)" : "var(--c-n400)",
            display: "block",
            marginTop: 4,
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
        className="comment-form-footer"
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
          className="comment-submit"
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
