import { supabase } from "@/integrations/supabase/client";
import { IMMUTABLE_CACHE_CONTROL, buildMediaPath, optimizeImage } from "@/lib/media-optimizer";

const BUCKET = "payment-proofs";

export type UploadedProof = { url: string; path: string };

export async function uploadPaymentProof(file: File, userId: string): Promise<UploadedProof> {
  const media = await optimizeImage(file, "document");
  const path = buildMediaPath(userId, media.ext);
  const { error } = await supabase.storage.from(BUCKET).upload(path, media.blob, {
    contentType: media.contentType,
    cacheControl: IMMUTABLE_CACHE_CONTROL,
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
