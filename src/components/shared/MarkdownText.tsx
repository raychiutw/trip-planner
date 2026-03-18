import { useMemo } from 'react';
import { renderMarkdown } from '../../lib/sanitize';

interface MarkdownTextProps {
  /** The text to render (may contain markdown). */
  text: string;
  /** HTML tag to wrap with. Default: 'span'. */
  as?: 'span' | 'div' | 'p';
  /** Additional className. */
  className?: string;
}

/**
 * Renders text that may contain markdown as sanitized HTML.
 * Pure text passes through unchanged.
 */
export default function MarkdownText({ text, as: Tag = 'span', className }: MarkdownTextProps) {
  const html = useMemo(() => renderMarkdown(text), [text]);
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
