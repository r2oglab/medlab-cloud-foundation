import { useEffect, useId, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Loader2, MessageSquareText, Sparkles, Table2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { aiErrorMessage } from "@/lib/ai-busy";
import { cn } from "@/lib/utils";
import { escapeHtml, insertIntoSummary, listSections } from "@/lib/summary-sections";
import { compareTable, reexplainSection } from "@/lib/summary-tools.functions";

const field =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-[0.9375rem] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-ring)_18%,transparent)]";
const labelClass = "text-sm font-medium";

/** Grava o resumo com o bloco novo e avisa a página para recarregar o editor. */
async function saveSummary(topicId: string, html: string) {
  const { error } = await supabase
    .from("materials")
    .update({ content: { html } })
    .eq("topic_id", topicId)
    .eq("type", "summary");
  if (error) throw new Error("Não deu para salvar no resumo. Tente de novo.");
}

/** Menu "Ferramentas IA" do resumo (modo leitura): tabela comparativa e explicar uma seção de novo. */
export function SummaryTools({
  topicId,
  html,
  onChanged,
}: {
  topicId: string;
  html: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState<"tabela" | "explicar" | null>(null);
  const sections = useMemo(() => (typeof window === "undefined" ? [] : listSections(html)), [html]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="h-9 text-sm">
            <Sparkles className="size-4" aria-hidden /> Ferramentas IA
            <ChevronDown className="size-3.5 opacity-60" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onSelect={() => setOpen("tabela")} className="gap-2">
            <Table2 className="size-4" aria-hidden /> Tabela comparativa
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setOpen("explicar")}
            className="gap-2"
            disabled={!sections.length}
          >
            <MessageSquareText className="size-4" aria-hidden /> Explicar uma seção de novo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CompareDialog
        open={open === "tabela"}
        onOpenChange={(o) => setOpen(o ? "tabela" : null)}
        topicId={topicId}
        html={html}
        sections={sections}
        onChanged={onChanged}
      />
      <ExplainDialog
        open={open === "explicar"}
        onOpenChange={(o) => setOpen(o ? "explicar" : null)}
        topicId={topicId}
        html={html}
        sections={sections}
        onChanged={onChanged}
      />
    </>
  );
}

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId: string;
  html: string;
  sections: { index: number; title: string; text: string }[];
  onChanged: () => void;
};

function PlaceSelect({
  id,
  value,
  onChange,
  sections,
  endLabel,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  sections: DialogProps["sections"];
  endLabel?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(field, "appearance-auto bg-card text-foreground")}
    >
      {endLabel && <option value="fim">{endLabel}</option>}
      {sections.map((s) => (
        <option key={s.index} value={String(s.index)}>
          {endLabel ? "Dentro de: " : ""}
          {s.title}
        </option>
      ))}
    </select>
  );
}

function CompareDialog({ open, onOpenChange, topicId, html, sections, onChanged }: DialogProps) {
  const generate = useServerFn(compareTable);
  const queryId = useId();
  const placeId = useId();
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState("fim");
  const [busy, setBusy] = useState<"gerando" | "salvando" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ title: string; html: string } | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setResult(null);
    }
  }, [open]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 3) {
      setError("Diga o que comparar, por exemplo: necrose × apoptose.");
      return;
    }
    setError(null);
    setBusy("gerando");
    try {
      setResult(await generate({ data: { topic_id: topicId, query: query.trim() } }));
    } catch (err) {
      setError(aiErrorMessage(err, "Não deu para montar a tabela."));
    } finally {
      setBusy(null);
    }
  }

  async function insert() {
    if (!result) return;
    setBusy("salvando");
    try {
      const block = `<h2>${escapeHtml(result.title)}</h2>${result.html}`;
      const inside = place !== "fim" ? `<h3>${escapeHtml(result.title)}</h3>${result.html}` : block;
      await saveSummary(
        topicId,
        insertIntoSummary(html, place === "fim" ? null : Number(place), inside),
      );
      toast.success("Tabela inserida no resumo.");
      onOpenChange(false);
      setQuery("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não deu para salvar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="text-[1.6rem] font-normal leading-none">
            Tabela comparativa
          </DialogTitle>
          <DialogDescription>
            A IA monta a tabela com os critérios que mais diferenciam os itens. Você confere antes
            de inserir.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={run} className="mt-2 grid gap-2">
          <label htmlFor={queryId} className={labelClass}>
            O que comparar?
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={queryId}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={200}
              autoComplete="off"
              placeholder="Ex.: necrose × apoptose, ou tipos de hipersensibilidade…"
              className={field}
            />
            <Button type="submit" disabled={!!busy} className="h-11 shrink-0">
              {busy === "gerando" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4" aria-hidden />
              )}
              {busy === "gerando" ? "Montando…" : result ? "Gerar de novo" : "Gerar tabela"}
            </Button>
          </div>
          <p aria-live="polite" className={cn("text-sm", error ? "text-destructive" : "sr-only")}>
            {error ?? (busy === "gerando" ? "Montando a tabela." : "")}
          </p>
        </form>

        {result && (
          <div className="mt-2 border-t border-border pt-4">
            <p className="font-serif text-[1.35rem] leading-tight">{result.title}</p>
            <div
              className="resumo-editor prose-study mt-3"
              dangerouslySetInnerHTML={{ __html: result.html }}
            />
            <div className="mt-5 grid gap-2">
              <label htmlFor={placeId} className={labelClass}>
                Onde inserir
              </label>
              <PlaceSelect
                id={placeId}
                value={place}
                onChange={setPlace}
                sections={sections}
                endLabel="No fim do resumo, como seção nova"
              />
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!!busy}
            onClick={() => onOpenChange(false)}
          >
            {result ? "Descartar" : "Cancelar"}
          </Button>
          {result && (
            <Button type="button" disabled={!!busy} onClick={() => void insert()}>
              {busy === "salvando" ? "Inserindo…" : "Inserir no resumo"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const MODES = [
  { v: "simples", label: "Mais simples", heading: "Em outras palavras" },
  { v: "fundo", label: "Mais a fundo", heading: "Aprofundando" },
  { v: "clinico", label: "Com exemplo clínico", heading: "Na prática clínica" },
] as const;

function ExplainDialog({ open, onOpenChange, topicId, html, sections, onChanged }: DialogProps) {
  const explain = useServerFn(reexplainSection);
  const sectionId = useId();
  const modeName = useId();
  const [section, setSection] = useState("0");
  const [mode, setMode] = useState<(typeof MODES)[number]["v"]>("simples");
  const [busy, setBusy] = useState<"gerando" | "salvando" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setResult(null);
    }
  }, [open]);

  const chosen = sections[Number(section)];
  const heading = MODES.find((m) => m.v === mode)!.heading;

  async function run() {
    if (!chosen) return;
    setError(null);
    setBusy("gerando");
    try {
      const r = await explain({
        data: {
          topic_id: topicId,
          section_title: chosen.title,
          section_text: chosen.text.slice(0, 12000) || chosen.title,
          mode,
        },
      });
      setResult(r.html);
    } catch (err) {
      setError(aiErrorMessage(err, "Não deu para explicar esta seção."));
    } finally {
      setBusy(null);
    }
  }

  async function insert() {
    if (!result || !chosen) return;
    setBusy("salvando");
    try {
      await saveSummary(
        topicId,
        insertIntoSummary(html, chosen.index, `<h3>${heading}</h3>${result}`),
      );
      toast.success(`Explicação inserida em “${chosen.title}”.`);
      onOpenChange(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não deu para salvar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="text-[1.6rem] font-normal leading-none">
            Explicar de novo
          </DialogTitle>
          <DialogDescription>
            Escolha a seção que não ficou clara e como quer a nova explicação. Ler não muda o
            resumo; só inserir.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid gap-2">
          <label htmlFor={sectionId} className={labelClass}>
            Seção
          </label>
          <PlaceSelect
            id={sectionId}
            value={section}
            onChange={(v) => {
              setSection(v);
              setResult(null);
            }}
            sections={sections}
          />
        </div>

        <fieldset className="mt-4">
          <legend className={labelClass}>Como explicar</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {MODES.map((m) => (
              <label
                key={m.v}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border px-3 text-sm transition-colors",
                  mode === m.v ? "border-foreground" : "border-border hover:border-foreground/40",
                )}
              >
                <input
                  type="radio"
                  name={modeName}
                  value={m.v}
                  checked={mode === m.v}
                  onChange={() => {
                    setMode(m.v);
                    setResult(null);
                  }}
                  className="size-4 accent-[var(--color-foreground)]"
                />
                {m.label}
              </label>
            ))}
          </div>
        </fieldset>

        <p
          aria-live="polite"
          className={cn("mt-2 text-sm", error ? "text-destructive" : "sr-only")}
        >
          {error ?? (busy === "gerando" ? "Escrevendo a explicação." : "")}
        </p>

        {result && (
          <div className="mt-2 rounded-lg border border-border bg-card px-4 py-3">
            <p className="font-sans text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {heading}
            </p>
            <div className="prose-study mt-1" dangerouslySetInnerHTML={{ __html: result }} />
          </div>
        )}

        <DialogFooter className="mt-4 gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!!busy}
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
          {result ? (
            <>
              <Button type="button" variant="outline" disabled={!!busy} onClick={() => void run()}>
                Gerar de novo
              </Button>
              <Button type="button" disabled={!!busy} onClick={() => void insert()}>
                {busy === "salvando" ? "Inserindo…" : "Inserir no fim da seção"}
              </Button>
            </>
          ) : (
            <Button type="button" disabled={!!busy || !chosen} onClick={() => void run()}>
              {busy === "gerando" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4" aria-hidden />
              )}
              {busy === "gerando" ? "Explicando…" : "Explicar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
