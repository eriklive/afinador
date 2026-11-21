/**
 * Mantém a tela ligada enquanto o afinador escuta. Quem afina o violão está
 * com as duas mãos no instrumento e não toca na tela por minutos — sem isso o
 * aparelho apaga o visor e o app perde o foco no meio da afinação.
 *
 * Usa a Screen Wake Lock API. Onde ela não existe (ou é negada, como no modo
 * economia de bateria) simplesmente não faz nada: afinar continua funcionando.
 */
export class TelaAcordada {
  private trava: WakeLockSentinel | null = null;
  private desejada = false;

  private readonly aoVoltarParaATela = (): void => {
    // O navegador solta a trava sozinho quando a aba some; ao voltar, pega de novo.
    if (this.desejada && document.visibilityState === 'visible') void this.pedir();
  };

  manter(): void {
    if (this.desejada) return;
    this.desejada = true;
    document.addEventListener('visibilitychange', this.aoVoltarParaATela);
    void this.pedir();
  }

  soltar(): void {
    this.desejada = false;
    document.removeEventListener('visibilitychange', this.aoVoltarParaATela);
    const trava = this.trava;
    this.trava = null;
    void trava?.release().catch(() => undefined);
  }

  private async pedir(): Promise<void> {
    if (this.trava || !navigator.wakeLock) return;
    try {
      const trava = await navigator.wakeLock.request('screen');
      // Pode ter parado de escutar enquanto o pedido estava no ar.
      if (!this.desejada) {
        void trava.release().catch(() => undefined);
        return;
      }
      this.trava = trava;
      trava.addEventListener('release', () => {
        if (this.trava === trava) this.trava = null;
      });
    } catch {
      // Negado ou sem suporte: segue sem a trava.
    }
  }
}
