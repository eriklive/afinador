import { SuavizadorDeTom } from './suavizador';

describe('SuavizadorDeTom', () => {
  it('começa sem valor', () => {
    expect(new SuavizadorDeTom().valor).toBeNull();
  });

  it('converge para a frequência estável', () => {
    const suavizador = new SuavizadorDeTom();
    for (let i = 0; i < 40; i++) suavizador.registrar(110);
    expect(suavizador.valor).toBeCloseTo(110, 4);
  });

  it('absorve um pulo isolado de oitava sem sair da nota', () => {
    const suavizador = new SuavizadorDeTom();
    for (let i = 0; i < 10; i++) suavizador.registrar(110);
    suavizador.registrar(220);
    for (let i = 0; i < 3; i++) suavizador.registrar(110);
    expect(suavizador.valor!).toBeGreaterThan(105);
    expect(suavizador.valor!).toBeLessThan(115);
  });

  it('reage rápido quando o usuário troca de corda', () => {
    const suavizador = new SuavizadorDeTom();
    for (let i = 0; i < 10; i++) suavizador.registrar(110);
    // Salto grande e sustentado: o histórico é descartado em vez de suavizado.
    const primeira = suavizador.registrar(196);
    expect(primeira).toBeCloseTo(196, 4);
  });

  it('limpar zera o estado', () => {
    const suavizador = new SuavizadorDeTom();
    suavizador.registrar(110);
    suavizador.limpar();
    expect(suavizador.valor).toBeNull();
  });
});
