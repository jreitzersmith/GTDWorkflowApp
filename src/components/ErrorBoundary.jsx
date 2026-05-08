import { Component } from "react";
import PropTypes from "prop-types";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary: ${this.props.label}]`, error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
            ⚠ {this.props.label || 'This section'} crashed
          </div>
          <div style={{ fontSize: 12, color: '#888', fontFamily: 'monospace', maxWidth: 400, wordBreak: 'break-word' }}>
            {this.state.error?.message}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #555', background: 'transparent', color: '#ccc', cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  label:    PropTypes.string,
  children: PropTypes.node,
};

export { ErrorBoundary };
