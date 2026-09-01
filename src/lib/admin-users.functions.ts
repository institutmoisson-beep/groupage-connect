import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: any) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Accès réservé à l'administration.");
}

export type AdminUserRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
};

/** Annuaire admin : tous les comptes avec leur email, pour attribuer un rôle sans coller d'UUID. */
export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUserRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const users: { id: string; email: string | null }[] = [];
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      const batch = data?.users ?? [];
      users.push(...batch.map((u) => ({ id: u.id, email: u.email ?? null })));
      if (batch.length < 200) break;
    }

    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name, phone");
    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    return users
      .map((u) => ({
        id: u.id,
        email: u.email,
        fullName: byId.get(u.id)?.full_name ?? null,
        phone: byId.get(u.id)?.phone ?? null,
      }))
      .sort((a, b) =>
        (a.fullName ?? a.email ?? "").localeCompare(b.fullName ?? b.email ?? "", "fr"),
      );
  });

/** Résout un email en identifiant utilisateur (admin uniquement). */
export const adminFindUserByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().trim().email() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<AdminUserRow> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const needle = data.email.toLowerCase();

    for (let page = 1; page <= 20; page += 1) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw new Error(error.message);
      const batch = list?.users ?? [];
      const found = batch.find((u) => (u.email ?? "").toLowerCase() === needle);
      if (found) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("full_name, phone")
          .eq("id", found.id)
          .maybeSingle();
        return {
          id: found.id,
          email: found.email ?? null,
          fullName: profile?.full_name ?? null,
          phone: profile?.phone ?? null,
        };
      }
      if (batch.length < 200) break;
    }
    throw new Error("Aucun compte avec cet email.");
  });
