import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { Microfone } from './nucleo/microfone';

async function montar() {
  const fixture = TestBed.createComponent(App);
  await fixture.whenStable();
  return fixture;
}

function textos(elemento: HTMLElement, seletor: string): string[] {
  return Array.from(elemento.querySelectorAll(seletor)).map((no) => (no.textContent ?? '').trim());
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  });

  it('abre no violão em afinação padrão', async () => {
    const fixture = await montar();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.querySelector('h1')?.textContent).toContain('Afinador');
    expect(textos(elemento, '.segmentado__opcao--ativa')).toEqual(['Violão']);
    expect(textos(elemento, '.corda__cifra')).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
  });

  it('troca para as quatro cordas do ukulele', async () => {
    const fixture = await montar();
    const elemento = fixture.nativeElement as HTMLElement;

    const botoes = Array.from(elemento.querySelectorAll<HTMLButtonElement>('.segmentado__opcao'));
    botoes.find((botao) => botao.textContent?.includes('Ukulele'))!.click();
    await fixture.whenStable();

    expect(textos(elemento, '.corda__cifra')).toEqual(['G4', 'C4', 'E4', 'A4']);
    expect(elemento.querySelector('select')?.value).toBe('ukulele-padrao');
  });

  it('escolhe a corda ao tocar nela e mostra a nota alvo', async () => {
    const fixture = await montar();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.querySelector('.leitura__cifra')?.textContent?.trim()).toBe('–');

    elemento.querySelectorAll<HTMLButtonElement>('.corda')[1].click();
    await fixture.whenStable();

    expect(elemento.querySelector('.leitura__cifra')?.textContent).toContain('A');
    expect(elemento.querySelector('.leitura__nome')?.textContent).toContain('Lá');
    expect(elemento.querySelector('.leitura__instrucao')?.textContent).toContain('microfone');
  });

  it('recalcula as frequências ao calibrar o diapasão', async () => {
    const fixture = await montar();
    const elemento = fixture.nativeElement as HTMLElement;

    elemento.querySelectorAll<HTMLButtonElement>('.corda')[0].click();
    await fixture.whenStable();
    const antes = elemento.querySelector('.leitura__numeros')?.textContent ?? '';

    elemento.querySelector<HTMLButtonElement>('.diapasao')!.click();
    await fixture.whenStable();
    elemento.querySelectorAll<HTMLButtonElement>('.passo')[0].click();
    await fixture.whenStable();

    expect(elemento.querySelector('.ajustes__valor')?.textContent).toContain('439');
    // Calibrar reinicia a seleção, então a leitura volta ao estado sem corda.
    expect(elemento.querySelector('.leitura__numeros')?.textContent).not.toBe(antes);
  });

  describe('diagnóstico da escuta', () => {
    // Sem separar estes dois casos, "não pegou a corda" é indistinguível de
    // "microfone morto" — foi exatamente o que aconteceu em campo.
    it('avisa quando o microfone está aberto mas não chega som', async () => {
      const microfone = TestBed.inject(Microfone);
      const fixture = await montar();
      microfone.estado.set('ouvindo');
      microfone.nivel.set(0);
      await fixture.whenStable();

      const elemento = fixture.nativeElement as HTMLElement;
      expect(elemento.querySelector('.leitura__instrucao')?.textContent).toContain(
        'Nenhum som chegando',
      );
    });

    it('avisa quando chega som mas nenhuma nota fecha', async () => {
      const microfone = TestBed.inject(Microfone);
      const fixture = await montar();
      microfone.estado.set('ouvindo');
      microfone.nivel.set(0.05);
      await fixture.whenStable();

      const elemento = fixture.nativeElement as HTMLElement;
      expect(elemento.querySelector('.leitura__instrucao')?.textContent).toContain('Ouvindo');
    });

    it('a barra de nível acompanha o volume mesmo sem nota', async () => {
      const microfone = TestBed.inject(Microfone);
      const fixture = await montar();
      microfone.estado.set('ouvindo');
      microfone.nivel.set(0.05);
      await fixture.whenStable();

      const barra = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
        '.nivel__barra',
      );
      expect(barra).not.toBeNull();
      expect(parseFloat(barra!.style.width)).toBeGreaterThan(0);
    });
  });

  it('mostra o instrumento pedido no seletor de afinações', async () => {
    const fixture = await montar();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(textos(elemento, 'option')).toContain('Padrão (E A D G B E)');
  });
});
