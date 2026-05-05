import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { NewDealModal } from "@/components/NewDealModal";
import { DealTypeBadge, StatusBadge } from "@/components/badges";
import { formatPKR, formatArea, formatDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileText, Search, Plus } from "lucide-react";

export default function DealsPage() {
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [typeF, setTypeF] = useState("all");
  const [clientF, setClientF] = useState("all");

  useEffect(() => {
    if (params.get("new") === "1") { setOpen(true); params.delete("new"); setParams(params, { replace: true }); }
  }, [params, setParams]);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-filter"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").eq("role", "client");
      return data || [];
    },
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["deals-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deals")
        .select(`
          id, deal_number, title, deal_type, status, deal_date, client_id, created_at,
          profiles:client_id (full_name, email),
          areas (total_area_value, total_area_unit),
          payments (total_amount, amount_paid, payment_status)
        `)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return data.filter((d: any) => {
      if (statusF !== "all" && d.status !== statusF) return false;
      if (typeF !== "all" && d.deal_type !== typeF) return false;
      if (clientF !== "all" && d.client_id !== clientF) return false;
      if (s) {
        const name = d.profiles?.full_name || "";
        const blob = `${d.deal_number} ${d.title} ${name}`.toLowerCase();
        if (!blob.includes(s)) return false;
      }
      return true;
    });
  }, [data, search, statusF, typeF, clientF]);

  return (
    <AppLayout onNewDeal={() => setOpen(true)}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Deals</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage all land deals.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by number, title or client" className="pl-9" />
        </div>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All Status</option><option>active</option><option>pending</option><option>closed</option><option>cancelled</option>
        </select>
        <select value={typeF} onChange={(e) => setTypeF(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All Types</option><option value="purchase">Purchase</option>
        </select>
        <select value={clientF} onChange={(e) => setClientF(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All Clients</option>
          {clients.map((c: any) => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}
        </select>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Deal No</th>
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-left px-4 py-3">Area</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-right px-4 py-3">Remaining</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  {Array.from({ length: 10 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-3 bg-muted animate-pulse rounded" /></td>
                  ))}
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={10} className="text-center py-12">
                  <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <div className="font-semibold">No deals found</div>
                  <div className="text-sm text-muted-foreground mb-4">Create your first deal to get started.</div>
                  <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Create First Deal</Button>
                </td></tr>
              )}
              {!isLoading && filtered.map((d: any) => {
                const area = Array.isArray(d.areas) ? d.areas[0] : d.areas;
                const pay = Array.isArray(d.payments) ? d.payments[0] : d.payments;
                const total = Number(pay?.total_amount || 0);
                const paid = Number(pay?.amount_paid || 0);
                return (
                  <tr key={d.id} className="border-t border-border hover:bg-accent/40">
                    <td className="px-4 py-3"><Link to={`/deals/${d.id}`} className="font-mono text-xs text-primary">{d.deal_number}</Link></td>
                    <td className="px-4 py-3 font-medium max-w-xs truncate">{d.title}</td>
                    <td className="px-4 py-3"><DealTypeBadge type={d.deal_type} /></td>
                    <td className="px-4 py-3">{d.profiles?.full_name || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 text-xs">{area ? formatArea(area.total_area_value, area.total_area_unit) : "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatPKR(total)}</td>
                    <td className="px-4 py-3 text-right text-destructive">{formatPKR(total - paid)}</td>
                    <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(d.deal_date)}</td>
                    <td className="px-4 py-3"><Link to={`/deals/${d.id}`} className="text-primary text-xs font-semibold hover:underline">View</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <NewDealModal open={open} onClose={() => setOpen(false)} />
    </AppLayout>
  );
}
