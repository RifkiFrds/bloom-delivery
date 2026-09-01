'use client';

/**
 * Whole-app error boundary — Doc 01 §9.2 (BD-SYS02), Doc 02 §2.22.
 *
 * THE NO-DEAD-END INVARIANT: every failure state has a path to the letter.
 * This is the last line of it.
 *
 * The diagnostic is rendered as COPYABLE TEXT and never sent anywhere. PRD v2
 * rejected an error beacon: any network egress would put an asterisk on "your
 * camera never leaves this phone", and that asterisk costs more than the
 * telemetry is worth. If it breaks, she screenshots it.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

import { bus } from '@/events/bus';
import { buildDiagnosticString, record } from '@/lib/diagnostics';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly currentState: string;
}

interface ErrorBoundaryState {
  readonly diagnostic: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { diagnostic: null };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { diagnostic: 'pending' };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    const diagnostic = buildDiagnosticString(this.props.currentState, error);
    record(`FATAL: ${error.name}: ${error.message}`);
    if (info.componentStack !== null && info.componentStack !== undefined) {
      record(`componentStack: ${info.componentStack.split('\n')[1]?.trim() ?? ''}`);
    }
    this.setState({ diagnostic });
    bus.emit({ type: 'FATAL', diagnostic });
  }

  private readonly copy = (): void => {
    const { diagnostic } = this.state;
    if (diagnostic === null) return;
    // Typed non-nullish, but genuinely absent in insecure contexts and older
    // WebViews — the `in` check is a real runtime guard, not defensive noise.
    if ('clipboard' in navigator) void navigator.clipboard.writeText(diagnostic);
  };

  override render(): ReactNode {
    const { diagnostic } = this.state;
    if (diagnostic === null) return this.props.children;

    return (
      <main className="mx-auto flex w-full max-w-[480px] flex-col gap-4 px-5 py-10">
        <div className="rounded-[28px] border-3 border-ink bg-peach p-6 shadow-[8px_8px_0_#111111]">
          <h1 className="font-display text-3xl">Something wobbled 🌷</h1>
          <p className="mt-3 text-[17px]">But your letter is safe 💌</p>

          <button
            type="button"
            onClick={() => {
              bus.emit({ type: 'SKIP_TO_LETTER' });
            }}
            className="mt-6 min-h-[48px] w-full rounded-[20px] border-3 border-ink bg-pink px-6 font-display text-[17px] shadow-[6px_6px_0_#111111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_#111111]"
          >
            Take me to the letter
          </button>
        </div>

        <details className="rounded-[20px] border-3 border-ink bg-white p-4 shadow-[4px_4px_0_#111111]">
          <summary className="cursor-pointer font-display text-[15px]">
            Diagnostic
          </summary>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
            {diagnostic === 'pending' ? 'collecting…' : diagnostic}
          </pre>
          <button
            type="button"
            onClick={this.copy}
            className="mt-3 min-h-[48px] rounded-[20px] border-3 border-ink bg-white px-4 font-display text-[15px] shadow-[2px_2px_0_#111111]"
          >
            Copy diagnostic
          </button>
        </details>
      </main>
    );
  }
}
