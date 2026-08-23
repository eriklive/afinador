import { Injectable, signal } from '@angular/core';

/** Amplitude relativa dos primeiros harmônicos. */
const HARMONICOS = [1, 0.55, 0.32, 0.2, 0.12, 0.07, 0.04];

const VOLUME = 0.22;
const ATAQUE_S = 0.02;
const QUEDA_S = 0.12;

/**
 * Toca a nota alvo como referência auditiva.
 *
 * Uma senoide pura no E2 (82 Hz) é praticamente inaudível no alto-falante de
 * um celular, então a onda leva uma série de harmônicos: o ouvido reconstrói a
 * fundamental a partir deles mesmo quando o alto-falante não a reproduz.
 */
@Injectable({ providedIn: 'root' })
export class TomReferencia {
  readonly tocando = signal(false);

  private contexto: AudioContext | null = null;
  private oscilador: OscillatorNode | null = null;
  private ganho: GainNode | null = null;
  private onda: PeriodicWave | null = null;

  async tocar(frequencia: number): Promise<void> {
    this.parar();

    const contexto = this.contexto ?? new AudioContext({ latencyHint: 'interactive' });
    this.contexto = contexto;
    if (contexto.state === 'suspended') await contexto.resume();

    this.onda ??= criarOnda(contexto);

    const ganho = contexto.createGain();
    ganho.gain.setValueAtTime(0, contexto.currentTime);
    ganho.gain.linearRampToValueAtTime(VOLUME, contexto.currentTime + ATAQUE_S);

    const oscilador = contexto.createOscillator();
    oscilador.setPeriodicWave(this.onda);
    oscilador.frequency.setValueAtTime(frequencia, contexto.currentTime);
    oscilador.connect(ganho);
    ganho.connect(contexto.destination);
    oscilador.start();

    this.oscilador = oscilador;
    this.ganho = ganho;
    this.tocando.set(true);
  }

  parar(): void {
    const { contexto, oscilador, ganho } = this;
    if (contexto && oscilador && ganho) {
      const fim = contexto.currentTime + QUEDA_S;
      ganho.gain.cancelScheduledValues(contexto.currentTime);
      ganho.gain.setValueAtTime(ganho.gain.value, contexto.currentTime);
      ganho.gain.linearRampToValueAtTime(0, fim);
      oscilador.stop(fim);
      oscilador.onended = () => {
        oscilador.disconnect();
        ganho.disconnect();
      };
    }
    this.oscilador = null;
    this.ganho = null;
    this.tocando.set(false);
  }
}

function criarOnda(contexto: AudioContext): PeriodicWave {
  const real = new Float32Array(HARMONICOS.length + 1);
  const imaginario = new Float32Array(HARMONICOS.length + 1);
  HARMONICOS.forEach((amplitude, i) => (imaginario[i + 1] = amplitude));
  return contexto.createPeriodicWave(real, imaginario, { disableNormalization: false });
}
