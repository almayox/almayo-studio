import sanitizeHtml from "sanitize-html";

const STYLE_COLOR = [
  /^#[0-9a-f]{3,8}$/i,
  /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i,
  /^[a-z]{3,20}$/i,
];

/**
 * Rich text written in the dashboard editor is stored as HTML. Only the tags
 * and attributes that editor can produce are allowed through to visitors.
 */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "hr", "h1", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s",
      "blockquote", "ul", "ol", "li", "a", "mark", "span", "code", "pre",
      "table", "thead", "tbody", "tr", "th", "td", "colgroup", "col",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      span: ["style"],
      mark: ["style", "data-color"],
      p: ["style", "dir"],
      h1: ["style", "dir"],
      h2: ["style", "dir"],
      h3: ["style", "dir"],
      h4: ["style", "dir"],
      li: ["dir"],
      th: ["colspan", "rowspan", "style"],
      td: ["colspan", "rowspan", "style"],
      col: ["style"],
    },
    allowedStyles: {
      "*": {
        color: STYLE_COLOR,
        "background-color": STYLE_COLOR,
        "text-align": [/^(left|right|center|justify)$/],
        "min-width": [/^\d{1,4}px$/],
        width: [/^\d{1,4}(px|%)$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
    },
  });
}

/** Plain-text preview of stored rich text (cards, meta descriptions). */
export function richTextToPlain(html: string | null | undefined, maxLength = 300): string {
  if (!html) return "";
  const spaced = html.replace(/<\/(p|h[1-6]|li|div|tr)>|<br\s*\/?>/gi, " ");
  const text = sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}
