/* ===== Props ===== */

export interface FooterData {
  title?: string;
  dates?: string;
  budget?: string;
  exchangeNote?: string;
  tagline?: string;
}

interface FooterProps {
  footer: FooterData;
}

/* ===== Component ===== */

export default function Footer({ footer }: FooterProps) {
  return (
    <div id="footer-slot">
      <footer className="px-4 py-6 text-center">
        {footer.title && <h3 className="font-bold text-(length:--font-size-title3) mb-1">{footer.title}</h3>}
        {footer.dates && <p className="text-(length:--font-size-callout) text-(--color-muted) mb-1">{footer.dates}</p>}
        {footer.budget && <p className="text-(length:--font-size-callout) text-(--color-muted) mb-1">{footer.budget}</p>}
        {footer.exchangeNote && (
          <p className="text-(length:--font-size-footnote) text-(--color-muted) mb-1">{footer.exchangeNote}</p>
        )}
        {footer.tagline && <p className="text-(length:--font-size-callout) text-(--color-muted) mt-3">{footer.tagline}</p>}
      </footer>
    </div>
  );
}
