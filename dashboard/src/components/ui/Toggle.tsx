"use client";

export function Toggle({
  checked,
  onChange,
  labelOn = "Visible",
  labelOff = "Hidden",
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  labelOn?: string;
  labelOff?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 disabled:opacity-50"
    >
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-emerald-500" : "bg-fg/25"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
      <span
        className={`text-xs font-medium ${checked ? "text-emerald-700" : "text-fg/50"}`}
      >
        {checked ? labelOn : labelOff}
      </span>
    </button>
  );
}
