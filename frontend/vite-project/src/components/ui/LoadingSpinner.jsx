// src/components/ui/LoadingSpinner.jsx
export default function LoadingSpinner({ text = "Cargando…" }) {
  return (
    <div className="flex items-center gap-2 py-6">
      <div className="w-4 h-4 rounded-full border-2 border-ink/20 border-t-ink animate-spin" />
      <p className="text-[13px] text-ink/50">{text}</p>
    </div>
  );
}
