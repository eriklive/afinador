import { Mola } from './mola';

/** Roda a mola por `segundos` a 60 quadros por segundo. */
function correr(mola: Mola, alvo: number, segundos: number): number {
  const dt = 1 / 60;
  for (let t = 0; t < segundos; t += dt) mola.avancar(alvo, dt);
  return mola.valor;
}

describe('Mola', () => {
  it('começa onde foi posta', () => {
    expect(new Mola(-15).valor).toBe(-15);
  });

  it('assenta no alvo', () => {
    expect(correr(new Mola(0), 30, 1)).toBeCloseTo(30, 2);
  });

  it('não salta o quadro inteiro de uma vez', () => {
    const mola = new Mola(0);
    mola.avancar(50, 1 / 60);
    expect(mola.valor).toBeGreaterThan(0);
    expect(mola.valor).toBeLessThan(5);
  });

  it('passa um pouco do alvo quando o atrito é baixo', () => {
    const mola = new Mola(0, 170, 6);
    let maximo = 0;
    for (let t = 0; t < 1; t += 1 / 60) maximo = Math.max(maximo, mola.avancar(10, 1 / 60));
    expect(maximo).toBeGreaterThan(10);
  });

  it('persegue um alvo que muda sem reiniciar o percurso', () => {
    const mola = new Mola(0);
    correr(mola, 20, 0.5);
    const velocidadeMantida = mola.avancar(40, 1 / 60) - 20;
    expect(velocidadeMantida).toBeGreaterThan(0);
  });

  it('saltarPara chega inteiro e sem velocidade', () => {
    const mola = new Mola(0);
    correr(mola, 40, 0.1);
    expect(mola.saltarPara(-7)).toBe(-7);
    expect(mola.avancar(-7, 1 / 60)).toBeCloseTo(-7, 10);
  });
});
