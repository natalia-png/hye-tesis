// src/data/roles.js
// Sistema de roles H&E Arquitectos
// admin        → Luisa (control total)
// colaborador  → Equipo interno (jurídica, sistemas, arquitecto)
// cliente      → Dueño del proyecto

export const ROLES = {
  ADMIN: "admin",
  COLABORADOR: "colaborador",
  CLIENTE: "cliente",
};

export const SUB_ROLES = {
  JURIDICA: "juridica",
  SISTEMAS: "sistemas",
  ARQUITECTO: "arquitecto",
};

export const SUB_ROLE_LABEL = {
  juridica: "Jurídica",
  sistemas: "Sistemas",
  arquitecto: "Arquitecto",
};

export const SUB_ROLE_COLOR = {
  juridica: "bg-violet-50 text-violet-700 border-violet-200",
  sistemas: "bg-blue-50   text-blue-700   border-blue-200",
  arquitecto: "bg-amber-50  text-amber-700  border-amber-200",
};

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
  // Solo admin ve módulo comercial
  COMERCIAL: ["admin"],
  // Admin + colaborador ven garantías admin
  GARANTIAS_ADMIN: ["admin", "colaborador"],
};

// Helper para RoleRoute
export function isOneOf(role, allowed = []) {
  if (!role) return false;
  return allowed.includes(role.toLowerCase().trim());
}

// Helper para saber si puede editar una fase específica
// Admin puede todo. Colaborador solo si es el responsableUid de esa fase.
export function canEditFase(userRole, userUid, fase) {
  if (!userRole) return false;
  if (userRole === "admin") return true;
  if (userRole === "colaborador") {
    return fase?.responsableUid === userUid;
  }
  return false;
}