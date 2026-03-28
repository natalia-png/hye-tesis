// src/__tests__/routes.test.jsx
import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
import RoleRoute from "../components/RoleRoute";

jest.mock("../app/useAuth", () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from "../app/useAuth";

// ── ProtectedRoute ────────────────────────────────────────────
describe("ProtectedRoute", () => {
  test("no renderiza nada si ready=false", () => {
    useAuth.mockReturnValue({ user: null, ready: false });
    const { container } = render(
      <MemoryRouter>
        <ProtectedRoute><div>Contenido protegido</div></ProtectedRoute>
      </MemoryRouter>
    );
    expect(container.textContent).toBe("");
  });

  test("redirige a /login si no hay usuario y ready=true", () => {
    useAuth.mockReturnValue({ user: null, ready: true });
    const { container } = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <ProtectedRoute><div>Contenido protegido</div></ProtectedRoute>
      </MemoryRouter>
    );
    expect(container.textContent).not.toContain("Contenido protegido");
  });

  test("renderiza children cuando hay usuario autenticado", () => {
    useAuth.mockReturnValue({ user: { uid: "123", role: "admin" }, ready: true });
    const { container } = render(
      <MemoryRouter>
        <ProtectedRoute><div>Contenido protegido</div></ProtectedRoute>
      </MemoryRouter>
    );
    expect(container.textContent).toContain("Contenido protegido");
  });
});

// ── RoleRoute ─────────────────────────────────────────────────
describe("RoleRoute", () => {
  test("no renderiza nada si ready=false", () => {
    useAuth.mockReturnValue({ user: null, ready: false });
    const { container } = render(
      <MemoryRouter>
        <RoleRoute allow={["admin"]}><div>Admin area</div></RoleRoute>
      </MemoryRouter>
    );
    expect(container.textContent).toBe("");
  });

  test("redirige a /login si no hay usuario", () => {
    useAuth.mockReturnValue({ user: null, ready: true });
    const { container } = render(
      <MemoryRouter>
        <RoleRoute allow={["admin"]}><div>Admin area</div></RoleRoute>
      </MemoryRouter>
    );
    expect(container.textContent).not.toContain("Admin area");
  });

  test("no renderiza nada si role es null", () => {
    useAuth.mockReturnValue({ user: { uid: "123", role: null }, ready: true });
    const { container } = render(
      <MemoryRouter>
        <RoleRoute allow={["admin"]}><div>Admin area</div></RoleRoute>
      </MemoryRouter>
    );
    expect(container.textContent).toBe("");
  });

  test("redirige si el rol no está en allow", () => {
    useAuth.mockReturnValue({ user: { uid: "123", role: "cliente" }, ready: true });
    const { container } = render(
      <MemoryRouter>
        <RoleRoute allow={["admin"]}><div>Admin area</div></RoleRoute>
      </MemoryRouter>
    );
    expect(container.textContent).not.toContain("Admin area");
  });

  test("renderiza children si el rol tiene permiso", () => {
    useAuth.mockReturnValue({ user: { uid: "123", role: "admin" }, ready: true });
    const { container } = render(
      <MemoryRouter>
        <RoleRoute allow={["admin", "colaborador"]}><div>Admin area</div></RoleRoute>
      </MemoryRouter>
    );
    expect(container.textContent).toContain("Admin area");
  });

  test("colaborador puede acceder si está en allow", () => {
    useAuth.mockReturnValue({ user: { uid: "456", role: "colaborador" }, ready: true });
    const { container } = render(
      <MemoryRouter>
        <RoleRoute allow={["admin", "colaborador"]}><div>Panel colaborador</div></RoleRoute>
      </MemoryRouter>
    );
    expect(container.textContent).toContain("Panel colaborador");
  });
});
