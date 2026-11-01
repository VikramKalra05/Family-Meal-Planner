/**
 * Serving-size phrasing: turns raw ingredient weights into clear household
 * wording — "1 serving ≈ 350 g (about 1 large bowl)", plus piece counts
 * parsed from titles like "Idli (8 pieces)".
 *
 * Grams are the sum of RAW ingredient weights ÷ servings; cooked yield is a
 * bit lower (moisture loss), so phrasing says "≈".
 */

export interface ServingSize {
  gramsPerServing: number;
  piecesPerServing: number | null;
  phrase: string;
}

export function parsePieceCount(title: string): number | null {
  const m = title.match(/\((\d+)\s*(?:pieces|pcs)\)/i);
  return m ? Number(m[1]) : null;
}

function bowlWord(grams: number): string {
  if (grams < 120) return "a small katori";
  if (grams < 260) return "1 bowl";
  if (grams < 400) return "1 generous bowl";
  return "1 large bowl";
}

export function servingSize(
  title: string,
  totalRawGrams: number,
  servings: number,
): ServingSize {
  const n = Math.max(1, servings);
  const gramsPerServing = Math.round(totalRawGrams / n);
  const pieceCount = parsePieceCount(title);
  const piecesPerServing = pieceCount ? Math.round((pieceCount / n) * 10) / 10 : null;

  const piecesStr =
    piecesPerServing != null
      ? ` (${piecesPerServing % 1 === 0 ? piecesPerServing : piecesPerServing.toFixed(1)} ${piecesPerServing === 1 ? "piece" : "pieces"})`
      : "";
  const bowlStr = piecesPerServing != null ? "" : ` — about ${bowlWord(gramsPerServing)}`;
  return {
    gramsPerServing,
    piecesPerServing,
    phrase: `1 serving ≈ ${gramsPerServing} g${piecesStr}${bowlStr}`,
  };
}
