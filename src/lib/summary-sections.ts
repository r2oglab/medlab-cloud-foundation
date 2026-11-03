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

const NUMBERED = /^\s*\d+\.\s*/;
const GLOSSARY = /termos importantes|gloss[áa]rio/i;

/** Índice da seção "Termos importantes" (ou -1), que deve continuar sendo a última. */
export function glossaryIndex(sections: SummarySection[]) {
  return sections.findIndex((s) => GLOSSARY.test(s.title));
}

/**
 * Seção nova (<h2>) antes de "Termos importantes", ou no fim se ela não existir.
 * Se os títulos do resumo são numerados ("4. Etiologia…"), renumera todos.
 */
export function insertNewSection(html: string, title: string, bodyHtml: string): string {
  const doc = parse(html);
  const headings = () => Array.from(doc.body.children).filter((n) => n.tagName === "H2");
  const before = headings().find((h) => GLOSSARY.test(h.textContent ?? "")) ?? null;
  const h2 = doc.createElement("h2");
  h2.textContent = title;
  const body = Array.from(parse(bodyHtml).body.childNodes).map((n) => doc.importNode(n, true));
  for (const n of [h2, ...body]) doc.body.insertBefore(n, before);

  const all = headings();
  const numbered = all.filter((h) => NUMBERED.test(h.textContent ?? "")).length;
  if (numbered > 0 && numbered >= all.length - 1) {
    all.forEach((h, i) => {
      const walker = doc.createTreeWalker(h, NodeFilter.SHOW_TEXT);
      let first = walker.nextNode() as Text | null;
      while (first && !first.data.trim()) first = walker.nextNode() as Text | null;
      if (first && NUMBERED.test(first.data))
        first.data = first.data.replace(NUMBERED, `${i + 1}. `);
      else h.insertBefore(doc.createTextNode(`${i + 1}. `), h.firstChild);
    });
  }
  return doc.body.innerHTML;
}

export function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
