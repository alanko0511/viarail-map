const NAMED: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
}

/**
 * Decodes the HTML entities the upstream tracker embeds in text meant for its
 * own DOM. Workers have no DOMParser, and the set in play is small.
 */
export function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, body: string) => {
      if (body.startsWith("#x") || body.startsWith("#X")) {
        return String.fromCodePoint(Number.parseInt(body.slice(2), 16))
      }
      if (body.startsWith("#")) {
        return String.fromCodePoint(Number(body.slice(1)))
      }
      return NAMED[body.toLowerCase()] ?? match
    }
  )
}
