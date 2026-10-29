import type { ReactNode } from 'react';

export function SettingRow({
  label,
  description,
  hint,
  control,
}: {
  label: string;
  description?: string;
  hint?: string;
  control: ReactNode;
}) {
  return (
    <div className="ax-setting-row">
      <div>
        <div className="ax-setting-label">{label}</div>
        {description ? <div className="ax-setting-desc">{description}</div> : null}
        {hint ? <div className="ax-setting-hint">{hint}</div> : null}
      </div>
      <div className="ax-setting-control">{control}</div>
    </div>
  );
}
