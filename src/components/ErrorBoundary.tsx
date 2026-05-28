import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 rounded-3xl bg-red-50 border border-red-100 flex flex-col items-center justify-center text-center gap-4 my-4">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center shadow-inner">
            <AlertCircle size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-red-900 mb-1">Iyee! Something went wrong</h2>
            <p className="text-sm text-red-700 max-w-xs mx-auto">
              A bit of a wobble in the system. Don't worry, mwana, just a quick refresh should fix it.
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-200 hover:bg-red-700 transition-all"
          >
            <RefreshCw size={18} />
            Refresh Bulela
          </button>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-4 p-4 bg-slate-900 text-slate-300 text-left text-[10px] rounded-lg overflow-auto max-w-full">
              {this.state.error?.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}