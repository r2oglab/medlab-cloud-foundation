/**
 * Configuração da IA do MedLab: quais modelos usar e as regras de formato que se repetem
 * entre a geração completa (gemini.server.ts) e a geração avulsa (study-extra.functions.ts).
 */

/** Modelo principal: mais preciso em conteúdo médico. */
export const MODEL_MAIN = "gemini-3.5-flash";
/** Reserva: mais leve; entra quando o principal está sem cota, congestionado ou indisponível. */
export const MODEL_FALLBACK = "gemini-3.1-flash-lite";

/** Vale tentar o modelo reserva? 429 = cota ou limite, 404 = modelo indisponível, 5xx = congestionado. */
export function shouldFallback(status: number) {
  return status === 429 || status === 404 || status >= 500;
}

/** Caso clínico no formato de tutoria (PBL). O cenário é exibido como texto puro, linha a linha. */
export const CASE_RULES = `CASO CLÍNICO (formato de tutoria PBL):
- "scenario" com 220 a 380 palavras, em texto puro (sem markdown, sem asteriscos, sem #), uma seção por linha, nesta ordem, cada linha começando pelo rótulo seguido de dois-pontos:
Identificação: ...
Queixa principal: ... (entre aspas, nas palavras do paciente)
História da doença atual: ...
Antecedentes: ... (pessoais, familiares, medicamentos e hábitos)
Exame físico: ... (estado geral, sinais vitais com unidades e achados relevantes por sistema)
Exames complementares: ... (laboratório com valor, unidade e referência entre parênteses, ex.: "Hb 9,8 g/dL (VR 12–16)"; imagem ou anatomopatológico quando fizer sentido)
Evolução: ... (opcional: o que aconteceu depois ou o que motivou a investigação)
- O caso precisa exigir raciocínio: os achados sustentam o diagnóstico sem entregá-lo. Nunca escreva o diagnóstico no cenário.
- "guiding_questions" de 5 a 10, na sequência de uma tutoria: dados relevantes e problemas do caso; hipóteses diagnósticas e diferenciais; mecanismos fisiopatológicos ligando ciências básicas aos achados; interpretação dos exames; anatomia patológica esperada, quando couber; conduta e prognóstico. Cada "answer" é completa e cita os achados do caso que a sustentam.
- "case_explanation" com 120 a 220 palavras: diagnóstico mais provável, o raciocínio que leva a ele e a conduta esperada.`;

/** Questões objetivas com vinheta clínica. Vinheta e enunciado ficam separados por uma linha em branco. */
export const MCQ_RULES = `QUESTÕES DE MÚLTIPLA ESCOLHA (estilo prova de Medicina e residência):
- Pelo menos 7 em cada 10 questões começam com uma VINHETA CLÍNICA de 40 a 90 palavras (paciente, idade, queixa, achados de exame e exames relevantes com unidades), seguida de UMA LINHA EM BRANCO ("\\n\\n") e do enunciado: UMA frase curta (até 25 palavras) que é só a pergunta. Todos os dados do paciente, inclusive medicações em uso e exames, ficam na vinheta, nunca depois da linha em branco. As demais podem ser conceituais diretas (mecanismo, histologia, classificação), sem vinheta e sem linha em branco.
- Exatamente 4 alternativas plausíveis e do mesmo tipo (todas diagnósticos, ou todas mecanismos etc.). Nada de "todas as anteriores", "nenhuma das anteriores" ou pegadinha de português.
- "explanation" diz por que a correta está certa e por que cada distratora está errada, em 2 a 5 frases, em texto puro (sem asteriscos nem outra marcação).
- A vinheta e o enunciado nunca contêm a resposta nem uma pista direta dela: não escreva o nome do diagnóstico, do mecanismo ou do conceito pedido (por exemplo, numa questão sobre exsudato, a vinheta não diz "caracterizando um exsudato"). Dê os achados e deixe o aluno concluir.
- Distribua as respostas corretas entre as posições 0, 1, 2 e 3.`;
