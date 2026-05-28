import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Navaya render error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div style={{
        maxWidth: 430,
        margin: '0 auto',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F5F0EB',
        padding: '32px 24px',
        textAlign: 'center',
      }}>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: '#4A3728', display: 'block', marginBottom: 8 }}>
          Something went wrong
        </span>
        <span style={{ fontSize: 13, color: '#8A7968', lineHeight: 1.6, display: 'block', marginBottom: 28 }}>
          The app hit an unexpected error. Your data is safe — reload to continue.
        </span>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#4A3728',
            color: '#D4956A',
            border: 'none',
            borderRadius: 13,
            padding: '13px 28px',
            fontSize: 14,
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
          }}
        >
          Reload app
        </button>
      </div>
    )
  }
}
