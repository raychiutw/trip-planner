// @ts-check
/**
 * Playwright helper — pick a date via TripDatePicker (custom popover).
 *
 * Replaces the `<input type="date">.fill(iso)` pattern used pre-v2.33.17.
 * Clicks the trigger button, navigates months until the target month is
 * visible, then clicks the day cell.
 */

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} testId  wrapper testid that holds the TripDatePicker
 * @param {string} isoDate "YYYY-MM-DD"
 */
export async function pickDate(page, testId, isoDate) {
  const [yearStr, monthStr, dayStr] = isoDate.split('-');
  const targetYear = Number(yearStr);
  const targetMonth = Number(monthStr); // 1-12
  const targetDay = Number(dayStr);
  if (!Number.isFinite(targetYear) || !Number.isFinite(targetMonth) || !Number.isFinite(targetDay)) {
    throw new Error(`pickDate: invalid ISO date ${isoDate}`);
  }

  const trigger = page.getByTestId(testId).getByRole('button');
  await trigger.click();
  const popover = page.locator('.tp-date-popover').first();
  await popover.waitFor({ state: 'visible' });

  // Caption format: "2026 年 8 月" (中文 formatter).
  const captionRe = /(\d{4})\s*年\s*(\d{1,2})\s*月/;
  const caption = popover.locator('.rdp-month_caption').first();

  // Navigate prev/next until caption matches target year + month.
  for (let i = 0; i < 240; i += 1) {
    const text = (await caption.textContent()) ?? '';
    const m = text.match(captionRe);
    if (m) {
      const curY = Number(m[1]);
      const curM = Number(m[2]);
      if (curY === targetYear && curM === targetMonth) break;
      const diff = (targetYear - curY) * 12 + (targetMonth - curM);
      const navBtn = popover.locator('.rdp-nav button').nth(diff > 0 ? 1 : 0);
      await navBtn.click();
    } else {
      throw new Error(`pickDate: caption did not match (${text})`);
    }
  }

  // Click the day cell — react-day-picker renders <button> with text === day number.
  // Use exact text match to avoid muted prev/next-month days.
  const dayBtn = popover.locator('.rdp-day:not(.rdp-outside) .rdp-day_button', { hasText: String(targetDay) }).first();
  await dayBtn.click();
  await popover.waitFor({ state: 'hidden' });
}
