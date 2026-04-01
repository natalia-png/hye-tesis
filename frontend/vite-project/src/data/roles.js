// src/data/roles.js
// Sistema de roles H&E Arquitectos
// admin        → Luisa (control total)
// colaborador  → Equipo interno (jurídica, sistemas, arquitecto, etc.)
// cliente      → Dueño del proyecto

export const ROLES = {
  ADMIN: "admin",
  COLABORADOR: "colaborador",
  CLIENTE: "cliente",
};

export const SUB_ROLE_COLOR_MAP = {
  "Arquitecto":          "bg-amber-50   text-amber-700   border-amber-200",
  "Diseño":              "bg-pink-50    text-pink-700    border-pink-200",
  "Residente de obra":   "bg-orange-50  text-orange-700  border-orange-200",
  "Jurídica":            "bg-violet-50  text-violet-700  border-violet-200",
  "Coordinación":        "bg-teal-50    text-teal-700    border-teal-200",
  // legado (valores en inglés/sin tilde guardados antes)
  juridica:     "bg-violet-50  text-violet-700  border-violet-200",
  sistemas:     "bg-blue-50    text-blue-700    border-blue-200",
  arquitecto:   "bg-amber-50   text-amber-700   border-amber-200",
  diseno:       "bg-pink-50    text-pink-700    border-pink-200",
  obra:         "bg-orange-50  text-orange-700  border-orange-200",
  coordinacion: "bg-teal-50    text-teal-700    border-teal-200",
  financiero:   "bg-green-50   text-green-700   border-green-200",
  comercial:    "bg-rose-50    text-rose-700    border-rose-200",
};

// Para cualquier área personalizada que no esté en el mapa
const DEFAULT_ROLE_COLOR = "bg-sand text-ink/70 border-taupe/30";

export function getSubRoleColor(subRole) {
  if (!subRole) return DEFAULT_ROLE_COLOR;
  return SUB_ROLE_COLOR_MAP[subRole] || DEFAULT_ROLE_COLOR;
}

// Mantener compatibilidad con imports existentes
export const SUB_ROLE_LABEL = {};
export const SUB_ROLE_COLOR = SUB_ROLE_COLOR_MAP;

// ── Permisos por sección ──────────────────────────────────────
export const ACCESS = {
  // Admin + colaborador pueden ver lista de proyectos
  PROYECTOS_LIST: ["admin", "colaborador"],
  // Solo admin puede crear / editar proyectos
  PROYECTOS_EDIT: ["admin"],
  // Solo cliente ve sus proyectos
  PROYECTOS_CLIENTE: ["cliente"],
  // Admin + colaborador ven historial
  HISTORIAL: ["admin"],
  // Admin + colaborador ven módulo comercial
  COMERCIAL: ["admin", "colaborador"],
  // Admin + colaborador ven garantías admin
  GARANTIAS_ADMIN: ["admin", "colaborador"],
};

// Helper para RoleRoute
export function isOneOf(role, allowed = []) {
  if (!role) return false;
  return allowed.includes(role.toLowerCase().trim());
}

// Helper para saber si puede editar una fase específica
// Admin tiene acceso completo. Colaborador solo si es el responsableUid de esa fase.
export function canEditFase(userRole, userUid, fase) {
  if (!userRole) return false;
  if (userRole === "admin") return true;
  if (userRole === "colaborador") {
    return fase?.responsableUid === userUid;
  }
  return false;
}
