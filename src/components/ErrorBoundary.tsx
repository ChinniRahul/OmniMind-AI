import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("OmniMind ErrorBoundary intercepted an unhandled failure:", error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error(e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] dark:bg-[#07090e] p-6 text-gray-900 dark:text-gray-100 font-sans relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(239,68,68,0.04),transparent_40%)] dark:bg-[radial-gradient(circle_at_30%_20%,rgba(239,68,68,0.08),transparent_40%)] pointer-events-none" />
          
          <div className="max-w-md w-full bg-white dark:bg-[#0f131a] p-8 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-xl text-center space-y-6 relative z-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 mx-auto">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-base font-extrabold tracking-tight">System Configuration Stabilisation Fault</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                An unexpected state execution index occurred inside the workspace rendering node. We have safely captured this telemetry.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3.5 bg-gray-50 dark:bg-[#141b25] border border-gray-100 dark:border-[#1e2530] rounded-xl text-[10px] font-mono text-left text-gray-400 overflow-x-auto max-h-32 scrollbar-thin">
                <span className="text-rose-500 font-bold block mb-1">RUNTIME_EXCEPTION_TRACE:</span>
                {this.state.error.stack || this.state.error.message || String(this.state.error)}
              </div>
            )}

            <button
              id="error_boundary_reset_btn"
              onClick={this.handleReset}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/15 flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Clear Cache & Re-hydrate Core Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
