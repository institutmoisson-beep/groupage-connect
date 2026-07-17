import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "sourcing-chat-images";

/**
 * Uploads a chat image for a sourcing request, automatically compressed
 * client-side (max 1600px / ~800KB) before upload so conversations stay
 * fast to load even with many photos in the history.
 */
export async function uploadSourcingChatImage(file: File, sourcingOrderId: string): Promise<string> {
  let toUpload: Blob = file;
  let ext = (file.name.split(".").pop() || "bin").toLowerCase();
  let contentType = file.type || "application/octet-stream";
  try {
    if (file.type.startsWith("image/") && file.type !== "image/heic" && file.type !== "image/heif") {
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
    console.warn("Chat image compression failed, uploading original", e);
  }
  const path = `${sourcingOrderId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, toUpload, { contentType, upsert: false });
  if (error) throw new Error(error.message || "Échec de l'envoi de l'image");
  const { data, error: sErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  if (sErr || !data) throw sErr ?? new Error("Signed URL failed");
  return data.signedUrl;
}
