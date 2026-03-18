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
    <div className="trip-footer" id="footer-slot">
      <footer>
        {footer.title && <h3>{footer.title}</h3>}
        {footer.dates && <p>{footer.dates}</p>}
        {footer.budget && <p className="footer-budget">{footer.budget}</p>}
        {footer.exchangeNote && (
          <p className="footer-exchange">{footer.exchangeNote}</p>
        )}
        {footer.tagline && <p>{footer.tagline}</p>}
      </footer>
    </div>
  );
}
