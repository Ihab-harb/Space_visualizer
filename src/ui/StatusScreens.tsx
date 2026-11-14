export function LoadingScreen() {
  return (
    <div className="status-screen" role="status">
      <p>Loading Solar System data…</p>
    </div>
  );
}

export function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="status-screen" role="alert">
      <h1>Could not load the data</h1>
      <pre className="status-screen__detail">{message}</pre>
      <button type="button" className="primary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function WebGLUnavailable() {
  return (
    <div className="status-screen" role="alert">
      <h1>3D graphics are not available</h1>
      <p>
        This app needs WebGL. Turn on hardware acceleration in your browser settings, or use a current version of Chrome, Edge,
        Firefox or Safari.
      </p>
    </div>
  );
}
