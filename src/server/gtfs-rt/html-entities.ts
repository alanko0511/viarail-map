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

const MAX_CODE_POINT = 0x10ffff

/** The character a numeric entity names, or the entity untouched when it names
 * none, as `String.fromCodePoint` throws past U+10FFFF. */
function fromNumeric(match: string, codePoint: number): string {
  return codePoint <= MAX_CODE_POINT ? String.fromCodePoint(codePoint) : match
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
        return fromNumeric(match, Number.parseInt(body.slice(2), 16))
      }
      if (body.startsWith("#")) {
        return fromNumeric(match, Number(body.slice(1)))
      }
      return NAMED[body.toLowerCase()] ?? match
    }
  )
}
