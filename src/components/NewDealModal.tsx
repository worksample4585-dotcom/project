import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PKRInput, AreaInput } from "@/components/inputs";
import { formatPKR, formatArea, formatDate } from "@/lib/format";
import { Home, Banknote, Trash2, Plus, ChevronRight, ChevronLeft, Check } from "lucide-react";
import toast from "react-hot-toast";

type Step = 1 | 2 | 3 | 4 | 5;
type Block = { block_number: string; area_value: number; area_unit: string; description: string };
type Party = { full_name: string; role: string; phone: string; email: string };

interface Props { open: boolean; onClose: () => void; }

export const NewDealModal = ({ open, onClose }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>(1);

  // Step 1 — purchase only
  const dealType = "purchase" as const;
  const [title, setTitle] = useState("");
  const [landName, setLandName] = useState("");
  const [dealDate, setDealDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<"active" | "pending" | "closed" | "cancelled">("active");
  const [clientId, setClientId] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Step 2
  const [areaValue, setAreaValue] = useState(0);
  const [areaUnit, setAreaUnit] = useState("Acre");
  const [locationName, setLocationName] = useState("");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [address, setAddress] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);

  // Step 3
  const [parties, setParties] = useState<Party[]>([]);

  // Step 4
  const [totalAmount, setTotalAmount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "partial" | "paid" | "overdue">("pending");
  const [remarks, setRemarks] = useState("");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").eq("role", "client").eq("is_active", true);
      return data || [];
    },
    enabled: open,
  });

  const reset = () => {
    setStep(1); setTitle(""); setLandName(""); setDealDate(new Date().toISOString().slice(0, 10));
    setStatus("active"); setClientId(""); setNotes("");
    setAreaValue(0); setAreaUnit("Acre"); setLocationName(""); setLatitude(""); setLongitude(""); setAddress(""); setBlocks([]);
    setParties([]);
    setTotalAmount(0); setAmountPaid(0); setPaymentDueDate(""); setPaymentStatus("pending"); setRemarks("");
  };

  const close = () => { reset(); onClose(); };

  const createMut = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Title required");
      if (!landName.trim()) throw new Error("Land name required");
      if (!user) throw new Error("Not authenticated");

      // 1. Insert deal
      const { data: deal, error: dErr } = await supabase
        .from("deals")
        .insert({
          deal_number: "" as any, // trigger will fill
          title: title.trim(),
          land_name: landName.trim(),
          deal_type: dealType,
          status,
          deal_date: dealDate,
          client_id: clientId || null,
          created_by: user.id,
          notes: notes || null,
        })
        .select("id")
        .single();
      if (dErr || !deal) throw new Error(dErr?.message || "Failed to create deal");

      // 2. Area
      if (areaValue > 0 || locationName || address || latitude || longitude) {
        await supabase.from("areas").insert({
          deal_id: deal.id,
          total_area_value: areaValue,
          total_area_unit: areaUnit,
          location_name: locationName || null,
          latitude: latitude ? Number(latitude) : null,
          longitude: longitude ? Number(longitude) : null,
          address: address || null,
        });
      }
      // 3. Blocks
      if (blocks.length) {
        await supabase.from("blocks").insert(blocks.map((b) => ({
          deal_id: deal.id,
          block_number: b.block_number,
          area_value: b.area_value,
          area_unit: b.area_unit,
          description: b.description || null,
        })));
      }
      // 4. Parties
      if (parties.length) {
        await supabase.from("parties").insert(parties.map((p) => ({
          deal_id: deal.id,
          full_name: p.full_name,
          role: p.role as any,
          phone: p.phone || null,
          email: p.email || null,
        })));
      }
      // 5. Payments
      await supabase.from("payments").insert({
        deal_id: deal.id,
        total_amount: totalAmount,
        amount_paid: amountPaid,
        payment_due_date: paymentDueDate || null,
        payment_status: paymentStatus,
        remarks: remarks || null,
      });
    },
    onSuccess: () => {
      toast.success("Deal created");
      qc.invalidateQueries();
      close();
    },
    onError: (e: any) => toast.error(e.message || "Failed to create deal"),
  });

  const next = () => {
    if (step === 1) {
      if (!title.trim()) { toast.error("Title required"); return; }
      if (!landName.trim()) { toast.error("Land name required"); return; }
    }
    setStep((s) => Math.min(5, s + 1) as Step);
  };
  const back = () => setStep((s) => Math.max(1, s - 1) as Step);

  const stepNames = ["Deal Info", "Area & Location", "Parties", "Financial", "Review"];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Deal</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4">
          {stepNames.map((name, i) => {
            const n = (i + 1) as Step;
            const active = n === step;
            const done = n < step;
            return (
              <div key={n} className="flex-1 flex items-center gap-2">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0
                  ${active ? "bg-primary text-primary-foreground" : done ? "bg-primary/30 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {done ? <Check className="h-3 w-3" /> : n}
                </div>
                <span className={`text-xs hidden md:inline ${active ? "font-semibold" : "text-muted-foreground"}`}>{name}</span>
                {i < stepNames.length - 1 && <div className={`flex-1 h-px ${done ? "bg-primary/40" : "bg-border"}`} />}
              </div>
            );
          })}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 flex items-center gap-2">
              <Home className="h-5 w-5 text-primary" />
              <div>
                <div className="font-semibold text-sm">Purchase Deal</div>
                <div className="text-xs text-muted-foreground">This system records purchased land only.</div>
              </div>
            </div>
            <div>
              <Label htmlFor="land">Land Name *</Label>
              <Input id="land" value={landName} onChange={(e) => setLandName(e.target.value)} required className="mt-1.5" placeholder="e.g. Chak 42 Farmland" />
            </div>
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="date">Deal Date *</Label>
                <Input id="date" type="date" value={dealDate} onChange={(e) => setDealDate(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Status</Label>
                <select value={status} onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full mt-1.5 h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="closed">Closed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Assign to Client</Label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}
                className="w-full mt-1.5 h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">— Unassigned —</option>
                {clients.map((c: any) => <option key={c.id} value={c.id}>{c.full_name || c.email} ({c.email})</option>)}
              </select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1.5" rows={2} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>Total Area</Label>
              <div className="mt-1.5">
                <AreaInput value={areaValue} unit={areaUnit} onValueChange={setAreaValue} onUnitChange={setAreaUnit} />
              </div>
            </div>
            <div>
              <Label>Location Name</Label>
              <Input value={locationName} onChange={(e) => setLocationName(e.target.value)} className="mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>GPS Latitude</Label>
                <Input type="number" step="0.000001" value={latitude} onChange={(e) => setLatitude(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>GPS Longitude</Label>
                <Input type="number" step="0.000001" value={longitude} onChange={(e) => setLongitude(e.target.value)} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1.5" rows={2} />
            </div>
            {latitude && longitude && (
              <iframe
                title="Map preview"
                src={`https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`}
                className="w-full rounded-lg border border-border" height={250}
              />
            )}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Blocks</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setBlocks([...blocks, { block_number: "", area_value: 0, area_unit: "Acre", description: "" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add Block
                </Button>
              </div>
              <div className="space-y-2">
                {blocks.map((b, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <Input className="col-span-2" placeholder="#" value={b.block_number}
                      onChange={(e) => setBlocks(blocks.map((x, j) => j === i ? { ...x, block_number: e.target.value } : x))} />
                    <Input className="col-span-2" type="number" placeholder="Area" value={b.area_value || ""}
                      onChange={(e) => setBlocks(blocks.map((x, j) => j === i ? { ...x, area_value: parseFloat(e.target.value) || 0 } : x))} />
                    <select className="col-span-2 h-10 rounded-md border border-input bg-background px-2 text-sm" value={b.area_unit}
                      onChange={(e) => setBlocks(blocks.map((x, j) => j === i ? { ...x, area_unit: e.target.value } : x))}>
                      {["Acre", "Canal", "Kanal", "Marla"].map((u) => <option key={u}>{u}</option>)}
                    </select>
                    <Input className="col-span-5" placeholder="Description" value={b.description}
                      onChange={(e) => setBlocks(blocks.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                    <Button type="button" size="icon" variant="ghost" className="col-span-1 text-destructive"
                      onClick={() => setBlocks(blocks.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Seller Details</h3>
              <Button type="button" size="sm" variant="outline"
                onClick={() => setParties([...parties, { full_name: "", role: "seller", phone: "", email: "" }])}>
                <Plus className="h-3 w-3 mr-1" /> Add Party
              </Button>
            </div>
            {parties.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">No parties added</div>}
            {parties.map((p, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-3" placeholder="Full name" value={p.full_name}
                  onChange={(e) => setParties(parties.map((x, j) => j === i ? { ...x, full_name: e.target.value } : x))} />
                <select className="col-span-2 h-10 rounded-md border border-input bg-background px-2 text-sm" value={p.role}
                  onChange={(e) => setParties(parties.map((x, j) => j === i ? { ...x, role: e.target.value } : x))}>
                  {["seller", "agent", "witness", "other"].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <Input className="col-span-3" placeholder="Phone" value={p.phone}
                  onChange={(e) => setParties(parties.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} />
                <Input className="col-span-3" type="email" placeholder="Email" value={p.email}
                  onChange={(e) => setParties(parties.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} />
                <Button type="button" size="icon" variant="ghost" className="col-span-1 text-destructive"
                  onClick={() => setParties(parties.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div>
              <Label>Total Deal Amount *</Label>
              <div className="mt-1.5"><PKRInput value={totalAmount} onChange={setTotalAmount} required /></div>
            </div>
            <div>
              <Label>Amount Paid So Far</Label>
              <div className="mt-1.5"><PKRInput value={amountPaid} onChange={setAmountPaid} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Payment Due Date</Label>
                <Input type="date" value={paymentDueDate} onChange={(e) => setPaymentDueDate(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Payment Status</Label>
                <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as any)}
                  className="w-full mt-1.5 h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} className="mt-1.5" rows={2} />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4 text-sm">
            <Section title="Deal Info">
              <Row k="Type" v="Purchase" />
              <Row k="Land Name" v={landName} />
              <Row k="Title" v={title} />
              <Row k="Date" v={formatDate(dealDate)} />
              <Row k="Status" v={status} />
              <Row k="Client" v={clients.find((c: any) => c.id === clientId)?.full_name || "Unassigned"} />
            </Section>
            <Section title="Area & Location">
              <Row k="Area" v={formatArea(areaValue, areaUnit)} />
              <Row k="Location" v={locationName || "—"} />
              <Row k="GPS" v={latitude && longitude ? `${latitude}, ${longitude}` : "—"} />
              <Row k="Address" v={address || "—"} />
              <Row k="Blocks" v={`${blocks.length} block(s)`} />
            </Section>
            <Section title="Sellers">
              <Row k="Total Sellers" v={`${parties.length}`} />
            </Section>
            <Section title="Financial">
              <Row k="Total Amount" v={formatPKR(totalAmount)} />
              <Row k="Amount Paid" v={formatPKR(amountPaid)} />
              <Row k="Remaining" v={formatPKR(totalAmount - amountPaid)} />
              <Row k="Status" v={paymentStatus} />
            </Section>
          </div>
        )}

        <div className="flex justify-between pt-5 border-t border-border mt-2">
          <Button variant="outline" onClick={back} disabled={step === 1}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          {step < 5 ? (
            <Button onClick={next}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? "Submitting…" : "Submit Deal"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-muted/40 rounded-md p-3">
    <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">{title}</div>
    <div className="space-y-1">{children}</div>
  </div>
);
const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-2"><span className="text-muted-foreground">{k}</span><span className="font-medium text-right">{v}</span></div>
);
