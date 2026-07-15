import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "payment-proofs";

export type UploadedProof = { url: string; path: string };

export async function uploadPaymentProof(file: File, userId: string): Promise<UploadedProof> {
  // Try to compress to webp; if the browser/format refuses, fall back to the original file.
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
    console.warn("Image compression failed, uploading original", e);
  }
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, toUpload, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(error.message || "Upload échoué");
  const { data, error: sErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  if (sErr || !data) throw sErr ?? new Error("Signed URL failed");
  return { url: data.signedUrl, path };
}

/** Force a real file download in the file manager (works cross-origin via blob). */
export async function downloadFile(url: string, filename: string) {
  const res = await fetch(url, { mode: "cors" });
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
}
