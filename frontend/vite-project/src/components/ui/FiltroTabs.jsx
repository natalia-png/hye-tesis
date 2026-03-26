// src/components/ui/FiltroTabs.jsx
import PropTypes from "prop-types";

export default function FiltroTabs({ tabs, filtro, conteo, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
            filtro === key
              ? "bg-ink text-ivory border-ink"
              : "bg-white text-ink/60 border-ink/15 hover:border-ink/30"
          }`}
        >
          {label}
          {conteo[key] > 0 && (
            <span className={`ml-1.5 text-[10px] ${filtro === key ? "opacity-70" : "text-ink/40"}`}>
              {conteo[key]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

FiltroTabs.propTypes = {
  tabs: PropTypes.arrayOf(PropTypes.shape({ key: PropTypes.string, label: PropTypes.string })).isRequired,
  filtro: PropTypes.string.isRequired,
  conteo: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};
