type Vertex = { x?: number; y?: number };
type Word = { symbols?: { text?: string }[]; boundingBox?: { vertices?: Vertex[] } };
type Page = { blocks?: { paragraphs?: { words?: Word[] }[] }[] };
type PositionedWord = { text: string; x: number; y: number; height: number; slope: number };
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)] ?? 0; };

/** Rejoin labels and amounts by their printed row, instead of OCR paragraph order. */
export function receiptLines(text: string, pages?: unknown[]): string[] {
  const fallback = text.normalize("NFKC").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!pages?.length) return fallback;
  const result: string[] = [];
  for (const page of pages.slice(0, 10) as Page[]) {
    const words: PositionedWord[] = [];
    for (const block of page.blocks ?? []) for (const paragraph of block.paragraphs ?? []) for (const word of paragraph.words ?? []) {
      const value = (word.symbols ?? []).map(symbol => symbol.text ?? "").join("").normalize("NFKC");
      const vertices = word.boundingBox?.vertices;
      if (!value.trim() || vertices?.length !== 4) continue;
      const xs = vertices.map(v => Number(v.x ?? 0)), ys = vertices.map(v => Number(v.y ?? 0));
      if (![...xs, ...ys].every(Number.isFinite)) continue;
      const width = xs[1] - xs[0];
      words.push({ text: value, x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, height: Math.max(1, Math.max(...ys) - Math.min(...ys)), slope: width > 5 ? (ys[1] - ys[0]) / width : NaN });
    }
    if (!words.length) continue;
    const slope = median(words.map(word => word.slope).filter(value => Number.isFinite(value) && Math.abs(value) < 0.4));
    const typicalHeight = median(words.map(word => word.height));
    const rows: { y: number; words: PositionedWord[] }[] = [];
    for (const word of words.sort((a, b) => (a.y - slope * a.x) - (b.y - slope * b.x))) {
      const y = word.y - slope * word.x;
      const tolerance = Math.max(3, Math.min(word.height, typicalHeight * 1.5) * 0.55);
      const row = rows.slice(-3).find(candidate => Math.abs(candidate.y - y) <= tolerance);
      if (row) { row.words.push(word); row.y = median(row.words.map(w => w.y - slope * w.x)); }
      else rows.push({ y, words: [word] });
    }
    for (const row of rows) result.push(row.words.sort((a, b) => a.x - b.x).map(word => word.text).join(" ").replace(/(?<=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])\s+(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu, "").trim());
  }
  const joinedLength = result.join("").replace(/\s/g, "").length;
  return result.length && joinedLength >= text.replace(/\s/g, "").length * 0.7 ? result : fallback;
}
