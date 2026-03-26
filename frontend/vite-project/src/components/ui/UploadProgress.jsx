// src/components/ui/UploadProgress.jsx
import PropTypes from "prop-types";

export default function UploadProgress({ progress, label = "Subiendo…" }) {
    if (!progress) return null;
    return (
        <div className="space-y-1">
            <div className="h-1.5 bg-sand rounded-full overflow-hidden">
                <div className="h-full bg-ink rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[11px] text-ink/50">{label} {progress}%</p>
        </div>
    );
}

UploadProgress.propTypes = {
    progress: PropTypes.number,
    label: PropTypes.string,
};
