/**
 * Detecção de tom pelo método McLeod (NSDF — normalized square difference
 * function), que é o que sustenta o afinador: autocorrelação crua erra a
 * oitava com frequência em corda dedilhada, porque o 2º harmônico costuma
 * render um pico tão alto quanto o da fundamental. O NSDF normaliza a
 * correlação e a escolha do *primeiro* pico acima de um percentual do máximo
 * faz a fundamental ganhar do harmônico.
 */

export interface OpcoesDeteccao {
  /** Menor frequência considerada, em Hz. */
  readonly frequenciaMinima?: number;
  /**
   * Maior frequência considerada, em Hz. Não serve como filtro: um tom acima
   * dela também é periódico em suas subharmônicas e seria reportado ali. Quem
   * limita a banda de entrada é a cadeia de filtros do microfone.
   */
  readonly frequenciaMaxima?: number;
  /** RMS mínimo do trecho para valer a pena analisar. */
  readonly limiarRms?: number;
  /** Altura mínima do pico do NSDF (0..1) para aceitar a leitura. */
  readonly limiarClareza?: number;
}

export interface Leitura {
  /** Frequência fundamental estimada, em Hz. */
  readonly frequencia: number;
  /** Periodicidade do trecho, de 0 (ruído) a 1 (tom puro). */
  readonly clareza: number;
  /** Volume RMS do trecho, de 0 a 1. */
  readonly volume: number;
}

const PADRAO: Required<OpcoesDeteccao> = {
  // Abaixo do D2 do drop D (73,4 Hz) com folga, e acima do A4 do ukulele.
  frequenciaMinima: 60,
  frequenciaMaxima: 1200,
  limiarRms: 0.008,
  limiarClareza: 0.82,
};

/** Fração do pico máximo do NSDF a partir da qual um pico já serve. */
const CORTE_PICO = 0.9;

/**
 * Estima a frequência fundamental de um trecho de áudio no domínio do tempo.
 * Devolve `null` quando o trecho está baixo ou pouco periódico demais.
 */
export function detectarFrequencia(
  amostras: Float32Array,
  taxaAmostragem: number,
  opcoes: OpcoesDeteccao = {},
): Leitura | null {
  const { frequenciaMinima, frequenciaMaxima, limiarRms, limiarClareza } = {
    ...PADRAO,
    ...opcoes,
  };
  const n = amostras.length;
  if (n < 128) return null;

  // Tira o nível DC: um offset constante infla a correlação em todo lag.
  let soma = 0;
  for (let i = 0; i < n; i++) soma += amostras[i];
  const media = soma / n;

  const x = new Float32Array(n);
  let energia = 0;
  for (let i = 0; i < n; i++) {
    const v = amostras[i] - media;
    x[i] = v;
    energia += v * v;
  }

  const volume = Math.sqrt(energia / n);
  if (volume < limiarRms) return null;

  const lagMinimo = Math.max(2, Math.floor(taxaAmostragem / frequenciaMaxima));
  const lagMaximo = Math.min(n - 2, Math.ceil(taxaAmostragem / frequenciaMinima));
  if (lagMaximo <= lagMinimo) return null;

  // Somas de prefixo de x², para obter o denominador do NSDF em O(1) por lag.
  const prefixo = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefixo[i + 1] = prefixo[i] + x[i] * x[i];

  const nsdf = new Float64Array(lagMaximo + 1);
  for (let lag = lagMinimo; lag <= lagMaximo; lag++) {
    const limite = n - lag;
    let correlacao = 0;
    for (let i = 0; i < limite; i++) correlacao += x[i] * x[i + lag];
    // m(lag) = Σ x[i]² + Σ x[i+lag]², sobre a mesma janela sobreposta.
    const m = prefixo[limite] + (prefixo[n] - prefixo[lag]);
    nsdf[lag] = m > 0 ? (2 * correlacao) / m : 0;
  }

  const picos = acharPicos(nsdf, lagMinimo, lagMaximo);
  if (picos.length === 0) return null;

  let maiorValor = 0;
  for (const pico of picos) maiorValor = Math.max(maiorValor, pico.valor);
  if (maiorValor <= 0) return null;

  const corte = maiorValor * CORTE_PICO;
  const escolhido = picos.find((pico) => pico.valor >= corte) ?? picos[0];
  if (escolhido.valor < limiarClareza) return null;

  const frequencia = taxaAmostragem / escolhido.lag;
  if (frequencia < frequenciaMinima || frequencia > frequenciaMaxima) return null;

  return { frequencia, clareza: Math.min(1, escolhido.valor), volume };
}

interface Pico {
  /** Lag interpolado, em amostras (fracionário). */
  readonly lag: number;
  readonly valor: number;
}

/**
 * Máximos locais do NSDF, um por região positiva — é a varredura do McLeod:
 * entre um cruzamento de zero para cima e o próximo para baixo só o maior
 * ponto interessa, o que descarta as ondulações em volta de cada pico real.
 */
function acharPicos(nsdf: Float64Array, lagMinimo: number, lagMaximo: number): Pico[] {
  const picos: Pico[] = [];
  let lag = lagMinimo;

  // Ignora a encosta inicial: o NSDF sai de ~1 em lag 0 e desce.
  while (lag <= lagMaximo && nsdf[lag] > 0) lag++;

  while (lag <= lagMaximo) {
    while (lag <= lagMaximo && nsdf[lag] <= 0) lag++;
    if (lag > lagMaximo) break;

    let melhorLag = lag;
    let melhorValor = nsdf[lag];
    while (lag <= lagMaximo && nsdf[lag] > 0) {
      if (nsdf[lag] > melhorValor) {
        melhorValor = nsdf[lag];
        melhorLag = lag;
      }
      lag++;
    }
    picos.push({ lag: interpolarPico(nsdf, melhorLag, lagMinimo, lagMaximo), valor: melhorValor });
  }

  return picos;
}

/**
 * Refina a posição do pico com uma parábola pelos três pontos ao redor. Sem
 * isso a resolução é de 1 amostra, que no E2 (lag ≈ 535 a 44,1 kHz) já vale
 * ~3 cents — visível no ponteiro.
 */
function interpolarPico(
  nsdf: Float64Array,
  lag: number,
  lagMinimo: number,
  lagMaximo: number,
): number {
  if (lag <= lagMinimo || lag >= lagMaximo) return lag;
  const anterior = nsdf[lag - 1];
  const atual = nsdf[lag];
  const seguinte = nsdf[lag + 1];
  const denominador = 2 * (2 * atual - anterior - seguinte);
  if (denominador === 0) return lag;
  const deslocamento = (seguinte - anterior) / denominador;
  return Math.abs(deslocamento) < 1 ? lag + deslocamento : lag;
}
