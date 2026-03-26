// src/components/garantias/RespuestasGarantia.jsx
import PropTypes from "prop-types";

export default function RespuestasGarantia({ respuestas, titulo = "Respuestas" }) {
  if (!respuestas?.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">
        {titulo}
      </p>
      {respuestas.map((r, i) => (
        <div key={i} className="bg-sand/50 rounded-xl px-3 py-2.5 space-y-2">
          {r.texto && (
            <p className="text-[12px] text-ink/80 leading-relaxed">{r.texto}</p>
          )}
          {r.archivo && (
            <a
              href={r.archivo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-blue-600 hover:text-blue-800 bg-blue-50 rounded-lg px-2.5 py-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {r.archivo.name}
            </a>
          )}
          <p className="text-[10px] text-ink/35">
            {r.autor || "H&E Arquitectos"} · {r.fecha ? new Date(r.fecha.seconds * 1000).toLocaleDateString("es-CO") : "—"}
          </p>
        </div>
      ))}
    </div>
  );
}

RespuestasGarantia.propTypes = {
  respuestas: PropTypes.array,
  titulo: PropTypes.string,
};
