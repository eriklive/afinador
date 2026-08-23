import {
  A4_PADRAO,
  centsEntre,
  descreverNota,
  frequenciaParaMidi,
  midiParaFrequencia,
  notaMaisProxima,
} from './nota';

describe('nota', () => {
  describe('midiParaFrequencia', () => {
    it('devolve as frequências das cordas soltas do violão', () => {
      expect(midiParaFrequencia(40)).toBeCloseTo(82.41, 2); // E2
      expect(midiParaFrequencia(45)).toBeCloseTo(110.0, 2); // A2
      expect(midiParaFrequencia(50)).toBeCloseTo(146.83, 2); // D3
      expect(midiParaFrequencia(55)).toBeCloseTo(196.0, 2); // G3
      expect(midiParaFrequencia(59)).toBeCloseTo(246.94, 2); // B3
      expect(midiParaFrequencia(64)).toBeCloseTo(329.63, 2); // E4
    });

    it('devolve as frequências das cordas soltas do ukulele', () => {
      expect(midiParaFrequencia(67)).toBeCloseTo(392.0, 2); // G4
      expect(midiParaFrequencia(60)).toBeCloseTo(261.63, 2); // C4
      expect(midiParaFrequencia(69)).toBe(A4_PADRAO); // A4
    });

    it('acompanha a calibração do diapasão', () => {
      expect(midiParaFrequencia(69, 432)).toBe(432);
      expect(midiParaFrequencia(40, 432)).toBeCloseTo(80.91, 2);
    });
  });

  it('frequenciaParaMidi desfaz midiParaFrequencia', () => {
    for (const midi of [38, 40, 55, 64, 69, 76]) {
      expect(frequenciaParaMidi(midiParaFrequencia(midi))).toBeCloseTo(midi, 10);
    }
  });

  describe('centsEntre', () => {
    it('é zero quando as frequências coincidem', () => {
      expect(centsEntre(440, 440)).toBe(0);
    });

    it('conta 100 cents por semitom e 1200 por oitava', () => {
      expect(centsEntre(midiParaFrequencia(70), 440)).toBeCloseTo(100, 6);
      expect(centsEntre(880, 440)).toBeCloseTo(1200, 6);
    });

    it('é negativo quando a nota está abaixo do alvo', () => {
      expect(centsEntre(437, 440)).toBeLessThan(0);
    });
  });

  describe('descreverNota', () => {
    it('nomeia a nota em cifra e em português', () => {
      expect(descreverNota(40)).toMatchObject({ cifra: 'E', nome: 'Mi', oitava: 2, rotulo: 'E2' });
      expect(descreverNota(60)).toMatchObject({ cifra: 'C', nome: 'Dó', oitava: 4, rotulo: 'C4' });
      expect(descreverNota(69)).toMatchObject({ cifra: 'A', nome: 'Lá', oitava: 4, rotulo: 'A4' });
      expect(descreverNota(66)).toMatchObject({ cifra: 'F#', nome: 'Fá#', oitava: 4 });
    });

    it('arredonda para o semitom mais próximo', () => {
      expect(descreverNota(59.6).rotulo).toBe('C4');
      expect(descreverNota(59.4).rotulo).toBe('B3');
    });
  });

  describe('notaMaisProxima', () => {
    it('reconhece uma corda ligeiramente desafinada', () => {
      // E2 vinte cents abaixo continua sendo um E2.
      const desafinada = midiParaFrequencia(40) * Math.pow(2, -20 / 1200);
      expect(notaMaisProxima(desafinada).rotulo).toBe('E2');
    });
  });
});
