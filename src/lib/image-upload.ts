import { supabase } from "@/integrations/supabase/client";
import {
  IMMUTABLE_CACHE_CONTROL,
  buildMediaPath,
  optimizeImage,
} from "@/lib/media-optimizer";

const BUCKET = "product-images";
// Long-lived signed URL (~10 years) — bucket is private and workspace blocks public buckets.
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

export type UploadedImage = { url: string; path: string };

export async function compressAndUploadImage(
  file: File,
  opts: { prefix?: string } = {},
): Promise<UploadedImage> {
  const { prefix = "products" } = opts;

  const media = await optimizeImage(file, "standard");
  const path = buildMediaPath(prefix, media.ext);

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, media.blob, {
    cacheControl: IMMUTABLE_CACHE_CONTROL,
    contentType: media.contentType,
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data) throw error ?? new Error("Signed URL failed");

  return { url: data.signedUrl, path };
}
