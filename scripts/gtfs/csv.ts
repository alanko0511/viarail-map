/** Minimal RFC-4180 CSV reader. GTFS files quote fields containing commas. */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: Array<Array<string>> = []
  let row: Array<string> = []
  let field = ""
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      field = ""
      if (row.length > 1 || row[0] !== "") rows.push(row)
      row = []
    } else {
      field += char
    }
  }
  row.push(field)
  if (row.length > 1 || row[0] !== "") rows.push(row)

  const header = rows.shift()
  if (!header) return []
  // Strip a UTF-8 BOM, which some GTFS exporters emit.
  header[0] = header[0].replace(/^﻿/, "")

  return rows.map((cells) => {
    const record: Record<string, string> = {}
    header.forEach((key, index) => {
      record[key] = (cells[index] ?? "").trim()
    })
    return record
  })
}

/** GTFS times may exceed 24:00:00 for trips running past midnight. */
export function parseGtfsTime(value: string): number | null {
  if (!value) return null
  const parts = value.split(":")
  if (parts.length !== 3) return null
  return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2])
}
