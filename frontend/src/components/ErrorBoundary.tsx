import { Component, type ErrorInfo, type ReactNode } from "react";

/** Catches render errors so that a failure in decoration (the intro) or in one screen never blocks the game. */
export class ErrorBoundary extends Component<{ children: ReactNode; onError?: (e: Error) => void; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("QTA6 render error:", error, info.componentStack); this.props.onError?.(error); }
  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <div className="notice" role="alert" style={{ margin: 24 }}>
        <strong>Something went wrong.</strong> Your saved progress is safe. <button onClick={() => location.reload()}>Reload the game</button>
      </div>
    );
  }
}
