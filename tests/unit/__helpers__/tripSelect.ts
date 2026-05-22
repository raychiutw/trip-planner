/**
 * Test helper — interact with TripSelect (headless-ui Listbox) in tests.
 *
 * Replaces the `fireEvent.change(select, { target: { value } })` pattern used
 * with native <select>. With TripSelect, the value is set by clicking the
 * trigger button to open the listbox + clicking the matching option.
 */
import { fireEvent, screen } from '@testing-library/react';

export function openTripSelect(wrapperTestId: string): HTMLElement {
  const wrapper = screen.getByTestId(wrapperTestId);
  const trigger = wrapper.querySelector<HTMLElement>('button');
  if (!trigger) throw new Error(`TripSelect trigger not found inside testId=${wrapperTestId}`);
  fireEvent.click(trigger);
  return trigger;
}

export async function pickFromTripSelect(
  wrapperTestId: string,
  optionMatcher: string | RegExp,
): Promise<void> {
  openTripSelect(wrapperTestId);
  const options = await screen.findAllByRole('option');
  const re = typeof optionMatcher === 'string' ? null : optionMatcher;
  const opt = options.find((o) => {
    const text = (o.textContent ?? '').trim();
    return re ? re.test(text) : text.includes(optionMatcher as string);
  });
  if (!opt) {
    const labels = options.map((o) => o.textContent?.trim()).filter(Boolean);
    throw new Error(
      `TripSelect option not found in testId=${wrapperTestId}; matcher=${String(
        optionMatcher,
      )}; available=[${labels.join(', ')}]`,
    );
  }
  fireEvent.click(opt);
}
