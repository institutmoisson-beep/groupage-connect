import imageCompression from "browser-image-compression";

/**
 * Pipeline unique d'optimisation des images avant upload.
 *
 * Objectif : aucune image lourde ne doit entrer dans le stockage.
 * - redimensionnement au format cible (presets)
 * - conversion WebP (2 à 5x plus léger que JPEG/PNG)
 * - compression itérative jusqu'à la taille cible
 * - en-têtes de cache immuables (1 an) pour un service CDN
 */

export type ImagePreset = "thumbnail" | "standard" | "hd" | "document";

type PresetConfig = { maxSizeMB: number; maxWidthOrHeight: number; quality: number };

const PRESETS: Record<ImagePreset, PresetConfig> = {
  thumbnail: { maxSizeMB: 0.08, maxWidthOrHeight: 480, quality: 0.72 },
  standard: { maxSizeMB: 0.35, maxWidthOrHeight: 1280, quality: 0.8 },
  hd: { maxSizeMB: 0.9, maxWidthOrHeight: 1920, quality: 0.86 },
  document: { maxSizeMB: 0.6, maxWidthOrHeight: 1600, quality: 0.84 },
};

/** Cache immuable d'un an : le nom de fichier est un UUID, le contenu ne change jamais. */
export const IMMUTABLE_CACHE_CONTROL = "31536000";

export type OptimizedMedia = {
  blob: Blob;
  ext: string;
  contentType: string;
  /** Taille finale en octets. */
  size: number;
  /** Taille d'origine en octets (pour affichage du gain). */
  originalSize: number;
};

function isOptimizableImage(file: File | Blob): boolean {
  const type = (file as File).type || "";
  if (!type.startsWith("image/")) return false;
  // HEIC/HEIF et SVG ne passent pas par le canvas de façon fiable.
  return !["image/heic", "image/heif", "image/svg+xml", "image/gif"].includes(type);
}

/**
 * Optimise une image côté client. Ne jette jamais : en cas d'échec (format exotique,
 * navigateur ancien), le fichier d'origine est renvoyé tel quel.
 */
export async function optimizeImage(
  file: File,
  preset: ImagePreset = "standard",
): Promise<OptimizedMedia> {
  const original = { size: file.size };
  const fallbackExt = (file.name.split(".").pop() || "bin").toLowerCase();
  const fallback: OptimizedMedia = {
    blob: file,
    ext: fallbackExt,
    contentType: file.type || "application/octet-stream",
    size: file.size,
    originalSize: original.size,
  };

  if (!isOptimizableImage(file)) return fallback;

  const cfg = PRESETS[preset];
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: cfg.maxSizeMB,
      maxWidthOrHeight: cfg.maxWidthOrHeight,
      useWebWorker: true,
      fileType: "image/webp",
      initialQuality: cfg.quality,
    });
    // Si la « compression » a grossi le fichier (petites images déjà optimisées), on garde l'original.
    if (compressed.size >= file.size && file.type === "image/webp") return fallback;
    return {
      blob: compressed,
      ext: "webp",
      contentType: "image/webp",
      size: compressed.size,
      originalSize: original.size,
    };
  } catch (e) {
    console.warn("[media-optimizer] optimisation impossible, envoi de l'original", e);
    return fallback;
  }
}

/** Optimise plusieurs images en parallèle (limité pour ne pas saturer le mobile). */
export async function optimizeImages(
  files: File[],
  preset: ImagePreset = "standard",
  concurrency = 3,
): Promise<OptimizedMedia[]> {
  const out: OptimizedMedia[] = [];
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    out.push(...(await Promise.all(batch.map((f) => optimizeImage(f, preset)))));
  }
  return out;
}

/** Chemin de stockage unique et cache-friendly. */
export function buildMediaPath(prefix: string, ext: string): string {
  return `${prefix.replace(/\/+$/, "")}/${crypto.randomUUID()}.${ext}`;
}

/** Lisible pour l'utilisateur : "1,4 Mo → 180 Ko (-87 %)". */
export function describeSaving(media: OptimizedMedia): string {
  const fmt = (b: number) => (b > 1024 * 1024 ? `${(b / 1048576).toFixed(1)} Mo` : `${Math.round(b / 1024)} Ko`);
  const gain = media.originalSize > 0 ? Math.round((1 - media.size / media.originalSize) * 100) : 0;
  return `${fmt(media.originalSize)} → ${fmt(media.size)}${gain > 0 ? ` (-${gain} %)` : ""}`;
}
