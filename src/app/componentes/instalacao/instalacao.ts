import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Atualizacao } from '../../nucleo/atualizacao';
import { Instalacao } from '../../nucleo/instalacao';

/**
 * O afinador como app do aparelho: o convite para instalar e o aviso de versão
 * nova.
 *
 * Fica embaixo dos controles de propósito. Instalar é útil — instalado o
 * afinador abre em tela cheia e funciona sem internet —, mas não é o que a
 * pessoa veio fazer aqui, e nada disso pode disputar espaço com a corda.
 */
@Component({
  selector: 'app-instalacao',
  templateUrl: './instalacao.html',
  styleUrl: './instalacao.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PainelInstalacao {
  private readonly instalacao = inject(Instalacao);
  private readonly atualizacao = inject(Atualizacao);

  protected readonly podeInstalar = this.instalacao.disponivel;
  protected readonly atualizacaoPronta = this.atualizacao.pronta;
  protected readonly instrucoesAbertas = signal(false);

  /**
   * Onde o navegador tem convite próprio, ele aparece agora — este clique é o
   * gesto que o navegador exige para deixar o convite passar. No iOS, onde
   * convite não existe, o que dá para oferecer é o caminho do menu.
   */
  protected async instalar(): Promise<void> {
    if (this.instalacao.temConvite()) {
      this.instrucoesAbertas.set(false);
      await this.instalacao.instalar();
      return;
    }
    this.instrucoesAbertas.update((aberto) => !aberto);
  }

  protected aplicarAtualizacao(): void {
    void this.atualizacao.aplicar();
  }
}
