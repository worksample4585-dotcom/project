import { Input } from "@/components/ui/input";

const AREA_UNITS = ["Acre", "Canal", "Kanal", "Marla"];

export const PKRInput = ({
  value,
  onChange,
  placeholder = "0",
  required,
}: {
  value: number | string;
  onChange: (v: number) => void;
  placeholder?: string;
  required?: boolean;
}) => (
  <div className="flex">
    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm font-medium">
      PKR
    </span>
    <Input
      type="number"
      min={0}
      step="0.01"
      value={value === 0 ? "" : value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      placeholder={placeholder}
      required={required}
      className="rounded-l-none"
    />
  </div>
);

export const AreaInput = ({
  value,
  unit,
  onValueChange,
  onUnitChange,
}: {
  value: number | string;
  unit: string;
  onValueChange: (v: number) => void;
  onUnitChange: (u: string) => void;
}) => (
  <div className="flex gap-2">
    <Input
      type="number"
      min={0}
      step="0.01"
      value={value === 0 ? "" : value}
      onChange={(e) => onValueChange(parseFloat(e.target.value) || 0)}
      placeholder="0.00"
      className="flex-1"
    />
    <select
      value={unit}
      onChange={(e) => onUnitChange(e.target.value)}
      className="px-3 rounded-md border border-input bg-background text-foreground text-sm h-10 w-28"
    >
      {AREA_UNITS.map((u) => (
        <option key={u} value={u}>{u}</option>
      ))}
    </select>
  </div>
);

export { AREA_UNITS };
