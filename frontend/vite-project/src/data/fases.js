// src/data/fases.js

export const DEFAULT_FASES = [
  { id: "anteproyecto", nombre: "Anteproyecto", porcentaje: 0, estado: "pendiente", peso: 1 },
  { id: "diseno_arq", nombre: "Diseño arquitectónico", porcentaje: 0, estado: "pendiente", peso: 2 },
  { id: "diseno_est", nombre: "Diseño estructural", porcentaje: 0, estado: "pendiente", peso: 2 },
  { id: "tramites", nombre: "Trámites / jurídico", porcentaje: 0, estado: "pendiente", peso: 1 },
  { id: "ejecucion", nombre: "Ejecución", porcentaje: 0, estado: "pendiente", peso: 3 },
  { id: "entrega", nombre: "Entrega", porcentaje: 0, estado: "pendiente", peso: 1 },
];

export const cloneFases = (fases = DEFAULT_FASES) =>
  (Array.isArray(fases) ? fases : DEFAULT_FASES).map((f) => ({ ...f }));

export const normalizeFases = (fases) => {
  const list = Array.isArray(fases) && fases.length ? fases : DEFAULT_FASES;

  return list.map((f, idx) => {
    const id = String(f?.id || f?.key || DEFAULT_FASES[idx]?.id || `fase_${idx}`);
    const base = DEFAULT_FASES.find((x) => x.id === id);

    const nombre = String(f?.nombre || base?.nombre || "Fase");
    const estadoRaw = String(f?.estado || base?.estado || "pendiente").toLowerCase();
    const estado = ["en_curso", "completada", "pendiente"].includes(estadoRaw)
      ? estadoRaw : "pendiente";

    let porcentaje = Number(f?.porcentaje);
    if (!Number.isFinite(porcentaje)) porcentaje = Number(f?.progreso);
    if (!Number.isFinite(porcentaje)) porcentaje = Number(base?.porcentaje ?? 0);
    porcentaje = clampInt(porcentaje, 0, 100);

    if (estado === "completada") porcentaje = 100;
    if (estado === "pendiente" && porcentaje === 100) porcentaje = 0;

    let peso = Number(f?.peso);
    if (!Number.isFinite(peso)) peso = Number(base?.peso ?? 1);
    peso = Math.max(1, Math.round(peso));

    // ── Campos de responsable — se preservan tal cual, sin transformar ──
    const responsableUid = f?.responsableUid ?? null;
    const responsableNombre = f?.responsableNombre ?? null;
    const responsableSubRole = f?.responsableSubRole ?? null;

    // ── Fechas del plan (también se preservan) ──
    const fechaInicioPlaneada = f?.fechaInicioPlaneada ?? null;
    const fechaFinPlaneada = f?.fechaFinPlaneada ?? null;

    return {
      id,
      nombre,
      porcentaje,
      estado,
      peso,
      responsableUid,
      responsableNombre,
      responsableSubRole,
      fechaInicioPlaneada,
      fechaFinPlaneada,
    };
  });
};

export const calcAvanceGlobal = (fases = []) => {
  const list = normalizeFases(fases);
  if (!list.length) return 0;

  const totalPeso = list.reduce((acc, f) => acc + (Number.isFinite(f.peso) ? f.peso : 1), 0);
  if (!totalPeso) return 0;

  const sum = list.reduce((acc, f) => acc + (f.porcentaje * f.peso), 0);
  return clampInt(Math.round(sum / totalPeso), 0, 100);
};

export const labelEstado = (estado) => {
  if (estado === "en_curso") return "En curso";
  if (estado === "completada") return "Completada";
  return "Pendiente";
};

export const clampInt = (n, min, max) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return min;
  return Math.min(max, Math.max(min, Math.round(num)));
};