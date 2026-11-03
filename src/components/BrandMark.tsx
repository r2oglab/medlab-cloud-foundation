import { cn } from "@/lib/utils";

/**
 * Marca do MedLab (proposta Caderno): "M" em serifa sobre bloco tinta,
 * com o traço amarelo do marca-texto atrás. A letra é um desenho (path),
 * então não depende da fonte ter carregado.
 */
const M_PATH =
  "M31.25 47.07Q31.07 47.07 30.86 46.94Q30.64 46.81 30.56 46.38L24.06 19.99Q24.01 19.69 23.8 19.71Q23.58 19.73 23.58 20.03L22.72 43.8Q22.68 45 23.11 45.63Q23.54 46.25 24.62 46.42L25.18 46.51Q25.74 46.55 25.74 47.03Q25.74 47.5 25.09 47.5H18.93Q18.29 47.5 18.29 47.03Q18.29 46.55 18.85 46.51L19.41 46.42Q20.53 46.25 20.93 45.63Q21.34 45 21.39 43.8L22.25 19.34Q22.29 18.44 21.99 18.14Q21.69 17.83 20.7 17.66L19.71 17.49Q19.15 17.36 19.15 16.97Q19.15 16.5 19.79 16.5H24.96Q26.3 16.5 26.6 17.79L31.81 39.28Q31.89 39.58 32.09 39.58Q32.28 39.58 32.32 39.28L37.75 17.58Q38.01 16.5 39.13 16.5H44.21Q44.85 16.5 44.85 16.97Q44.85 17.36 44.29 17.49L43.3 17.66Q42.4 17.83 42.1 18.14Q41.8 18.44 41.84 19.34L42.7 44.66Q42.74 45.56 43 45.86Q43.26 46.17 44.16 46.34L45.15 46.51Q45.71 46.64 45.71 47.03Q45.71 47.5 45.07 47.5H37.27Q36.63 47.5 36.63 47.03Q36.63 46.64 37.19 46.51L38.18 46.34Q39.08 46.17 39.38 45.86Q39.69 45.56 39.64 44.66L38.91 20.03Q38.91 19.73 38.72 19.71Q38.52 19.69 38.44 19.94L31.89 46.38Q31.81 46.81 31.61 46.94Q31.42 47.07 31.25 47.07Z";

export function BrandMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("size-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <rect width="64" height="64" rx="14" fill="#1A1917" />
      <rect
        x="12"
        y="38"
        width="40"
        height="10"
        rx="2"
        fill="#FFD84D"
        transform="rotate(-5 32 43)"
      />
      <path d={M_PATH} fill="#FAF9F6" stroke="#FAF9F6" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}

/** "Med" reto e "lab" itálico, em Instrument Serif. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      translate="no"
      className={cn("font-serif text-[1.7rem] leading-none tracking-[-0.02em]", className)}
    >
      Med<i className="italic">lab</i>
    </span>
  );
}