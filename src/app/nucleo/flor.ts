/**
 * A forma do mostrador é uma flor: uma circunferência cujo raio é modulado por
 * um cosseno. Com amplitude quase nula ela é um círculo — corda longe do tom,
 * nada acontecendo; conforme a corda entra na faixa afinada a amplitude cresce
 * e os sete lóbulos aparecem. É o mesmo desenho o tempo todo, só respirando.
 */

/** Lóbulos da flor. Sete é ímpar: nenhuma pétala espelha a outra e a rotação lê. */
export const LOBOS = 7;

/**
 * Caminho SVG fechado da flor, centrado na origem.
 *
 * @param raio Raio médio.
 * @param amplitude Fração do raio que separa vale de pico (0 = círculo).
 * @param rotacao Giro em radianos.
 * @param pontos Quantidade de segmentos — 150 já não mostra facetas em 268 px.
 */
export function caminhoDaFlor(
  raio: number,
  amplitude: number,
  rotacao: number,
  pontos = 150,
): string {
  let d = '';
  for (let i = 0; i <= pontos; i++) {
    const angulo = (i / pontos) * Math.PI * 2;
    const r = raio * (1 + amplitude * Math.cos(LOBOS * (angulo - rotacao)));
    d += `${i ? 'L' : 'M'}${(r * Math.cos(angulo)).toFixed(2)} ${(r * Math.sin(angulo)).toFixed(2)}`;
  }
  return `${d}Z`;
}

/**
 * Caminho da onda de fundo da fita: um seno que corre da esquerda para a
 * direita e cuja altura cresce com o desvio — parada quando afinado.
 */
export function caminhoDaOnda(
  amplitude: number,
  fase: number,
  largura: number,
  meio: number,
  pontos = 64,
): string {
  let d = '';
  for (let i = 0; i <= pontos; i++) {
    const x = 6 + (i * largura) / pontos;
    const y = meio + amplitude * Math.sin((i / pontos) * Math.PI * 6 - fase);
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}
