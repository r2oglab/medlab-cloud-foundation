import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Notas na margem do resumo. Cada nota fica presa a um bloco (parágrafo, lista,
 * tabela…) pelo índice e pelo começo do texto do bloco: se o resumo mudar (tabela
 * inserida, edição), a nota procura o bloco pelo texto e continua no lugar certo.
 */

export type NoteRow = {
  id: string;
  topic_id: string;
  block_index: number;
  anchor_text: string | null;
  content: string;
  updated_at: string;
};

const ANCHOR_LEN = 120;

export const normalizeBlockText = (text: string) =>
  text.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");

/** O começo do texto do bloco, que serve de âncora da nota. */
export const anchorOf = (blockText: string) => normalizeBlockText(blockText).slice(0, ANCHOR_LEN);

export type ResolvedNotes = {
  /** índice do bloco → notas daquele bloco */
  byBlock: Map<number, NoteRow[]>;
  /** notas cujo trecho não existe mais (resumo refeito, por exemplo) */
  orphans: NoteRow[];
};

/**
 * Acha o bloco de cada nota: primeiro pelo texto (o bloco mais perto do índice
 * antigo que começa igual), depois pelo índice, se o texto estiver vazio.
 */
export function resolveNotes(notes: NoteRow[], blockTexts: string[]): ResolvedNotes {
  const anchors = blockTexts.map(anchorOf);
  const byBlock = new Map<number, NoteRow[]>();
  const orphans: NoteRow[] = [];
  for (const note of notes) {
    let at = -1;
    if (note.anchor_text) {
      let best = Infinity;
      anchors.forEach((a, i) => {
        if (a && (a === note.anchor_text || a.startsWith(note.anchor_text!))) {
          const d = Math.abs(i - note.block_index);
          if (d < best) {
            best = d;
            at = i;
          }
        }
      });
    } else if (note.block_index < blockTexts.length) {
      at = note.block_index;
    }
    if (at < 0) orphans.push(note);
    else (byBlock.get(at) ?? byBlock.set(at, []).get(at)!).push(note);
  }
  return { byBlock, orphans };
}

export function useNotes(topicId: string) {
  return useQuery({
    queryKey: ["notes", topicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topic_notes")
        .select("id, topic_id, block_index, anchor_text, content, updated_at")
        .eq("topic_id", topicId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as NoteRow[];
    },
  });
}

export function useNoteActions(topicId: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["notes", topicId] });

  const create = useMutation({
    mutationFn: async (v: { blockIndex: number; blockText: string; content: string }) => {
      const { error } = await supabase.from("topic_notes").insert({
        topic_id: topicId,
        block_index: v.blockIndex,
        anchor_text: anchorOf(v.blockText) || null,
        content: v.content.trim().slice(0, 5000),
      });
      if (error) throw new Error("Não deu para salvar a nota.");
    },
    onSuccess: refresh,
  });

  const update = useMutation({
    mutationFn: async (v: { id: string; content: string }) => {
      const { error } = await supabase
        .from("topic_notes")
        .update({ content: v.content.trim().slice(0, 5000), updated_at: new Date().toISOString() })
        .eq("id", v.id);
      if (error) throw new Error("Não deu para salvar a nota.");
    },
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("topic_notes").delete().eq("id", id);
      if (error) throw new Error("Não deu para apagar a nota.");
    },
    onSuccess: refresh,
  });

  return { create, update, remove };
}
