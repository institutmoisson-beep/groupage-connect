import { useEffect, useState } from "react";
import { X, Share, Plus, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "msn-install-dismissed-at";
const DISMISS_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode() || wasRecentlyDismissed()) return;

    // Android / Chrome / Edge: capture the native install event and show our banner.
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowAndroid(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iPhone / iPad: no native prompt exists — show guided instructions automatically.
    if (isIos()) {
      const t = setTimeout(() => setShowIos(true), 2500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShowAndroid(false);
    setShowIos(false);
  };

  const installAndroid = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setShowAndroid(false);
    } else {
      dismiss();
    }
    setDeferredPrompt(null);
  };

  if (!showAndroid && !showIos) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+4.5rem)]">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <img src="/pwa-192.png" alt="MSN Courtier" className="h-12 w-12 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">Installer MSN Courtier</p>
            {showAndroid ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Accédez à l'app en un clic depuis votre écran d'accueil, même hors ligne.
              </p>
            ) : (
              <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  1. Appuyez sur <Share className="h-3.5 w-3.5 text-primary" /> <span className="font-medium text-foreground">Partager</span> (en bas de Safari)
                </p>
                <p className="flex items-center gap-1.5">
                  2. Choisissez <Plus className="h-3.5 w-3.5 text-primary" /> <span className="font-medium text-foreground">« Sur l'écran d'accueil »</span>
                </p>
                <p>3. Confirmez avec « Ajouter »</p>
              </div>
            )}
          </div>
          <button
            onClick={dismiss}
            aria-label="Fermer"
            className="rounded-full p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {showAndroid && (
          <button
            onClick={installAndroid}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <Download className="h-4 w-4" /> Installer l'application
          </button>
        )}
      </div>
    </div>
  );
}
