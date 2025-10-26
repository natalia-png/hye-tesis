import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

/* ====== Data mock (puedes ampliar libremente) ====== */
const MOCK = [
  { id: "ARQ-001", nombre: "Vivienda unifamiliar", estado: "En curso",    avance: 62, cliente: "H&E"  },
  { id: "ARQ-002", nombre: "Centro comercial N.",  estado: "Planificado", avance: 10, cliente: "Acme" },
  { id: "ARQ-003", nombre: "Remodelación oficina", estado: "En curso",    avance: 45, cliente: "Beta" },
];

/* ====== UI helpers ====== */
const ESTADOS = ["Todos", "En curso", "Planificado", "Finalizado"];
const ORDENES = [
  { id: "recientes", label: "Recientes" },
  { id: "nombre_asc", label: "Nombre A–Z" },
  { id: "avance_asc", label: "Avance ↑" },
  { id: "avance_desc", label: "Avance ↓" },
];

function EstadoChip({ value }) {
  if (!value) return null;
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-sand/80 text-ink/80 border border-taupe/40">
      {value}
    </span>
  );
}

/* ====== Página ====== */
export default function Proyectos() {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("Todos");
  const [orden, setOrden] = useState("recientes");

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    let arr = MOCK.filter(p => {
      const matchTexto =
        p.id.toLowerCase().includes(s) ||
        p.nombre.toLowerCase().includes(s) ||
        p.cliente.toLowerCase().includes(s);
      const matchEstado = estado === "Todos" ? true : p.estado === estado;
      return matchTexto && matchEstado;
    });

    switch (orden) {
      case "nombre_asc":
        arr = [...arr].sort((a, b) => a.nombre.localeCompare(b.nombre));
        break;
      case "avance_asc":
        arr = [...arr].sort((a, b) => a.avance - b.avance);
        break;
      case "avance_desc":
        arr = [...arr].sort((a, b) => b.avance - a.avance);
        break;
      default:
        // "recientes": aquí mantén el orden original (simula fecha desc)
        break;
    }

    return arr;
  }, [q, estado, orden]);

  const total = MOCK.length;
  const enCurso = MOCK.filter(p => p.estado === "En curso").length;

  return (
    <section className="space-y-4">
      {/* Encabezado compacto con métricas */}
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-[18px] font-semibold text-ink">Proyectos</h2>
          <p className="text-[12px] muted">
            {total} totales · {enCurso} en curso
          </p>
        </div>
        <button className="btn-primary">+ Nuevo</button>
      </header>

      {/* Controles: búsqueda, estado y orden */}
      <div className="rounded-2xl bg-ivory/90 border border-taupe/30 p-3 shadow-card space-y-2">
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por ID, nombre o cliente…"
            className="input flex-1 bg-ivory"
            aria-label="Buscar proyectos"
          />
        </div>

        <div className="flex gap-2">
          <select
            className="input bg-white/80"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            aria-label="Filtrar por estado"
          >
            {ESTADOS.map(op => <option key={op} value={op}>{op}</option>)}
          </select>

          <select
            className="input bg-white/80"
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            aria-label="Ordenar resultados"
          >
            {ORDENES.map(op => <option key={op.id} value={op.id}>{op.label}</option>)}
          </select>
        </div>
      </div>

      {/* Listado */}
      <div className="space-y-3">
        {filtrados.map(p => (
          <article key={p.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-medium text-ink truncate">{p.nombre}</h3>
                <p className="text-[13px] text-ink/80">
                  <span className="muted">Cliente:</span> {p.cliente}
                </p>
              </div>
              <div className="text-right">
                <span className="block text-[11px] text-ink/70 font-semibold tracking-wide">{p.id}</span>
                <div className="mt-1">
                  <EstadoChip value={p.estado} />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-[11px] muted mb-1">
                <span>Avance</span><span>{p.avance}%</span>
              </div>
              <div className="h-2 w-full bg-sand rounded-full overflow-hidden">
                <div
                  className="h-full bg-ink"
                  style={{ width: `${p.avance}%` }}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end">
  <Link className="btn-ghost" to={`/proyectos/${p.id}`}>Ver</Link>
</div>
          </article>
        ))}

        {filtrados.length === 0 && (
          <div className="rounded-2xl border border-taupe/30 bg-ivory/80 p-8 text-center">
            <div className="text-3xl mb-2">🗂️</div>
            <p className="text-sm text-ink/80">Sin resultados.</p>
            <p className="text-[12px] muted">Ajusta la búsqueda o filtros.</p>
          </div>
        )}
      </div>

      {/* Botón flotante (acción principal) */}
      <button
        aria-label="Nuevo proyecto"
        className="fixed bottom-20 right-6 bg-ink text-ivory rounded-full w-14 h-14 text-2xl shadow-card flex items-center justify-center hover:bg-coal"
        title="Crear proyecto"
      >
        +
      </button>
    </section>
  );
}
