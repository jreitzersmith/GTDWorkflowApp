import { useState } from "react";
import PropTypes from "prop-types";
import { COLORS } from "../constants.jsx";

function ResizeHandle({ onMouseDown, direction = 'h' }) {
  const [hovered, setHovered] = useState(false);
  const isH = direction === 'h';
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flexShrink: 0,
        width:  isH ? 4 : '100%',
        height: isH ? '100%' : 4,
        cursor: isH ? 'col-resize' : 'row-resize',
        background: hovered ? COLORS.border2 : COLORS.border,
        transition: 'background 0.15s',
        zIndex: 10,
      }}
    />
  );
}

ResizeHandle.propTypes = {
  onMouseDown: PropTypes.func.isRequired,
  direction:   PropTypes.oneOf(['h', 'v']),
};

export { ResizeHandle };
