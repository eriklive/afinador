import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import {
  INSTRUMENTOS,
  acharAfinacao,
  acharInstrumento,
  type Corda,
  type InstrumentoId,
} from './nucleo/afinacoes';
import { COR_EM_ESPERA, corDoDesvio, intensidadeDoDesvio } from './nucleo/cor-do-desvio';
import { Microfone } from './nucleo/microfone';
import {
  A4_MAXIMO,
  A4_MINIMO,
  A4_PADRAO,
  centsEntre,
  descreverNota,
  midiParaFrequencia,
} from './nucleo/nota';
import { TomReferencia } from './nucleo/tom-referencia';
import { PainelInstalacao } from './componentes/instalacao/instalacao';
import { Medidor } from './componentes/medidor/medidor';
import { SeletorCordas, type CordaExibida } from './componentes/seletor-cordas/seletor-cordas';

/** Desvio até o qual a corda conta como afinada. */
const TOLERANCIA_CENTS = 5;

/** Desvio máximo que o ponteiro consegue mostrar. */
const ESCALA_MEDIDOR = 50;

interface CordaAlvo extends Corda {
  readonly frequencia: number;
}

@Component({
  selector: 'app-root',
  imports: [Medidor, PainelInstalacao, SeletorCordas],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--acento]': 'cores().acento',
    '[style.--acento-fundo]': 'cores().fundo',
    '[style.--acento-tinta]': 'cores().tinta',
  },
})
export class App {
  private readonly microfone = inject(Microfone);
  private readonly tomReferencia = inject(TomReferencia);

  protected readonly instrumentos = INSTRUMENTOS;
  protected readonly a4Minimo = A4_MINIMO;
  protected readonly a4Maximo = A4_MAXIMO;

  protected readonly instrumentoId = signal<InstrumentoId>('violao');
  protected readonly afinacaoId = signal('violao-padrao');
  protected readonly a4 = signal(A4_PADRAO);
  protected readonly automatico = signal(true);
  protected readonly ajustesAbertos = signal(false);

  private readonly cordaManualId = signal<string | null>(null);
  private readonly concluidas = signal<ReadonlySet<string>>(new Set());

  protected readonly estado = this.microfone.estado;
  protected readonly mensagemErro = this.microfone.mensagemErro;
  protected readonly nivel = this.microfone.nivel;
  protected readonly sinal = this.microfone.sinal;
  protected readonly tocandoReferencia = this.tomReferencia.tocando;

  protected readonly ouvindo = computed(() => this.estado() === 'ouvindo');
  protected readonly iniciando = computed(() => this.estado() === 'iniciando');

  protected readonly instrumento = computed(() => acharInstrumento(this.instrumentoId()));
  protected readonly afinacao = computed(() =>
    acharAfinacao(this.instrumento(), this.afinacaoId()),
  );

  /** Cordas da afinação atual já com a frequência do diapasão em vigor. */
  protected readonly cordas = computed<readonly CordaAlvo[]>(() => {
    const diapasao = this.a4();
    return this.afinacao().cordas.map((corda) => ({
      ...corda,
      frequencia: midiParaFrequencia(corda.midi, diapasao),
    }));
  });

  /** Frequência captada, ou `null` enquanto o instrumento está em silêncio. */
  protected readonly frequencia = computed(() => this.microfone.leitura()?.frequencia ?? null);

  /**
   * Corda que o afinador está mirando: a escolhida à mão, ou — no automático —
   * aquela cuja nota está mais perto do que se está ouvindo.
   */
  protected readonly cordaAlvo = computed<CordaAlvo | null>(() => {
    const cordas = this.cordas();
    if (!this.automatico()) {
      return cordas.find((corda) => corda.id === this.cordaManualId()) ?? null;
    }

    const captada = this.frequencia();
    if (captada === null) return null;

    let melhor = cordas[0];
    let menorDistancia = Infinity;
    for (const corda of cordas) {
      const distancia = Math.abs(centsEntre(captada, corda.frequencia));
      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        melhor = corda;
      }
    }
    return melhor;
  });

  /** Desvio da nota captada em relação ao alvo, em cents. */
  protected readonly desvio = computed(() => {
    const alvo = this.cordaAlvo();
    const captada = this.frequencia();
    if (!alvo || captada === null) return null;
    return centsEntre(captada, alvo.frequencia);
  });

  protected readonly afinado = computed(() => {
    const desvio = this.desvio();
    return desvio !== null && Math.abs(desvio) <= TOLERANCIA_CENTS;
  });

  protected readonly notaAlvo = computed(() => {
    const alvo = this.cordaAlvo();
    return alvo ? descreverNota(alvo.midi) : null;
  });

  protected readonly desvioArredondado = computed(() => {
    const desvio = this.desvio();
    return desvio === null ? null : Math.round(desvio);
  });

  protected readonly frequenciaExibida = computed(() => {
    const captada = this.frequencia();
    if (captada !== null) return captada;
    return this.cordaAlvo()?.frequencia ?? null;
  });

  protected readonly textoFrequencia = computed(() => {
    const valor = this.frequenciaExibida();
    return valor === null ? '—' : `${valor.toFixed(1).replace('.', ',')} Hz`;
  });

  protected readonly textoDesvio = computed(() => {
    const cents = this.desvioArredondado();
    if (cents === null) return '—';
    if (cents === 0) return '0 ¢';
    // Fora da escala do ponteiro o número exato não ajuda ninguém a girar a
    // tarraxa — só o lado importa.
    if (cents > ESCALA_MEDIDOR) return `> +${ESCALA_MEDIDOR} ¢`;
    if (cents < -ESCALA_MEDIDOR) return `< −${ESCALA_MEDIDOR} ¢`;
    return `${cents > 0 ? '+' : '−'}${Math.abs(cents)} ¢`;
  });

  /**
   * Cor do afinador neste instante — verde na faixa afinada, esquentando até
   * o vermelho conforme a corda se afasta. Sai daqui para três variáveis CSS
   * e é só o que a interface inteira lê: nota, flor, fita, pílula e cordas.
   */
  protected readonly cores = computed(() => {
    const desvio = this.desvio();
    if (desvio === null) return COR_EM_ESPERA;
    return corDoDesvio(intensidadeDoDesvio(desvio, TOLERANCIA_CENTS));
  });

  /** Altura da barra de nível, em porcentagem. */
  protected readonly nivelBarra = computed(() => Math.min(100, this.nivel() * 1400));

  /** Instrução principal mostrada abaixo da nota. */
  protected readonly instrucao = computed(() => {
    if (!this.ouvindo()) return 'Ative o microfone para começar';
    if (this.tocandoReferencia()) return 'Tocando a nota de referência';

    const desvio = this.desvio();
    if (desvio === null) {
      // Separa os dois motivos de não haver nota: microfone sem som nenhum
      // (permissão, aparelho mudo) ou som chegando sem altura definida.
      if (this.sinal() === 'mudo') return 'Nenhum som chegando ao microfone';
      return this.automatico()
        ? 'Ouvindo — toque uma corda solta'
        : `Ouvindo — toque a ${this.cordaAlvo()?.numero ?? ''}ª corda`;
    }
    if (Math.abs(desvio) <= TOLERANCIA_CENTS) return 'Afinada';
    return desvio < 0 ? 'Aperte a corda' : 'Afrouxe a corda';
  });

  protected readonly cordasExibidas = computed<readonly CordaExibida[]>(() => {
    const alvoId = this.cordaAlvo()?.id;
    const concluidas = this.concluidas();
    return this.cordas().map((corda) => {
      const nota = descreverNota(corda.midi);
      return {
        id: corda.id,
        numero: corda.numero,
        cifra: nota.cifra,
        nome: nota.nome,
        oitava: nota.oitava,
        frequencia: corda.frequencia,
        alvo: corda.id === alvoId,
        concluida: concluidas.has(corda.id),
      };
    });
  });

  constructor() {
    // Marca a corda como pronta assim que ela entra na tolerância, para dar o
    // retorno de "já era" sem o usuário precisar olhar o ponteiro de novo.
    effect(() => {
      const alvo = this.cordaAlvo();
      if (!alvo || !this.afinado()) return;
      untracked(() => {
        if (this.concluidas().has(alvo.id)) return;
        this.concluidas.update((atual) => new Set(atual).add(alvo.id));
        // No celular a mão está no braço do instrumento, não na tela.
        navigator.vibrate?.(30);
      });
    });
  }

  protected trocarInstrumento(id: InstrumentoId): void {
    if (this.instrumentoId() === id) return;
    this.instrumentoId.set(id);
    this.afinacaoId.set(acharInstrumento(id).afinacoes[0].id);
    this.recomecar();
  }

  protected trocarAfinacao(evento: Event): void {
    this.afinacaoId.set((evento.target as HTMLSelectElement).value);
    this.recomecar();
  }

  protected escolherCorda(id: string): void {
    this.pararReferencia();
    this.automatico.set(false);
    this.cordaManualId.set(id);
    this.microfone.reiniciarLeitura();
  }

  protected ligarAutomatico(): void {
    this.pararReferencia();
    this.automatico.set(true);
    this.cordaManualId.set(null);
    this.microfone.reiniciarLeitura();
  }

  protected ajustarA4(passo: number): void {
    const proximo = Math.min(A4_MAXIMO, Math.max(A4_MINIMO, this.a4() + passo));
    if (proximo === this.a4()) return;
    this.a4.set(proximo);
    this.recomecar();
  }

  protected redefinirA4(): void {
    if (this.a4() === A4_PADRAO) return;
    this.a4.set(A4_PADRAO);
    this.recomecar();
  }

  protected alternarAjustes(): void {
    this.ajustesAbertos.update((aberto) => !aberto);
  }

  protected async alternarMicrofone(): Promise<void> {
    if (this.estado() === 'ouvindo') {
      this.pararReferencia();
      this.microfone.parar();
      return;
    }
    await this.microfone.iniciar();
  }

  protected async alternarReferencia(): Promise<void> {
    if (this.tocandoReferencia()) {
      this.pararReferencia();
      return;
    }
    const alvo = this.cordaAlvo();
    if (!alvo) return;
    // Sem pausar a escuta o afinador ouviria o próprio tom e travaria nele.
    this.microfone.pausado.set(true);
    this.microfone.reiniciarLeitura();
    await this.tomReferencia.tocar(alvo.frequencia);
  }

  private pararReferencia(): void {
    if (!this.tocandoReferencia()) return;
    this.tomReferencia.parar();
    this.microfone.pausado.set(false);
    this.microfone.reiniciarLeitura();
  }

  private recomecar(): void {
    this.pararReferencia();
    this.concluidas.set(new Set());
    this.cordaManualId.set(null);
    this.automatico.set(true);
    this.microfone.reiniciarLeitura();
  }
}
