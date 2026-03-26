// src/utils/timeAgo.js
// Convierte una fecha a texto relativo (ej. "hace 5min", "ahora", "hace 2h")

export function timeAgo(value) {
  if (!value) return "—";
  const d = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "ahora";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}
