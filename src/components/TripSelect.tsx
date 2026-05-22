/**
 * TripSelect — terracotta-themed dropdown (replaces native <select>).
 *
 * Variant B Spacious mockup (44px row, 8px popover padding, shadow-lg).
 * Wraps `@headlessui/react` Listbox; accessibility, keyboard navigation and
 * focus management come from headlessui. Disabled rows render greyed and
 * skip keyboard cycling.
 */
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';

import { TRIP_SELECT_STYLES } from './TripSelect.styles';

export interface TripSelectOption<V extends string | number> {
  value: V;
  label: string;
  disabled?: boolean;
}

export interface TripSelectProps<V extends string | number> {
  value: V;
  onChange: (value: V) => void;
  options: TripSelectOption<V>[];
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** 'default' = 44px form field; 'pill' = 32px compact toolbar pill. */
  variant?: 'default' | 'pill';
}

export function TripSelect<V extends string | number>({
  value,
  onChange,
  options,
  placeholder = '請選擇',
  ariaLabel,
  disabled = false,
  className,
  id,
  variant = 'default',
}: TripSelectProps<V>) {
  const current = options.find((opt) => opt.value === value);
  const display = current?.label ?? placeholder;
  const isPlaceholder = !current;
  const rootClass = `tp-select tp-select--${variant} ${className ?? ''}`.trim();
  const triggerClass = `tp-select-trigger ${isPlaceholder ? 'is-placeholder' : ''}`;

  return (
    <div className={rootClass}>
      <style>{TRIP_SELECT_STYLES}</style>
      <Listbox value={value} onChange={onChange} disabled={disabled}>
        <ListboxButton
          id={id}
          className={triggerClass}
          aria-label={ariaLabel}
        >
          <span className="tp-select-value">{display}</span>
          <svg className="tp-select-chev" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </ListboxButton>
        <ListboxOptions
          anchor={{ to: 'bottom start', gap: 8 }}
          className="tp-select-list"
        >
          {options.map((opt) => (
            <ListboxOption
              key={String(opt.value)}
              value={opt.value}
              disabled={opt.disabled}
              className="tp-select-item"
            >
              {({ selected }) => (
                <>
                  <span className="tp-select-item-label">{opt.label}</span>
                  {selected && (
                    <svg className="tp-select-check" viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M5 10l4 4 8-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </>
              )}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </Listbox>
    </div>
  );
}
