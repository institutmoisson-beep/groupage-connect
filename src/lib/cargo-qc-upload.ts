import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "cargo-qc-images";

/**
 * Uploads a QC inspection photo for a package. Stored under {ownerUserId}/{packageId}/...
 * so the owning client can read it (RLS checks the first path segment against auth.uid()),
 * while admins can read/write everything in the bucket.
 */
export async function uploadCargoQcImage(file: File, ownerUserId: string, packageId: string): Promise<string> {
  let toUpload: Blob = file;
  let ext = (file.name.split(".").pop() || "bin").toLowerCase();
  let contentType = file.type || "application/octet-stream";
  try {
    if (file.type.startsWith("image/") && file.type !== "image/heic" && file.type !== "image/heif") {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: false,
        fileType: "image/webp",
        initialQuality: 0.88,
      });
      toUpload = compressed;
      ext = "webp";
      contentType = "image/webp";
    }
  } catch (e) {
    console.warn("QC image compression failed, uploading original", e);
  }
  const path = `${ownerUserId}/${packageId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, toUpload, { contentType, upsert: false });
  if (error) throw new Error(error.message || "Upload de la photo QC échoué");
  const { data, error: sErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  if (sErr || !data) throw sErr ?? new Error("Signed URL failed");
  return data.signedUrl;
                             }
