// src/pages/ProyectosCliente.jsx
export default function ProyectosCliente() {
  const proyectosAsignados = [
    { id: "ARQ-001", nombre: "Vivienda unifamiliar", estado: "En curso", avance: 62 },
    { id: "ARQ-003", nombre: "Remodelación oficina", estado: "En curso", avance: 45 },
  ];

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-taupe/30 bg-white p-4 shadow-card">
        <h2 className="text-[18px] font-semibold text-ink">Mis proyectos</h2>
        <p className="text-[13px] text-ink/70">Vista cliente (solo lectura)</p>
      </header>

      <div className="space-y-3">
        {proyectosAsignados.map(p => (
          <article key={p.id} className="card">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-ink">{p.nombre}</h3>
              <span className="text-[11px] text-ink/70 font-semibold tracking-wide">{p.id}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="chip">{p.estado}</span>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-[11px] muted mb-1">
                <span>Avance</span><span>{p.avance}%</span>
              </div>
              <div className="h-2 w-full bg-sand rounded-full overflow-hidden">
                <div className="h-full bg-ink" style={{ width: `${p.avance}%` }} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
