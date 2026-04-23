import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "u", "b", "i", "s",
  "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote", "a",
];

const ALLOWED_ATTRS = {
  a: ["href", "name", "target", "rel"],
};

export function sanitizedHtml(html: string): { __html: string } {
  return {
    __html: sanitizeHtml(html, {
      allowedTags: ALLOWED_TAGS,
      allowedAttributes: ALLOWED_ATTRS,
      allowedSchemes: ["http", "https", "mailto"],
    }),
  };
}
