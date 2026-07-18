import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "direct-messages-media";

/**
 * Upload d'une image de la messagerie personnelle admin <-> client, compressée
 * côté client (max 1600px / ~800KB) avant envoi.
 */
export async function uploadDirectMessageImage(file: File, channelUserId: string): Promise<string> {
  let toUpload: Blob = file;
  let ext = (file.name.split(".").pop() || "bin").toLowerCase();
  let contentType = file.type || "application/octet-stream";
  try {
    if (
      file.type.startsWith("image/") &&
      file.type !== "image/heic" &&
      file.type !== "image/heif"
    ) {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1600,
        useWebWorker: false,
        fileType: "image/webp",
        initialQuality: 0.85,
      });
      toUpload = compressed;
      ext = "webp";
      contentType = "image/webp";
    }
  } catch (e) {
    console.warn("Compression de l'image échouée, envoi de l'original", e);
  }
  return uploadDirectMessageBlob(toUpload, channelUserId, ext, contentType);
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
  const path = `${channelUserId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType, upsert: false });
  if (error) throw new Error(error.message || "Échec de l'envoi du fichier");
  const { data, error: sErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  if (sErr || !data) throw sErr ?? new Error("Signed URL failed");
  return data.signedUrl;
}
