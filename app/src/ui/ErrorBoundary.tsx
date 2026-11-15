import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  reset = () => { try { Object.keys(localStorage).filter((k) => k.startsWith("helm.")).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ } location.reload(); };
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div role="alert" style={{ padding: 24, maxWidth: 760, margin: "40px auto", font: "15px system-ui", color: "#e8f0ff" }}>
        <h2 style={{ marginTop: 0 }}>HELM hit an error</h2>
        <p>Please send this message to your engineer:</p>
        <pre style={{ whiteSpace: "pre-wrap", background: "#0b1224", padding: 12, borderRadius: 8, color: "#ffb454" }}>{String(this.state.err.stack ?? this.state.err.message).slice(0, 1500)}</pre>
        <button onClick={this.reset} style={{ padding: "8px 14px", borderRadius: 8 }}>Clear saved HELM data and reload</button>
      </div>
    );
  }
}
