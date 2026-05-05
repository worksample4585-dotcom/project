import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { RoleBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

export default function UserManagementPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "client" });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("created_at", { ascending: false })).data || [],
  });

  const editorCount = users.filter((u: any) => u.role === "editor").length;
  const editorLimitReached = editorCount >= 3;

  const toggleActive = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      await supabase.from("profiles").update({ is_active: val }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const invite = useMutation({
    mutationFn: async () => {
      if (form.role === "editor" && editorLimitReached) throw new Error("Maximum 3 editors allowed");
      const { error } = await supabase.auth.signUp({
        email: form.email, password: form.password,
        options: { data: { full_name: form.full_name, role: form.role } },
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("User invited"); setOpen(false); setForm({ full_name: "", email: "", password: "", role: "client" }); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage admins, editors and clients.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Invite User</Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr><th className="text-left px-4 py-2">Name</th><th className="text-left px-4 py-2">Email</th><th className="text-left px-4 py-2">Role</th><th className="text-left px-4 py-2">Active</th></tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-2 font-medium">{u.full_name || "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-2"><RoleBadge role={u.role} /></td>
                <td className="px-4 py-2">
                  <Switch checked={u.is_active} onCheckedChange={(val) => toggleActive.mutate({ id: u.id, val })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Full Name</Label><Input value={form.full_name} onChange={(e) => setForm({...form, full_name: e.target.value})} className="mt-1.5" /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="mt-1.5" /></div>
            <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} className="mt-1.5" /></div>
            <div><Label>Role</Label>
              <select className="w-full mt-1.5 h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.role} onChange={(e) => setForm({...form, role: e.target.value})}>
                <option value="client">Client</option>
                <option value="editor" disabled={editorLimitReached}>Editor {editorLimitReached ? "(limit reached)" : ""}</option>
                <option value="admin">Admin</option>
              </select>
              {editorLimitReached && (
                <p className="text-xs text-warning mt-1.5 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Maximum 3 editors allowed</p>
              )}
            </div>
            <Button onClick={() => invite.mutate()} className="w-full" disabled={!form.email || !form.password || !form.full_name || invite.isPending}>Invite</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
