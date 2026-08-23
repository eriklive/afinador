import { descreverNota } from './nota';

export type InstrumentoId = 'violao' | 'ukulele';

export interface Corda {
  /** Identificador estável, único dentro da afinação. */
  readonly id: string;
  /** Número da corda no instrumento (1 = a mais fina). */
  readonly numero: number;
  /** Número MIDI da nota solta. */
  readonly midi: number;
}

export interface Afinacao {
  readonly id: string;
  readonly nome: string;
  /** Cordas da mais grave para a mais aguda em posição no braço (6ª → 1ª). */
  readonly cordas: readonly Corda[];
}

export interface Instrumento {
  readonly id: InstrumentoId;
  readonly nome: string;
  readonly afinacoes: readonly Afinacao[];
}

function cordas(midis: readonly number[], prefixo: string): Corda[] {
  // `midis` vem da 6ª/4ª corda para a 1ª, então o número da corda decresce.
  const total = midis.length;
  return midis.map((midi, i) => ({
    id: `${prefixo}-${total - i}`,
    numero: total - i,
    midi,
  }));
}

export const INSTRUMENTOS: readonly Instrumento[] = [
  {
    id: 'violao',
    nome: 'Violão',
    afinacoes: [
      {
        id: 'violao-padrao',
        nome: 'Padrão (E A D G B E)',
        cordas: cordas([40, 45, 50, 55, 59, 64], 'violao-padrao'),
      },
      {
        id: 'violao-drop-d',
        nome: 'Drop D (D A D G B E)',
        cordas: cordas([38, 45, 50, 55, 59, 64], 'violao-drop-d'),
      },
      {
        id: 'violao-meio-tom',
        nome: 'Meio tom abaixo (Eb)',
        cordas: cordas([39, 44, 49, 54, 58, 63], 'violao-meio-tom'),
      },
      {
        id: 'violao-aberto-g',
        nome: 'Aberto em Sol (D G D G B D)',
        cordas: cordas([38, 43, 50, 55, 59, 62], 'violao-aberto-g'),
      },
    ],
  },
  {
    id: 'ukulele',
    nome: 'Ukulele',
    afinacoes: [
      {
        id: 'ukulele-padrao',
        nome: 'Padrão (G C E A)',
        cordas: cordas([67, 60, 64, 69], 'ukulele-padrao'),
      },
      {
        id: 'ukulele-sol-grave',
        nome: 'Sol grave / Low G (G C E A)',
        cordas: cordas([55, 60, 64, 69], 'ukulele-sol-grave'),
      },
      {
        id: 'ukulele-baritono',
        nome: 'Barítono (D G B E)',
        cordas: cordas([50, 55, 59, 64], 'ukulele-baritono'),
      },
    ],
  },
];

export function acharInstrumento(id: InstrumentoId): Instrumento {
  const instrumento = INSTRUMENTOS.find((i) => i.id === id);
  if (!instrumento) throw new Error(`Instrumento desconhecido: ${id}`);
  return instrumento;
}

export function acharAfinacao(instrumento: Instrumento, id: string): Afinacao {
  return instrumento.afinacoes.find((a) => a.id === id) ?? instrumento.afinacoes[0];
}

/** Rótulo curto da corda, ex.: `E2`. */
export function rotuloCorda(corda: Corda): string {
  return descreverNota(corda.midi).rotulo;
}
