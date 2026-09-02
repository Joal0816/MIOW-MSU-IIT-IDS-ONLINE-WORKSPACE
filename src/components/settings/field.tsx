import { type InputHTMLAttributes } from "react";

export function Field({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        {...props}
        className="w-full rounded-xl border border-input bg-background/70 px-3 py-2 text-sm outline-none backdrop-blur-sm transition-shadow focus:ring-2 focus:ring-ring disabled:opacity-60"
      />
    </label>
  );
}
