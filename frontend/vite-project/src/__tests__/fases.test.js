// src/__tests__/fases.test.js
import {
  DEFAULT_FASES,
  cloneFases,
  normalizeFases,
  calcAvanceGlobal,
  labelEstado,
  clampInt,
} from "../data/fases";

// ── DEFAULT_FASES ─────────────────────────────────────────────
describe("DEFAULT_FASES", () => {
  test("contiene 6 fases", () => {
    expect(DEFAULT_FASES).toHaveLength(6);
  });

  test("todas las fases tienen estado 'pendiente' por defecto", () => {
    DEFAULT_FASES.forEach(f => expect(f.estado).toBe("pendiente"));
  });

  test("todas las fases tienen porcentaje 0 por defecto", () => {
    DEFAULT_FASES.forEach(f => expect(f.porcentaje).toBe(0));
  });

  test("contiene la fase 'ejecucion' con peso 3", () => {
    const ejecucion = DEFAULT_FASES.find(f => f.id === "ejecucion");
    expect(ejecucion).toBeDefined();
    expect(ejecucion.peso).toBe(3);
  });
});

// ── clampInt ──────────────────────────────────────────────────
describe("clampInt", () => {
  test("retorna el valor dentro del rango", () => {
    expect(clampInt(50, 0, 100)).toBe(50);
  });

  test("clampea valores por encima del máximo", () => {
    expect(clampInt(150, 0, 100)).toBe(100);
  });

  test("clampea valores por debajo del mínimo", () => {
    expect(clampInt(-10, 0, 100)).toBe(0);
  });

  test("retorna min si el valor no es finito", () => {
    expect(clampInt(NaN, 0, 100)).toBe(0);
    expect(clampInt(Infinity, 0, 100)).toBe(100);
  });

  test("redondea al entero más cercano", () => {
    expect(clampInt(3.7, 0, 100)).toBe(4);
    expect(clampInt(3.2, 0, 100)).toBe(3);
  });
});

// ── cloneFases ────────────────────────────────────────────────
describe("cloneFases", () => {
  test("retorna una copia profunda de DEFAULT_FASES si no se pasa argumento", () => {
    const clon = cloneFases();
    expect(clon).toHaveLength(DEFAULT_FASES.length);
    expect(clon).not.toBe(DEFAULT_FASES);
  });

  test("retorna copias independientes (no la misma referencia)", () => {
    const clon = cloneFases();
    clon[0].porcentaje = 99;
    expect(DEFAULT_FASES[0].porcentaje).toBe(0);
  });

  test("acepta un array personalizado", () => {
    const custom = [{ id: "a", nombre: "A", porcentaje: 50, estado: "en_curso", peso: 1 }];
    const result = cloneFases(custom);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });

  test("usa DEFAULT_FASES si se pasa un valor no-array", () => {
    const result = cloneFases(null);
    expect(result).toHaveLength(DEFAULT_FASES.length);
  });
});

// ── labelEstado ───────────────────────────────────────────────
describe("labelEstado", () => {
  test("retorna 'En curso' para en_curso", () => {
    expect(labelEstado("en_curso")).toBe("En curso");
  });

  test("retorna 'Completada' para completada", () => {
    expect(labelEstado("completada")).toBe("Completada");
  });

  test("retorna 'Pendiente' para cualquier otro valor", () => {
    expect(labelEstado("pendiente")).toBe("Pendiente");
    expect(labelEstado("otro")).toBe("Pendiente");
    expect(labelEstado("")).toBe("Pendiente");
    expect(labelEstado(undefined)).toBe("Pendiente");
  });
});

// ── normalizeFases ────────────────────────────────────────────
describe("normalizeFases", () => {
  test("retorna DEFAULT_FASES cuando se pasa array vacío", () => {
    const result = normalizeFases([]);
    expect(result).toHaveLength(DEFAULT_FASES.length);
  });

  test("retorna DEFAULT_FASES cuando se pasa null", () => {
    const result = normalizeFases(null);
    expect(result).toHaveLength(DEFAULT_FASES.length);
  });

  test("normaliza porcentaje a entero entre 0 y 100", () => {
    const result = normalizeFases([{ id: "anteproyecto", porcentaje: 150 }]);
    expect(result[0].porcentaje).toBe(100);
  });

  test("fuerza porcentaje=100 si estado es completada", () => {
    const result = normalizeFases([{ id: "anteproyecto", porcentaje: 50, estado: "completada" }]);
    expect(result[0].porcentaje).toBe(100);
  });

  test("fuerza porcentaje=0 si estado=pendiente y porcentaje=100", () => {
    const result = normalizeFases([{ id: "anteproyecto", porcentaje: 100, estado: "pendiente" }]);
    expect(result[0].porcentaje).toBe(0);
  });

  test("normaliza estado inválido a 'pendiente'", () => {
    const result = normalizeFases([{ id: "anteproyecto", estado: "invalido" }]);
    expect(result[0].estado).toBe("pendiente");
  });

  test("acepta estado en_curso correctamente", () => {
    const result = normalizeFases([{ id: "ejecucion", estado: "en_curso", porcentaje: 60 }]);
    expect(result[0].estado).toBe("en_curso");
    expect(result[0].porcentaje).toBe(60);
  });

  test("preserva responsableUid si se provee", () => {
    const result = normalizeFases([{ id: "anteproyecto", responsableUid: "uid-123" }]);
    expect(result[0].responsableUid).toBe("uid-123");
  });
});

// ── calcAvanceGlobal ──────────────────────────────────────────
describe("calcAvanceGlobal", () => {
  test("retorna 0 con array vacío", () => {
    expect(calcAvanceGlobal([])).toBe(0);
  });

  test("retorna 0 con array vacío implícito", () => {
    expect(calcAvanceGlobal()).toBe(0);
  });

  test("calcula promedio ponderado correctamente", () => {
    const fases = [
      { id: "anteproyecto", porcentaje: 100, estado: "completada", peso: 1 },
      { id: "ejecucion", porcentaje: 0, estado: "pendiente", peso: 1 },
    ];
    const result = calcAvanceGlobal(fases);
    expect(result).toBe(50);
  });

  test("usa peso para ponderar el avance", () => {
    const fases = [
      { id: "anteproyecto", porcentaje: 100, estado: "completada", peso: 1 },
      { id: "ejecucion", porcentaje: 0, estado: "pendiente", peso: 3 },
    ];
    const result = calcAvanceGlobal(fases);
    expect(result).toBe(25); // (100*1 + 0*3) / 4 = 25
  });

  test("resultado entre 0 y 100", () => {
    const fases = DEFAULT_FASES.map(f => ({ ...f, porcentaje: 50, estado: "en_curso" }));
    const result = calcAvanceGlobal(fases);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });
});
