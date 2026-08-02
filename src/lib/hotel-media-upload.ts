import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "hotel-media";

/**
 * Upload une photo d'hôtel/chambre vers le bucket public `hotel-media` et
 * renvoie son URL publique (bucket public, pas besoin d'URL signée).
 */
export async function uploadHotelMedia(file: File, folder: string): Promise<string> {
  let toUpload: Blob = file;
  let ext = (file.name.split(".").pop() || "bin").toLowerCase();
  let contentType = file.type || "application/octet-stream";
  try {
    if (file.type.startsWith("image/") && file.type !== "image/heic" && file.type !== "image/heif") {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1.2,
        maxWidthOrHeight: 2000,
        useWebWorker: false,
        fileType: "image/webp",
        initialQuality: 0.88,
      });
      toUpload = compressed;
      ext = "webp";
      contentType = "image/webp";
    }
  } catch (e) {
    console.warn("Compression image échouée, upload de l'original", e);
  }
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, toUpload, { contentType, upsert: false });
  if (error) throw new Error(error.message || "Échec de l'upload de l'image");
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadHotelMediaMany(files: File[], folder: string): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    urls.push(await uploadHotelMedia(file, folder));
  }
  return urls;
}
