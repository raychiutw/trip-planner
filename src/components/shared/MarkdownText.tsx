import { useMemo } from 'react';
import { renderMarkdown, renderMarkdownInline } from '../../lib/sanitize';

interface MarkdownTextProps {
  /** The text to render (may contain markdown). */
  text: string;
  /** HTML tag to wrap with. Default: 'span'. */
  as?: 'span' | 'div' | 'p';
  /** Additional className. */
  className?: string;
  /** Use parseInline to avoid wrapping in <p> and breaking TEL/URL formats. */
  inline?: boolean;
}

/**
 * Renders text that may contain markdown as sanitized HTML.
 * Pure text passes through unchanged.
 * Use inline mode for fields that may contain TEL/URL/address (avoids <p> wrapping).
 */
export default function MarkdownText({ text, as: Tag = 'span', className, inline }: MarkdownTextProps) {
  const html = useMemo(() => inline ? renderMarkdownInline(text) : renderMarkdown(text), [text, inline]);
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
