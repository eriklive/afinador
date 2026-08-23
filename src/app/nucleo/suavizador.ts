/**
 * Estabiliza a sequência de frequências detectadas.
 *
 * Frame a frame a estimativa oscila alguns cents e, de vez em quando, pula uma
 * oitava. A mediana descarta esses pulos isolados sem atrasar a resposta; a
 * média exponencial (em espaço logarítmico, para o passo ser musicalmente
 * uniforme) tira o resto do tremor do ponteiro. Uma variação grande de verdade
 * — o usuário tocou outra corda — zera o histórico em vez de ser suavizada.
 */
export class SuavizadorDeTom {
  private readonly historico: number[] = [];
  private suavizado: number | null = null;

  constructor(
    private readonly janela = 5,
    private readonly fator = 0.4,
    private readonly saltoEmCents = 70,
  ) {}

  /** Frequência suavizada corrente, ou `null` se ainda não há leitura. */
  get valor(): number | null {
    return this.suavizado;
  }

  /** Registra uma nova leitura e devolve a frequência suavizada. */
  registrar(frequencia: number): number {
    if (this.suavizado !== null) {
      const salto = Math.abs(1200 * Math.log2(frequencia / this.suavizado));
      if (salto > this.saltoEmCents) this.limpar();
    }

    this.historico.push(frequencia);
    if (this.historico.length > this.janela) this.historico.shift();

    const mediana = calcularMediana(this.historico);
    this.suavizado =
      this.suavizado === null
        ? mediana
        : Math.pow(2, Math.log2(this.suavizado) + this.fator * Math.log2(mediana / this.suavizado));

    return this.suavizado;
  }

  limpar(): void {
    this.historico.length = 0;
    this.suavizado = null;
  }
}

function calcularMediana(valores: readonly number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0 ? (ordenados[meio - 1] + ordenados[meio]) / 2 : ordenados[meio];
}
