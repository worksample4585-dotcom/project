import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { DealTypeBadge, StatusBadge, PaymentStatusBadge, PartyRoleBadge } from "@/components/badges";
import { formatPKR, formatArea, formatDate, formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PKRInput } from "@/components/inputs";
import {
  ArrowLeft, Trash2, Plus, Copy, Upload, Download, FileText,
  Image as ImageIcon, FileSpreadsheet, File as FileIcon, Printer, Edit, X,
} from "lucide-react";
import toast from "react-hot-toast";

interface Props { readOnly?: boolean; }

export default function DealDetailPage({ readOnly = false }: Props) {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAdmin = profile?.role === "admin";
  const ro = readOnly || profile?.role === "client";

  const { data: deal, isLoading } = useQuery({
    queryKey: ["deal", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deals")
        .select(`*, profiles!deals_client_id_fkey(*), creator:profiles!deals_created_by_fkey(full_name, email),
                 areas(*), blocks(*), parties(*), payments(*), payment_transactions(*),
                 documents(*), reminders(*)`)
        .eq("id", id!)
        .single();
      return data as any;
    },
    enabled: !!id,
  });

  const [delOpen, setDelOpen] = useState(false);
  const deleteMut = useMutation({
    mutationFn: async () => { await supabase.from("deals").delete().eq("id", id!); },
    onSuccess: () => { toast.success("Deal deleted"); navigate("/deals"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !deal) {
    return <AppLayout><div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded" />)}</div></AppLayout>;
  }

  const area = Array.isArray(deal.areas) ? deal.areas[0] : deal.areas;
  const payment = Array.isArray(deal.payments) ? deal.payments[0] : deal.payments;
  const total = Number(payment?.total_amount || 0);
  const paid = Number(payment?.amount_paid || 0);
  const remaining = total - paid;
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;

  return (
    <AppLayout>
      <Link to={ro ? "/client" : "/deals"} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-xl text-primary font-bold">{deal.deal_number}</span>
            <DealTypeBadge type={deal.deal_type} />
            <StatusBadge status={deal.status} />
          </div>
          <h1 className="text-xl md:text-2xl font-bold mt-1">{deal.title}</h1>
          <p className="text-sm text-muted-foreground">{formatDate(deal.deal_date)}</p>
        </div>
        {!ro && (
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="outline" onClick={() => setDelOpen(true)} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="area">Area & Blocks</TabsTrigger>
          <TabsTrigger value="parties">Parties</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoCard title="Client">
              {deal.profiles ? (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold">
                    {(deal.profiles.full_name || "?").charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium">{deal.profiles.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{deal.profiles.email}</div>
                  </div>
                </div>
              ) : <span className="text-muted-foreground">Unassigned</span>}
            </InfoCard>
            <InfoCard title="Deal Type"><DealTypeBadge type={deal.deal_type} /></InfoCard>
            <InfoCard title="Date"><div className="font-medium">{formatDate(deal.deal_date)}</div></InfoCard>
            <InfoCard title="Status"><StatusBadge status={deal.status} /></InfoCard>
            <InfoCard title="Created By"><div className="text-sm">{deal.creator?.full_name || "—"}</div></InfoCard>
            <InfoCard title="Notes"><p className="text-sm whitespace-pre-wrap">{deal.notes || <span className="text-muted-foreground">No notes</span>}</p></InfoCard>
          </div>
        </TabsContent>

        <TabsContent value="area" className="mt-4">
          <AreaTab deal={deal} area={area} blocks={deal.blocks || []} readOnly={ro} />
        </TabsContent>

        <TabsContent value="parties" className="mt-4">
          <PartiesTab dealId={deal.id} parties={deal.parties || []} readOnly={ro} />
        </TabsContent>

        <TabsContent value="financial" className="mt-4 print-area">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <InfoCard title="Total Amount"><div className="text-xl font-bold text-info">{formatPKR(total)}</div></InfoCard>
            <InfoCard title="Amount Paid"><div className="text-xl font-bold text-primary">{formatPKR(paid)}</div></InfoCard>
            <InfoCard title="Remaining"><div className="text-xl font-bold text-destructive">{formatPKR(remaining)}</div></InfoCard>
          </div>
          <div className="bg-card border border-border rounded-lg p-5 mb-5">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-semibold">{pct.toFixed(0)}% Paid</span>
              <PaymentStatusBadge status={payment?.payment_status} />
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            {payment?.payment_due_date && (
              <div className="text-xs text-muted-foreground mt-2">Due: {formatDate(payment.payment_due_date)}</div>
            )}
          </div>
          <FinancialTab dealId={deal.id} payment={payment} transactions={deal.payment_transactions || []} readOnly={ro} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentsTab deal={deal} readOnly={ro} />
        </TabsContent>

        <TabsContent value="reminders" className="mt-4">
          <RemindersTab dealId={deal.id} reminders={deal.reminders || []} payments={Array.isArray(deal.payments) ? deal.payments : [deal.payments].filter(Boolean)} readOnly={ro} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deal.deal_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the deal and all related areas, blocks, parties, payments, transactions, and documents. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMut.mutate()} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

const InfoCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-card border border-border rounded-lg p-4">
    <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">{title}</div>
    {children}
  </div>
);

// ============ Area Tab ============
function AreaTab({ deal, area, blocks, readOnly }: any) {
  const qc = useQueryClient();
  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copied"); };
  const [adding, setAdding] = useState(false);
  const [bn, setBn] = useState(""); const [bv, setBv] = useState(0); const [bu, setBu] = useState("Acre"); const [bd, setBd] = useState("");

  const addBlock = useMutation({
    mutationFn: async () => {
      await supabase.from("blocks").insert({ deal_id: deal.id, block_number: bn, area_value: bv, area_unit: bu, description: bd || null });
    },
    onSuccess: () => { toast.success("Block added"); setAdding(false); setBn(""); setBv(0); setBu("Acre"); setBd(""); qc.invalidateQueries({ queryKey: ["deal", deal.id] }); },
  });
  const delBlock = useMutation({
    mutationFn: async (id: string) => { await supabase.from("blocks").delete().eq("id", id); },
    onSuccess: () => { toast.success("Block deleted"); qc.invalidateQueries({ queryKey: ["deal", deal.id] }); },
  });

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Total Area</div>
        <div className="text-3xl font-bold mb-3">{area ? formatArea(area.total_area_value, area.total_area_unit) : "—"}</div>
        {area && (
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Location:</span> {area.location_name || "—"}</div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Lat:</span>
              <span className="font-mono">{area.latitude || "—"}</span>
              {area.latitude && <button onClick={() => copy(String(area.latitude))}><Copy className="h-3 w-3" /></button>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Lng:</span>
              <span className="font-mono">{area.longitude || "—"}</span>
              {area.longitude && <button onClick={() => copy(String(area.longitude))}><Copy className="h-3 w-3" /></button>}
            </div>
            <div className="md:col-span-2"><span className="text-muted-foreground">Address:</span> {area.address || "—"}</div>
          </div>
        )}
        {area?.latitude && area?.longitude && (
          <iframe className="w-full mt-4 rounded-lg border border-border" height={250}
            src={`https://maps.google.com/maps?q=${area.latitude},${area.longitude}&z=15&output=embed`} />
        )}
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Blocks</h3>
          {!readOnly && <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="h-3 w-3 mr-1" /> Add Block</Button>}
        </div>
        {blocks.length === 0 ? (
          <div className="text-sm text-center py-8 text-muted-foreground">No blocks added</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left px-4 py-2">Block</th><th className="text-left px-4 py-2">Area</th><th className="text-left px-4 py-2">Description</th>{!readOnly && <th />}</tr>
            </thead>
            <tbody>
              {blocks.map((b: any) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono">{b.block_number}</td>
                  <td className="px-4 py-2">{formatArea(b.area_value, b.area_unit)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{b.description || "—"}</td>
                  {!readOnly && <td className="px-4 py-2 text-right">
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => delBlock.mutate(b.id)}><Trash2 className="h-4 w-4" /></Button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Block</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Block Number</Label><Input value={bn} onChange={(e) => setBn(e.target.value)} className="mt-1.5" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Area</Label><Input type="number" value={bv || ""} onChange={(e) => setBv(parseFloat(e.target.value) || 0)} className="mt-1.5" /></div>
              <div><Label>Unit</Label><select className="w-full mt-1.5 h-10 rounded-md border border-input bg-background px-2 text-sm" value={bu} onChange={(e) => setBu(e.target.value)}>{["Acre","Canal","Kanal","Marla"].map((u)=><option key={u}>{u}</option>)}</select></div>
            </div>
            <div><Label>Description</Label><Input value={bd} onChange={(e) => setBd(e.target.value)} className="mt-1.5" /></div>
            <Button onClick={() => addBlock.mutate()} className="w-full" disabled={!bn || addBlock.isPending}>Save Block</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Parties Tab ============
function PartiesTab({ dealId, parties, readOnly }: any) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ full_name: "", role: "buyer", phone: "", email: "", notes: "" });

  const reset = () => setForm({ full_name: "", role: "buyer", phone: "", email: "", notes: "" });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, role: form.role as any };
      if (editing) {
        await supabase.from("parties").update(payload).eq("id", editing.id);
      } else {
        await supabase.from("parties").insert({ ...payload, deal_id: dealId });
      }
    },
    onSuccess: () => { toast.success("Party saved"); setOpen(false); setEditing(null); reset(); qc.invalidateQueries({ queryKey: ["deal", dealId] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("parties").delete().eq("id", id); },
    onSuccess: () => { toast.success("Party deleted"); qc.invalidateQueries({ queryKey: ["deal", dealId] }); },
  });

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold">Parties</h3>
        {!readOnly && <Button size="sm" onClick={() => { reset(); setEditing(null); setOpen(true); }}><Plus className="h-3 w-3 mr-1" /> Add Party</Button>}
      </div>
      {parties.length === 0 ? (
        <div className="text-sm text-center py-8 text-muted-foreground">No parties added</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr><th className="text-left px-4 py-2">Name</th><th className="text-left px-4 py-2">Role</th><th className="text-left px-4 py-2">Phone</th><th className="text-left px-4 py-2">Email</th>{!readOnly && <th />}</tr>
          </thead>
          <tbody>
            {parties.map((p: any) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-2 font-medium">{p.full_name}</td>
                <td className="px-4 py-2"><PartyRoleBadge role={p.role} /></td>
                <td className="px-4 py-2">{p.phone || "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">{p.email || "—"}</td>
                {!readOnly && <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="icon" onClick={() => { setForm({ full_name: p.full_name, role: p.role, phone: p.phone || "", email: p.email || "", notes: p.notes || "" }); setEditing(p); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => del.mutate(p.id)}><Trash2 className="h-4 w-4" /></Button>
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Party</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Full Name</Label><Input value={form.full_name} onChange={(e) => setForm({...form, full_name: e.target.value})} className="mt-1.5" /></div>
            <div><Label>Role</Label><select className="w-full mt-1.5 h-10 rounded-md border border-input bg-background px-2 text-sm" value={form.role} onChange={(e) => setForm({...form, role: e.target.value})}>{["buyer","seller","agent","witness","other"].map((r)=><option key={r}>{r}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="mt-1.5" /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="mt-1.5" /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} className="mt-1.5" /></div>
            <Button onClick={() => save.mutate()} className="w-full" disabled={!form.full_name || save.isPending}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Financial Tab ============
function FinancialTab({ dealId, payment, transactions, readOnly }: any) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [remarks, setRemarks] = useState("");

  const record = useMutation({
    mutationFn: async () => {
      if (!payment || amount <= 0) throw new Error("Invalid amount");
      await supabase.from("payment_transactions").insert({
        deal_id: dealId, amount, paid_date: paidDate, due_date: dueDate || null, remarks: remarks || null, recorded_by: user?.id,
      });
      const newPaid = Number(payment.amount_paid) + amount;
      const total = Number(payment.total_amount);
      const status = newPaid <= 0 ? "pending" : newPaid >= total ? "paid" : "partial";
      await supabase.from("payments").update({ amount_paid: newPaid, payment_status: status }).eq("id", payment.id);
    },
    onSuccess: () => { toast.success("Payment recorded"); setOpen(false); setAmount(0); setRemarks(""); qc.invalidateQueries({ queryKey: ["deal", dealId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold">Payment Transactions</h3>
        <div className="flex gap-2 no-print">
          {!readOnly && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-3 w-3 mr-1" /> Record Payment</Button>}
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-3 w-3 mr-1" /> Print PDF</Button>
        </div>
      </div>
      {transactions.length === 0 ? (
        <div className="text-sm text-center py-8 text-muted-foreground">No payment transactions</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr><th className="text-left px-4 py-2">Date</th><th className="text-right px-4 py-2">Amount</th><th className="text-left px-4 py-2">Due</th><th className="text-left px-4 py-2">Remarks</th></tr>
          </thead>
          <tbody>
            {transactions.sort((a: any, b: any) => b.paid_date.localeCompare(a.paid_date)).map((t: any) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-4 py-2">{formatDate(t.paid_date)}</td>
                <td className="px-4 py-2 text-right font-medium text-primary">{formatPKR(t.amount)}</td>
                <td className="px-4 py-2 text-muted-foreground">{t.due_date ? formatDate(t.due_date) : "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">{t.remarks || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Amount *</Label><div className="mt-1.5"><PKRInput value={amount} onChange={setAmount} required /></div></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Paid Date</Label><Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className="mt-1.5" /></div>
              <div><Label>Due Date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1.5" /></div>
            </div>
            <div><Label>Remarks</Label><Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} className="mt-1.5" /></div>
            <Button onClick={() => record.mutate()} className="w-full" disabled={amount <= 0 || record.isPending}>Record Payment</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Documents Tab ============
function DocumentsTab({ deal, readOnly }: any) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const isAdmin = profile?.role === "admin";

  const dealDocs = (deal.documents || []).filter((d: any) => d.deal_id === deal.id && (!d.client_id || d.client_id === deal.client_id));

  const { data: clientDocs = [] } = useQuery({
    queryKey: ["client-docs", deal.client_id],
    queryFn: async () => {
      if (!deal.client_id) return [];
      const { data } = await supabase.from("documents").select("*, deals(deal_number)").eq("client_id", deal.client_id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!deal.client_id,
  });

  const upload = async (file: File, scope: "deal" | "client") => {
    const folder = scope === "deal" ? `deals/${deal.id}` : `clients/${deal.client_id}`;
    const path = `${folder}/${Date.now()}-${file.name}`;
    const { error: uErr } = await supabase.storage.from("deal-documents").upload(path, file);
    if (uErr) { toast.error(uErr.message); return; }
    await supabase.from("documents").insert({
      deal_id: deal.id,
      client_id: scope === "client" ? deal.client_id : null,
      file_name: file.name, file_path: path, file_size: file.size, file_type: file.type,
      uploaded_by: user?.id,
    });
    toast.success("Uploaded");
    qc.invalidateQueries({ queryKey: ["deal", deal.id] });
    qc.invalidateQueries({ queryKey: ["client-docs", deal.client_id] });
  };

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from("deal-documents").createSignedUrl(path, 60);
    if (error || !data) { toast.error("Download failed"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const del = async (doc: any) => {
    await supabase.storage.from("deal-documents").remove([doc.file_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["deal", deal.id] });
  };

  return (
    <div className="space-y-6">
      <DocSection
        title="Deal Documents" subtitle="Documents specific to this deal"
        files={dealDocs} onUpload={(f) => upload(f, "deal")} onDownload={download}
        onDelete={isAdmin ? del : undefined} readOnly={readOnly}
      />
      {deal.client_id && (
        <DocSection
          title="Client Documents" subtitle={`All documents for ${deal.profiles?.full_name || "this client"}`}
          files={clientDocs} onUpload={(f) => upload(f, "client")} onDownload={download} readOnly={readOnly}
          showDeal
        />
      )}
    </div>
  );
}

function DocSection({ title, subtitle, files, onUpload, onDownload, onDelete, readOnly, showDeal }: any) {
  const fileIcon = (type?: string) => {
    if (!type) return <FileIcon className="h-4 w-4 text-muted-foreground" />;
    if (type.includes("pdf")) return <FileText className="h-4 w-4 text-destructive" />;
    if (type.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-info" />;
    if (type.includes("spreadsheet") || type.includes("csv") || type.includes("excel")) return <FileSpreadsheet className="h-4 w-4 text-primary" />;
    if (type.includes("word") || type.includes("document")) return <FileText className="h-4 w-4 text-info" />;
    return <FileIcon className="h-4 w-4 text-muted-foreground" />;
  };
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {!readOnly && (
        <label className="block m-4 border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition">
          <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <div className="text-sm">Click to upload or drag & drop</div>
          <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
        </label>
      )}
      {files.length === 0 ? (
        <div className="text-sm text-center py-6 text-muted-foreground">No documents</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2">File</th>
              {showDeal && <th className="text-left px-4 py-2">Deal</th>}
              <th className="text-left px-4 py-2">Size</th>
              <th className="text-left px-4 py-2">Uploaded</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {files.map((d: any) => (
              <tr key={d.id} className="border-t border-border">
                <td className="px-4 py-2 flex items-center gap-2">{fileIcon(d.file_type)}<span className="truncate max-w-xs">{d.file_name}</span></td>
                {showDeal && <td className="px-4 py-2 font-mono text-xs">{d.deals?.deal_number || "—"}</td>}
                <td className="px-4 py-2 text-muted-foreground text-xs">{formatBytes(d.file_size)}</td>
                <td className="px-4 py-2 text-muted-foreground text-xs">{formatDate(d.created_at)}</td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="icon" onClick={() => onDownload(d.file_path)}><Download className="h-4 w-4" /></Button>
                  {onDelete && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onDelete(d)}><Trash2 className="h-4 w-4" /></Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ============ Reminders Tab ============
function RemindersTab({ dealId, reminders, payments, readOnly }: any) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [remindOn, setRemindOn] = useState(new Date().toISOString().slice(0, 10));
  const [paymentId, setPaymentId] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      await supabase.from("reminders").insert({
        deal_id: dealId, payment_id: paymentId || null, message, remind_on: remindOn, created_by: user?.id,
      });
    },
    onSuccess: () => { toast.success("Reminder added"); setOpen(false); setMessage(""); qc.invalidateQueries({ queryKey: ["deal", dealId] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const dismiss = useMutation({
    mutationFn: async (id: string) => { await supabase.from("reminders").update({ is_dismissed: true }).eq("id", id); },
    onSuccess: () => { toast.success("Dismissed"); qc.invalidateQueries({ queryKey: ["deal", dealId] }); },
  });

  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...reminders].sort((a: any, b: any) => a.remind_on.localeCompare(b.remind_on));

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold">Reminders</h3>
        {!readOnly && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-3 w-3 mr-1" /> Add Reminder</Button>}
      </div>
      {sorted.length === 0 ? (
        <div className="text-sm text-center py-8 text-muted-foreground">No reminders</div>
      ) : (
        <ul className="divide-y divide-border">
          {sorted.map((r: any) => {
            const dot = r.remind_on < today ? "bg-destructive" : r.remind_on === today ? "bg-warning" : "bg-primary";
            return (
              <li key={r.id} className="px-5 py-3 flex items-center gap-3">
                <span className={`h-2 w-2 rounded-full ${dot}`} />
                <div className="flex-1">
                  <div className="text-sm">{r.message}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(r.remind_on)}</div>
                </div>
                {r.is_dismissed ? (
                  <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">Dismissed</span>
                ) : !readOnly && (
                  <Button size="sm" variant="ghost" onClick={() => dismiss.mutate(r.id)}><X className="h-4 w-4" /></Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Reminder</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Message *</Label><Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1.5" required /></div>
            <div><Label>Remind On *</Label><Input type="date" value={remindOn} onChange={(e) => setRemindOn(e.target.value)} className="mt-1.5" /></div>
            <div><Label>Link to Payment</Label>
              <select className="w-full mt-1.5 h-10 rounded-md border border-input bg-background px-2 text-sm" value={paymentId} onChange={(e) => setPaymentId(e.target.value)}>
                <option value="">—</option>
                {payments.map((p: any) => p && <option key={p.id} value={p.id}>{formatPKR(p.total_amount)} ({p.payment_status})</option>)}
              </select>
            </div>
            <Button onClick={() => add.mutate()} className="w-full" disabled={!message || add.isPending}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
