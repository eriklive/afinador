import { TestBed } from '@angular/core/testing';
import { Instalacao } from './instalacao';

/** Convite do navegador, com o mesmo formato do evento real. */
function convite(escolha: 'accepted' | 'dismissed' = 'accepted') {
  const evento = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  };
  evento.prompt = vi.fn(async () => undefined);
  evento.userChoice = Promise.resolve({ outcome: escolha });
  return evento;
}

function criar(): Instalacao {
  return TestBed.inject(Instalacao);
}

describe('Instalacao', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14) Chrome/126',
      configurable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
  });

  it('não oferece nada enquanto o navegador não convidar', () => {
    const instalacao = criar();

    expect(instalacao.temConvite()).toBe(false);
    expect(instalacao.disponivel()).toBe(false);
  });

  it('guarda o convite do navegador em vez de deixá-lo aparecer sozinho', () => {
    const instalacao = criar();
    const evento = convite();

    dispatchEvent(evento);

    expect(evento.defaultPrevented).toBe(true);
    expect(instalacao.temConvite()).toBe(true);
    expect(instalacao.precisaDeInstrucoes()).toBe(false);
  });

  it('mostra o convite guardado quando o usuário pede e o consome no uso', async () => {
    const instalacao = criar();
    const evento = convite('accepted');
    dispatchEvent(evento);

    await expect(instalacao.instalar()).resolves.toBe(true);

    expect(evento.prompt).toHaveBeenCalledOnce();
    expect(instalacao.instalado()).toBe(true);
    // O evento vale uma vez só: sem convite novo não há o que mostrar.
    expect(instalacao.temConvite()).toBe(false);
    await expect(instalacao.instalar()).resolves.toBe(false);
  });

  it('não se dá por instalado quando o usuário recusa', async () => {
    const instalacao = criar();
    dispatchEvent(convite('dismissed'));

    await expect(instalacao.instalar()).resolves.toBe(false);

    expect(instalacao.instalado()).toBe(false);
  });

  it('para de oferecer depois que o aparelho instala', () => {
    const instalacao = criar();
    dispatchEvent(convite());

    dispatchEvent(new Event('appinstalled'));

    expect(instalacao.instalado()).toBe(true);
    expect(instalacao.disponivel()).toBe(false);
  });

  it('no iOS oferece as instruções, já que lá não existe convite', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari',
      configurable: true,
    });
    const instalacao = criar();

    expect(instalacao.temConvite()).toBe(false);
    expect(instalacao.precisaDeInstrucoes()).toBe(true);
    expect(instalacao.disponivel()).toBe(true);
  });

  it('reconhece o iPad, que se apresenta como Mac', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari',
      configurable: true,
    });
    const instalacao = criar();

    expect(instalacao.precisaDeInstrucoes()).toBe(true);
  });

  it('não oferece instalação para quem já está no app instalado', () => {
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    try {
      const instalacao = criar();

      expect(instalacao.instalado()).toBe(true);
      expect(instalacao.disponivel()).toBe(false);
    } finally {
      Object.defineProperty(navigator, 'standalone', { value: undefined, configurable: true });
    }
  });
});
