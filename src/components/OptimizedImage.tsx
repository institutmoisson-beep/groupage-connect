import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

type OptimizedImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "loading"> & {
  src: string | null | undefined;
  alt: string;
  /** true uniquement pour l'image principale visible d'entrée (LCP). */
  priority?: boolean;
  /** ratio CSS pour éviter tout décalage de mise en page (CLS). */
  aspect?: string;
  fallback?: React.ReactNode;
};

/**
 * Image optimisée : chargement paresseux natif, décodage asynchrone,
 * squelette pendant le chargement et ratio fixe pour éviter les sauts de layout.
 */
export function OptimizedImage({
  src,
  alt,
  priority = false,
  aspect,
  className,
  fallback,
  ...rest
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Une image déjà en cache peut finir de charger avant l'hydratation :
  // on lit alors `complete` sur le noeud pour éviter une image invisible.
  const attachRef = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete) {
      if (node.naturalWidth > 0) setLoaded(true);
      else setFailed(true);
    }
  }, []);


  if (!src || failed) {
    return (
      <div
        className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}
        style={aspect ? { aspectRatio: aspect } : undefined}
      >
        {fallback ?? <span className="text-xs">Image indisponible</span>}
      </div>
    );
  }

  return (
    <div
      className={cn("relative overflow-hidden bg-muted", className)}
      style={aspect ? { aspectRatio: aspect } : undefined}
    >
      {!loaded && <div className="absolute inset-0 animate-pulse bg-muted" />}
      <img
        {...rest}
        ref={attachRef}
        src={src}

        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "low"}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
