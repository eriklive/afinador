import { INSTRUMENTOS, acharAfinacao, acharInstrumento, rotuloCorda } from './afinacoes';

describe('afinacoes', () => {
  it('oferece violão e ukulele', () => {
    expect(INSTRUMENTOS.map((i) => i.id)).toEqual(['violao', 'ukulele']);
  });

  it('usa ids únicos de corda dentro de cada afinação', () => {
    for (const instrumento of INSTRUMENTOS) {
      for (const afinacao of instrumento.afinacoes) {
        const ids = new Set(afinacao.cordas.map((c) => c.id));
        expect(ids.size).toBe(afinacao.cordas.length);
      }
    }
  });

  it('numera as cordas da mais grave em posição (6ª) para a 1ª', () => {
    const padrao = acharAfinacao(acharInstrumento('violao'), 'violao-padrao');
    expect(padrao.cordas.map((c) => c.numero)).toEqual([6, 5, 4, 3, 2, 1]);
    expect(padrao.cordas.map(rotuloCorda)).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
  });

  it('descreve o drop D só com a 6ª corda alterada', () => {
    const padrao = acharAfinacao(acharInstrumento('violao'), 'violao-padrao');
    const dropD = acharAfinacao(acharInstrumento('violao'), 'violao-drop-d');
    expect(dropD.cordas.map(rotuloCorda)).toEqual(['D2', 'A2', 'D3', 'G3', 'B3', 'E4']);
    expect(dropD.cordas.slice(1).map((c) => c.midi)).toEqual(
      padrao.cordas.slice(1).map((c) => c.midi),
    );
  });

  it('mantém o Sol reentrante na afinação padrão do ukulele', () => {
    const padrao = acharAfinacao(acharInstrumento('ukulele'), 'ukulele-padrao');
    expect(padrao.cordas.map(rotuloCorda)).toEqual(['G4', 'C4', 'E4', 'A4']);
    // O Sol reentrante é mais agudo que o Dó vizinho — é o que define o timbre.
    expect(padrao.cordas[0].midi).toBeGreaterThan(padrao.cordas[1].midi);
  });

  it('tem uma opção de Sol grave sem reentrância', () => {
    const lowG = acharAfinacao(acharInstrumento('ukulele'), 'ukulele-sol-grave');
    expect(lowG.cordas.map(rotuloCorda)).toEqual(['G3', 'C4', 'E4', 'A4']);
  });

  it('cai na primeira afinação quando o id não existe', () => {
    const violao = acharInstrumento('violao');
    expect(acharAfinacao(violao, 'inexistente')).toBe(violao.afinacoes[0]);
  });
});
