import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Desvio máximo mostrado no arco, em cents. */
const ESCALA_CENTS = 50;

/** Abertura do arco, em graus para cada lado do centro. */
const ABERTURA_GRAUS = 62;

const CENTRO_X = 160;
const CENTRO_Y = 158;
const RAIO = 126;

interface Marca {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly forte: boolean;
}

@Component({
  selector: 'app-medidor',
  templateUrl: './medidor.html',
  styleUrl: './medidor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Medidor {
  /** Desvio da nota em cents, ou `null` quando não há som. */
  readonly cents = input<number | null>(null);
  readonly afinado = input(false);

  protected readonly marcas: readonly Marca[] = criarMarcas();
  protected readonly arco = criarArco();
  protected readonly zonaAfinada = criarZona(5);

  protected readonly graus = computed(() => {
    const valor = this.cents();
    if (valor === null) return 0;
    const limitado = Math.max(-ESCALA_CENTS, Math.min(ESCALA_CENTS, valor));
    return (limitado / ESCALA_CENTS) * ABERTURA_GRAUS;
  });

  protected readonly rotuloAcessivel = computed(() => {
    const valor = this.cents();
    if (valor === null) return 'Sem sinal do instrumento';
    if (this.afinado()) return 'Corda afinada';
    const desvio = Math.round(valor);
    return desvio > 0 ? `${desvio} cents acima` : `${Math.abs(desvio)} cents abaixo`;
  });

  protected readonly transformacaoPonteiro = computed(
    () => `rotate(${this.graus().toFixed(2)} ${CENTRO_X} ${CENTRO_Y})`,
  );
}

function ponto(graus: number, raio: number): { x: number; y: number } {
  const radianos = (graus * Math.PI) / 180;
  return {
    x: CENTRO_X + raio * Math.sin(radianos),
    y: CENTRO_Y - raio * Math.cos(radianos),
  };
}

function criarArco(): string {
  const inicio = ponto(-ABERTURA_GRAUS, RAIO);
  const fim = ponto(ABERTURA_GRAUS, RAIO);
  return `M ${inicio.x.toFixed(2)} ${inicio.y.toFixed(2)} A ${RAIO} ${RAIO} 0 0 1 ${fim.x.toFixed(2)} ${fim.y.toFixed(2)}`;
}

function criarZona(cents: number): string {
  const graus = (cents / ESCALA_CENTS) * ABERTURA_GRAUS;
  const inicio = ponto(-graus, RAIO);
  const fim = ponto(graus, RAIO);
  return `M ${inicio.x.toFixed(2)} ${inicio.y.toFixed(2)} A ${RAIO} ${RAIO} 0 0 1 ${fim.x.toFixed(2)} ${fim.y.toFixed(2)}`;
}

function criarMarcas(): Marca[] {
  const marcas: Marca[] = [];
  for (let cents = -ESCALA_CENTS; cents <= ESCALA_CENTS; cents += 5) {
    const forte = cents % 25 === 0;
    const graus = (cents / ESCALA_CENTS) * ABERTURA_GRAUS;
    const externo = ponto(graus, RAIO - 4);
    const interno = ponto(graus, RAIO - (forte ? 22 : 13));
    marcas.push({ x1: externo.x, y1: externo.y, x2: interno.x, y2: interno.y, forte });
  }
  return marcas;
}
