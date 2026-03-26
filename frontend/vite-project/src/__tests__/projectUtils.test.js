// src/__tests__/projectUtils.test.js
import {
  calcAvance,
  formatDate,
  buildDirectChatId,
  buildProjectChatId,
  truncateText,
  colorEstado,
  formatCOP,
} from "../utils/projectUtils";

// ── calcAvance ────────────────────────────────────────────────
describe("calcAvance", () => {
  test("retorna 0 si no hay fases", () => {
    expect(calcAvance([])).toBe(0);
    expect(calcAvance()).toBe(0);
  });

  test("calcula el promedio correctamente", () => {
    const fases = [
      { porcentaje: 100 },
      { porcentaje: 50 },
      { porcentaje: 0 },
    ];
    expect(calcAvance(fases)).toBe(50);
  });

  test("redondea al entero más cercano", () => {
    const fases = [{ porcentaje: 100 }, { porcentaje: 0 }, { porcentaje: 0 }];
    expect(calcAvance(fases)).toBe(33);
  });

  test("ignora valores no numéricos", () => {
    const fases = [{ porcentaje: "abc" }, { porcentaje: 60 }];
    expect(calcAvance(fases)).toBe(30);
  });

  test("una sola fase al 75%", () => {
    expect(calcAvance([{ porcentaje: 75 }])).toBe(75);
  });
});

// ── formatDate ────────────────────────────────────────────────
describe("formatDate", () => {
  test("retorna '—' si dateStr es nulo o vacío", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("")).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });

  test("formatea correctamente una fecha ISO válida", () => {
    const resultado = formatDate("2025-06-15T12:00:00");
    expect(resultado).toContain("2025");
    expect(typeof resultado).toBe("string");
    expect(resultado.length).toBeGreaterThan(4);
  });

  test("incluye el año en el resultado", () => {
    const resultado = formatDate("2024-06-15T12:00:00");
    expect(resultado).toContain("2024");
  });
});

// ── buildDirectChatId ─────────────────────────────────────────
describe("buildDirectChatId", () => {
  test("genera un ID con prefijo 'direct_'", () => {
    expect(buildDirectChatId("aaa", "bbb")).toMatch(/^direct_/);
  });

  test("el resultado es determinista sin importar el orden", () => {
    const id1 = buildDirectChatId("userA", "userB");
    const id2 = buildDirectChatId("userB", "userA");
    expect(id1).toBe(id2);
  });

  test("contiene ambos UIDs en el ID", () => {
    const id = buildDirectChatId("uid-001", "uid-002");
    expect(id).toContain("uid-001");
    expect(id).toContain("uid-002");
  });
});

// ── buildProjectChatId ────────────────────────────────────────
describe("buildProjectChatId", () => {
  test("genera un ID con prefijo 'project_'", () => {
    expect(buildProjectChatId("proj-123")).toBe("project_proj-123");
  });
});

// ── truncateText ──────────────────────────────────────────────
describe("truncateText", () => {
  test("retorna el texto sin cambios si no supera el límite", () => {
    expect(truncateText("Hola", 10)).toBe("Hola");
  });

  test("trunca y agrega '...' cuando el texto es muy largo", () => {
    const resultado = truncateText("Texto muy largo para mostrar", 10);
    expect(resultado).toHaveLength(10);
    expect(resultado.endsWith("...")).toBe(true);
  });

  test("retorna cadena vacía si text es falsy", () => {
    expect(truncateText("", 10)).toBe("");
    expect(truncateText(null, 10)).toBe("");
  });
});

// ── colorEstado ───────────────────────────────────────────────
describe("colorEstado", () => {
  test("retorna clase verde para 'completada'", () => {
    expect(colorEstado("completada")).toBe("bg-green-600");
  });

  test("retorna clase amarilla para 'en_curso'", () => {
    expect(colorEstado("en_curso")).toBe("bg-yellow-500");
  });

  test("retorna clase gris para 'pendiente'", () => {
    expect(colorEstado("pendiente")).toBe("bg-gray-400");
  });

  test("retorna clase gris por defecto para estados desconocidos", () => {
    expect(colorEstado("otro")).toBe("bg-gray-400");
    expect(colorEstado("")).toBe("bg-gray-400");
    expect(colorEstado(undefined)).toBe("bg-gray-400");
  });
});

// ── formatCOP ─────────────────────────────────────────────────
describe("formatCOP", () => {
  test("retorna '—' para valores nulos o indefinidos", () => {
    expect(formatCOP(null)).toBe("—");
    expect(formatCOP(undefined)).toBe("—");
    expect(formatCOP(Number.NaN)).toBe("—");
  });

  test("formatea números con símbolo de peso colombiano", () => {
    const resultado = formatCOP(1000000);
    expect(resultado).toContain("$");
  });

  test("formatea correctamente el millón", () => {
    const resultado = formatCOP(1000000);
    expect(resultado).toMatch(/1\.000\.000|1,000,000/);
  });

  test("funciona con cero", () => {
    const resultado = formatCOP(0);
    expect(resultado).toContain("$");
  });
});
