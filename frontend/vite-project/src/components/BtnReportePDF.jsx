// src/components/BtnReportePDF.jsx
// Uso admin (fondo blanco):   <BtnReportePDF proyecto={project} isAdmin={true} />
// Uso cliente (fondo oscuro): <BtnReportePDF proyecto={project} isAdmin={false} dark />

import { useReportePDF } from "../hooks/useReportePDF";
import PropTypes from "prop-types";

export default function BtnReportePDF({ proyecto, isAdmin = false, dark = false }) {
    const { generar, loading } = useReportePDF();

    const clases = dark
        ? // Versión fondo oscuro — estilos inline para evitar purge de Tailwind
        "inline-flex items-center gap-2 text-[13px] px-4 py-2 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        : // Versión normal — usa btn-outline existente
        "btn-outline flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed";

    return (
        <button
            onClick={() => generar(proyecto, isAdmin)}
            disabled={loading || !proyecto}
            className={clases}
            style={dark ? { border: "1px solid white", color: "white", background: "transparent" } : {}}
            title="Descargar reporte PDF completo del proyecto"
        >
            {loading ? (
                <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10"
                            stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor"
                            d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Generando...
                </>
            ) : (
                <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor"
                        viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                            d="M12 10v6m0 0-3-3m3 3 3-3M3 17a4 4 0 004 4h10a4 4 0 004-4V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0014.586 3H7a4 4 0 00-4 4v10z" />
                    </svg>
                    Descargar reporte PDF
                </>
            )}
        </button>
    );
}

BtnReportePDF.propTypes = {
    proyecto: PropTypes.object,
    isAdmin: PropTypes.bool,
    dark: PropTypes.bool,
};