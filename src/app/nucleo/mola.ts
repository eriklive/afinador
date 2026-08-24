/**
 * Mola amortecida integrada quadro a quadro.
 *
 * O afinador usa mola em vez de transição CSS onde o alvo muda a cada leitura
 * do microfone: a transição reinicia do zero a cada valor novo e o movimento
 * fica picado, enquanto a mola carrega a velocidade de um quadro para o outro
 * e ainda passa um pouco do alvo — é o que faz a forma parecer viva.
 */
export class Mola {
  private velocidade = 0;

  constructor(
    private posicao = 0,
    /** Rigidez: quanto maior, mais rápido persegue o alvo. */
    private readonly rigidez = 170,
    /** Atrito: quanto menor, mais ela oscila em volta do alvo. */
    private readonly atrito = 20,
  ) {}

  get valor(): number {
    return this.posicao;
  }

  /** Avança `dt` segundos rumo a `alvo` e devolve a nova posição. */
  avancar(alvo: number, dt: number): number {
    const forca = -this.rigidez * (this.posicao - alvo) - this.atrito * this.velocidade;
    this.velocidade += forca * dt;
    this.posicao += this.velocidade * dt;
    return this.posicao;
  }

  /** Coloca a mola parada no valor, sem percurso — usado com movimento reduzido. */
  saltarPara(valor: number): number {
    this.posicao = valor;
    this.velocidade = 0;
    return this.posicao;
  }
}
