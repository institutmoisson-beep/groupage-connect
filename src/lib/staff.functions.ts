import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STAFF_MODULES } from "@/lib/staff-modules";

const moduleSchema = z.enum(STAFF_MODULES);

export type StaffAssignmentRow = {
  id: string;
  user_id: string;
  module: string;
  is_active: boolean;
  note: string | null;
  created_at: string;
  full_name: string | null;
  email: string | null;
};

/** Liste toutes les délégations de modules (admin uniquement, contrôlé côté SQL). */
export const staffListAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any).rpc("admin_list_staff_assignments");
    if (error) throw new Error(error.message);
    return (data ?? []) as StaffAssignmentRow[];
  });

/** Confie (ou suspend) un module à un utilisateur. */
export const staffSetModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        module: moduleSchema,
        isActive: z.boolean().default(true),
        note: z.string().trim().max(300).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any).rpc("admin_set_staff_module", {
      p_user_id: data.userId,
      p_module: data.module,
      p_is_active: data.isActive,
      p_note: data.note,
    });
    if (error) throw new Error(error.message);
    return row;
  });

/** Retire définitivement une délégation. */
export const staffRemoveModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), module: moduleSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("admin_remove_staff_module", {
      p_user_id: data.userId,
      p_module: data.module,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
