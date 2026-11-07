import React from 'react';

/** If a screen throws, the coach sees a way out instead of a blank page. Data is untouched. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('Dugout Lab screen error', error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ padding: 20 }}>
        <h1>Something went wrong on this screen</h1>
        <p className="small">Your data is safe on this phone. Go back to Today and try again. If it keeps happening, make a backup in Settings and tell your coach-app person what you tapped.</p>
        <details className="small muted" style={{ margin: '10px 0' }}><summary>Details</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error?.message ?? this.state.error)}</pre></details>
        <div className="row wrap">
          <button className="btn primary" onClick={() => { this.setState({ error: undefined }); window.location.hash = '#/today'; }}>Go to Today</button>
          <button className="btn" onClick={() => window.location.reload()}>Reload the app</button>
        </div>
      </div>
    );
  }
}
