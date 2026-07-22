import { cn } from "@/lib/utils";

export default function Pills({ options, value, onChange, className, style }) {
  return (
    <div className={cn("pills", className)} style={style}>
      {options.map((o) => (
        <div
          key={o.value}
          className={cn("pill", value === o.value && "active")}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </div>
      ))}
    </div>
  );
}
