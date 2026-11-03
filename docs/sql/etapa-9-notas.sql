-- Etapa 9: notas na margem do resumo.
-- Guarda o começo do texto do parágrafo anotado, para a nota continuar no lugar certo
-- mesmo depois de inserir tabelas, explicações ou editar o resumo.
ALTER TABLE public.topic_notes
  ADD COLUMN IF NOT EXISTS anchor_text text
  CHECK (anchor_text IS NULL OR char_length(anchor_text) <= 300);

-- Conferência: deve listar a coluna anchor_text (tipo text)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'topic_notes'
ORDER BY ordinal_position;
