// src/data/garantias.js
// Constantes compartidas entre GarantiasAdmin y GarantiasCliente

export const ESTADO_LABEL = {
  pendiente: "Pendiente",
  en_revision: "En revisión",
  resuelto: "Resuelto",
};

export const ESTADO_STYLE = {
  pendiente: "bg-amber-50  text-amber-700  border-amber-200",
  en_revision: "bg-blue-50   text-blue-700   border-blue-200",
  resuelto: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export const ESTADOS = ["pendiente", "en_revision", "resuelto"];
