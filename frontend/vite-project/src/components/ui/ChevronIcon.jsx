// src/components/ui/ChevronIcon.jsx
export default function ChevronIcon({ expanded }) {
  return (
    <svg
      className={`w-4 h-4 text-ink/30 transition-transform ${expanded ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <polyline points="6 9 12 15 18 9" strokeWidth="2" />
    </svg>
  );
}
