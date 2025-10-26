// src/data/roles.js

// Definición de roles base
export const ROLES = {
  ADMIN: "admin",
  CLIENTE: "cliente",
  ARQUITECTO: "arquitecto",
  INGENIERO: "ingeniero",
  ABOGADO: "abogado",
};

// Accesos por módulo o vista
export const ACCESS = {
  DASHBOARD: ["admin", "arquitecto", "ingeniero", "abogado"],
  PROYECTOS_LIST: ["admin", "arquitecto", "ingeniero", "abogado"],
  PROYECTOS_CLIENTE: ["cliente"],
};

// 👇 ESTA FUNCIÓN es la que faltaba
export function isOneOf(role, allowed = []) {
  return allowed.includes(role);
}
