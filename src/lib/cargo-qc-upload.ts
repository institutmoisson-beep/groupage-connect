import { supabase } from "@/integrations/supabase/client";
import { IMMUTABLE_CACHE_CONTROL, buildMediaPath, optimizeImage } from "@/lib/media-optimizer";

const BUCKET = "cargo-qc-images";

/**
 * Uploads a QC inspection photo for a package. Stored under {ownerUserId}/{packageId}/...
 * so the owning client can read it (RLS checks the first path segment against auth.uid()),
 * while admins can read/write everything in the bucket.
 */
export async function uploadCargoQcImage(
  file: File,
  ownerUserId: string,
  packageId: string,
): Promise<string> {
  const media = await optimizeImage(file, "hd");
  const path = buildMediaPath(`${ownerUserId}/${packageId}`, media.ext);
  const { error } = await supabase.storage.from(BUCKET).upload(path, media.blob, {
    contentType: media.contentType,
    cacheControl: IMMUTABLE_CACHE_CONTROL,
    upsert: false,
  });
  if (error) throw new Error(error.message || "Upload de la photo QC échoué");
  const { data, error: sErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  if (sErr || !data) throw sErr ?? new Error("Signed URL failed");
  return data.signedUrl;
}
