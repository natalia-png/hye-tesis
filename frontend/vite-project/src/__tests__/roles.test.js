// src/__tests__/roles.test.js
import {
  ROLES,
  SUB_ROLES,
  SUB_ROLE_LABEL,
  SUB_ROLE_COLOR,
  ACCESS,
  isOneOf,
  canEditFase,
} from "../data/roles";

describe("ROLES constants", () => {
  test("contiene admin, colaborador y cliente", () => {
    expect(ROLES.ADMIN).toBe("admin");
    expect(ROLES.COLABORADOR).toBe("colaborador");
    expect(ROLES.CLIENTE).toBe("cliente");
  });
});

describe("SUB_ROLES constants", () => {
  test("contiene juridica, sistemas y arquitecto", () => {
    expect(SUB_ROLES.JURIDICA).toBe("juridica");
    expect(SUB_ROLES.SISTEMAS).toBe("sistemas");
    expect(SUB_ROLES.ARQUITECTO).toBe("arquitecto");
  });
});

describe("SUB_ROLE_LABEL", () => {
  test("tiene etiquetas en español para cada sub-rol", () => {
    expect(SUB_ROLE_LABEL.juridica).toBe("Jurídica");
    expect(SUB_ROLE_LABEL.sistemas).toBe("Sistemas");
    expect(SUB_ROLE_LABEL.arquitecto).toBe("Arquitecto");
  });
});

describe("SUB_ROLE_COLOR", () => {
  test("tiene clases CSS para cada sub-rol", () => {
    expect(typeof SUB_ROLE_COLOR.juridica).toBe("string");
    expect(typeof SUB_ROLE_COLOR.sistemas).toBe("string");
    expect(typeof SUB_ROLE_COLOR.arquitecto).toBe("string");
  });
});

describe("ACCESS permissions", () => {
  test("admin puede acceder a PROYECTOS_LIST", () => {
    expect(ACCESS.PROYECTOS_LIST).toContain("admin");
  });

  test("solo admin puede editar proyectos", () => {
    expect(ACCESS.PROYECTOS_EDIT).toEqual(["admin"]);
  });

  test("cliente ve sus proyectos", () => {
    expect(ACCESS.PROYECTOS_CLIENTE).toContain("cliente");
  });
});

describe("isOneOf", () => {
  test("retorna true si el rol está en la lista", () => {
    expect(isOneOf("admin", ["admin", "colaborador"])).toBe(true);
    expect(isOneOf("cliente", ["cliente"])).toBe(true);
  });

  test("retorna false si el rol no está en la lista", () => {
    expect(isOneOf("cliente", ["admin"])).toBe(false);
  });

  test("retorna false si role es null o undefined", () => {
    expect(isOneOf(null, ["admin"])).toBe(false);
    expect(isOneOf(undefined, ["admin"])).toBe(false);
  });

  test("es case-insensitive", () => {
    expect(isOneOf("Admin", ["admin"])).toBe(true);
    expect(isOneOf("ADMIN", ["admin"])).toBe(true);
  });

  test("maneja espacios", () => {
    expect(isOneOf(" admin ", ["admin"])).toBe(true);
  });

  test("retorna false con lista vacía", () => {
    expect(isOneOf("admin", [])).toBe(false);
  });

  test("usa lista vacía por defecto si no se pasa segundo argumento", () => {
    expect(isOneOf("admin")).toBe(false);
  });
});

describe("canEditFase", () => {
  test("admin puede editar cualquier fase", () => {
    expect(canEditFase("admin", "uid-admin", { responsableUid: "uid-otro" })).toBe(true);
    expect(canEditFase("admin", "uid-admin", {})).toBe(true);
  });

  test("colaborador puede editar solo sus fases", () => {
    expect(canEditFase("colaborador", "uid-colab", { responsableUid: "uid-colab" })).toBe(true);
    expect(canEditFase("colaborador", "uid-colab", { responsableUid: "uid-otro" })).toBe(false);
  });

  test("cliente no puede editar fases", () => {
    expect(canEditFase("cliente", "uid-c", { responsableUid: "uid-c" })).toBe(false);
  });

  test("retorna false si role es null", () => {
    expect(canEditFase(null, "uid", {})).toBe(false);
    expect(canEditFase(undefined, "uid", {})).toBe(false);
  });
});
