/**
 * PasswordToggle — 密碼欄位的「顯示密碼」切換（#1560，沿用 ChangePasswordPage 的做法）。
 * 標籤固定、狀態只用 aria-pressed 表達（W3C APG：不要同時換文字又設 aria-pressed）；
 * 觸控目標至少 44×44。不碰 input 的 autoComplete。
 */
interface Props {
  pressed: boolean;
  onToggle: () => void;
  testId?: string;
}

export default function PasswordToggle({ pressed, onToggle, testId }: Props) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      data-testid={testId}
      style={{
        alignSelf: 'flex-end', minWidth: 44, minHeight: 44, padding: '0 4px', background: 'none', border: 0,
        font: 'inherit', fontSize: 'var(--font-size-footnote)', color: 'var(--color-accent-text)', cursor: 'pointer',
      }}
    >顯示密碼</button>
  );
}
