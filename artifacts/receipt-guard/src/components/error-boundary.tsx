import React from "react"

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  componentStack: string | null
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null, componentStack: null }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const componentStack = info.componentStack ?? null
    this.setState({ componentStack })
    console.error("[ErrorBoundary] Caught render error:", error.message)
    console.error("[ErrorBoundary] Stack:", error.stack)
    console.error("[ErrorBoundary] Component stack:", componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, componentStack: null })
    window.location.href = "/dashboard"
  }

  render() {
    if (this.state.hasError) {
      const { error, componentStack } = this.state
      return (
        <div style={{ fontFamily: 'monospace', padding: '24px', background: '#fff', minHeight: '100vh' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ background: '#fee2e2', border: '2px solid #ef4444', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <h1 style={{ color: '#dc2626', margin: '0 0 8px', fontSize: '18px', fontWeight: 'bold' }}>
                ⛔ Render Error Caught
              </h1>
              <p style={{ margin: '0 0 4px', fontWeight: 'bold', color: '#991b1b' }}>
                {error?.name}: {error?.message}
              </p>
            </div>

            <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <h2 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 'bold', color: '#475569' }}>JS Stack Trace</h2>
              <pre style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#1e293b' }}>
                {error?.stack ?? 'No stack available'}
              </pre>
            </div>

            <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <h2 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 'bold', color: '#475569' }}>React Component Stack</h2>
              <pre style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#1e293b' }}>
                {componentStack ?? 'Not captured yet — check browser console'}
              </pre>
            </div>

            <button
              onClick={this.handleReset}
              style={{ padding: '8px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
