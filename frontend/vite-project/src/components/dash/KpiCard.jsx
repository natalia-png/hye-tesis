export default function KpiCard({ label, value, hint, right }) {
  return (
    <div className="rounded-2xl border border-taupe/30 bg-ivory/90 px-3 py-3 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-ink/60">{label}</p>
          <p className="mt-1 text-[18px] font-semibold text-ink leading-none truncate">
            {value ?? "—"}
          </p>
          {hint && <p className="mt-1 text-[11px] text-ink/50">{hint}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </div>
  );
}