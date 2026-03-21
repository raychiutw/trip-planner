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
    <div className="request-stepper" role="group" aria-label="請求進度">
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
                  'stepper-line',
                  isDone || isActive ? 'stepper-line--done' : 'stepper-line--pending',
                )}
              />
            )}

            {/* Step: dot + label */}
            <div className="stepper-step">
              <div
                className={clsx(
                  'stepper-dot',
                  isDone && 'stepper-dot--done',
                  isActive && 'stepper-dot--active',
                  isPending && 'stepper-dot--pending',
                )}
              />
              <div
                className={clsx(
                  'stepper-label',
                  isDone && 'stepper-label--done',
                  isActive && 'stepper-label--active',
                  isPending && 'stepper-label--pending',
                )}
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
