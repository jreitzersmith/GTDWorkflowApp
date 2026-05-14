import "access-key-label-polyfill";
import { StrictMode, Component } from "react";
import { createRoot } from "react-dom/client";
import GTDManager from "./App.jsx";

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, fontFamily: 'sans-serif', color: '#ccc', background: '#1a1a1a' }}>
          <div style={{ fontSize: 16, color: '#ef4444', fontWeight: 600 }}>⚠ The app crashed</div>
          <div style={{ fontSize: 12, color: '#888', fontFamily: 'monospace', maxWidth: 500, textAlign: 'center' }}>{this.state.error?.message}</div>
          <button onClick={() => this.setState({ hasError: false, error: null })} style={{ fontSize: 13, padding: '6px 18px', borderRadius: 6, border: '1px solid #555', background: 'transparent', color: '#ccc', cursor: 'pointer' }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppErrorBoundary>
      <GTDManager />
    </AppErrorBoundary>
  </StrictMode>
);
