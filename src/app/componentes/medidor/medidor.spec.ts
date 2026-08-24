import { TestBed } from '@angular/core/testing';
import { Medidor } from './medidor';

async function montar(cents: number | null, afinado = false) {
  const fixture = TestBed.createComponent(Medidor);
  fixture.componentRef.setInput('cents', cents);
  fixture.componentRef.setInput('afinado', afinado);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('Medidor', () => {
  it('nasce desenhado, antes de qualquer quadro de animação', async () => {
    const elemento = await montar(0, true);

    // O laço de animação começa depois da primeira renderização e não roda em
    // ambiente sem `requestAnimationFrame`. A forma em repouso é o que garante
    // que o mostrador nunca apareça vazio.
    expect(elemento.querySelector('.medidor__miolo')?.getAttribute('d')).toMatch(/^M.+Z$/);
    expect(elemento.querySelector('.medidor__anel')?.getAttribute('d')).toMatch(/^M.+Z$/);
    expect(elemento.querySelector('.medidor__onda')?.getAttribute('d')).toMatch(/^M/);
  });

  it('descreve o desvio para quem não vê a flor', async () => {
    expect((await montar(12)).querySelector('.medidor__flor svg')?.getAttribute('aria-label')).toBe(
      '12 cents acima',
    );
    expect((await montar(-7)).querySelector('.medidor__flor svg')?.getAttribute('aria-label')).toBe(
      '7 cents abaixo',
    );
    expect(
      (await montar(2, true)).querySelector('.medidor__flor svg')?.getAttribute('aria-label'),
    ).toBe('Corda afinada');
    expect(
      (await montar(null)).querySelector('.medidor__flor svg')?.getAttribute('aria-label'),
    ).toBe('Sem sinal do instrumento');
  });

  it('marca o estado no próprio host, para a cor descer para o SVG', async () => {
    expect((await montar(null)).classList).toContain('medidor--inativo');
    expect((await montar(0, true)).classList).toContain('medidor--afinado');
  });
});
