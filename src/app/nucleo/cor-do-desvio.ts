/**
 * A cor do afinador não é um estado com três degraus (afinado / perto / longe)
 * — é uma rampa contínua. Quanto mais a corda se afasta do alvo, mais quente
 * fica a tela: verde, limão, amarelo, laranja, vermelho.
 *
 * A rampa vive em HSL porque é a interpolação que atravessa esses cinco tons
 * sem passar por cinza no caminho, como aconteceria misturando os sRGB.
 */

interface Parada {
  /** Posição na rampa, de 0 (afinado) a 1 (longe). */
  readonly p: number;
  readonly h: number;
  readonly s: number;
  readonly l: number;
}

const RAMPA: readonly Parada[] = [
  { p: 0.0, h: 142, s: 62, l: 70 },
  { p: 0.28, h: 72, s: 70, l: 68 },
  { p: 0.5, h: 48, s: 88, l: 66 },
  { p: 0.75, h: 26, s: 92, l: 64 },
  { p: 1.0, h: 4, s: 85, l: 66 },
];

/** Desvio em que a cor chega ao vermelho pleno, em cents. */
const ALCANCE = 45;

export interface CorDoDesvio {
  /** Cor viva: nota, ponteiro, pílula de instrução. */
  readonly acento: string;
  /** Versão funda, para preencher áreas grandes sem ofuscar. */
  readonly fundo: string;
  /** Versão escura, para texto sobre o acento. */
  readonly tinta: string;
}

const limitar = (valor: number, minimo: number, maximo: number): number =>
  Math.max(minimo, Math.min(maximo, valor));

/**
 * Onde o desvio cai na rampa, de 0 a 1. Dentro da tolerância o resultado é 0:
 * a faixa afinada é verde inteira, não um degradê que já começa a esquentar.
 */
export function intensidadeDoDesvio(cents: number | null, tolerancia: number): number {
  if (cents === null) return 0;
  return limitar((Math.abs(cents) - tolerancia) / (ALCANCE - tolerancia), 0, 1);
}

/** Cor da rampa numa posição de 0 a 1. */
export function corDoDesvio(intensidade: number): CorDoDesvio {
  const t = limitar(intensidade, 0, 1);

  let inicio = RAMPA[0];
  let fim = RAMPA[RAMPA.length - 1];
  for (let i = 0; i < RAMPA.length - 1; i++) {
    if (t >= RAMPA[i].p && t <= RAMPA[i + 1].p) {
      inicio = RAMPA[i];
      fim = RAMPA[i + 1];
      break;
    }
  }

  const vao = fim.p - inicio.p;
  const k = vao === 0 ? 0 : (t - inicio.p) / vao;
  const h = inicio.h + (fim.h - inicio.h) * k;
  const s = inicio.s + (fim.s - inicio.s) * k;
  const l = inicio.l + (fim.l - inicio.l) * k;

  return {
    acento: hsl(h, s, l),
    fundo: hsl(h, s - 28, l - 48),
    tinta: hsl(h, s + 10, l - 56),
  };
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${h.toFixed(1)} ${limitar(s, 0, 100).toFixed(1)}% ${limitar(l, 0, 100).toFixed(1)}%)`;
}

/**
 * Cor de espera: enquanto nenhuma nota chega, o acento sai da rampa e vira o
 * lilás da própria interface — verde aqui seria lido como "afinado".
 */
export const COR_EM_ESPERA: CorDoDesvio = {
  acento: '#c9bad3',
  fundo: '#2e2537',
  tinta: '#221b29',
};
