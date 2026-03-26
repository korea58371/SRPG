import React from 'react'
import { createRoot } from 'react-dom/client'
import * as PIXI from 'pixi.js'
import './index.css'
import App from './App.tsx'

// 전역 스케일 모드(NEAREST 강제 픽셀 아트 모드)를 제거하여, PIXI.Text(폰트)는 엔진 기본값인 Linear(부드러운 안티앨리어싱)를 따르도록 개방합니다.
// 도트 텍스처들은 각자의 생성 로직에서 개별적으로 NEAREST를 지정합니다.
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
