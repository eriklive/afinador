import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { Instalacao } from './nucleo/instalacao';
import { Microfone } from './nucleo/microfone';

/** Coloca o afinador ouvindo uma frequência, como se o microfone a tivesse pego. */
function ouvir(microfone: Microfone, frequencia: number): void {
  microfone.estado.set('ouvindo');
  microfone.nivel.set(0.05);
  microfone.leitura.set({ frequencia, clareza: 0.95, volume: 0.05 });
}

/** Matiz da cor de acento em vigor no componente raiz. */
function matizDoAcento(elemento: HTMLElement): number {
  const acento = elemento.style.getPropertyValue('--acento');
  return Number(acento.slice(4, acento.indexOf(' ')));
}

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

  // A cor é a linguagem inteira do afinador: se ela não acompanhar o desvio,
  // não sobra nada dizendo o quanto falta girar a tarraxa.
  describe('cor do desvio', () => {
    it('fica verde quando a corda entra na faixa afinada', async () => {
      const microfone = TestBed.inject(Microfone);
      const fixture = await montar();
      ouvir(microfone, 110); // A2 exato
      await fixture.whenStable();

      const raiz = fixture.nativeElement as HTMLElement;
      expect(raiz.querySelector('.leitura__instrucao')?.textContent).toContain('Afinada');
      expect(matizDoAcento(raiz)).toBeCloseTo(142, 0);
    });

    it('esquenta conforme a corda se afasta', async () => {
      const microfone = TestBed.inject(Microfone);
      const fixture = await montar();
      const raiz = fixture.nativeElement as HTMLElement;

      ouvir(microfone, 110 * Math.pow(2, 18 / 1200)); // +18 cents
      await fixture.whenStable();
      const perto = matizDoAcento(raiz);

      ouvir(microfone, 110 * Math.pow(2, 42 / 1200)); // +42 cents
      await fixture.whenStable();
      const longe = matizDoAcento(raiz);

      expect(perto).toBeLessThan(142);
      expect(longe).toBeLessThan(perto);
    });

    it('sem nota nenhuma, sai da rampa em vez de fingir afinação', async () => {
      const fixture = await montar();
      const raiz = fixture.nativeElement as HTMLElement;
      expect(raiz.style.getPropertyValue('--acento')).toBe('#c9bad3');
    });
  });

  it('mostra o convite de instalação quando o navegador o oferece', async () => {
    const instalacao = { disponivel: signal(true), temConvite: signal(true) };
    TestBed.overrideProvider(Instalacao, { useValue: instalacao as unknown as Instalacao });

    const fixture = await montar();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.querySelector('.instalar')?.textContent).toContain('Instalar');
  });

  it('mostra o instrumento pedido no seletor de afinações', async () => {
    const fixture = await montar();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(textos(elemento, 'option')).toContain('Padrão (E A D G B E)');
  });
});
