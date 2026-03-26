// src/components/garantias/SolicitudCardHeader.jsx
import PropTypes from "prop-types";
import { ESTADO_STYLE, ESTADO_LABEL } from "../../data/garantias";
import ChevronIcon from "../ui/ChevronIcon";

export default function SolicitudCardHeader({
  solicitud,
  expanded,
  subText,
  leftExtra,
  rightExtra,
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-ink line-clamp-2">
            {solicitud.descripcion}
          </p>
          <p className="text-[11px] text-ink/40 mt-0.5">{subText}</p>
          {leftExtra}
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${ESTADO_STYLE[solicitud.estado] || ESTADO_STYLE.pendiente}`}>
            {ESTADO_LABEL[solicitud.estado] || solicitud.estado}
          </span>
          {rightExtra}
        </div>
      </div>
      <div className="flex justify-end mt-1">
        <ChevronIcon expanded={expanded} />
      </div>
    </>
  );
}

SolicitudCardHeader.propTypes = {
  solicitud: PropTypes.object.isRequired,
  expanded: PropTypes.bool,
  subText: PropTypes.node,
  leftExtra: PropTypes.node,
  rightExtra: PropTypes.node,
};
