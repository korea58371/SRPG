import React from 'react'
import { createRoot } from 'react-dom/client'
import * as PIXI from 'pixi.js'
import './index.css'
import App from './App.tsx'

// 레트로 픽셀 아트 및 폰트 렌더링 선명도(안티앨리어싱 해제) 강제 고정
PIXI.BaseTexture.defaultOptions.scaleMode = PIXI.SCALE_MODES.NEAREST;
PIXI.settings.ROUND_PIXELS = true;

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) { console.error("Global Error Caught:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return <div style={{padding: 20, color: 'red', background: 'white', zIndex: 99999, position: 'absolute', top: 0}}>
          <h1>렌더링 에러 발생!</h1>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
