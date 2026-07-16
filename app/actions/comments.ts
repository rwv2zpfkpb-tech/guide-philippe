"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireApproved, requireAdmin } from "@/utils/supabase/auth-helpers";
import { createClient } from "@/utils/supabase/server";
import type { Comment } from "@/types/database";

// ── Add a comment (authenticated users only) ──────────────────────────────────

export async function addComment(
  restaurantId: string,
  content: string,
  secondaryRating: number // 0–5
): Promise<Comment> {
  const { user } = await requireApproved();

  const trimmed = content.trim();
  if (!trimmed) throw new Error("Comment content cannot be empty");
  if (trimmed.length > 150) throw new Error("Comment content must be 150 characters or fewer");
  if (secondaryRating < 0 || secondaryRating > 5) {
    throw new Error("Secondary rating must be between 0 and 5");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("comments")
    .insert({
      restaurant_id: restaurantId,
      user_id: user.id,
      content: trimmed,
      secondary_rating: secondaryRating,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/restaurant/${restaurantId}`);
  return data;
}

// ── Update own comment ────────────────────────────────────────────────────────

export async function updateComment(
  commentId: string,
  restaurantId: string,
  content: string,
  secondaryRating: number
): Promise<Comment> {
  await requireAuth();

  const trimmed = content.trim();
  if (!trimmed) throw new Error("Comment content cannot be empty");
  if (trimmed.length > 150) throw new Error("Comment content must be 150 characters or fewer");
  if (secondaryRating < 0 || secondaryRating > 5) {
    throw new Error("Secondary rating must be between 0 and 5");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("comments")
    .update({ content: trimmed, secondary_rating: secondaryRating })
    .eq("id", commentId)
    .select()
    .single();

  // RLS will reject the update if the caller doesn't own the comment.
  if (error) throw new Error(error.message);

  revalidatePath(`/restaurant/${restaurantId}`);
  return data;
}

// ── Delete own comment (or any comment if admin) ──────────────────────────────

export async function deleteComment(
  commentId: string,
  restaurantId: string
): Promise<void> {
  await requireAuth();

  const supabase = await createClient();

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);

  // RLS enforces that only the owner or an admin may delete.
  if (error) throw new Error(error.message);

  revalidatePath(`/restaurant/${restaurantId}`);
}

// ── Admin: delete any comment ─────────────────────────────────────────────────

export async function adminDeleteComment(
  commentId: string,
  restaurantId: string
): Promise<void> {
  await requireAdmin();

  const supabase = await createClient();

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);

  if (error) throw new Error(error.message);

  revalidatePath(`/restaurant/${restaurantId}`);
}
