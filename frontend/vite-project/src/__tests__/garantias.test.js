// src/__tests__/garantias.test.js
import {
  ESTADO_LABEL,
  ESTADO_STYLE,
  ESTADOS,
  calcFechaSolicitud,
} from "../data/garantias";

describe("ESTADO_LABEL", () => {
  test("contiene etiquetas para los tres estados", () => {
    expect(ESTADO_LABEL.pendiente).toBe("Pendiente");
    expect(ESTADO_LABEL.en_revision).toBe("En revisión");
    expect(ESTADO_LABEL.resuelto).toBe("Resuelto");
  });
});

describe("ESTADO_STYLE", () => {
  test("cada estado tiene clases CSS definidas", () => {
    expect(typeof ESTADO_STYLE.pendiente).toBe("string");
    expect(typeof ESTADO_STYLE.en_revision).toBe("string");
    expect(typeof ESTADO_STYLE.resuelto).toBe("string");
  });

  test("los estilos tienen clases de color distintas", () => {
    expect(ESTADO_STYLE.pendiente).toContain("amber");
    expect(ESTADO_STYLE.en_revision).toContain("blue");
    expect(ESTADO_STYLE.resuelto).toContain("emerald");
  });
});

describe("ESTADOS array", () => {
  test("contiene exactamente los tres estados válidos", () => {
    expect(ESTADOS).toEqual(["pendiente", "en_revision", "resuelto"]);
  });

  test("tiene longitud 3", () => {
    expect(ESTADOS).toHaveLength(3);
  });
});

describe("calcFechaSolicitud", () => {
  test("retorna '—' si createdAt no existe", () => {
    expect(calcFechaSolicitud({})).toBe("—");
    expect(calcFechaSolicitud({ createdAt: null })).toBe("—");
  });

  test("retorna fecha formateada cuando tiene toDate()", () => {
    const fecha = new Date(2024, 5, 15); // 15 jun 2024
    const solicitud = { createdAt: { toDate: () => fecha } };
    const resultado = calcFechaSolicitud(solicitud);
    expect(resultado).toContain("2024");
    expect(typeof resultado).toBe("string");
    expect(resultado.length).toBeGreaterThan(4);
  });

  test("incluye el mes en la fecha formateada", () => {
    const fecha = new Date(2025, 0, 10); // 10 ene 2025
    const solicitud = { createdAt: { toDate: () => fecha } };
    const resultado = calcFechaSolicitud(solicitud);
    expect(resultado).toContain("2025");
  });
});
