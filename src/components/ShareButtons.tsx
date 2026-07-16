import { toast } from "sonner";
import { MessageCircle, Facebook, Share2, Copy } from "lucide-react";

export function ShareButtons({
  url,
  title,
  text,
  compact,
}: {
  url: string;
  title: string;
  text: string;
  compact?: boolean;
}) {
  const shareText = `${text}\n${url}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // user cancelled or unsupported — fall through to copy
      }
    }
    navigator.clipboard.writeText(shareText).then(
      () => toast.success("Lien copié — collez-le où vous voulez partager"),
      () => toast.error("Copie impossible"),
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="grid h-8 w-8 place-items-center rounded-lg bg-[#25D366]/15 text-[#25D366]"
          aria-label="Partager sur WhatsApp"
        >
          <MessageCircle className="h-4 w-4" />
        </a>
        <a
          href={facebookUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="grid h-8 w-8 place-items-center rounded-lg bg-[#1877F2]/15 text-[#1877F2]"
          aria-label="Partager sur Facebook"
        >
          <Facebook className="h-4 w-4" />
        </a>
        <button
          onClick={(e) => {
            e.stopPropagation();
            nativeShare();
          }}
          className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-muted-foreground"
          aria-label="Partager"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
        className="flex flex-col items-center justify-center gap-1 rounded-xl bg-[#25D366]/10 py-2.5 text-[10px] font-bold text-[#128C4A]"
      >
        <MessageCircle className="h-5 w-5" /> WhatsApp
      </a>
      <a
        href={facebookUrl}
        target="_blank"
        rel="noreferrer"
        className="flex flex-col items-center justify-center gap-1 rounded-xl bg-[#1877F2]/10 py-2.5 text-[10px] font-bold text-[#1877F2]"
      >
        <Facebook className="h-5 w-5" /> Facebook
      </a>
      <button
        onClick={nativeShare}
        className="flex flex-col items-center justify-center gap-1 rounded-xl bg-muted py-2.5 text-[10px] font-bold text-muted-foreground"
      >
        <Share2 className="h-5 w-5" /> Plus
      </button>
    </div>
  );
}
