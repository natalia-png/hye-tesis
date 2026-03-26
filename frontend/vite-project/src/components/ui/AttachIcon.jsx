// src/components/ui/AttachIcon.jsx
import PropTypes from "prop-types";

export default function AttachIcon({ className = "w-4 h-4", strokeWidth = "1.8" }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={strokeWidth}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
    );
}

AttachIcon.propTypes = {
    className: PropTypes.string,
    strokeWidth: PropTypes.string,
};
