import { corDoDesvio, intensidadeDoDesvio } from './cor-do-desvio';

/** Extrai o matiz de uma cor `hsl(h s% l%)`. */
function matiz(cor: string): number {
  return Number(cor.slice(4, cor.indexOf(' ')));
}

describe('intensidadeDoDesvio', () => {
  it('é zero em toda a faixa afinada', () => {
    expect(intensidadeDoDesvio(0, 5)).toBe(0);
    expect(intensidadeDoDesvio(4.9, 5)).toBe(0);
    expect(intensidadeDoDesvio(-5, 5)).toBe(0);
  });

  it('não distingue apertar de afrouxar — só a distância', () => {
    expect(intensidadeDoDesvio(-20, 5)).toBeCloseTo(intensidadeDoDesvio(20, 5), 10);
  });

  it('cresce com o desvio e satura no vermelho', () => {
    expect(intensidadeDoDesvio(25, 5)).toBeCloseTo(0.5, 10);
    expect(intensidadeDoDesvio(45, 5)).toBe(1);
    expect(intensidadeDoDesvio(120, 5)).toBe(1);
  });

  it('sem nota, fica na ponta verde', () => {
    expect(intensidadeDoDesvio(null, 5)).toBe(0);
  });
});

describe('corDoDesvio', () => {
  it('sai do verde e chega ao vermelho', () => {
    expect(matiz(corDoDesvio(0).acento)).toBeCloseTo(142, 1);
    expect(matiz(corDoDesvio(1).acento)).toBeCloseTo(4, 1);
  });

  it('percorre a rampa sem voltar atrás', () => {
    let anterior = Infinity;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const h = matiz(corDoDesvio(t).acento);
      expect(h).toBeLessThanOrEqual(anterior);
      anterior = h;
    }
  });

  it('interpola entre as paradas em vez de saltar', () => {
    // Meio caminho entre a parada de 0,50 (amarelo) e a de 0,75 (laranja).
    expect(matiz(corDoDesvio(0.625).acento)).toBeCloseTo(37, 1);
  });

  it('a tinta é escura o bastante para ler sobre o acento', () => {
    for (const t of [0, 0.5, 1]) {
      const cor = corDoDesvio(t);
      expect(luminosidade(cor.tinta)).toBeLessThan(luminosidade(cor.acento) - 40);
      expect(luminosidade(cor.fundo)).toBeLessThan(luminosidade(cor.acento) - 40);
    }
  });

  it('mantém os valores dentro da faixa válida de HSL', () => {
    const cor = corDoDesvio(0);
    expect(luminosidade(cor.tinta)).toBeGreaterThanOrEqual(0);
    expect(Number(cor.acento.split(' ')[1].replace('%', ''))).toBeLessThanOrEqual(100);
  });
});

function luminosidade(cor: string): number {
  return Number(cor.split(' ')[2].replace('%)', ''));
}
