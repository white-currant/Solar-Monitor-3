import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Solar Monitor Error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050a14] flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2 uppercase tracking-wider">
              ОШИБКА СИСТЕМЫ
            </h1>
            <p className="text-gray-400 font-mono text-sm mb-6">
              Произошел сбой при отображении данных. Это не влияет на космическую погоду.
            </p>
            <pre className="bg-black/50 border border-red-900 rounded p-3 text-xs text-red-400 font-mono mb-6 text-left overflow-auto max-h-32">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="flex items-center gap-2 mx-auto px-6 py-3 bg-[#00bcd4] text-black font-bold rounded uppercase tracking-wider text-sm hover:bg-[#00e5ff] transition-colors"
            >
              <RefreshCw size={16} /> ПЕРЕЗАПУСК
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
