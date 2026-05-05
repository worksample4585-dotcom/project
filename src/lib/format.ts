import { format, parseISO } from "date-fns";

/** Pakistani lakh/crore comma system. */
export function formatPKR(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  if (!isFinite(n)) return "PKR 0";
  const negative = n < 0;
  const str = Math.round(Math.abs(n)).toString();
  let result: string;
  if (str.length <= 3) {
    result = str;
  } else {
    const last3 = str.slice(-3);
    const rest = str.slice(0, -3);
    // Group remaining by 2 from right
    const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    result = `${grouped},${last3}`;
  }
  return `${negative ? "-" : ""}PKR ${result}`;
}

export function formatArea(value: number | string | null | undefined, unit: string | null | undefined): string {
  const n = Number(value ?? 0);
  const u = unit || "Acre";
  if (u === "Acre") return `${n.toFixed(2)} Acre`;
  return `${Math.round(n)} ${u}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "d MMM yyyy");
  } catch {
    try { return format(new Date(dateStr), "d MMM yyyy"); } catch { return dateStr; }
  }
}

export function formatBytes(bytes: number | null | undefined): string {
  const b = Number(bytes ?? 0);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}
