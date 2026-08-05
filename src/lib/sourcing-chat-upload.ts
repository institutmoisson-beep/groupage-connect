import { supabase } from "@/integrations/supabase/client";
import { IMMUTABLE_CACHE_CONTROL, buildMediaPath, optimizeImage } from "@/lib/media-optimizer";

const BUCKET = "sourcing-chat-images";

/**
 * Uploads a chat image for a sourcing request, automatically optimized
 * client-side (WebP, 1280px max) before upload so conversations stay
 * fast to load even with many photos in the history.
 */
export async function uploadSourcingChatImage(
  file: File,
  sourcingOrderId: string,
): Promise<string> {
  const media = await optimizeImage(file, "standard");
  const path = buildMediaPath(sourcingOrderId, media.ext);
  const { error } = await supabase.storage.from(BUCKET).upload(path, media.blob, {
    contentType: media.contentType,
    cacheControl: IMMUTABLE_CACHE_CONTROL,
    upsert: false,
  });
  if (error) throw new Error(error.message || "Échec de l'envoi de l'image");
  const { data, error: sErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  if (sErr || !data) throw sErr ?? new Error("Signed URL failed");
  return data.signedUrl;
}
