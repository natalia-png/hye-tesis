// src/data/fases.js

// Pesos profesionales (tesis): no todas las fases “valen” igual
// (puedes ajustarlos, pero esto se ve serio y realista)
export const DEFAULT_FASES = [
  { id: "anteproyecto", nombre: "Anteproyecto", porcentaje: 0, estado: "pendiente", peso: 1 },
  { id: "diseno_arq", nombre: "Diseño arquitectónico", porcentaje: 0, estado: "pendiente", peso: 2 },
  { id: "diseno_est", nombre: "Diseño estructural", porcentaje: 0, estado: "pendiente", peso: 2 },
  { id: "tramites", nombre: "Trámites / jurídico", porcentaje: 0, estado: "pendiente", peso: 1 },
  { id: "ejecucion", nombre: "Ejecución", porcentaje: 0, estado: "pendiente", peso: 3 },
  { id: "entrega", nombre: "Entrega", porcentaje: 0, estado: "pendiente", peso: 1 },
];

// Clona fases para evitar referencias compartidas entre proyectos
export const cloneFases = (fases = DEFAULT_FASES) =>
  (Array.isArray(fases) ? fases : DEFAULT_FASES).map((f) => ({ ...f }));

// Normaliza: soporta datos viejos (por si tienes proyectos ya creados)
// - id/key
// - porcentaje/progreso
// - estado
// - peso
export const normalizeFases = (fases) => {
  const list = Array.isArray(fases) && fases.length ? fases : DEFAULT_FASES;

  return list.map((f, idx) => {
    const id = String(f?.id || f?.key || DEFAULT_FASES[idx]?.id || `fase_${idx}`);
    const base = DEFAULT_FASES.find((x) => x.id === id);

    const nombre = String(f?.nombre || base?.nombre || "Fase");
    const estadoRaw = String(f?.estado || base?.estado || "pendiente").toLowerCase();

    const estado =
      estadoRaw === "en_curso" || estadoRaw === "completada" || estadoRaw === "pendiente"
        ? estadoRaw
        : "pendiente";

    // porcentaje: acepta porcentaje / progreso (compat)
    let porcentaje = Number(f?.porcentaje);
    if (!Number.isFinite(porcentaje)) porcentaje = Number(f?.progreso);
    if (!Number.isFinite(porcentaje)) porcentaje = Number(base?.porcentaje ?? 0);

    porcentaje = clampInt(porcentaje, 0, 100);

    // reglas de consistencia
    if (estado === "completada") porcentaje = 100;
    if (estado === "pendiente" && porcentaje === 100) porcentaje = 0;

    let peso = Number(f?.peso);
    if (!Number.isFinite(peso)) peso = Number(base?.peso ?? 1);
    peso = Math.max(1, Math.round(peso));

    return { id, nombre, porcentaje, estado, peso };
  });
};

// Avance global PONDERADO (más realista)
export const calcAvanceGlobal = (fases = []) => {
  const list = normalizeFases(fases);
  if (!list.length) return 0;

  const totalPeso = list.reduce((acc, f) => acc + (Number.isFinite(f.peso) ? f.peso : 1), 0);
  if (!totalPeso) return 0;

  const sum = list.reduce((acc, f) => acc + (f.porcentaje * f.peso), 0);
  const avg = sum / totalPeso;

  return clampInt(Math.round(avg), 0, 100);
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
