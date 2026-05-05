import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatPKR, formatDate } from "@/lib/format";

interface ReminderRow {
  id: string;
  message: string;
  remind_on: string;
  deal_id: string | null;
  payment_id: string | null;
  deals?: { deal_number: string; title: string } | null;
  payments?: { total_amount: number; amount_paid: number } | null;
}

export const ReminderToasts = () => {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<ReminderRow[]>([]);

  useEffect(() => {
    if (!user || !profile) return;
    if (profile.role === "client") return; // only staff
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("reminders")
        .select("id, message, remind_on, deal_id, payment_id, deals(deal_number, title), payments(total_amount, amount_paid)")
        .lte("remind_on", today)
        .eq("is_dismissed", false)
        .order("remind_on", { ascending: true })
        .limit(5);
      if (data) setItems(data as any);
    })();
  }, [user, profile]);

  const dismiss = async (id: string) => {
    setItems((arr) => arr.filter((r) => r.id !== id));
    await supabase.from("reminders").update({ is_dismissed: true }).eq("id", id);
  };

  // auto-dismiss timers
  useEffect(() => {
    const timers = items.map((r) => setTimeout(() => dismiss(r.id), 8000));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  if (!items.length) return null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-[340px]">
      {items.map((r) => {
        const overdue = r.remind_on < today;
        const isToday = r.remind_on === today;
        const borderColor = overdue ? "border-l-destructive" : isToday ? "border-l-warning" : "border-l-primary";
        const remaining = r.payments ? Number(r.payments.total_amount) - Number(r.payments.amount_paid) : null;
        return (
          <div
            key={r.id}
            className={`relative bg-card border border-border ${borderColor} border-l-4 rounded-md shadow-lg p-3 pr-8 animate-slide-in-right overflow-hidden`}
          >
            <button onClick={() => dismiss(r.id)} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-2">
              <AlertCircle className={`h-4 w-4 mt-0.5 ${overdue ? "text-destructive" : isToday ? "text-warning" : "text-primary"}`} />
              <div className="flex-1 min-w-0">
                {r.deals && (
                  <div className="text-xs font-mono text-primary">{r.deals.deal_number}</div>
                )}
                {r.deals?.title && <div className="text-sm font-semibold truncate">{r.deals.title}</div>}
                <div className="text-sm text-foreground/90 mt-1">{r.message}</div>
                {remaining !== null && (
                  <div className="text-xs text-muted-foreground mt-1">Remaining: {formatPKR(remaining)}</div>
                )}
                <div className="text-xs text-muted-foreground mt-1">{formatDate(r.remind_on)}</div>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 h-0.5 bg-primary/40" style={{ animation: "shrink 8s linear forwards" }} />
            <style>{`@keyframes shrink { from { width: 100%; } to { width: 0%; } }`}</style>
          </div>
        );
      })}
    </div>
  );
};
