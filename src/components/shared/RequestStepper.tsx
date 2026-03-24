import React from 'react';
import clsx from 'clsx';

/* ===== Step definitions ===== */

const STEPS = [
  { key: 'open', label: '送出' },
  { key: 'received', label: '接收' },
  { key: 'processing', label: '處理中' },
  { key: 'completed', label: '已回覆' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

interface RequestStepperProps {
  status: StepKey;
}

/* ===== RequestStepper Component ===== */

export default function RequestStepper({ status }: RequestStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === status);

  return (
    <>
      <style>{`
        @keyframes stepper-pulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent) 40%, transparent); }
          50% { box-shadow: 0 0 8px 4px color-mix(in srgb, var(--color-accent) 20%, transparent); }
        }
        .stepper-dot-active { animation: stepper-pulse 2s infinite; }
      `}</style>
      <div className="flex items-center mt-3" role="group" aria-label="請求進度">
        {STEPS.map((step, i) => {
          const isDone = i < currentIndex;
          const isActive = i === currentIndex;
          const isPending = i > currentIndex;

          return (
            <React.Fragment key={step.key}>
              {/* Connecting line before step (except first) */}
              {i > 0 && (
                <div
                  className={clsx(
                    'flex-1 h-0.5 mx-1 mb-4',
                    isDone || isActive ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]',
                  )}
                />
              )}

              {/* Step: dot + label */}
              <div className="text-center shrink-0">
                <div
                  className={clsx(
                    'w-2 h-2 rounded-full mx-auto mb-1',
                    isDone && 'bg-[var(--color-accent)]',
                    isActive && 'border-2 border-[var(--color-accent)] stepper-dot-active',
                    isPending && 'border-2 border-[var(--color-border)]',
                  )}
                />
                <div
                  className={clsx(
                    'text-[var(--font-size-caption2)]',
                    isDone && 'text-[var(--color-muted)]',
                    isActive && 'text-[var(--color-accent)] font-semibold',
                    isPending && 'text-[var(--color-muted)]',
                  )}
                >
                  {step.label}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </>
  );
}
