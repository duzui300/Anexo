export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="ax-switch"
      onClick={() => onChange(!checked)}
    >
      <span className="ax-switch__thumb" />
    </button>
  );
}
