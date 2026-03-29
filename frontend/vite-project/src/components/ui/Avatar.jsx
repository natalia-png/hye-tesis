import PropTypes from "prop-types";

export default function Avatar({ name, photoURL, size = 40, className = "", textClassName = "" }) {
  const initial = name?.trim?.()?.[0]?.toUpperCase() || "?";

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name || "Avatar"}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: "rgb(var(--sand))",
        color: "rgb(var(--ink))",
      }}
    >
      <span className={textClassName}>{initial}</span>
    </div>
  );
}

Avatar.propTypes = {
  name: PropTypes.string,
  photoURL: PropTypes.string,
  size: PropTypes.number,
  className: PropTypes.string,
  textClassName: PropTypes.string,
};
