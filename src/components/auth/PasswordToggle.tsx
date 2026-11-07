import { useState } from 'react';

/**
 * PasswordToggle — 密碼欄位的「顯示密碼」切換（#1560，沿用 ChangePasswordPage 的做法）。
 * 標籤固定、狀態只用 aria-pressed 表達（W3C APG：不要同時換文字又設 aria-pressed）；
 * 觸控目標至少 44×44（樣式在 css/tokens.css 的 .tp-pw-toggle）。不碰 input 的 autoComplete。
 */
interface Props {
  pressed: boolean;
  onToggle: () => void;
  testId?: string;
}

/** 顯示密碼的狀態：`type` 給 input，`toggleProps` 展開給 PasswordToggle。 */
export function usePasswordVisibility() {
  const [show, setShow] = useState(false);
  return {
    type: show ? 'text' : 'password',
    toggleProps: { pressed: show, onToggle: () => setShow((v) => !v) },
  } as const;
}

export default function PasswordToggle({ pressed, onToggle, testId }: Props) {
  return (
    <button type="button" className="tp-pw-toggle" aria-pressed={pressed} onClick={onToggle} data-testid={testId}>
      顯示密碼
    </button>
  );
}
