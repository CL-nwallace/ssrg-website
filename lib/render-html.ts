import DOMPurify from "isomorphic-dompurify";

export function sanitizedHtml(html: string): { __html: string } {
  return { __html: DOMPurify.sanitize(html) };
}
