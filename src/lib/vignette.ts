/**
 * Questões com vinheta clínica chegam como "vinheta\n\nenunciado". Separa as duas partes
 * para mostrar a vinheta como texto corrido e só o enunciado em destaque.
 */
export function splitVignette(question: string): { vignette: string | null; stem: string } {
  const text = question.trim();
  const i = text.lastIndexOf("\n\n");
  if (i === -1) return { vignette: null, stem: text };
  const vignette = text.slice(0, i).trim();
  const stem = text.slice(i + 2).trim();
  if (!vignette || !stem) return { vignette: null, stem: text };
  return { vignette, stem };
}
