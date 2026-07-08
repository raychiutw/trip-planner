/**
 * TravelPillDialog portal（2026-07-09 交通方式遮罩蓋不過 sticky header）
 *
 * `.tp-travel-overlay` 是 `position: fixed; inset: 0; z-index: --z-modal(9000)`，
 * 理論上蓋全螢幕。但 dialog 原本 inline render 在 timeline 欄內，day-section 動畫的
 * transformed ancestor 會成為 fixed 的 containing block → 遮罩被困在該欄、z-index
 * 也升不過 sticky header（標題列 + DAY tabs，--z-sticky-nav 200）。
 *
 * 修正：createPortal 到 document.body（與 ConfirmModal / StopLightbox 同 idiom），
 * 逃出 transformed ancestor，遮罩才蓋得過 header。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import TravelPillDialog from '../../src/components/trip/TravelPillDialog';

vi.mock('../../src/lib/apiClient', () => ({ apiFetchRaw: vi.fn() }));
vi.mock('../../src/components/shared/Toast', () => ({ showToast: vi.fn() }));

afterEach(cleanup);

describe('TravelPillDialog — portal 到 body（遮罩蓋過 sticky header）', () => {
  it('overlay 掛在 document.body，不困在 caller 的 transformed stacking context', () => {
    // 模擬 timeline 欄的 transformed ancestor（fixed 的 containing block breaker）
    const { container } = render(
      <div style={{ transform: 'translateZ(0)' }}>
        <TravelPillDialog tripId="t1" segmentId={1} currentMode="driving" onClose={() => {}} />
      </div>,
    );
    const overlay = document.body.querySelector('[data-testid="travel-pill-dialog"]');
    expect(overlay).toBeTruthy();
    // portal：overlay 不是 caller wrapper 的後代（否則會被 transformed ancestor 困住 → 遮罩蓋不過 header）
    expect(container.querySelector('[data-testid="travel-pill-dialog"]')).toBeNull();
    // 直接掛在 body 之下
    expect(overlay?.parentElement).toBe(document.body);
  });
});
