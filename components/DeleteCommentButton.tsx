"use client";

import { useFormStatus } from "react-dom";
import { deleteComment } from "@/app/actions/comments";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        fontSize: "0.75rem",
        color: "var(--c-n400)",
        background: "none",
        border: "none",
        cursor: pending ? "default" : "pointer",
        letterSpacing: "0.04em",
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? "Löscht…" : "Löschen"}
    </button>
  );
}

// Wraps the inline delete form in its own client component so useFormStatus
// can report the in-flight state — the surrounding restaurant page stays a
// Server Component, but without this the button gave no feedback at all
// during the round trip.
export function DeleteCommentButton({
  commentId,
  restaurantId,
}: {
  commentId: string;
  restaurantId: string;
}) {
  const deleteAction = deleteComment.bind(null, commentId, restaurantId);
  return (
    <form action={deleteAction} style={{ display: "inline" }}>
      <SubmitButton />
    </form>
  );
}
