import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "product-images";
// Long-lived signed URL (~10 years) — bucket is private and workspace blocks public buckets.
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

export type UploadedImage = { url: string; path: string };

export async function compressAndUploadImage(
  file: File,
  opts: { prefix?: string; maxSizeMB?: number; maxWidthOrHeight?: number } = {},
): Promise<UploadedImage> {
  const { prefix = "products", maxSizeMB = 0.5, maxWidthOrHeight = 1600 } = opts;

  const compressed = await imageCompression(file, {
    maxSizeMB,
    maxWidthOrHeight,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.82,
  });

  const ext = "webp";
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, compressed, {
      cacheControl: "31536000",
      contentType: "image/webp",
      upsert: false,
    });
  if (upErr) throw upErr;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data) throw error ?? new Error("Signed URL failed");

  return { url: data.signedUrl, path };
}
