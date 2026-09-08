import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";

type Props = {
  /** Appelé avec le texte brut lu dans le QR code. */
  onResult: (value: string) => void;
  label?: string;
  className?: string;
};

/** Bouton d'ouverture de la caméra pour lire un QR code (voucher ViDa, OTP livraison…).
 *  Utilise l'API native BarcodeDetector si disponible, sinon jsQR en secours. */
export function QrScanButton({ onResult, label = "Scanner", className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-black text-primary"
        }
      >
        <Camera className="h-3.5 w-3.5" /> {label}
      </button>
      {open && (
        <QrScannerOverlay
          onClose={() => setOpen(false)}
          onResult={(v) => {
            setOpen(false);
            onResult(v);
          }}
        />
      )}
    </>
  );
}

function QrScannerOverlay({
  onResult,
  onClose,
}: {
  onResult: (value: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Ouverture de la caméra…");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setStatus("Placez le QR code dans le cadre");

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const AnyWindow = window as unknown as { BarcodeDetector?: any };
        const detector = AnyWindow.BarcodeDetector
          ? new AnyWindow.BarcodeDetector({ formats: ["qr_code"] })
          : null;
        const jsQR = detector ? null : (await import("jsqr")).default;

        const tick = async () => {
          if (stopped) return;
          if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
            try {
              if (detector) {
                const codes = await detector.detect(video);
                if (codes?.[0]?.rawValue) return onResult(String(codes[0].rawValue));
              } else if (jsQR) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const found = jsQR(img.data, img.width, img.height);
                if (found?.data) return onResult(found.data);
              }
            } catch {
              /* on continue à scanner */
            }
          }
          raf = requestAnimationFrame(() => void tick());
        };
        void tick();
      } catch {
        setStatus("Caméra indisponible — autorisez l'accès puis réessayez.");
        toast.error("Impossible d'ouvrir la caméra.");
      }
    }
    void start();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 p-4">
      <button
        onClick={onClose}
        className="self-end rounded-full bg-white/15 p-2 text-white"
        aria-label="Fermer le scanner"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="mx-auto mt-6 w-full max-w-sm overflow-hidden rounded-2xl border-2 border-white/40">
        <video ref={videoRef} playsInline muted className="h-72 w-full bg-black object-cover" />
      </div>
      <p className="mt-4 text-center text-xs font-semibold text-white/80">{status}</p>
    </div>
  );
}

/** Extrait un code exploitable d'un QR ViDa (JSON) ou d'un texte brut. */
export function parseVidaQr(raw: string): { code?: string; otp?: string } {
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") {
      return { code: obj.code ? String(obj.code) : undefined, otp: obj.otp ? String(obj.otp) : undefined };
    }
  } catch {
    /* texte brut */
  }
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (/^\d{6}$/.test(digits) && trimmed.length <= 8) return { otp: digits };
  return { code: trimmed };
}
