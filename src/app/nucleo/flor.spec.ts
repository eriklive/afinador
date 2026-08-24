import { LOBOS, caminhoDaFlor, caminhoDaOnda } from './flor';

/** Lê os pares de coordenadas de um caminho feito só de M/L. */
function pontos(d: string): { x: number; y: number }[] {
  return d
    .replace(/Z$/, '')
    .split(/[ML]/)
    .filter(Boolean)
    .map((par) => {
      const [x, y] = par.trim().split(' ').map(Number);
      return { x, y };
    });
}

const raio = (p: { x: number; y: number }) => Math.hypot(p.x, p.y);

describe('caminhoDaFlor', () => {
  it('fecha o contorno', () => {
    expect(caminhoDaFlor(100, 0.08, 0)).toMatch(/^M.*Z$/);
  });

  it('sem amplitude é uma circunferência', () => {
    for (const p of pontos(caminhoDaFlor(100, 0, 0))) {
      expect(raio(p)).toBeCloseTo(100, 1);
    }
  });

  it('a amplitude vale a fração pedida do raio', () => {
    const raios = pontos(caminhoDaFlor(100, 0.1, 0)).map(raio);
    expect(Math.max(...raios)).toBeCloseTo(110, 0);
    expect(Math.min(...raios)).toBeCloseTo(90, 0);
  });

  it('tem tantas pétalas quanto lóbulos', () => {
    // Meia pétala de giro tira os picos das pontas do caminho, onde a volta
    // fechada mostraria o mesmo ponto duas vezes.
    const raios = pontos(caminhoDaFlor(100, 0.1, Math.PI / LOBOS, 700)).map(raio);
    let picos = 0;
    for (let i = 1; i < raios.length - 1; i++) {
      if (raios[i] > raios[i - 1] && raios[i] >= raios[i + 1]) picos++;
    }
    expect(picos).toBe(LOBOS);
  });

  it('girar uma pétala inteira devolve o mesmo desenho', () => {
    expect(caminhoDaFlor(100, 0.1, (2 * Math.PI) / LOBOS)).toBe(caminhoDaFlor(100, 0.1, 0));
  });

  it('meia pétala de giro troca o pico pelo vale', () => {
    expect(raio(pontos(caminhoDaFlor(100, 0.1, 0))[0])).toBeCloseTo(110, 1);
    expect(raio(pontos(caminhoDaFlor(100, 0.1, Math.PI / LOBOS))[0])).toBeCloseTo(90, 1);
  });
});

describe('caminhoDaOnda', () => {
  it('atravessa a fita de ponta a ponta', () => {
    const p = pontos(caminhoDaOnda(6, 0, 308, 22));
    expect(p[0].x).toBeCloseTo(6, 1);
    expect(p[p.length - 1].x).toBeCloseTo(314, 1);
  });

  it('sem amplitude é uma reta na altura do meio', () => {
    for (const p of pontos(caminhoDaOnda(0, 1.4, 308, 22))) {
      expect(p.y).toBeCloseTo(22, 5);
    }
  });

  it('oscila em torno do meio até a amplitude pedida', () => {
    const ys = pontos(caminhoDaOnda(9, 0, 308, 22, 400)).map((p) => p.y);
    expect(Math.max(...ys)).toBeCloseTo(31, 0);
    expect(Math.min(...ys)).toBeCloseTo(13, 0);
  });

  it('a fase desloca a onda', () => {
    const parada = pontos(caminhoDaOnda(9, 0, 308, 22));
    const corrida = pontos(caminhoDaOnda(9, 1, 308, 22));
    expect(parada[10].y).not.toBeCloseTo(corrida[10].y, 2);
  });
});
