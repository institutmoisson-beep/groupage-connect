import { useState } from "react";
import { X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { TERMS_ARTICLES, TERMS_LAST_UPDATE, TERMS_TITLE, TERMS_VERSION } from "@/lib/terms";

interface Props {
  userId: string;
  onAccepted: () => void;
  onClose: () => void;
}

export function TermsDialog({ userId, onAccepted, onClose }: Props) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  async function accept() {
    if (!checked) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          terms_accepted_at: new Date().toISOString(),
          terms_version: TERMS_VERSION,
        })
        .eq("id", userId);
      if (error) throw error;
      toast.success("Conditions acceptées");
      onAccepted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-card shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="font-display text-sm font-bold leading-tight">{TERMS_TITLE}</h2>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                Dernière mise à jour : {TERMS_LAST_UPDATE} · v{TERMS_VERSION}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3 text-sm leading-relaxed">
          {TERMS_ARTICLES.map((a) => (
            <section key={a.title}>
              <h3 className="font-display text-sm font-bold text-primary">{a.title}</h3>
              <p className="mt-1 whitespace-pre-line text-xs text-foreground/90">{a.body}</p>
            </section>
          ))}
        </div>

        <footer className="border-t border-border bg-muted/30 p-4">
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span>
              J'ai lu et j'accepte les <strong>Conditions Générales d'Utilisation et de Vente</strong> de MSN Courtier.
            </span>
          </label>
          <button
            onClick={accept}
            disabled={!checked || saving}
            className="mt-3 w-full rounded-lg bg-gradient-brand py-3 text-sm font-bold text-primary-foreground shadow-brand disabled:opacity-50"
          >
            {saving ? "…" : "Accepter et continuer"}
          </button>
        </footer>
      </div>
    </div>
  );
}
