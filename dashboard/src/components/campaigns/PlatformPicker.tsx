"use client";

/** Toggle chips for choosing platforms. */
export function PlatformPicker({
  options,
  value,
  onChange,
  disabled,
}: {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  // Keeps values saved earlier that are not among the options.
  const all = [...options, ...value.filter((item) => !options.includes(item))];
  return (
    <div className="flex flex-wrap gap-2">
      {all.map((platform) => {
        const active = value.includes(platform);
        return (
          <button
            key={platform}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() =>
              onChange(active ? value.filter((item) => item !== platform) : [...value, platform])
            }
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
              active
                ? "border-fg bg-fg text-canvas"
                : "border-line bg-subtle text-fg/70 hover:border-fg/30 hover:text-fg"
            }`}
          >
            {platform}
          </button>
        );
      })}
    </div>
  );
}
