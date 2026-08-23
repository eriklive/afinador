import { Injectable, signal } from '@angular/core';
import { detectarFrequencia, type Leitura } from './detector-de-tom';
import { SuavizadorDeTom } from './suavizador';

export type EstadoMicrofone =
  'parado' | 'iniciando' | 'ouvindo' | 'negado' | 'indisponivel' | 'erro';

/** Janela de análise. 4096 amostras cobrem ~3 ciclos do E2 a 48 kHz. */
const TAMANHO_JANELA = 4096;

/** Intervalo entre análises. Menor que isso só gasta bateria. */
const INTERVALO_MS = 45;

/** Tempo que a última leitura válida continua na tela depois do som sumir. */
const RETENCAO_MS = 900;

@Injectable({ providedIn: 'root' })
export class Microfone {
  readonly estado = signal<EstadoMicrofone>('parado');
  readonly mensagemErro = signal<string | null>(null);

  /** Última leitura válida, já suavizada. `null` quando não há som útil. */
  readonly leitura = signal<Leitura | null>(null);

  /** Volume instantâneo de 0 a 1, para o medidor de nível. */
  readonly volume = signal(0);

  /** Quando `true`, o loop segue rodando mas para de publicar leituras. */
  readonly pausado = signal(false);

  private contexto: AudioContext | null = null;
  private captura: MediaStream | null = null;
  private analisador: AnalyserNode | null = null;
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

    try {
      // Os processamentos de voz do navegador destroem a periodicidade do
      // sinal — com eles ligados a detecção de tom simplesmente não fecha.
      this.captura = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });

      const contexto = new AudioContext({ latencyHint: 'interactive' });
      await contexto.resume();

      const fonte = contexto.createMediaStreamSource(this.captura);

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

      fonte.connect(passaAlta);
      passaAlta.connect(passaBaixa);
      passaBaixa.connect(analisador);

      this.contexto = contexto;
      this.analisador = analisador;
      this.amostras = new Float32Array(analisador.fftSize);
      this.suavizador.limpar();
      this.estado.set('ouvindo');
      this.agendar();
    } catch (erro) {
      this.encerrarAudio();
      const nome = erro instanceof DOMException ? erro.name : '';
      if (nome === 'NotAllowedError' || nome === 'SecurityError') {
        this.falhar('negado', 'Permissão de microfone negada. Libere o acesso e tente de novo.');
      } else if (nome === 'NotFoundError' || nome === 'OverconstrainedError') {
        this.falhar('indisponivel', 'Nenhum microfone encontrado neste aparelho.');
      } else {
        this.falhar('erro', 'Não foi possível abrir o microfone.');
      }
    }
  }

  parar(): void {
    this.encerrarAudio();
    this.suavizador.limpar();
    this.leitura.set(null);
    this.volume.set(0);
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
      this.volume.set(0);
      return;
    }

    const leitura = detectarFrequencia(this.amostras, this.contexto!.sampleRate);
    this.volume.set(leitura ? Math.min(1, leitura.volume * 12) : 0);

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
    void this.contexto?.close().catch(() => undefined);
    this.contexto = null;
  }
}
