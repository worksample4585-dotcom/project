import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { DealTypeBadge, StatusBadge } from "@/components/badges";
import { formatPKR, formatArea, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { LogOut, Moon, Sun, Download, FileText } from "lucide-react";
import toast from "react-hot-toast";

export default function ClientPortalPage() {
  const { profile, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const { data: deals = [] } = useQuery({
    queryKey: ["client-deals", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deals")
        .select("id, deal_number, title, deal_type, status, deal_date, areas(*), payments(*)")
        .eq("client_id", profile!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!profile,
  });
  const { data: docs = [] } = useQuery({
    queryKey: ["client-mydocs", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("*, deals(deal_number)")
        .eq("client_id", profile!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!profile,
  });

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from("deal-documents").createSignedUrl(path, 60);
    if (error || !data) { toast.error("Download failed"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border flex items-center justify-between px-4 md:px-6 sticky top-0 bg-background/80 backdrop-blur z-20">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-extrabold">S</div>
          <span className="font-bold">SamsonAgri</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden md:inline">{profile?.full_name || profile?.email}</span>
          <button onClick={toggle} className="p-2 rounded-md hover:bg-accent">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
          <Button size="sm" variant="ghost" onClick={async () => { await signOut(); navigate("/login"); }}>
            <LogOut className="h-4 w-4 mr-1" /> Logout
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-6xl mx-auto">
        <div className="rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 p-6 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Welcome back, <span className="text-primary">{profile?.full_name || "Client"}</span></h1>
          <p className="text-sm text-muted-foreground mt-1">Here's a summary of your deals.</p>
        </div>

        <h2 className="font-semibold mb-3">Your Deals</h2>
        {deals.length === 0 ? (
          <div className="bg-card border border-border rounded-lg py-12 text-center text-sm text-muted-foreground">No deals assigned to you.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {deals.map((d: any) => {
              const area = Array.isArray(d.areas) ? d.areas[0] : d.areas;
              const pay = Array.isArray(d.payments) ? d.payments[0] : d.payments;
              const total = Number(pay?.total_amount || 0); const paid = Number(pay?.amount_paid || 0);
              const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
              return (
                <div key={d.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs text-primary">{d.deal_number}</span>
                    <DealTypeBadge type={d.deal_type} />
                  </div>
                  <h3 className="font-semibold truncate">{d.title}</h3>
                  <div className="flex items-center gap-2 mt-1 mb-3">
                    <StatusBadge status={d.status} />
                    <span className="text-xs text-muted-foreground">{formatDate(d.deal_date)}</span>
                  </div>
                  {area && <div className="text-sm text-muted-foreground mb-1">Area: {formatArea(area.total_area_value, area.total_area_unit)}</div>}
                  <div className="text-sm">Remaining: <span className="font-semibold text-destructive">{formatPKR(total - paid)}</span></div>
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <Link to={`/client/deals/${d.id}`}>
                    <Button size="sm" variant="outline" className="w-full mt-3">View Details</Button>
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        <h2 className="font-semibold mb-3 mt-6">My Documents</h2>
        {docs.length === 0 ? (
          <div className="bg-card border border-border rounded-lg py-8 text-center text-sm text-muted-foreground">No documents available.</div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr><th className="text-left px-4 py-2">File</th><th className="text-left px-4 py-2">Deal</th><th className="text-left px-4 py-2">Date</th><th /></tr>
              </thead>
              <tbody>
                {docs.map((d: any) => (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-4 py-2 flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{d.file_name}</td>
                    <td className="px-4 py-2 font-mono text-xs">{d.deals?.deal_number || "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{formatDate(d.created_at)}</td>
                    <td className="px-4 py-2 text-right"><Button variant="ghost" size="icon" onClick={() => download(d.file_path)}><Download className="h-4 w-4" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
