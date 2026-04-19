/**
 * Render breadcrumb parts with separators.
 *
 *   parts=['DAY 02', '7/27', '14:30']  →  DAY 02 · 7/27 · 14:30
 *
 * First part gets `${classPrefix}-day`, separators get `${classPrefix}-sep`.
 * Styling owned by the parent page's SCOPED_STYLES (no global CSS here).
 */
interface Props {
  parts: string[];
  classPrefix: string;
}

export default function BreadcrumbCrumbs({ parts, classPrefix }: Props) {
  if (parts.length === 0) return null;
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && (
            <span className={`${classPrefix}-sep`} aria-hidden="true">
              ·
            </span>
          )}
          <span className={i === 0 ? `${classPrefix}-day` : undefined}>{part}</span>
        </span>
      ))}
    </>
  );
}
