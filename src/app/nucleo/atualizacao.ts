import { DestroyRef, InjectionToken, Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/**
 * Recarga da página, isolada num token porque `location.reload` não é
 * substituível: sem esta costura o teste da troca de versão navegaria de
 * verdade.
 */
export const RECARREGAR_PAGINA = new InjectionToken<() => void>('recarregar-pagina', {
  providedIn: 'root',
  factory: () => () => location.reload(),
});

/** Intervalo mínimo entre duas perguntas ao servidor por uma versão nova. */
const INTERVALO_CHECAGEM_MS = 60 * 60 * 1000;

/**
 * Versões novas do afinador instalado.
 *
 * Com o service worker no ar a tela passa a vir do cache, então uma publicação
 * nova não chega sozinha: o navegador baixa a versão em segundo plano e ela só
 * entra em vigor no próximo carregamento. Este serviço avisa quando a versão
 * baixada está pronta e recarrega a tela nela quando o usuário aceitar — trocar
 * de versão sem recarregar deixaria a página misturando arquivos de duas
 * publicações, cada um com o seu hash no nome.
 *
 * O `SwUpdate` é injetado como opcional de propósito: em `ng serve` e nos testes
 * o service worker não é registrado, e o serviço tem de virar um inerte em vez
 * de derrubar a injeção.
 */
@Injectable({ providedIn: 'root' })
export class Atualizacao {
  private readonly sw = inject(SwUpdate, { optional: true });
  private readonly aoDestruir = inject(DestroyRef);
  private readonly recarregar = inject(RECARREGAR_PAGINA);

  /** Uma versão nova já está baixada, esperando um recarregamento. */
  readonly pronta = signal(false);

  private ultimaChecagem = Date.now();

  constructor() {
    const sw = this.sw;
    if (!sw?.isEnabled) return;

    const inscricao = sw.versionUpdates.subscribe((evento) => {
      if (evento.type === 'VERSION_READY') this.pronta.set(true);
    });

    // Um afinador instalado costuma voltar do segundo plano em vez de ser aberto
    // de novo; sem esta checagem ele só veria a versão nova depois de o sistema
    // matar o app.
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void this.checar();
    };
    document.addEventListener('visibilitychange', aoVoltar);

    this.aoDestruir.onDestroy(() => {
      inscricao.unsubscribe();
      document.removeEventListener('visibilitychange', aoVoltar);
    });
  }

  /** Pergunta ao servidor se há versão nova, no máximo uma vez por hora. */
  async checar(): Promise<void> {
    const sw = this.sw;
    if (!sw?.isEnabled || this.pronta()) return;

    const agora = Date.now();
    if (agora - this.ultimaChecagem < INTERVALO_CHECAGEM_MS) return;
    this.ultimaChecagem = agora;

    try {
      await sw.checkForUpdate();
    } catch {
      // Sem rede a checagem falha, e tudo bem: o app cacheado continua servindo.
    }
  }

  /** Ativa a versão baixada e recarrega a tela nela. */
  async aplicar(): Promise<void> {
    if (!this.pronta()) return;
    try {
      await this.sw?.activateUpdate();
    } finally {
      this.recarregar();
    }
  }
}
