import PropTypes from 'prop-types';
import { COLORS } from '../constants.jsx';

// Custom checkbox that renders a styled visual element over a hidden native
// input. The native input stays fully functional (keyboard, click, label
// association) while the visual matches the app's dark-theme token system.
function StyledCheckbox({ checked, onChange, accentColor, style, ...rest }) {
  const color = accentColor || COLORS.project;
  return (
    <div style={{ position: 'relative', width: 13, height: 13, flexShrink: 0, ...style }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        {...rest}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          margin: 0,
          width: '100%',
          height: '100%',
          cursor: 'pointer',
          zIndex: 1,
        }}
      />
      <div
        style={{
          width: 13,
          height: 13,
          borderRadius: 3,
          border: `1px solid ${checked ? color : COLORS.border}`,
          background: checked ? color : COLORS.surface3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          transition: 'all 0.1s',
          boxSizing: 'border-box',
        }}
      >
        {checked && (
          <span style={{ color: '#fff', fontSize: 9, lineHeight: 1, fontWeight: 700, userSelect: 'none' }}>
            ✓
          </span>
        )}
      </div>
    </div>
  );
}

StyledCheckbox.propTypes = {
  checked:     PropTypes.bool.isRequired,
  onChange:    PropTypes.func.isRequired,
  accentColor: PropTypes.string,
  style:       PropTypes.object,
};

export { StyledCheckbox };
