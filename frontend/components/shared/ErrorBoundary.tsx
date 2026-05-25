'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (typeof window !== 'undefined') {
      // Surface to console without leaking PII
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error.message, info.componentStack)
    }
  }

  reset = () => {
    this.props.onReset?.()
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="p-4 text-sm bg-destructive/10 text-destructive rounded-md flex items-center justify-between gap-2">
            <span>Could not render this content.</span>
            <button
              onClick={this.reset}
              className="text-xs border border-destructive rounded px-2 py-1"
            >
              Retry
            </button>
          </div>
        )
      )
    }
    return this.props.children
  }
}
