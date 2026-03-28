// src/__tests__/dash.components.test.jsx
import React from "react";
import { render, screen } from "@testing-library/react";
import InsightCard from "../components/dash/InsightCard";
import KpiCard from "../components/dash/KpiCard";
import PhaseBars from "../components/dash/PhaseBars";
import RingChart from "../components/dash/RingChart";

// ── InsightCard ───────────────────────────────────────────────
describe("InsightCard", () => {
  test("muestra el título y el texto", () => {
    render(<InsightCard title="Alerta" text="3 proyectos vencidos" />);
    expect(screen.getByText("Alerta")).not.toBeNull();
    expect(screen.getByText("3 proyectos vencidos")).not.toBeNull();
  });

  test("muestra el tag cuando se provee", () => {
    render(<InsightCard title="Info" text="Texto" tag="Urgente" />);
    expect(screen.getByText("Urgente")).not.toBeNull();
  });

  test("no muestra tag si no se provee", () => {
    render(<InsightCard title="Info" text="Texto" />);
    expect(screen.queryByText("Urgente")).toBeNull();
  });

  test("renderiza sin props opcionales", () => {
    const { container } = render(<InsightCard />);
    expect(container.firstChild).not.toBeNull();
  });
});

// ── KpiCard ───────────────────────────────────────────────────
describe("KpiCard", () => {
  test("muestra label y value", () => {
    render(<KpiCard label="Proyectos activos" value={12} />);
    expect(screen.getByText("Proyectos activos")).not.toBeNull();
    expect(screen.getByText("12")).not.toBeNull();
  });

  test("muestra '—' cuando value es null", () => {
    render(<KpiCard label="Total" value={null} />);
    expect(screen.getByText("—")).not.toBeNull();
  });

  test("muestra hint cuando se provee", () => {
    render(<KpiCard label="Label" value={5} hint="Último mes" />);
    expect(screen.getByText("Último mes")).not.toBeNull();
  });

  test("no muestra hint si no se provee", () => {
    render(<KpiCard label="Label" value={5} />);
    expect(screen.queryByText("Último mes")).toBeNull();
  });

  test("renderiza el slot right cuando se provee", () => {
    render(<KpiCard label="L" value={1} right={<span>icono</span>} />);
    expect(screen.getByText("icono")).not.toBeNull();
  });
});

// ── PhaseBars ─────────────────────────────────────────────────
describe("PhaseBars", () => {
  test("muestra mensaje cuando no hay fases", () => {
    render(<PhaseBars fases={[]} />);
    expect(screen.getByText("No hay fases registradas.")).not.toBeNull();
  });

  test("muestra mensaje cuando fases es undefined", () => {
    render(<PhaseBars />);
    expect(screen.getByText("No hay fases registradas.")).not.toBeNull();
  });

  test("renderiza las fases correctamente", () => {
    const fases = [
      { id: "1", nombre: "Diseño", porcentaje: 80, estado: "en_curso" },
      { id: "2", nombre: "Construcción", porcentaje: 30, estado: "pendiente" },
    ];
    render(<PhaseBars fases={fases} />);
    expect(screen.getByText("Diseño")).not.toBeNull();
    expect(screen.getByText("Construcción")).not.toBeNull();
    expect(screen.getByText("80%")).not.toBeNull();
    expect(screen.getByText("30%")).not.toBeNull();
  });

  test("muestra 'En curso' para estado en_curso", () => {
    const fases = [{ id: "1", nombre: "Fase", porcentaje: 50, estado: "en_curso" }];
    render(<PhaseBars fases={fases} />);
    expect(screen.getByText("En curso")).not.toBeNull();
  });

  test("muestra 'Completada' para estado completada", () => {
    const fases = [{ id: "1", nombre: "Fase", porcentaje: 100, estado: "completada" }];
    render(<PhaseBars fases={fases} />);
    expect(screen.getByText("Completada")).not.toBeNull();
  });

  test("muestra 'Pendiente' para estado desconocido", () => {
    const fases = [{ id: "1", nombre: "Fase", porcentaje: 0, estado: "otro" }];
    render(<PhaseBars fases={fases} />);
    expect(screen.getByText("Pendiente")).not.toBeNull();
  });

  test("en modo compact no muestra etiqueta de estado", () => {
    const fases = [{ id: "1", nombre: "Fase", porcentaje: 50, estado: "en_curso" }];
    render(<PhaseBars fases={fases} compact={true} />);
    expect(screen.queryByText("En curso")).toBeNull();
  });

  test("clampea porcentaje a 0-100", () => {
    const fases = [{ id: "1", nombre: "Fase", porcentaje: 150, estado: "en_curso" }];
    render(<PhaseBars fases={fases} />);
    expect(screen.getByText("100%")).not.toBeNull();
  });

  test("usa nombre alternativo 'name' si no hay 'nombre'", () => {
    const fases = [{ id: "1", name: "Etapa inicial", porcentaje: 40, estado: "pendiente" }];
    render(<PhaseBars fases={fases} />);
    expect(screen.getByText("Etapa inicial")).not.toBeNull();
  });
});

// ── RingChart ─────────────────────────────────────────────────
describe("RingChart", () => {
  test("renderiza el SVG con el porcentaje", () => {
    render(<RingChart value={75} label="Avance" />);
    expect(screen.getByText("75%")).not.toBeNull();
  });

  test("muestra el label dentro del SVG", () => {
    render(<RingChart value={50} label="Progreso" />);
    const labels = screen.getAllByText("Progreso");
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  test("muestra sublabel cuando se provee", () => {
    render(<RingChart value={40} label="Total" sublabel="3 de 5 fases" />);
    expect(screen.getByText("3 de 5 fases")).not.toBeNull();
  });

  test("no muestra sublabel si no se provee", () => {
    render(<RingChart value={40} label="Total" />);
    expect(screen.queryByText("3 de 5 fases")).toBeNull();
  });

  test("clampea value=0 por defecto", () => {
    render(<RingChart label="Sin datos" />);
    expect(screen.getByText("0%")).not.toBeNull();
  });

  test("clampea valores mayores a 100", () => {
    render(<RingChart value={150} label="Test" />);
    expect(screen.getByText("100%")).not.toBeNull();
  });

  test("clampea valores negativos a 0", () => {
    render(<RingChart value={-10} label="Test" />);
    expect(screen.getByText("0%")).not.toBeNull();
  });
});
