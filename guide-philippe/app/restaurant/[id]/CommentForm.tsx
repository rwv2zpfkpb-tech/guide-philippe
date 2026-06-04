"use client";

import { useTransition, useRef, useState } from "react";
import { addComment } from "@/app/actions/comments";

const STAR_LABELS = ["", "Schlecht", "Unterdurchschnittlich", "Gut", "Sehr gut", "Ausgezeichnet"];

interface CommentFormProps {
  restaurantId: string;
}

export default function CommentForm({ restaurantId }: CommentFormProps) {
  const [isPending, startTransition] = useTransition();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const content = (form.elements.namedItem("content") as HTMLTextAreaElement).value.trim();

    if (!content || !rating) return;

    startTransition(async () => {
      await addComment(restaurantId, content, rating);
      formRef.current?.reset();
      setRating(0);
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
      {/* Star rating */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 3,
          marginBottom: 16,
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setRating(i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            style={{
              fontSize: "1.375rem",
              lineHeight: 1,
              background: "none",
              border: "none",
              color: i <= (hover || rating) ? "var(--c-gold)" : "var(--c-n200)",
              padding: "2px 3px",
              cursor: "pointer",
              transition: "color 0.1s, transform 0.1s",
              transform: i <= (hover || rating) ? "scale(1.05)" : "scale(1)",
            }}
            aria-label={`${i} Sterne`}
          >
            ★
          </button>
        ))}
        <span
          style={{
            fontSize: "0.75rem",
            color: rating ? "var(--c-gold)" : "var(--c-n400)",
            marginLeft: 10,
            letterSpacing: "0.04em",
            transition: "color 0.15s",
          }}
        >
          {rating ? STAR_LABELS[rating] : "Bewertung auswählen"}
        </span>
      </div>

      {/* Text area */}
      <textarea
        name="content"
        required
        rows={4}
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

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginTop: 16,
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
          disabled={isPending || !rating}
          style={{
            fontSize: "0.875rem",
            fontWeight: 500,
            padding: "10px 24px",
            flexShrink: 0,
            borderRadius: 8,
            border: "none",
            background: "var(--c-ink)",
            color: "var(--c-bg)",
            cursor: isPending || !rating ? "default" : "pointer",
            opacity: isPending || !rating ? 0.45 : 1,
            transition: "background 0.2s, transform 0.2s, box-shadow 0.2s",
          }}
        >
          {isPending ? "Speichern…" : "Rezension posten"}
        </button>
      </div>
    </form>
  );
}
