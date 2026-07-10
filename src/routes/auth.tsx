import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Ship } from "lucide-react";

const searchSchema = z.object({
  ref: z.string().optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Connexion — MSN Courtier" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { ref, redirect } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [referral, setReferral] = useState(ref ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirect ?? "/", replace: true } as never);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName,
              phone,
              referral_code: referral || null,
            },
          },
        });
        if (error) throw error;
        toast.success("Compte créé ! Bienvenue.");
        navigate({ to: redirect ?? "/", replace: true } as never);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Connexion réussie");
        navigate({ to: redirect ?? "/", replace: true } as never);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <div className="relative overflow-hidden bg-gradient-brand p-6 pb-10 text-primary-foreground">
        <Link to="/" className="mb-4 inline-flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/15 backdrop-blur">
            <Ship className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">MSN Courtier</span>
        </Link>
        <h1 className="font-display text-2xl font-black leading-tight">
          {mode === "signup" ? "Rejoignez le réseau" : "Bon retour"}
        </h1>
        <p className="mt-1 text-sm opacity-90">
          {mode === "signup"
            ? "Achats groupés, prix en gros, réseau MLM."
            : "Connectez-vous pour commander."}
        </p>
      </div>

      <form
        onSubmit={submit}
        className="-mt-6 mx-3 rounded-2xl bg-card p-5 shadow-card space-y-3"
      >
        {mode === "signup" && (
          <>
            <Field label="Nom complet" value={fullName} onChange={setFullName} required />
            <Field label="Téléphone" value={phone} onChange={setPhone} placeholder="+225…" />
            <Field
              label="Code parrain (optionnel)"
              value={referral}
              onChange={setReferral}
              placeholder="MSN123ABC"
            />
          </>
        )}
        <Field label="Email" value={email} onChange={setEmail} type="email" required />
        <Field
          label="Mot de passe"
          value={password}
          onChange={setPassword}
          type="password"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gradient-brand py-3 text-sm font-bold text-primary-foreground shadow-brand disabled:opacity-60"
        >
          {loading ? "…" : mode === "signup" ? "Créer mon compte" : "Se connecter"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="w-full text-center text-xs text-muted-foreground hover:text-primary"
        >
          {mode === "signup"
            ? "Déjà un compte ? Se connecter"
            : "Nouveau ? Créer un compte"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary"
      />
    </label>
  );
}
