import { supabase } from "@/integrations/supabase/client";
import {
  IMMUTABLE_CACHE_CONTROL,
  buildMediaPath,
  optimizeImage,
} from "@/lib/media-optimizer";

const BUCKET = "hotel-media";

/**
 * Upload une photo d'hôtel/chambre vers le bucket public `hotel-media` et
 * renvoie son URL publique (bucket public, pas besoin d'URL signée).
 */
export async function uploadHotelMedia(file: File, folder: string): Promise<string> {
  const media = await optimizeImage(file, "hd");
  const path = buildMediaPath(folder, media.ext);
  const { error } = await supabase.storage.from(BUCKET).upload(path, media.blob, {
    contentType: media.contentType,
    cacheControl: IMMUTABLE_CACHE_CONTROL,
    upsert: false,
  });
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
