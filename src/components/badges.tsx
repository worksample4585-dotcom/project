import { ReactNode } from "react";

const base = "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border";

export const StatusBadge = ({ status }: { status: string | null | undefined }) => {
  const s = (status || "active").toLowerCase();
  const map: Record<string, string> = {
    active: "bg-info/15 text-info border-info/30",
    pending: "bg-warning/15 text-warning border-warning/30",
    closed: "bg-muted text-muted-foreground border-border",
    cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return <span className={`${base} ${map[s] || map.active}`}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>;
};

export const DealTypeBadge = ({ type }: { type: string | null | undefined }) => {
  const t = (type || "purchase").toLowerCase();
  if (t === "sale") {
    return <span className={`${base} bg-warning/15 text-warning border-warning/30`}>Sale</span>;
  }
  return <span className={`${base} bg-primary/15 text-primary border-primary/30`}>Purchase</span>;
};

export const RoleBadge = ({ role }: { role: string | null | undefined }) => {
  const r = (role || "client").toLowerCase();
  const map: Record<string, string> = {
    admin: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    editor: "bg-info/15 text-info border-info/30",
    client: "bg-muted text-muted-foreground border-border",
  };
  return <span className={`${base} ${map[r] || map.client}`}>{r.charAt(0).toUpperCase() + r.slice(1)}</span>;
};

export const PaymentStatusBadge = ({ status }: { status: string | null | undefined }) => {
  const s = (status || "pending").toLowerCase();
  const map: Record<string, string> = {
    pending: "bg-warning/15 text-warning border-warning/30",
    partial: "bg-info/15 text-info border-info/30",
    paid: "bg-primary/15 text-primary border-primary/30",
    overdue: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return <span className={`${base} ${map[s] || map.pending}`}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>;
};

export const PartyRoleBadge = ({ role }: { role: string | null | undefined }) => {
  const r = (role || "other").toLowerCase();
  const map: Record<string, string> = {
    buyer: "bg-primary/15 text-primary border-primary/30",
    seller: "bg-warning/15 text-warning border-warning/30",
    agent: "bg-info/15 text-info border-info/30",
    witness: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    other: "bg-muted text-muted-foreground border-border",
  };
  return <span className={`${base} ${map[r] || map.other}`}>{r.charAt(0).toUpperCase() + r.slice(1)}</span>;
};

export const Pill = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <span className={`${base} ${className}`}>{children}</span>
);
