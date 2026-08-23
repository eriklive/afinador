import { detectarFrequencia } from './detector-de-tom';
import { centsEntre } from './nota';

const TAXA = 44100;
const TAMANHO = 4096;

/** Gera um trecho periódico com a série de harmônicos indicada. */
function tom(
  frequencia: number,
  amplitudes: readonly number[] = [1, 0.6, 0.4, 0.25, 0.15, 0.1],
): Float32Array {
  const amostras = new Float32Array(TAMANHO);
  for (let i = 0; i < TAMANHO; i++) {
    let valor = 0;
    amplitudes.forEach((amplitude, indice) => {
      const harmonico = indice + 1;
      // Fases distintas por harmônico: uma corda real nunca sai toda alinhada.
      const fase = harmonico * 0.7;
      valor += amplitude * Math.sin(2 * Math.PI * frequencia * harmonico * (i / TAXA) + fase);
    });
    amostras[i] = (valor / 2.5) * 0.5;
  }
  return amostras;
}

/** Ruído reprodutível, sem periodicidade. */
function ruido(): Float32Array {
  const amostras = new Float32Array(TAMANHO);
  let estado = 12345;
  for (let i = 0; i < TAMANHO; i++) {
    estado = (estado * 1103515245 + 12345) & 0x7fffffff;
    amostras[i] = (estado / 0x3fffffff - 1) * 0.3;
  }
  return amostras;
}

function desvioEmCents(frequencia: number, amplitudes?: readonly number[]): number {
  const leitura = detectarFrequencia(tom(frequencia, amplitudes), TAXA);
  expect(leitura).not.toBeNull();
  return centsEntre(leitura!.frequencia, frequencia);
}

describe('detectarFrequencia', () => {
  it.each([
    ['E2 (6ª do violão)', 82.41],
    ['A2 (5ª do violão)', 110.0],
    ['D3 (4ª do violão)', 146.83],
    ['G3 (3ª do violão)', 196.0],
    ['B3 (2ª do violão)', 246.94],
    ['E4 (1ª do violão)', 329.63],
    ['C4 (3ª do ukulele)', 261.63],
    ['G4 (4ª do ukulele)', 392.0],
    ['A4 (1ª do ukulele)', 440.0],
  ])('acerta %s com menos de 3 cents de erro', (_nome, frequencia) => {
    expect(Math.abs(desvioEmCents(frequencia))).toBeLessThan(3);
  });

  it('acerta uma corda desafinada em vez de arredondar para o semitom', () => {
    const alvo = 82.41 * Math.pow(2, -30 / 1200);
    expect(Math.abs(desvioEmCents(alvo))).toBeLessThan(3);
  });

  it('não cai na oitava acima quando a fundamental é fraca', () => {
    // Corda grave de violão: o 2º harmônico soa mais forte que a fundamental.
    expect(Math.abs(desvioEmCents(82.41, [0.08, 1, 0.75, 0.5, 0.3]))).toBeLessThan(5);
  });

  it('reporta clareza alta para um tom puro', () => {
    const leitura = detectarFrequencia(tom(196, [1]), TAXA);
    expect(leitura!.clareza).toBeGreaterThan(0.95);
  });

  it('devolve null no silêncio', () => {
    expect(detectarFrequencia(new Float32Array(TAMANHO), TAXA)).toBeNull();
  });

  it('devolve null para ruído sem altura definida', () => {
    expect(detectarFrequencia(ruido(), TAXA)).toBeNull();
  });

  it('devolve null para um trecho baixo demais', () => {
    const baixinho = tom(196);
    for (let i = 0; i < baixinho.length; i++) baixinho[i] *= 0.002;
    expect(detectarFrequencia(baixinho, TAXA)).toBeNull();
  });

  it('respeita a faixa de frequências configurada', () => {
    expect(detectarFrequencia(tom(110, [1]), TAXA, { frequenciaMinima: 200 })).toBeNull();
    expect(detectarFrequencia(tom(110, [1]), TAXA, { frequenciaMaxima: 90 })).toBeNull();
  });

  it('funciona a 48 kHz', () => {
    const taxa = 48000;
    const amostras = new Float32Array(TAMANHO);
    for (let i = 0; i < TAMANHO; i++) {
      amostras[i] = 0.4 * Math.sin((2 * Math.PI * 110 * i) / taxa);
    }
    const leitura = detectarFrequencia(amostras, taxa);
    expect(Math.abs(centsEntre(leitura!.frequencia, 110))).toBeLessThan(3);
  });
});
