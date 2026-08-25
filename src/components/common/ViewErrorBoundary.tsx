import React from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface ViewErrorBoundaryProps {
  children: React.ReactNode;
  onReturnHome: () => void;
}

interface ViewErrorBoundaryState {
  hasError: boolean;
}

/** Keeps one failed screen from blanking the entire Android WebView. */
export class ViewErrorBoundary extends React.Component<ViewErrorBoundaryProps, ViewErrorBoundaryState> {
  declare readonly props: Readonly<ViewErrorBoundaryProps>;
  declare setState: (state: Partial<ViewErrorBoundaryState>) => void;
  state: ViewErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ViewErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('DayTrace screen rendering failed', error, info.componentStack);
  }

  private retry = () => this.setState({ hasError: false });

  private returnHome = () => {
    this.setState({ hasError: false });
    this.props.onReturnHome();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <section
        id="view-recovery-screen"
        className="daytrace-scene flex flex-1 flex-col items-center justify-center overflow-y-auto p-6 text-center text-slate-100"
        role="alert"
      >
        <div className="w-full max-w-sm rounded-[30px] border border-amber-300/30 bg-slate-950/85 p-6 shadow-[0_0_32px_rgba(251,191,36,.12)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-300" />
          <h2 className="mt-4 text-base font-black">This screen could not open</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Your saved data is safe. Retry this screen or return to Today without restarting DayTrace.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" onClick={this.returnHome} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-800 py-3 text-xs font-bold">
              <Home className="h-4 w-4" />Today
            </button>
            <button type="button" onClick={this.retry} className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 py-3 text-xs font-black text-slate-950">
              <RefreshCw className="h-4 w-4" />Retry
            </button>
          </div>
        </div>
      </section>
    );
  }
}
