import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { askJson, PROFESSOR } from "./ai.server";
import { delatex } from "./delatex";
import { SECTIONS_MARK } from "./chat-format";
import { sanitizeStudyHtml } from "./html-clean";

/**
 * Chat com o tópico: responde perguntas usando o resumo e a transcrição da aula,
 * guarda a conversa e aponta as seções do resumo de onde veio a resposta.
 */

const strip = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function sections(html: string) {
  return html
    .split(/<h2[^>]*>/i)
    .slice(1)
    .map((part) => {
      const [title = "", ...rest] = part.split(/<\/h2>/i);
      return { title: strip(title), text: strip(rest.join(" ")) };
    });
}

export const askTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        topic_id: z.string().uuid(),
        question: z.string().trim().min(2).max(2000),
        // Nova tentativa depois de uma falha: a pergunta já ficou salva da primeira vez
        resend: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const [{ data: topic }, { data: summary }, { data: history }] = await Promise.all([
      supabase.from("topics").select("title, source_text").eq("id", data.topic_id).maybeSingle(),
      supabase
        .from("materials")
        .select("content")
        .eq("topic_id", data.topic_id)
        .eq("type", "summary")
        .maybeSingle(),
      supabase
        .from("topic_chat_messages")
        .select("role, content")
        .eq("topic_id", data.topic_id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    if (!topic) throw new Error("Tópico não encontrado.");

    // A pergunta fica salva antes da resposta: se a IA falhar, ela não se perde
    if (!data.resend) {
      const { error: userError } = await supabase
        .from("topic_chat_messages")
        .insert({ topic_id: data.topic_id, role: "user", content: data.question });
      if (userError) throw new Error("Não deu para salvar a pergunta.");
    }

    const html = String((summary?.content as { html?: string } | null)?.html ?? "");
    const secs = sections(html);
    const material = secs.length
      ? secs
          .map((s) => `## ${s.title}\n${s.text}`)
          .join("\n\n")
          .slice(0, 70_000)
      : "(o tópico ainda não tem resumo)";
    const lecture = String(topic.source_text ?? "").slice(0, 30_000);
    const previous = (history ?? [])
      .reverse()
      .map(
        (m) =>
          `${m.role === "user" ? "ALUNO" : "TUTOR"}: ${strip(String(m.content).replace(SECTIONS_MARK, "")).slice(0, 1500)}`,
      )
      .join("\n");

    const result = await askJson<{ html?: string; secoes?: unknown }>(
      `${PROFESSOR}
Você é o tutor do aluno neste tópico, como numa sessão de tutoria do PBL. Responda à pergunta usando principalmente o MATERIAL DO TÓPICO (o resumo do aluno e a transcrição da aula).
Regras:
- Comece pela resposta, numa frase; depois explique. De 60 a 250 palavras, a menos que o aluno peça mais ou menos.
- Se a resposta estiver no resumo, liste em "secoes" os títulos das seções usadas, exatamente como aparecem depois de "##".
- Se o material não cobrir a pergunta, responda com conhecimento consolidado (Robbins, Guyton, Abbas, Harrison) e comece com "Isso não está no seu material, mas".
- Se o aluno afirmar algo errado, corrija com clareza e explique por quê.
- Modo treino: se o aluno pedir para ser testado ("treino", "me faça uma pergunta"), faça UMA pergunta de tutoria por vez, sobre um ponto importante do material, e NÃO dê a resposta. Quando ele responder, corrija: diga o que acertou, o que faltou ou está errado, dê a resposta completa em poucas linhas e termine oferecendo a próxima pergunta. Não repita perguntas já feitas na conversa.
- Pode usar uma tabela curta para comparações. Sem doses, sem inventar valores, sem LaTeX, sem asteriscos.
- "html": só as tags p, ul, ol, li, strong, em, table, thead, tbody, tr, th, td. Sem títulos.
Responda SOMENTE com JSON: { "html": "string", "secoes": ["string"] }`,
      `Tópico: "${String(topic.title)}".

MATERIAL DO TÓPICO — RESUMO:
${material}
${lecture ? `\nMATERIAL DO TÓPICO — TRANSCRIÇÃO DA AULA (trecho):\n${lecture}\n` : ""}
${previous ? `CONVERSA ATÉ AGORA:\n${previous}\n` : ""}
PERGUNTA DO ALUNO: ${data.question}`,
    );

    const answer = delatex(sanitizeStudyHtml(String(result.html ?? "")), "html").replace(
      /<\/?h3>/g,
      "",
    );
    if (strip(answer).length < 2) throw new Error("A IA não devolveu uma resposta. Tente de novo.");
    const titles = new Set(secs.map((s) => s.title));
    const cited = (Array.isArray(result.secoes) ? result.secoes : [])
      .map((s) => String(s).trim())
      .filter((s) => titles.has(s))
      .slice(0, 4);
    const content = `${answer.slice(0, 19_000)}<!--secoes:${JSON.stringify(cited)}-->`;

    const { data: aiRow, error: aiError } = await supabase
      .from("topic_chat_messages")
      .insert({ topic_id: data.topic_id, role: "assistant", content })
      .select("id, role, content, created_at")
      .single();
    if (aiError || !aiRow) throw new Error("Não deu para salvar a resposta.");
    return { assistant: aiRow };
  });
