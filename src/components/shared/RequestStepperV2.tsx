import React from 'react';
import '../../../css/tokens.css';

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

/* ===== Tailwind class mappings ===== */

const DOT_BASE = 'w-2 h-2 rounded-full mx-auto mb-1';
const DOT_DONE = `${DOT_BASE} bg-[var(--color-accent)]`;
const DOT_ACTIVE = `${DOT_BASE} border-2 border-[var(--color-accent)] animate-[stepper-pulse_2s_infinite]`;
const DOT_PENDING = `${DOT_BASE} border-2 border-[var(--color-border)]`;

const LINE_BASE = 'flex-1 h-0.5 mx-1 mb-4';
const LINE_DONE = `${LINE_BASE} bg-[var(--color-accent)]`;
const LINE_PENDING = `${LINE_BASE} bg-[var(--color-border)]`;

const LABEL_BASE = 'text-[length:var(--font-size-caption2)]';
const LABEL_DONE = `${LABEL_BASE} text-[color:var(--color-muted)]`;
const LABEL_ACTIVE = `${LABEL_BASE} text-[color:var(--color-accent)] font-semibold`;
const LABEL_PENDING = `${LABEL_BASE} text-[color:var(--color-muted)]`;

/* ===== RequestStepperV2 Component ===== */

export default function RequestStepperV2({ status }: RequestStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === status);

  return (
    <div className="flex items-center mt-3" role="group" aria-label="請求進度">
      {STEPS.map((step, i) => {
        const isDone = i < currentIndex;
        const isActive = i === currentIndex;

        return (
          <React.Fragment key={step.key}>
            {i > 0 && (
              <div className={(isDone || isActive) ? LINE_DONE : LINE_PENDING} />
            )}
            <div className="text-center shrink-0">
              <div
                className={
                  isDone ? DOT_DONE :
                  isActive ? DOT_ACTIVE :
                  DOT_PENDING
                }
              />
              <div
                className={
                  isDone ? LABEL_DONE :
                  isActive ? LABEL_ACTIVE :
                  LABEL_PENDING
                }
              >
                {step.label}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
