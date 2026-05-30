/**
 * shareQr — client-side QR data-URL for a share link (v2.40.x PR-A / B2).
 *
 * Generated IN THE BROWSER (lazy-imported qrcode) so the share token never leaves the
 * device — we must NOT call a 3rd-party QR API (that would leak the secret token).
 */
export async function shareQrDataUrl(url: string): Promise<string> {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: '#1d1813', light: '#ffffff' } });
}
