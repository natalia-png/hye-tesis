// src/components/garantias/FotoGallery.jsx
import PropTypes from "prop-types";

export default function FotoGallery({ fotos, size = "w-24 h-24" }) {
  if (!fotos?.length) return null;
  return (
    <div className="flex gap-2 flex-wrap">
      {fotos.map((f, i) => (
        <a key={i} href={f.url} target="_blank" rel="noopener noreferrer">
          <img
            src={f.url}
            alt={f.name}
            className={`${size} rounded-xl object-cover border border-ink/10 hover:opacity-80 transition-opacity`}
          />
        </a>
      ))}
    </div>
  );
}

FotoGallery.propTypes = {
  fotos: PropTypes.array,
  size: PropTypes.string,
};
