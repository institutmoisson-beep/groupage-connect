import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { UserCheck, UserX, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatXOF } from "@/lib/format";
import { VIDA_RECOVERY_MODE_LABELS } from "@/lib/vida";
import { vidaAdminConfigureAgent, vidaAdminSetRoleStatus } from "@/lib/vida.functions";
import { adminFindUserByEmail, adminListUsers } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/admin/vida-agents")({
  head: () => ({
    meta: [
      { title: "ViDa — Agents & Rôles | Administration MSN" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminVidaAgents,
});

const RECOVERY_MODES = ["AUTO_LOOP", "API_TOPUP", "PHYSICAL_COLLECT"] as const;
const VIDA_ROLES = ["agent", "courier", "vendor"] as const;

function AdminVidaAgents() {
  const qc = useQueryClient();
  const configureAgent = useServerFn(vidaAdminConfigureAgent);
  const setRoleStatus = useServerFn(vidaAdminSetRoleStatus);
  const listUsers = useServerFn(adminListUsers);
  const findByEmail = useServerFn(adminFindUserByEmail);

  const [userQuery, setUserQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [newRole, setNewRole] = useState<(typeof VIDA_ROLES)[number]>("agent");

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-user-directory"],
    queryFn: () => listUsers({ data: undefined }),
  });

  const filteredUsers = useMemo(() => {
    const needle = userQuery.trim().toLowerCase();
    const rows = users ?? [];
    if (!needle) return rows.slice(0, 50);
    return rows
      .filter((u) =>
        `${u.fullName ?? ""} ${u.email ?? ""} ${u.phone ?? ""}`.toLowerCase().includes(needle),
      )
      .slice(0, 50);
  }, [users, userQuery]);


  const { data: roles } = useQuery({
    queryKey: ["admin-vida-roles"],
    queryFn: async () => {
      const { data: r, error } = await supabase
        .from("vida_roles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const userIds = Array.from(new Set((r ?? []).map((x: any) => x.user_id)));
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", userIds);
      const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      return (r ?? []).map((x: any) => ({ ...x, profile: byId.get(x.user_id) ?? null }));
    },
  });

  const { data: configs } = useQuery({
    queryKey: ["admin-vida-agent-configs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vida_agent_configurations").select("*");
      if (error) throw error;
      return data;
    },
  });

  const configByAgent = new Map((configs ?? []).map((c: any) => [c.agent_id, c]));

  const grantRole = useMutation({
    mutationFn: () =>
      setRoleStatus({
        data: { userId: newUserId.trim(), role: newRole, isApproved: true, isSuspended: false },
      }),
    onSuccess: () => {
      toast.success("Rôle ViDa attribué et approuvé.");
      setNewUserId("");
      qc.invalidateQueries({ queryKey: ["admin-vida-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleRole = useMutation({
    mutationFn: (v: {
      userId: string;
      role: (typeof VIDA_ROLES)[number];
      isApproved: boolean;
      isSuspended: boolean;
    }) => setRoleStatus({ data: v }),
    onSuccess: () => {
      toast.success("Statut mis à jour.");
      qc.invalidateQueries({ queryKey: ["admin-vida-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveConfig = useMutation({
    mutationFn: (v: {
      agentId: string;
      recoveryMode: (typeof RECOVERY_MODES)[number];
      maxCashLimit: number;
      securityDeposit: number;
      isActive: boolean;
    }) => configureAgent({ data: v }),
    onSuccess: () => {
      toast.success("Configuration agent enregistrée.");
      qc.invalidateQueries({ queryKey: ["admin-vida-agent-configs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-black">ViDa — Agents, Livreurs, Vendeurs</h1>
        <p className="text-xs text-muted-foreground">
          Approbation RBAC et configuration du mode de récupération de cash par agent.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs font-bold">Attribuer un rôle ViDa</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            placeholder="UUID utilisateur (auth.users.id)"
            className="min-w-[240px] flex-1 rounded-lg border border-input bg-background p-2 text-xs"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as (typeof VIDA_ROLES)[number])}
            className="rounded-lg border border-input bg-background p-2 text-xs"
          >
            {VIDA_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            onClick={() => grantRole.mutate()}
            disabled={grantRole.isPending || !newUserId.trim()}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            Attribuer
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-black">Comptes ViDa</h2>
        <ul className="mt-2 space-y-2">
          {(roles ?? []).map((r: any) => {
            const cfg = r.role === "agent" ? configByAgent.get(r.user_id) : null;
            return (
              <li key={r.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold">{r.profile?.full_name ?? r.user_id}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {r.role} · {r.profile?.phone ?? "—"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      r.is_suspended
                        ? "bg-destructive/20 text-destructive"
                        : r.is_approved
                          ? "bg-success/20 text-success"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {r.is_suspended ? "Suspendu" : r.is_approved ? "Approuvé" : "En attente"}
                  </span>
                </div>

                <div className="mt-2 flex gap-2 text-[10px] font-bold">
                  {!r.is_approved && (
                    <button
                      onClick={() =>
                        toggleRole.mutate({
                          userId: r.user_id,
                          role: r.role,
                          isApproved: true,
                          isSuspended: false,
                        })
                      }
                      className="flex items-center gap-1 rounded-lg bg-success px-2 py-1 text-success-foreground"
                    >
                      <UserCheck className="h-3 w-3" /> Approuver
                    </button>
                  )}
                  <button
                    onClick={() =>
                      toggleRole.mutate({
                        userId: r.user_id,
                        role: r.role,
                        isApproved: r.is_approved,
                        isSuspended: !r.is_suspended,
                      })
                    }
                    className="flex items-center gap-1 rounded-lg bg-destructive px-2 py-1 text-destructive-foreground"
                  >
                    <UserX className="h-3 w-3" /> {r.is_suspended ? "Réactiver" : "Suspendre"}
                  </button>
                </div>

                {r.role === "agent" && (
                  <AgentConfigForm
                    agentId={r.user_id}
                    initial={cfg}
                    saving={saveConfig.isPending}
                    onSave={(v) => saveConfig.mutate({ agentId: r.user_id, ...v })}
                  />
                )}
              </li>
            );
          })}
          {(roles ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun compte ViDa pour l'instant.</p>
          )}
        </ul>
      </section>
    </div>
  );
}

function AgentConfigForm({
  agentId,
  initial,
  saving,
  onSave,
}: {
  agentId: string;
  initial: any;
  saving: boolean;
  onSave: (v: {
    recoveryMode: (typeof RECOVERY_MODES)[number];
    maxCashLimit: number;
    securityDeposit: number;
    isActive: boolean;
  }) => void;
}) {
  const [mode, setMode] = useState<(typeof RECOVERY_MODES)[number]>(
    initial?.recovery_mode ?? "AUTO_LOOP",
  );
  const [limit, setLimit] = useState(String(initial?.max_cash_limit ?? 500000));
  const [deposit, setDeposit] = useState(String(initial?.security_deposit_amount ?? 100000));
  const [active, setActive] = useState(initial?.is_active ?? true);

  return (
    <div className="mt-2 rounded-lg bg-muted/40 p-2">
      <p className="text-[10px] font-bold text-muted-foreground">Mode de récupération de cash</p>
      <div className="mt-1 grid grid-cols-3 gap-1">
        {RECOVERY_MODES.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-lg px-1.5 py-1.5 text-[9px] font-bold ${mode === m ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
          >
            {VIDA_RECOVERY_MODE_LABELS[m]}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-[10px] text-muted-foreground">
          Plafond cash-in-hand
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            type="number"
            className="mt-0.5 w-full rounded-lg border border-input bg-background p-1.5 text-xs"
          />
        </label>
        <label className="text-[10px] text-muted-foreground">
          Caution initiale
          <input
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            type="number"
            className="mt-0.5 w-full rounded-lg border border-input bg-background p-1.5 text-xs"
          />
        </label>
      </div>
      <label className="mt-2 flex items-center gap-1.5 text-[10px] font-bold">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{" "}
        Agent actif (visible au catalogue)
      </label>
      <button
        onClick={() =>
          onSave({
            recoveryMode: mode,
            maxCashLimit: Number(limit),
            securityDeposit: Number(deposit),
            isActive: active,
          })
        }
        disabled={saving}
        className="mt-2 w-full rounded-lg bg-secondary py-1.5 text-[10px] font-black text-secondary-foreground disabled:opacity-50"
      >
        Enregistrer — {formatXOF(Number(limit || 0))} max
      </button>
    </div>
  );
}
