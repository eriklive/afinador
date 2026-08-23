/**
 * Conversões entre frequência, número MIDI e nome de nota.
 *
 * Todo o app trabalha com número MIDI como identidade da nota (inteiro, não
 * depende do diapasão) e converte para Hz só na hora de comparar com o
 * microfone — assim calibrar o Lá de referência (A4) reafina tudo de graça.
 */

/** Diapasão padrão: Lá acima do dó central, em Hz. */
export const A4_PADRAO = 440;

/** Faixa de calibração aceita para o diapasão. */
export const A4_MINIMO = 415;
export const A4_MAXIMO = 466;

/** MIDI do Lá 4 — âncora de toda a conversão. */
const MIDI_A4 = 69;

const NOMES_CIFRA = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const NOMES_PT = [
  'Dó',
  'Dó#',
  'Ré',
  'Ré#',
  'Mi',
  'Fá',
  'Fá#',
  'Sol',
  'Sol#',
  'Lá',
  'Lá#',
  'Si',
] as const;

export interface Nota {
  /** Número MIDI da nota (60 = dó central). */
  readonly midi: number;
  /** Cifra americana, ex.: `E`, `F#`. */
  readonly cifra: string;
  /** Nome em português, ex.: `Mi`, `Fá#`. */
  readonly nome: string;
  /** Oitava científica, ex.: 2 em `E2`. */
  readonly oitava: number;
  /** Cifra com oitava, ex.: `E2`. */
  readonly rotulo: string;
}

/** Frequência em Hz de um número MIDI, para um dado diapasão. */
export function midiParaFrequencia(midi: number, a4: number = A4_PADRAO): number {
  return a4 * Math.pow(2, (midi - MIDI_A4) / 12);
}

/** Número MIDI (fracionário) de uma frequência, para um dado diapasão. */
export function frequenciaParaMidi(frequencia: number, a4: number = A4_PADRAO): number {
  return MIDI_A4 + 12 * Math.log2(frequencia / a4);
}

/** Distância em cents de `frequencia` até `alvo` (positivo = acima do alvo). */
export function centsEntre(frequencia: number, alvo: number): number {
  return 1200 * Math.log2(frequencia / alvo);
}

/** Descreve a nota de um número MIDI (arredondado ao semitom mais próximo). */
export function descreverNota(midi: number): Nota {
  const inteiro = Math.round(midi);
  const indice = ((inteiro % 12) + 12) % 12;
  const oitava = Math.floor(inteiro / 12) - 1;
  const cifra = NOMES_CIFRA[indice];
  return {
    midi: inteiro,
    cifra,
    nome: NOMES_PT[indice],
    oitava,
    rotulo: `${cifra}${oitava}`,
  };
}

/** Descreve a nota mais próxima de uma frequência captada. */
export function notaMaisProxima(frequencia: number, a4: number = A4_PADRAO): Nota {
  return descreverNota(frequenciaParaMidi(frequencia, a4));
}
