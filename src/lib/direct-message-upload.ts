import { supabase } from "@/integrations/supabase/client";
import { IMMUTABLE_CACHE_CONTROL, buildMediaPath, optimizeImage } from "@/lib/media-optimizer";

const BUCKET = "direct-messages-media";

/**
 * Upload d'une image de la messagerie personnelle admin <-> client, optimisée
 * côté client (WebP, 1280px max) avant envoi.
 */
export async function uploadDirectMessageImage(
  file: File,
  channelUserId: string,
): Promise<string> {
  const media = await optimizeImage(file, "standard");
  return uploadDirectMessageBlob(media.blob, channelUserId, media.ext, media.contentType);
}

/** Upload d'un message vocal enregistré (blob audio) de la messagerie personnelle. */
export async function uploadDirectMessageAudio(blob: Blob, channelUserId: string): Promise<string> {
  const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
  return uploadDirectMessageBlob(blob, channelUserId, ext, blob.type || "audio/webm");
}

async function uploadDirectMessageBlob(
  blob: Blob,
  channelUserId: string,
  ext: string,
  contentType: string,
): Promise<string> {
  const path = buildMediaPath(channelUserId, ext);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType, cacheControl: IMMUTABLE_CACHE_CONTROL, upsert: false });
  if (error) throw new Error(error.message || "Échec de l'envoi du fichier");
  const { data, error: sErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  if (sErr || !data) throw sErr ?? new Error("Signed URL failed");
  return data.signedUrl;
}
