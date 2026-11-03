/**
 * O resumo é um HTML com seções marcadas por <h2>. Estas funções listam as seções e
 * inserem um bloco novo no fim de uma delas (antes do próximo <h2>) ou no fim do resumo.
 * Só rodam no navegador (usam DOMParser).
 */

export type SummarySection = { index: number; title: string; text: string };

function parse(html: string) {
  return new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, "text/html");
}

export function listSections(html: string): SummarySection[] {
  const body = parse(html).body;
  const sections: { title: string; parts: string[] }[] = [];
  for (const node of Array.from(body.children)) {
    if (node.tagName === "H2") sections.push({ title: (node.textContent ?? "").trim(), parts: [] });
    else sections.at(-1)?.parts.push((node.textContent ?? "").trim());
  }
  return sections.map((s, index) => ({
    index,
    title: s.title,
    text: s.parts.filter(Boolean).join("\n"),
  }));
}

export function insertIntoSummary(
  html: string,
  sectionIndex: number | null,
  block: string,
): string {
  const doc = parse(html);
  const incoming = Array.from(parse(block).body.childNodes).map((n) => doc.importNode(n, true));
  const headings = Array.from(doc.body.children).filter((n) => n.tagName === "H2");
  const before = sectionIndex === null ? null : (headings[sectionIndex + 1] ?? null);
  for (const n of incoming) doc.body.insertBefore(n, before);
  return doc.body.innerHTML;
}

export function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
