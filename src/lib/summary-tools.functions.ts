import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { askJson, PROFESSOR } from "./ai.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

/**
 * Ferramentas de IA do resumo: tabela comparativa sob demanda, explicar uma seção de
 * novo e mnemônicos. O HTML devolvido pela IA passa por uma lista de tags permitidas,
 * porque vai direto para o editor do resumo.
 */

async function grounding(supabase: Db, topicId: string) {
  const [{ data: topic }, { data: summary }] = await Promise.all([
    supabase.from("topics").select("title").eq("id", topicId).single(),
    supabase
      .from("materials")
      .select("content")
      .eq("topic_id", topicId)
      .eq("type", "summary")
      .maybeSingle(),
  ]);
  if (!topic) throw new Error("Tópico não encontrado.");
  const content = (summary?.content ?? {}) as { html?: string; text?: string };
  const text = String(content.html ?? content.text ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 9000);
  return { title: String(topic.title), summaryText: text };
}

const ALLOWED = new Set([
  "p",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "h3",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "br",
]);

/** Mantém só tags simples e sem atributos (nada de script, estilo ou link). */
function sanitize(html: string): string {
  let out = String(html ?? "").trim();
  const fence = out.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) out = fence[1].trim();
  out = out
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/?([a-zA-Z0-9]+)(\s[^>]*)?>/g, (tag, name: string) => {
      const n = name.toLowerCase();
      if (n === "h1" || n === "h2" || n === "h4") return tag.startsWith("</") ? "</h3>" : "<h3>";
      if (n === "b") return tag.startsWith("</") ? "</strong>" : "<strong>";
      if (n === "i") return tag.startsWith("</") ? "</em>" : "<em>";
      if (!ALLOWED.has(n)) return "";
      return tag.startsWith("</") ? `</${n}>` : `<${n}>`;
    })
    // **negrito** vira <strong>; *ênfase* que escapou vira texto comum
    .replace(/\*\*(?=\S)([^*\n<]+?)(?<=\S)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w*])\*\*?(?=\S)([^*\n<]+?)(?<=\S)\*\*?(?![\w*])/g, "$1$2");
  if (!out.includes("<")) out = `<p>${out}</p>`;
  return out;
}

export const compareTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({ topic_id: z.string().uuid(), query: z.string().trim().min(3).max(200) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { title, summaryText } = await grounding(context.supabase, data.topic_id);
    const result = await askJson<{ title?: string; html?: string }>(
      `${PROFESSOR}
Monte uma TABELA COMPARATIVA de estudo para prova.
Regras:
- Colunas = os itens comparados; linhas = os critérios que realmente diferenciam (de 5 a 9), como definição, mecanismo, morfologia, causas, clínica, diagnóstico, tratamento, prognóstico, conforme o caso.
- A primeira coluna é o critério. Células curtas (até 20 palavras), objetivas, só com conhecimento consolidado.
- Depois da tabela, um parágrafo de 1 a 2 frases com a dica que mais diferencia um do outro na prova.
- "html": só as tags table, thead, tbody, tr, th, td, p, strong, em. Sem markdown, sem asteriscos, sem estilos.
- "title": título curto, por exemplo "Necrose × apoptose".
Responda SOMENTE com JSON: { "title": "string", "html": "string" }`,
      `Tema do tópico: "${title}".
O que comparar: ${data.query}
Trecho do resumo do tópico, para manter coerência: ${summaryText || "não disponível"}`,
    );
    const html = sanitize(String(result.html ?? ""));
    if (!html.includes("<table>"))
      throw new Error("A IA não devolveu uma tabela. Tente descrever a comparação de outro jeito.");
    return {
      title: String(result.title ?? data.query)
        .trim()
        .slice(0, 120),
      html,
    };
  });

const MODES = {
  simples:
    "MAIS SIMPLES: explique como para quem está vendo o assunto pela primeira vez, com frases curtas, uma analogia do dia a dia e sem perder a precisão.",
  fundo:
    "MAIS A FUNDO: aprofunde o mecanismo (celular, molecular ou fisiológico), passo a passo, ligando causa e consequência, no nível de uma boa prova de graduação.",
  clinico:
    "COM EXEMPLO CLÍNICO: mostre o conteúdo aplicado a um paciente (2 a 4 frases de situação) e explique como cada ponto da seção aparece nele.",
} as const;

export const reexplainSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        topic_id: z.string().uuid(),
        section_title: z.string().trim().min(1).max(200),
        section_text: z.string().trim().min(1).max(12000),
        mode: z.enum(["simples", "fundo", "clinico"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { title } = await grounding(context.supabase, data.topic_id);
    const result = await askJson<{ html?: string }>(
      `${PROFESSOR}
Explique de novo UMA seção do resumo do aluno, do jeito pedido: ${MODES[data.mode]}
Regras:
- De 120 a 260 palavras. Não repita a seção com outras palavras: traga a explicação que faltou.
- Use só conhecimento consolidado e coerente com o conteúdo da seção.
- "html": só as tags p, ul, ol, li, strong, em. Sem títulos, sem markdown, sem asteriscos.
Responda SOMENTE com JSON: { "html": "string" }`,
      `Tópico: "${title}".
Seção: "${data.section_title}"
Conteúdo da seção: ${data.section_text}`,
    );
    const html = sanitize(String(result.html ?? "")).replace(/<\/?h3>/g, "");
    if (html.replace(/<[^>]+>/g, "").trim().length < 40)
      throw new Error("A IA não devolveu uma explicação válida. Tente de novo.");
    return { html };
  });

export type Mnemonic = {
  lista: string;
  mnemonico: string;
  itens: string[];
  explicacao: string;
  classico: boolean;
};

export const generateMnemonics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ topic_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { title, summaryText } = await grounding(context.supabase, data.topic_id);
    const result = await askJson<{ mnemonics?: Partial<Mnemonic>[] }>(
      `${PROFESSOR}
Crie MNEMÔNICOS em português para as listas e classificações do tópico que mais caem em prova.
Regras:
- De 4 a 6 mnemônicos, cada um para uma lista real do conteúdo (sinais, causas, critérios, classificações, fármacos, etapas).
- Se existir um mnemônico clássico e consagrado para a lista, use-o e marque "classico": true. Senão, crie um acrônimo ou frase curta, fácil de falar, e marque "classico": false.
- "itens": os itens da lista, na mesma ordem das letras ou palavras do mnemônico. Nunca force um item errado para caber na sigla.
- "explicacao": 1 frase dizendo como usar ou quando lembrar.
- Texto puro, sem asteriscos.
Responda SOMENTE com JSON: { "mnemonics": [{ "lista": "string", "mnemonico": "string", "itens": ["string"], "explicacao": "string", "classico": false }] }`,
      `Tópico: "${title}".
Resumo do tópico (base de conteúdo): ${summaryText || "não disponível"}`,
    );
    const items: Mnemonic[] = (result.mnemonics ?? [])
      .filter((m) => m?.lista && m.mnemonico && Array.isArray(m.itens) && m.itens.length >= 2)
      .slice(0, 6)
      .map((m) => ({
        lista: String(m.lista).trim(),
        mnemonico: String(m.mnemonico).trim(),
        itens: (m.itens as unknown[]).map((x) => String(x).trim()).filter(Boolean),
        explicacao: String(m.explicacao ?? "").trim(),
        classico: !!m.classico,
      }));
    if (!items.length) throw new Error("A IA não devolveu mnemônicos válidos. Tente de novo.");
    const { error } = await context.supabase.rpc("set_topic_material", {
      p_topic_id: data.topic_id,
      p_type: "mnemonics",
      p_content: { items, created_at: new Date().toISOString() },
    });
    if (error) throw new Error(error.message);
    return { items };
  });
