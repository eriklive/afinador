import { Injectable, computed, signal } from '@angular/core';

/**
 * Evento que Chrome, Edge e Samsung Internet disparam quando a página cumpre os
 * critérios de instalação. Não é padrão — por isso o tipo mora aqui.
 */
interface ConviteDeInstalacao extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Instalação do afinador como app do aparelho.
 *
 * Instalado, ele abre em tela cheia a partir do ícone e — com o service worker
 * — funciona sem internet, que é o caso comum de quem afina: um violão no
 * quarto, num porão de ensaio, num lugar sem sinal.
 *
 * Há dois caminhos e o navegador escolhe qual existe. Onde o `beforeinstallprompt`
 * é disparado, o app guarda o evento e devolve o convite no momento em que o
 * usuário pedir — o evento só vale uma vez e só pode ser chamado a partir de um
 * gesto. No iOS não há evento nenhum: a instalação é um caminho manual dentro do
 * menu Compartilhar, e o máximo que dá para fazer é ensinar o caminho.
 */
@Injectable({ providedIn: 'root' })
export class Instalacao {
  private readonly convite = signal<ConviteDeInstalacao | null>(null);

  /** Verdadeiro quando a tela já está rodando a partir do ícone instalado. */
  readonly instalado = signal(rodandoInstalado());

  /** O navegador tem um convite pronto para mostrar. */
  readonly temConvite = computed(() => this.convite() !== null && !this.instalado());

  /** Sem convite possível: resta explicar o caminho do menu Compartilhar. */
  readonly precisaDeInstrucoes = computed(
    () => !this.instalado() && this.convite() === null && ehIOS(),
  );

  /** Vale a pena oferecer a instalação por algum dos dois caminhos. */
  readonly disponivel = computed(() => this.temConvite() || this.precisaDeInstrucoes());

  constructor() {
    addEventListener('beforeinstallprompt', (evento) => {
      // Sem o preventDefault o Chrome mostra a própria faixa de instalação, que
      // no celular cobre justamente a parte de baixo da tela — as cordas.
      evento.preventDefault();
      this.convite.set(evento as ConviteDeInstalacao);
    });

    addEventListener('appinstalled', () => {
      this.instalado.set(true);
      this.convite.set(null);
    });
  }

  /**
   * Mostra o convite do navegador. Devolve `true` se o app foi instalado.
   *
   * O evento guardado morre no uso, aceito ou não: o navegador dispara outro
   * quando quiser oferecer de novo.
   */
  async instalar(): Promise<boolean> {
    const convite = this.convite();
    if (!convite) return false;
    this.convite.set(null);

    try {
      await convite.prompt();
      const { outcome } = await convite.userChoice;
      if (outcome !== 'accepted') return false;
      this.instalado.set(true);
      return true;
    } catch {
      // Convite recusado pelo navegador (já usado, gesto perdido): nada a fazer.
      return false;
    }
  }
}

/** A tela está aberta como app instalado, e não numa aba do navegador. */
function rodandoInstalado(): boolean {
  // `standalone` é o jeito antigo do Safari; é o único que funciona no iOS.
  if ((navigator as { standalone?: boolean }).standalone === true) return true;
  return matchMedia?.('(display-mode: standalone)').matches === true;
}

function ehIOS(): boolean {
  const agente = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(agente)) return true;
  // O iPad com iPadOS 13+ se apresenta como Mac; o toque é o que o entrega.
  return /Macintosh/.test(agente) && navigator.maxTouchPoints > 1;
}
