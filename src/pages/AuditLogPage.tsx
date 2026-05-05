import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Pill } from "@/components/badges";
import { formatDate } from "@/lib/format";
import { Input } from "@/components/ui/input";

export default function AuditLogPage() {
  const [userF, setUserF] = useState("all");
  const [actionF, setActionF] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: users = [] } = useQuery({
    queryKey: ["users-min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email")).data || [],
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["audit", userF, actionF, from, to],
    queryFn: async () => {
      let q = supabase.from("audit_logs").select("*, profiles:user_id(full_name)").order("created_at", { ascending: false }).limit(200);
      if (userF !== "all") q = q.eq("user_id", userF);
      if (actionF !== "all") q = q.eq("action", actionF);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", to + "T23:59:59");
      return (await q).data || [];
    },
  });

  const colorFor = (a: string) => {
    if (a === "INSERT") return "bg-primary/15 text-primary border-primary/30";
    if (a === "UPDATE") return "bg-info/15 text-info border-info/30";
    if (a === "DELETE") return "bg-destructive/15 text-destructive border-destructive/30";
    return "bg-muted text-muted-foreground border-border";
  };

  return (
    <AppLayout>
      <h1 className="text-2xl md:text-3xl font-bold mb-1">Audit Log</h1>
      <p className="text-sm text-muted-foreground mb-5">Most recent 200 changes.</p>

      <div className="flex flex-col md:flex-row gap-2 mb-3">
        <select value={userF} onChange={(e) => setUserF(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All Users</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
        </select>
        <select value={actionF} onChange={(e) => setActionF(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All Actions</option><option>INSERT</option><option>UPDATE</option><option>DELETE</option>
        </select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="md:w-44" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="md:w-44" />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr><th className="text-left px-4 py-2">User</th><th className="text-left px-4 py-2">Action</th><th className="text-left px-4 py-2">Table</th><th className="text-left px-4 py-2">When</th></tr>
          </thead>
          <tbody>
            {logs.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No audit logs</td></tr>}
            {logs.map((l: any) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-4 py-2">{l.profiles?.full_name || "—"}</td>
                <td className="px-4 py-2"><Pill className={colorFor(l.action)}>{l.action}</Pill></td>
                <td className="px-4 py-2 font-mono text-xs">{l.table_name}</td>
                <td className="px-4 py-2 text-muted-foreground text-xs">{formatDate(l.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
