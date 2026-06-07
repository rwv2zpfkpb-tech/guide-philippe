"use server";

import { requireAdmin } from "@/utils/supabase/auth-helpers";
import { createAdminClient } from "@/utils/supabase/admin";

const BUCKET = "restaurant-images";

// ── Upload a restaurant image ─────────────────────────────────────────────────
// Accepts a FormData object with a "file" field (from an <input type="file">).
// Returns the public CDN URL.
//
// Usage in a Server Action or Route Handler:
//   const url = await uploadRestaurantImage(formData)
//   await updateRestaurant(id, { image_url: url })
export async function uploadRestaurantImage(
  formData: FormData
): Promise<string> {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No file provided");
  }

  const ext      = file.name.split(".").pop() ?? "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(filename, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { data } = admin.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

// ── Delete a restaurant image ─────────────────────────────────────────────────
// Pass the full public URL that was previously returned by uploadRestaurantImage.
export async function deleteRestaurantImage(publicUrl: string): Promise<void> {
  await requireAdmin();

  const url        = new URL(publicUrl);
  // URL path is like: /storage/v1/object/public/<bucket>/<filename>
  const pathParts  = url.pathname.split("/");
  const filename   = pathParts.slice(pathParts.indexOf(BUCKET) + 1).join("/");

  const admin = createAdminClient();

  const { error } = await admin.storage.from(BUCKET).remove([filename]);
  if (error) throw new Error(error.message);
}
