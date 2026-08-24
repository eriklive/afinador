import { TestBed } from '@angular/core/testing';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { Atualizacao, RECARREGAR_PAGINA } from './atualizacao';

const UMA_HORA_MS = 60 * 60 * 1000;

/** Canal do service worker, no formato que o `SwUpdate` entrega ao app. */
class SwFalso {
  habilitado = true;
  readonly versionUpdates = new Subject<VersionEvent>();
  readonly checkForUpdate = vi.fn(async () => false);
  readonly activateUpdate = vi.fn(async () => true);

  get isEnabled(): boolean {
    return this.habilitado;
  }

  publicar(): void {
    this.versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'velha' },
      latestVersion: { hash: 'nova' },
    });
  }
}

let recarregou = 0;

/** Monta o serviço com — ou sem — service worker por trás. */
function criar(sw: SwFalso | null): Atualizacao {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: RECARREGAR_PAGINA, useValue: () => recarregou++ },
      ...(sw ? [{ provide: SwUpdate, useValue: sw }] : []),
    ],
  });
  return TestBed.inject(Atualizacao);
}

describe('Atualizacao', () => {
  beforeEach(() => {
    recarregou = 0;
  });

  afterEach(() => vi.restoreAllMocks());

  it('avisa quando a versão nova termina de baixar', () => {
    const sw = new SwFalso();
    const atualizacao = criar(sw);
    expect(atualizacao.pronta()).toBe(false);

    sw.publicar();

    expect(atualizacao.pronta()).toBe(true);
  });

  it('ignora os avisos que não são de versão pronta', () => {
    const sw = new SwFalso();
    const atualizacao = criar(sw);

    sw.versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'nova' } });

    expect(atualizacao.pronta()).toBe(false);
  });

  it('ativa a versão baixada e recarrega a tela nela', async () => {
    const sw = new SwFalso();
    const atualizacao = criar(sw);
    sw.publicar();

    await atualizacao.aplicar();

    expect(sw.activateUpdate).toHaveBeenCalledOnce();
    expect(recarregou).toBe(1);
  });

  it('não recarrega nada sem versão pronta', async () => {
    const sw = new SwFalso();
    const atualizacao = criar(sw);

    await atualizacao.aplicar();

    expect(sw.activateUpdate).not.toHaveBeenCalled();
    expect(recarregou).toBe(0);
  });

  it('procura versão nova quando a tela volta do segundo plano, no máximo de hora em hora', () => {
    const sw = new SwFalso();
    criar(sw);

    document.dispatchEvent(new Event('visibilitychange'));
    expect(sw.checkForUpdate).not.toHaveBeenCalled();

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + UMA_HORA_MS + 1);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sw.checkForUpdate).toHaveBeenCalledOnce();

    // A segunda volta, logo em seguida, não vale outra ida ao servidor.
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sw.checkForUpdate).toHaveBeenCalledOnce();
  });

  it('engole a falha da checagem — sem rede o app cacheado continua servindo', async () => {
    const sw = new SwFalso();
    sw.checkForUpdate.mockRejectedValueOnce(new Error('offline'));
    const atualizacao = criar(sw);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + UMA_HORA_MS + 1);

    await expect(atualizacao.checar()).resolves.toBeUndefined();
  });

  it('fica inerte quando não há service worker registrado', async () => {
    const atualizacao = criar(null);

    await atualizacao.checar();
    await atualizacao.aplicar();

    expect(atualizacao.pronta()).toBe(false);
    expect(recarregou).toBe(0);
  });

  it('fica inerte quando o service worker existe mas está desligado', () => {
    const sw = new SwFalso();
    sw.habilitado = false;
    const atualizacao = criar(sw);

    sw.publicar();

    expect(atualizacao.pronta()).toBe(false);
  });
});
