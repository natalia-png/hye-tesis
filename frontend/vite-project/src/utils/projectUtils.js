// src/utils/projectUtils.js
// Funciones utilitarias puras — sin dependencias externas

/**
 * Calcula el avance global de un proyecto promediando el porcentaje de sus fases.
 * @param {Array} fases - Lista de fases con campo `porcentaje`
 * @returns {number} Porcentaje de avance redondeado (0-100)
 */
export function calcAvance(fases = []) {
  if (!fases.length) return 0;
  const suma = fases.reduce((acc, f) => acc + (Number(f.porcentaje) || 0), 0);
  return Math.round(suma / fases.length);
}

/**
 * Formatea una fecha ISO a texto legible en español (Colombia).
 * @param {string} dateStr - Fecha en formato ISO o YYYY-MM-DD
 * @returns {string} Fecha formateada o "—" si es inválida
 */
export function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Genera un ID de chat directo entre dos usuarios.
 * El ID es determinista: siempre produce el mismo resultado
 * sin importar el orden de los argumentos.
 * @param {string} uid1
 * @param {string} uid2
 * @returns {string}
 */
export function buildDirectChatId(uid1, uid2) {
  return `direct_${[uid1, uid2].sort((a, b) => a.localeCompare(b)).join("_")}`;
}

/**
 * Genera el ID de chat de un proyecto.
 * @param {string} projectId
 * @returns {string}
 */
export function buildProjectChatId(projectId) {
  return `project_${projectId}`;
}

/**
 * Trunca un texto agregando "..." si supera el ancho máximo permitido.
 * @param {string} text - Texto original
 * @param {number} maxChars - Número máximo de caracteres antes de truncar
 * @returns {string}
 */
export function truncateText(text, maxChars) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3) + "...";
}

/**
 * Determina el color CSS del badge de estado de una fase.
 * @param {string} estado - "completada" | "en_curso" | "pendiente"
 * @returns {string} Clase Tailwind de color de fondo
 */
export function colorEstado(estado) {
  const mapa = {
    completada: "bg-green-600",
    en_curso: "bg-yellow-500",
    pendiente: "bg-gray-400",
  };
  return mapa[estado] || "bg-gray-400";
}

/**
 * Convierte un valor de presupuesto a formato de moneda COP.
 * @param {number} valor
 * @returns {string}
 */
export function formatCOP(valor) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(valor);
}
