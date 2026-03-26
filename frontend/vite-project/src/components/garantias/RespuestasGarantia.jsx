// src/components/garantias/RespuestasGarantia.jsx
import PropTypes from "prop-types";
import AttachIcon from "../ui/AttachIcon";

export default function RespuestasGarantia({ respuestas, titulo = "Respuestas" }) {
  if (!respuestas?.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40 font-semibold">
        {titulo}
      </p>
      {respuestas.map((r, i) => (
        <div key={r.fecha?.seconds ?? i} className="bg-sand/50 rounded-xl px-3 py-2.5 space-y-2">
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
              <AttachIcon className="w-3.5 h-3.5" strokeWidth="2" />
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
