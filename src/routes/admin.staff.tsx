import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Trash2, UserCog } from "lucide-react";

import { adminFindUserByEmail, adminListUsers } from "@/lib/admin-users.functions";
import { STAFF_MODULES, STAFF_MODULE_META, type StaffModule } from "@/lib/staff-modules";
import { staffListAssignments, staffRemoveModule, staffSetModule } from "@/lib/staff.functions";

export const Route = createFileRoute("/admin/staff")({
  head: () => ({
    meta: [
      { title: "Rôles délégués | Administration MSN" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminStaff,
});

function AdminStaff() {
  const qc = useQueryClient();
  const listUsers = useServerFn(adminListUsers);
  const findByEmail = useServerFn(adminFindUserByEmail);
  const listAssignments = useServerFn(staffListAssignments);
  const setModule = useServerFn(staffSetModule);
  const removeModule = useServerFn(staffRemoveModule);

  const [userQuery, setUserQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [module, setModuleChoice] = useState<StaffModule>("orders");
  const [note, setNote] = useState("");

  const { data: users } = useQuery({
    queryKey: ["admin-user-directory"],
    queryFn: () => listUsers({ data: undefined }),
  });

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["admin-staff-assignments"],
    queryFn: () => listAssignments({ data: undefined }),
  });

  const filteredUsers = useMemo(() => {
    const needle = userQuery.trim().toLowerCase();
    const rows = users ?? [];
    if (!needle) return rows.slice(0, 30);
    return rows
      .filter((u) =>
        `${u.fullName ?? ""} ${u.email ?? ""} ${u.phone ?? ""}`.toLowerCase().includes(needle),
      )
      .slice(0, 30);
  }, [users, userQuery]);

  const grant = useMutation({
    mutationFn: async () => {
      let userId = selectedUserId;
      const typed = userQuery.trim();
      if (!userId && typed.includes("@")) {
        userId = (await findByEmail({ data: { email: typed } })).id;
      }
      if (!userId) throw new Error("Sélectionnez un utilisateur ou saisissez son email.");
      return setModule({ data: { userId, module, isActive: true, note } });
    },
    onSuccess: () => {
      toast.success("Module confié : le tableau de bord apparaît dans son espace.");
      setSelectedUserId("");
      setUserQuery("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["admin-staff-assignments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (v: { userId: string; module: StaffModule; isActive: boolean }) =>
      setModule({ data: { userId: v.userId, module: v.module, isActive: v.isActive, note: "" } }),
    onSuccess: () => {
      toast.success("Statut mis à jour.");
      qc.invalidateQueries({ queryKey: ["admin-staff-assignments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (v: { userId: string; module: StaffModule }) => removeModule({ data: v }),
    onSuccess: () => {
      toast.success("Délégation retirée.");
      qc.invalidateQueries({ queryKey: ["admin-staff-assignments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-black">
          <UserCog className="h-5 w-5" /> Rôles délégués
        </h1>
        <p className="text-sm text-muted-foreground">
          Confiez une fonctionnalité à un utilisateur : il obtient automatiquement le tableau de
          bord et les outils de gestion correspondants dans son espace.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-bold">Confier un module</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={userQuery}
                onChange={(e) => {
                  setUserQuery(e.target.value);
                  setSelectedUserId("");
                }}
                placeholder="Nom, email ou téléphone de l'utilisateur"
                className="w-full rounded-lg border border-input bg-background py-2 pl-8 pr-2 text-xs"
              />
            </div>
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setSelectedUserId(u.id);
                    setUserQuery(u.fullName ?? u.email ?? "");
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] ${
                    selectedUserId === u.id ? "bg-primary text-primary-foreground" : "bg-muted/40"
                  }`}
                >
                  <span className="font-semibold">{u.fullName ?? "Sans nom"}</span>
                  <span className="opacity-80">{u.email}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <select
              value={module}
              onChange={(e) => setModuleChoice(e.target.value as StaffModule)}
              className="w-full rounded-lg border border-input bg-background px-2 py-2 text-xs"
            >
              {STAFF_MODULES.map((m) => (
                <option key={m} value={m}>
                  {STAFF_MODULE_META[m].label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground">{STAFF_MODULE_META[module].hint}</p>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note interne (optionnel)"
              className="w-full rounded-lg border border-input bg-background px-2 py-2 text-xs"
            />
            <button
              onClick={() => grant.mutate()}
              disabled={grant.isPending}
              className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-black text-primary-foreground disabled:opacity-50"
            >
              Confier le module
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <h2 className="border-b border-border px-4 py-3 text-sm font-bold">Délégations en cours</h2>
        {isLoading && <p className="px-4 py-4 text-sm text-muted-foreground">Chargement…</p>}
        <ul className="divide-y divide-border">
          {(assignments ?? []).map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">
                  {a.full_name ?? a.email ?? a.user_id}
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                    {a.email}
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {STAFF_MODULE_META[a.module as StaffModule]?.label ?? a.module}
                  {a.note ? ` — ${a.note}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    a.is_active
                      ? "bg-success text-success-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {a.is_active ? "Actif" : "Suspendu"}
                </span>
                <button
                  onClick={() =>
                    toggle.mutate({
                      userId: a.user_id,
                      module: a.module as StaffModule,
                      isActive: !a.is_active,
                    })
                  }
                  className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold"
                >
                  {a.is_active ? "Suspendre" : "Réactiver"}
                </button>
                <button
                  onClick={() => revoke.mutate({ userId: a.user_id, module: a.module as StaffModule })}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-border text-destructive"
                  aria-label="Retirer la délégation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
        {!isLoading && (assignments ?? []).length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">Aucune délégation pour l'instant.</p>
        )}
      </div>
    </div>
  );
}
