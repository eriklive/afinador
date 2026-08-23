import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface CordaExibida {
  readonly id: string;
  readonly numero: number;
  /** Cifra sem oitava, ex.: `E`. */
  readonly cifra: string;
  /** Nome em português, ex.: `Mi`. */
  readonly nome: string;
  readonly oitava: number;
  readonly frequencia: number;
  /** A corda que o afinador está mirando agora. */
  readonly alvo: boolean;
  /** Já foi afinada nesta sessão. */
  readonly concluida: boolean;
}

@Component({
  selector: 'app-seletor-cordas',
  templateUrl: './seletor-cordas.html',
  styleUrl: './seletor-cordas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeletorCordas {
  readonly cordas = input.required<readonly CordaExibida[]>();
  /** `true` quando o afinador escolhe a corda sozinho. */
  readonly automatico = input(true);

  readonly escolher = output<string>();
  readonly voltarParaAutomatico = output<void>();
}
