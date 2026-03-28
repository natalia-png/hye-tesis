// src/__tests__/ui.components.test.jsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ChevronIcon from "../components/ui/ChevronIcon";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import UploadProgress from "../components/ui/UploadProgress";
import AttachIcon from "../components/ui/AttachIcon";
import FiltroTabs from "../components/ui/FiltroTabs";

// ── ChevronIcon ───────────────────────────────────────────────
describe("ChevronIcon", () => {
  test("renderiza un SVG", () => {
    const { container } = render(<ChevronIcon />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  test("aplica clase rotate-180 cuando expanded=true", () => {
    const { container } = render(<ChevronIcon expanded={true} />);
    const svg = container.querySelector("svg");
    expect(svg.getAttribute("class")).toContain("rotate-180");
  });

  test("no aplica rotate-180 cuando expanded=false", () => {
    const { container } = render(<ChevronIcon expanded={false} />);
    const svg = container.querySelector("svg");
    expect(svg.getAttribute("class")).not.toContain("rotate-180");
  });

  test("renderiza sin props", () => {
    const { container } = render(<ChevronIcon />);
    expect(container.firstChild).not.toBeNull();
  });
});

// ── LoadingSpinner ────────────────────────────────────────────
describe("LoadingSpinner", () => {
  test("muestra el texto por defecto 'Cargando…'", () => {
    render(<LoadingSpinner />);
    expect(screen.getByText("Cargando…")).not.toBeNull();
  });

  test("muestra el texto personalizado", () => {
    render(<LoadingSpinner text="Procesando…" />);
    expect(screen.getByText("Procesando…")).not.toBeNull();
  });

  test("renderiza el spinner animado", () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
  });
});

// ── UploadProgress ────────────────────────────────────────────
describe("UploadProgress", () => {
  test("no renderiza nada si progress es 0", () => {
    const { container } = render(<UploadProgress progress={0} />);
    expect(container.firstChild).toBeNull();
  });

  test("no renderiza nada si progress es undefined", () => {
    const { container } = render(<UploadProgress />);
    expect(container.firstChild).toBeNull();
  });

  test("renderiza la barra cuando progress > 0", () => {
    render(<UploadProgress progress={50} />);
    expect(screen.getByText(/50%/)).not.toBeNull();
  });

  test("muestra el label por defecto 'Subiendo…'", () => {
    render(<UploadProgress progress={30} />);
    expect(screen.getByText(/Subiendo/)).not.toBeNull();
  });

  test("muestra label personalizado", () => {
    render(<UploadProgress progress={70} label="Guardando…" />);
    expect(screen.getByText(/Guardando/)).not.toBeNull();
  });

  test("la barra tiene el ancho correcto", () => {
    const { container } = render(<UploadProgress progress={60} />);
    const bar = container.querySelector("[style]");
    expect(bar.style.width).toBe("60%");
  });
});

// ── AttachIcon ────────────────────────────────────────────────
describe("AttachIcon", () => {
  test("renderiza un SVG", () => {
    const { container } = render(<AttachIcon />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  test("aplica la clase por defecto 'w-4 h-4'", () => {
    const { container } = render(<AttachIcon />);
    const svg = container.querySelector("svg");
    expect(svg.getAttribute("class")).toContain("w-4");
    expect(svg.getAttribute("class")).toContain("h-4");
  });

  test("aplica className personalizado", () => {
    const { container } = render(<AttachIcon className="w-6 h-6" />);
    const svg = container.querySelector("svg");
    expect(svg.getAttribute("class")).toContain("w-6");
  });
});

// ── FiltroTabs ────────────────────────────────────────────────
describe("FiltroTabs", () => {
  const tabs = [
    { key: "todos", label: "Todos" },
    { key: "activos", label: "Activos" },
  ];
  const conteo = { todos: 5, activos: 3 };
  const mockChange = jest.fn();

  beforeEach(() => mockChange.mockClear());

  test("renderiza todos los tabs", () => {
    render(<FiltroTabs tabs={tabs} filtro="todos" conteo={conteo} onChange={mockChange} />);
    expect(screen.getByText("Todos")).not.toBeNull();
    expect(screen.getByText("Activos")).not.toBeNull();
  });

  test("llama onChange con la key correcta al hacer click", () => {
    render(<FiltroTabs tabs={tabs} filtro="todos" conteo={conteo} onChange={mockChange} />);
    fireEvent.click(screen.getByText("Activos"));
    expect(mockChange).toHaveBeenCalledWith("activos");
  });

  test("muestra el conteo cuando es mayor a 0", () => {
    render(<FiltroTabs tabs={tabs} filtro="todos" conteo={conteo} onChange={mockChange} />);
    expect(screen.getByText("3")).not.toBeNull();
  });

  test("el tab activo tiene clase bg-ink", () => {
    const { container } = render(
      <FiltroTabs tabs={tabs} filtro="todos" conteo={conteo} onChange={mockChange} />
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons[0].getAttribute("class")).toContain("bg-ink");
  });

  test("no muestra conteo cuando es 0", () => {
    const conteoVacio = { todos: 0, activos: 0 };
    const { container } = render(
      <FiltroTabs tabs={tabs} filtro="todos" conteo={conteoVacio} onChange={mockChange} />
    );
    const spans = container.querySelectorAll("span");
    expect(spans.length).toBe(0);
  });
});
