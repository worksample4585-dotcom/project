import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { formatPKR, formatDate } from "@/lib/format";
import { DealTypeBadge } from "@/components/badges";
import { TrendingDown, TrendingUp, Wallet, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

const StatCard = ({ icon: Icon, label, value, color, loading }: any) => (
  <div className="bg-card border border-border rounded-lg p-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      <div className={`h-8 w-8 rounded-md flex items-center justify-center ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
    {loading ? (
      <div className="h-8 w-24 bg-muted animate-pulse rounded" />
    ) : (
      <div className="text-2xl font-bold">{value}</div>
    )}
  </div>
);

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [dealsRes, paymentsRes] = await Promise.all([
        supabase.from("deals").select("id, deal_type"),
        supabase.from("payments").select("total_amount, amount_paid, payment_status, payment_due_date"),
      ]);
      const deals = dealsRes.data || [];
      const payments = paymentsRes.data || [];
      return {
        purchases: deals.filter((d: any) => d.deal_type === "purchase").length,
        sales: deals.filter((d: any) => d.deal_type === "sale").length,
        collected: payments.reduce((s: number, p: any) => s + Number(p.amount_paid || 0), 0),
        pending: payments
          .filter((p: any) => p.payment_status !== "paid")
          .reduce((s: number, p: any) => s + (Number(p.total_amount || 0) - Number(p.amount_paid || 0)), 0),
      };
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const weekAhead = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const { data: dueWeek = [] } = useQuery({
    queryKey: ["due-week", today, weekAhead],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, total_amount, amount_paid, payment_due_date, payment_status, deal_id, deals(deal_number, title, profiles:client_id(full_name))")
        .gte("payment_due_date", today)
        .lte("payment_due_date", weekAhead)
        .neq("payment_status", "paid")
        .order("payment_due_date", { ascending: true });
      return data || [];
    },
  });

  const { data: overdue = [] } = useQuery({
    queryKey: ["overdue", today],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, total_amount, amount_paid, payment_due_date, payment_status, deals(deal_number)")
        .or(`payment_status.eq.overdue,and(payment_due_date.lt.${today},payment_status.neq.paid)`)
        .limit(10);
      return data || [];
    },
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["recent-deals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deals")
        .select("id, deal_number, title, deal_type, deal_date, profiles:client_id(full_name), payments(total_amount, amount_paid)")
        .order("created_at", { ascending: false })
        .limit(8);
      return data || [];
    },
  });

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of all land deals and payments.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={TrendingDown} label="Total Purchases" value={data?.purchases ?? 0}
          color="bg-primary/15 text-primary" loading={isLoading} />
        <StatCard icon={TrendingUp} label="Total Sales" value={data?.sales ?? 0}
          color="bg-warning/15 text-warning" loading={isLoading} />
        <StatCard icon={Wallet} label="Collected" value={formatPKR(data?.collected ?? 0)}
          color="bg-info/15 text-info" loading={isLoading} />
        <StatCard icon={AlertTriangle} label="Pending Dues" value={formatPKR(data?.pending ?? 0)}
          color="bg-destructive/15 text-destructive" loading={isLoading} />
      </div>

      {overdue.length > 0 && (
        <div className="mb-6 p-4 rounded-lg border border-warning/40 bg-warning/10">
          <div className="flex items-center gap-2 mb-2 text-warning font-semibold">
            <AlertTriangle className="h-4 w-4" /> Overdue Payments
          </div>
          <div className="space-y-1 text-sm">
            {overdue.map((p: any) => (
              <div key={p.id} className="flex justify-between">
                <span className="font-mono text-foreground">{p.deals?.deal_number}</span>
                <span className="text-destructive font-medium">
                  {formatPKR(Number(p.total_amount) - Number(p.amount_paid))} overdue
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="font-semibold mb-3">Due This Week</h2>
          {dueWeek.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">No payments due this week</div>
          ) : (
            <div className="space-y-2">
              {dueWeek.map((p: any) => {
                const remaining = Number(p.total_amount) - Number(p.amount_paid);
                const due = p.payment_due_date;
                const dot = due < today ? "bg-destructive" : due === today ? "bg-warning" : "bg-primary";
                return (
                  <Link key={p.id} to={`/deals/${p.deal_id}`} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-accent">
                    <span className={`h-2 w-2 rounded-full ${dot}`} />
                    <span className="font-mono text-xs text-primary">{p.deals?.deal_number}</span>
                    <span className="text-sm flex-1 truncate">{p.deals?.profiles?.full_name || "—"}</span>
                    <span className="text-sm font-medium text-destructive">{formatPKR(remaining)}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(due)}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="font-semibold mb-3">Recent Deals</h2>
          {recent.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">No deals yet</div>
          ) : (
            <div className="space-y-3">
              {recent.map((d: any) => {
                const pay = Array.isArray(d.payments) ? d.payments[0] : d.payments;
                const total = Number(pay?.total_amount || 0);
                const paid = Number(pay?.amount_paid || 0);
                const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
                return (
                  <Link key={d.id} to={`/deals/${d.id}`} className="block py-2 px-2 rounded hover:bg-accent">
                    <div className="flex items-center justify-between gap-2 text-sm mb-1.5">
                      <span className="font-mono text-xs text-primary">{d.deal_number}</span>
                      <DealTypeBadge type={d.deal_type} />
                    </div>
                    <div className="text-sm font-medium truncate">{d.title}</div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                      <span>{d.profiles?.full_name || "Unassigned"}</span>
                      <span>{formatPKR(total)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
