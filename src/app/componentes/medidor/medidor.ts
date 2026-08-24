import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { caminhoDaFlor, caminhoDaOnda } from '../../nucleo/flor';
import { Mola } from '../../nucleo/mola';

/** Desvio máximo mostrado na fita, em cents. */
const ESCALA_CENTS = 50;

/** Raio médio da flor, no sistema de coordenadas do SVG. */
const RAIO = 118;

/** Distância do anel externo até a flor. */
const FOLGA_DO_ANEL = 13;

/** Fita: largura útil, meio vertical e largura do marcador. */
const FITA_LARGURA = 308;
const FITA_MEIO = 22;
const FITA_MARCADOR = 6;

/** Quadro longo demais (aba em segundo plano) explodiria a integração da mola. */
const PASSO_MAXIMO = 0.032;

/**
 * O mostrador do afinador: uma flor de sete pétalas e a fita de desvio.
 *
 * Fora do tom a flor é quase um círculo que treme; conforme a corda entra na
 * faixa afinada as pétalas se abrem e o giro desacelera. O movimento inteiro
 * roda em `requestAnimationFrame` escrevendo direto nos nós do SVG: são dois
 * caminhos remontados a cada quadro, e passar isso pela detecção de mudanças
 * do Angular custaria um ciclo por quadro sem mudar um pixel do resultado.
 */
@Component({
  selector: 'app-medidor',
  templateUrl: './medidor.html',
  styleUrl: './medidor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.medidor--afinado]': 'afinado()',
    '[class.medidor--inativo]': 'cents() === null',
  },
})
export class Medidor {
  /** Desvio da nota em cents, ou `null` quando não há som. */
  readonly cents = input<number | null>(null);
  readonly afinado = input(false);

  private readonly miolo = viewChild.required<ElementRef<SVGPathElement>>('miolo');
  private readonly anel = viewChild.required<ElementRef<SVGPathElement>>('anel');
  private readonly onda = viewChild.required<ElementRef<SVGPathElement>>('onda');
  private readonly marcador = viewChild.required<ElementRef<SVGRectElement>>('marcador');

  /**
   * Forma em repouso, ligada já na primeira renderização. Sem ela o mostrador
   * nasceria vazio até o primeiro quadro — e continuaria vazio onde o laço não
   * roda. Como os valores nunca mudam, o Angular não reescreve o atributo
   * depois: o laço fica dono dele.
   */
  protected readonly florParada = caminhoDaFlor(RAIO, 0.057, 0);
  protected readonly anelParado = caminhoDaFlor(RAIO + FOLGA_DO_ANEL, 0.043, 0.22);
  protected readonly ondaParada = caminhoDaOnda(1, 0, FITA_LARGURA, FITA_MEIO);

  protected readonly rotuloAcessivel = computed(() => {
    const valor = this.cents();
    if (valor === null) return 'Sem sinal do instrumento';
    if (this.afinado()) return 'Corda afinada';
    const desvio = Math.round(valor);
    return desvio > 0 ? `${desvio} cents acima` : `${Math.abs(desvio)} cents abaixo`;
  });

  /** Persegue a leitura do microfone; guarda a velocidade entre os quadros. */
  private readonly molaCents = new Mola(0, 170, 20);
  /** Vai de 0 (fora do tom) a 1 (afinado) — é ela que abre as pétalas. */
  private readonly molaForma = new Mola(0, 120, 17);
  /** Inclina a flor para o lado do desvio. */
  private readonly molaGiro = new Mola(0, 90, 14);

  private reduzido = false;
  private tempo = 0;
  private ultimoQuadro = 0;
  private quadro = 0;
  private assinatura = '';

  constructor() {
    const destruicao = inject(DestroyRef);

    afterNextRender(() => {
      this.reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.ultimoQuadro = performance.now();
      this.desenhar(0);
      this.agendar();
      destruicao.onDestroy(() => cancelAnimationFrame(this.quadro));
    });
  }

  private agendar(): void {
    this.quadro = requestAnimationFrame((agora) => {
      this.agendar();
      const dt = Math.min(PASSO_MAXIMO, (agora - this.ultimoQuadro) / 1000);
      this.ultimoQuadro = agora;
      this.desenhar(dt);
    });
  }

  private desenhar(dt: number): void {
    const leitura = this.cents();
    const afinado = this.afinado();

    // Com movimento reduzido a mola some: a forma passa a ser função só da
    // leitura, e o quadro é descartado inteiro enquanto a leitura não muda.
    if (this.reduzido) {
      const assinatura = `${(leitura ?? 0).toFixed(1)}|${afinado}`;
      if (assinatura === this.assinatura) return;
      this.assinatura = assinatura;
    }

    const cents = limitar(this.mover(this.molaCents, leitura ?? 0, dt), -60, 60);
    const forma = this.mover(this.molaForma, afinado ? 1 : 0, dt);
    const giro = this.mover(this.molaGiro, cents * 0.018, dt);

    const desvio = Math.abs(cents);
    const t = this.reduzido ? 0 : (this.tempo += dt);

    // Fora do tom sobra um tremor na amplitude; afinada, a flor só respira.
    const tremor = (1 - forma) * (0.045 + 0.03 * Math.sin(t * 6.5));
    const amplitude = 0.012 + 0.075 * forma + (this.reduzido ? 0 : tremor);
    const raio = RAIO * (1 + (this.reduzido ? 0 : 0.03 * forma * Math.sin(t * 2.2)));
    // Afinada a flor quase para de girar: é o sinal de "pode soltar a tarraxa".
    const rotacao = giro + (this.reduzido ? 0 : t * (forma > 0.5 ? 0.12 : 0.5));

    this.miolo().nativeElement.setAttribute('d', caminhoDaFlor(raio, amplitude, rotacao));
    this.anel().nativeElement.setAttribute(
      'd',
      caminhoDaFlor(raio + FOLGA_DO_ANEL, amplitude * 0.75, rotacao + 0.22),
    );

    const altura = (1 - forma) * Math.min(11, desvio * 0.32) + 1;
    this.onda().nativeElement.setAttribute(
      'd',
      caminhoDaOnda(altura, this.reduzido ? 0 : t * 4, FITA_LARGURA, FITA_MEIO),
    );

    const posicao =
      (limitar(cents, -ESCALA_CENTS, ESCALA_CENTS) + ESCALA_CENTS) / (ESCALA_CENTS * 2);
    this.marcador().nativeElement.setAttribute(
      'x',
      (6 + posicao * FITA_LARGURA - FITA_MARCADOR / 2).toFixed(1),
    );
  }

  private mover(mola: Mola, alvo: number, dt: number): number {
    return this.reduzido ? mola.saltarPara(alvo) : mola.avancar(alvo, dt);
  }
}

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.max(minimo, Math.min(maximo, valor));
}
