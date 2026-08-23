import { Injectable, computed, signal } from '@angular/core';
import { detectarFrequencia, type Leitura } from './detector-de-tom';
import { SuavizadorDeTom } from './suavizador';

export type EstadoMicrofone =
  'parado' | 'iniciando' | 'ouvindo' | 'negado' | 'indisponivel' | 'erro';

/** O que está chegando pelo microfone neste instante. */
export type Sinal = 'mudo' | 'som' | 'nota';

/** Janela de análise. 4096 amostras cobrem ~3 ciclos do E2 a 48 kHz. */
const TAMANHO_JANELA = 4096;

/** Intervalo entre análises. Menor que isso só gasta bateria. */
const INTERVALO_MS = 45;

/** Tempo que a última leitura válida continua na tela depois do som sumir. */
const RETENCAO_MS = 900;

/** RMS a partir do qual consideramos que existe som entrando. */
const LIMIAR_SOM = 0.003;

@Injectable({ providedIn: 'root' })
export class Microfone {
  readonly estado = signal<EstadoMicrofone>('parado');
  readonly mensagemErro = signal<string | null>(null);

  /** Última leitura válida, já suavizada. `null` quando não há som útil. */
  readonly leitura = signal<Leitura | null>(null);

  /**
   * Volume RMS instantâneo, de 0 a 1 — medido sempre, mesmo quando a detecção
   * não fecha. É o que separa "microfone mudo" de "ouvindo mas sem nota".
   */
  readonly nivel = signal(0);

  /** Quando `true`, o loop segue rodando mas para de publicar leituras. */
  readonly pausado = signal(false);

  readonly sinal = computed<Sinal>(() => {
    if (this.leitura() !== null) return 'nota';
    return this.nivel() >= LIMIAR_SOM ? 'som' : 'mudo';
  });

  private contexto: AudioContext | null = null;
  private captura: MediaStream | null = null;
  private analisador: AnalyserNode | null = null;
  /** Segura o grafo inteiro: nó de áudio sem referência viva pode ser coletado. */
  private grafo: AudioNode[] = [];
  private amostras = new Float32Array(TAMANHO_JANELA);
  private readonly suavizador = new SuavizadorDeTom();
  private quadro = 0;
  private ultimaAnalise = 0;
  private ultimaValida = 0;

  get ativo(): boolean {
    return this.estado() === 'ouvindo';
  }

  async iniciar(): Promise<void> {
    if (this.estado() === 'ouvindo' || this.estado() === 'iniciando') return;

    if (!window.isSecureContext) {
      this.falhar('indisponivel', 'O microfone só funciona em páginas HTTPS.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      this.falhar('indisponivel', 'Este navegador não dá acesso ao microfone.');
      return;
    }

    this.estado.set('iniciando');
    this.mensagemErro.set(null);

    // O contexto nasce e começa a destravar AINDA dentro do toque que abriu o
    // microfone. No Safari (iPhone e iPad) um AudioContext criado depois do
    // primeiro `await` fica suspenso: o analisador devolve só zeros e o
    // afinador fica mudo sem levantar erro nenhum.
    let contexto: AudioContext;
    let destravando: Promise<void | undefined>;
    try {
      contexto = new AudioContext({ latencyHint: 'interactive' });
      destravando = contexto.resume().catch(() => undefined);
    } catch {
      this.falhar('indisponivel', 'Este navegador não suporta captura de áudio.');
      return;
    }

    try {
      // Os processamentos de voz do navegador destroem a periodicidade do
      // sinal — com eles ligados a detecção de tom simplesmente não fecha.
      const captura = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });

      await destravando;
      if (contexto.state !== 'running') await contexto.resume().catch(() => undefined);
      if (contexto.state !== 'running') {
        captura.getTracks().forEach((faixa) => faixa.stop());
        throw new DOMException('Contexto de áudio suspenso', 'InvalidStateError');
      }

      const fonte = contexto.createMediaStreamSource(captura);

      // Corta o ronco abaixo do instrumento e o brilho acima dele: sobra a
      // faixa das fundamentais, onde a autocorrelação erra menos.
      const passaAlta = contexto.createBiquadFilter();
      passaAlta.type = 'highpass';
      passaAlta.frequency.value = 55;

      const passaBaixa = contexto.createBiquadFilter();
      passaBaixa.type = 'lowpass';
      passaBaixa.frequency.value = 1300;

      const analisador = contexto.createAnalyser();
      analisador.fftSize = TAMANHO_JANELA;

      // O Safari só processa a cadeia que chega ao destino; um analisador
      // pendurado no vácuo pode nunca ser alimentado. O ganho zero fecha o
      // caminho sem devolver nada ao alto-falante — nada de microfonia.
      const mudo = contexto.createGain();
      mudo.gain.value = 0;

      fonte.connect(passaAlta);
      passaAlta.connect(passaBaixa);
      passaBaixa.connect(analisador);
      analisador.connect(mudo);
      mudo.connect(contexto.destination);

      contexto.onstatechange = () => this.aoMudarEstadoDoContexto();

      this.contexto = contexto;
      this.captura = captura;
      this.analisador = analisador;
      this.grafo = [fonte, passaAlta, passaBaixa, analisador, mudo];
      this.amostras = new Float32Array(analisador.fftSize);
      this.suavizador.limpar();
      this.ultimaAnalise = 0;
      this.ultimaValida = 0;
      this.estado.set('ouvindo');
      this.agendar();
    } catch (erro) {
      await contexto.close().catch(() => undefined);
      this.encerrarAudio();
      const nome = erro instanceof DOMException ? erro.name : '';
      if (nome === 'NotAllowedError' || nome === 'SecurityError') {
        this.falhar('negado', 'Permissão de microfone negada. Libere o acesso e tente de novo.');
      } else if (nome === 'NotFoundError' || nome === 'OverconstrainedError') {
        this.falhar('indisponivel', 'Nenhum microfone encontrado neste aparelho.');
      } else if (nome === 'InvalidStateError') {
        this.falhar('erro', 'O navegador bloqueou o áudio. Toque em ativar o microfone de novo.');
      } else {
        this.falhar('erro', 'Não foi possível abrir o microfone.');
      }
    }
  }

  parar(): void {
    this.encerrarAudio();
    this.suavizador.limpar();
    this.leitura.set(null);
    this.nivel.set(0);
    this.pausado.set(false);
    this.estado.set('parado');
    this.mensagemErro.set(null);
  }

  /** Descarta o histórico — usado ao trocar de corda, afinação ou diapasão. */
  reiniciarLeitura(): void {
    this.suavizador.limpar();
    this.leitura.set(null);
  }

  private falhar(estado: EstadoMicrofone, mensagem: string): void {
    this.estado.set(estado);
    this.mensagemErro.set(mensagem);
  }

  /**
   * O iOS suspende o contexto sozinho depois de uma ligação ou de trocar de
   * app. Tenta voltar; se não voltar, avisa em vez de fingir que ouve.
   */
  private aoMudarEstadoDoContexto(): void {
    const contexto = this.contexto;
    if (!contexto || this.estado() !== 'ouvindo' || contexto.state === 'running') return;
    void contexto.resume().catch(() => undefined);
    setTimeout(() => {
      if (this.estado() === 'ouvindo' && this.contexto?.state !== 'running') {
        this.falhar('erro', 'O áudio foi interrompido. Toque em ativar o microfone de novo.');
        this.encerrarAudio();
      }
    }, 400);
  }

  private agendar(): void {
    this.quadro = requestAnimationFrame((agora) => this.aoQuadro(agora));
  }

  private aoQuadro(agora: number): void {
    if (this.estado() !== 'ouvindo' || !this.analisador) return;
    this.agendar();

    if (agora - this.ultimaAnalise < INTERVALO_MS) return;
    this.ultimaAnalise = agora;

    this.analisador.getFloatTimeDomainData(this.amostras);

    if (this.pausado()) {
      this.nivel.set(0);
      return;
    }

    // O nível é medido antes e independente da detecção: é o único jeito de a
    // tela mostrar que o microfone está vivo quando nenhuma nota fecha.
    this.nivel.set(calcularRms(this.amostras));

    const leitura = detectarFrequencia(this.amostras, this.contexto!.sampleRate);
    if (leitura) {
      this.ultimaValida = agora;
      this.leitura.set({
        ...leitura,
        frequencia: this.suavizador.registrar(leitura.frequencia),
      });
    } else if (agora - this.ultimaValida > RETENCAO_MS && this.leitura() !== null) {
      this.suavizador.limpar();
      this.leitura.set(null);
    }
  }

  private encerrarAudio(): void {
    cancelAnimationFrame(this.quadro);
    this.quadro = 0;
    this.captura?.getTracks().forEach((faixa) => faixa.stop());
    this.captura = null;
    this.analisador = null;
    this.grafo = [];
    if (this.contexto) {
      this.contexto.onstatechange = null;
      void this.contexto.close().catch(() => undefined);
    }
    this.contexto = null;
  }
}

function calcularRms(amostras: Float32Array): number {
  let soma = 0;
  for (let i = 0; i < amostras.length; i++) soma += amostras[i];
  const media = soma / amostras.length;

  let energia = 0;
  for (let i = 0; i < amostras.length; i++) {
    const v = amostras[i] - media;
    energia += v * v;
  }
  return Math.sqrt(energia / amostras.length);
}
