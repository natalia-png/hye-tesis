import PropTypes from "prop-types";

export default function InsightCard({ title, text, tag }) {
  return (
    <div className="rounded-2xl border border-taupe/30 bg-white/80 p-3 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-ink truncate">{title}</p>
          <p className="mt-1 text-[12px] text-ink/70">{text}</p>
        </div>
        {tag && (
          <span className="shrink-0 text-[10px] rounded-full border border-sand bg-sand/70 text-ink/80 px-2 py-[2px]">
            {tag}
          </span>
        )}
      </div>
    </div>
  );
}

InsightCard.propTypes = {
  title: PropTypes.string,
  text: PropTypes.string,
  tag: PropTypes.string,
};