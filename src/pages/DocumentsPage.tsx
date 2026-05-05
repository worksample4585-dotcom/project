import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, FileText, Image as ImageIcon, FileSpreadsheet, File as FileIcon, Search } from "lucide-react";
import { formatBytes, formatDate } from "@/lib/format";
import toast from "react-hot-toast";

const fileIcon = (type?: string) => {
  if (!type) return <FileIcon className="h-4 w-4 text-muted-foreground" />;
  if (type.includes("pdf")) return <FileText className="h-4 w-4 text-destructive" />;
  if (type.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-info" />;
  if (type.includes("spreadsheet") || type.includes("csv") || type.includes("excel")) return <FileSpreadsheet className="h-4 w-4 text-primary" />;
  if (type.includes("word") || type.includes("document")) return <FileText className="h-4 w-4 text-info" />;
  return <FileIcon className="h-4 w-4 text-muted-foreground" />;
};

const download = async (path: string) => {
  const { data, error } = await supabase.storage.from("deal-documents").createSignedUrl(path, 60);
  if (error || !data) { toast.error("Download failed"); return; }
  window.open(data.signedUrl, "_blank");
};

export default function DocumentsPage() {
  const [search, setSearch] = useState("");
  const [dealF, setDealF] = useState("all");
  const [clientF, setClientF] = useState("all");

  const { data: deals = [] } = useQuery({
    queryKey: ["deals-min"],
    queryFn: async () => (await supabase.from("deals").select("id, deal_number")).data || [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email").eq("role", "client")).data || [],
  });
  const { data: dealDocs = [] } = useQuery({
    queryKey: ["doc-deals"],
    queryFn: async () => (await supabase.from("documents")
      .select("*, deals(deal_number), uploader:uploaded_by(full_name)")
      .not("deal_id", "is", null)
      .order("created_at", { ascending: false })).data || [],
  });
  const { data: clientDocs = [] } = useQuery({
    queryKey: ["doc-clients"],
    queryFn: async () => (await supabase.from("documents")
      .select("*, profiles:client_id(full_name)")
      .not("client_id", "is", null)
      .order("created_at", { ascending: false })).data || [],
  });

  const dealFiltered = useMemo(() => dealDocs.filter((d: any) => {
    if (dealF !== "all" && d.deal_id !== dealF) return false;
    if (search && !d.file_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [dealDocs, search, dealF]);
  const clientFiltered = useMemo(() => clientDocs.filter((d: any) => {
    if (clientF !== "all" && d.client_id !== clientF) return false;
    if (search && !d.file_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [clientDocs, search, clientF]);

  return (
    <AppLayout>
      <h1 className="text-2xl md:text-3xl font-bold mb-1">Documents</h1>
      <p className="text-sm text-muted-foreground mb-5">Browse all uploaded files.</p>

      <Tabs defaultValue="deal">
        <TabsList>
          <TabsTrigger value="deal">Deal Documents</TabsTrigger>
          <TabsTrigger value="client">Client Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="deal" className="mt-4">
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search file name" className="pl-9" /></div>
            <select value={dealF} onChange={(e) => setDealF(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="all">All Deals</option>{deals.map((d: any) => <option key={d.id} value={d.id}>{d.deal_number}</option>)}
            </select>
          </div>
          <DocTable rows={dealFiltered} keyLabel="Deal" />
        </TabsContent>

        <TabsContent value="client" className="mt-4">
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search file name" className="pl-9" /></div>
            <select value={clientF} onChange={(e) => setClientF(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="all">All Clients</option>{clients.map((c: any) => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}
            </select>
          </div>
          <DocTable rows={clientFiltered} keyLabel="Client" />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function DocTable({ rows, keyLabel }: { rows: any[]; keyLabel: string }) {
  if (rows.length === 0) return <div className="bg-card border border-border rounded-lg py-12 text-center text-sm text-muted-foreground">No documents</div>;
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr><th className="text-left px-4 py-2">File</th><th className="text-left px-4 py-2">{keyLabel}</th><th className="text-left px-4 py-2">Size</th><th className="text-left px-4 py-2">Date</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((d: any) => (
            <tr key={d.id} className="border-t border-border">
              <td className="px-4 py-2 flex items-center gap-2">{fileIcon(d.file_type)}<span className="truncate max-w-xs">{d.file_name}</span></td>
              <td className="px-4 py-2 font-mono text-xs">{d.deals?.deal_number || d.profiles?.full_name || "—"}</td>
              <td className="px-4 py-2 text-muted-foreground text-xs">{formatBytes(d.file_size)}</td>
              <td className="px-4 py-2 text-muted-foreground text-xs">{formatDate(d.created_at)}</td>
              <td className="px-4 py-2 text-right"><Button variant="ghost" size="icon" onClick={() => download(d.file_path)}><Download className="h-4 w-4" /></Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
