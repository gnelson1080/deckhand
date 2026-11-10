// Card text from both sources loses the "−" (U+2212) sign. Put it back where the official wording has it:
//   "DON!! 1:"                      -> "DON!! −1:"      (return DON!! to your DON!! deck)
//   "give ... Characters 1000 power" -> "... −1000 power" (debuffs are always written with "give")
//   "give ... Characters 3 cost"     -> "... −3 cost"
export function fixMinusSigns(text) {
  let s = String(text ?? '').replace(/DON!! (\d+)(?=\s*[:(,])/g, 'DON!! −$1');
  s = s.replace(/(^|[.:\n])([^.:\n]*)/g, (all, lead, clause) => {
    if (!/\bgive/i.test(clause)) return all;
    const fixed = clause.replace(/(^|[^\d+\-−])(\s)(\d{1,5}) (power|cost)\b(?! or (?:less|more))/g, (m, pre, sp, n, what, off, str) => {
      const before = str.slice(0, off + pre.length);
      if (!/\bgive/i.test(before)) return m;
      if (/\b(?:of|with|than|is|has|a|base)$/i.test(before.trimEnd())) return m;
      if (what === 'cost' && n.length > 2) return m;
      return `${pre}${sp}−${n} ${what}`;
    });
    return lead + fixed;
  });
  return s;
}
