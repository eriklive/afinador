import { TestBed } from '@angular/core/testing';
import { Microfone } from './microfone';

/** Ordem em que o navegador foi chamado, para provar a sequência de abertura. */
let cronologia: string[] = [];

/** Registra que a cadeia chegou até o destino do contexto. */
let ligadosAoDestino: string[] = [];

class ContextoFalso {
  static resumeFunciona = true;

  state: AudioContextState = 'suspended';
  sampleRate = 48000;
  onstatechange: (() => void) | null = null;

  constructor() {
    cronologia.push('novo-contexto');
  }

  async resume(): Promise<void> {
    if (ContextoFalso.resumeFunciona) this.state = 'running';
  }

  async close(): Promise<void> {
    this.state = 'closed';
  }

  createMediaStreamSource() {
    return { connect: () => undefined };
  }

  createBiquadFilter() {
    return { type: '', frequency: { value: 0 }, connect: () => undefined };
  }

  createAnalyser() {
    return {
      fftSize: 0,
      connect: () => undefined,
      getFloatTimeDomainData: () => undefined,
    };
  }

  createGain() {
    ligadosAoDestino.push('gain');
    return {
      gain: { value: 1 },
      connect: (destino: unknown) => {
        if (destino === this.destination) ligadosAoDestino.push('destino');
      },
    };
  }

  readonly destination = { nome: 'destino' };
}

const faixa = { stop: vi.fn() };
let erroDaCaptura: DOMException | null = null;

function instalarNavegador(): void {
  cronologia = [];
  ligadosAoDestino = [];
  faixa.stop.mockClear();
  erroDaCaptura = null;
  ContextoFalso.resumeFunciona = true;

  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = ContextoFalso;
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: async () => {
        cronologia.push('getUserMedia');
        if (erroDaCaptura) throw erroDaCaptura;
        return { getTracks: () => [faixa] };
      },
    },
    configurable: true,
  });
}

describe('Microfone', () => {
  let microfone: Microfone;

  beforeEach(() => {
    instalarNavegador();
    TestBed.resetTestingModule();
    microfone = TestBed.inject(Microfone);
  });

  afterEach(() => microfone.parar());

  it('cria o contexto de áudio antes de pedir a captura', async () => {
    // No Safari, um AudioContext criado depois do primeiro `await` nasce
    // suspenso e nunca destrava: o analisador passa a devolver só zeros, sem
    // erro nenhum. A ordem aqui é a correção — não é detalhe de estilo.
    await microfone.iniciar();
    expect(cronologia).toEqual(['novo-contexto', 'getUserMedia']);
    expect(microfone.estado()).toBe('ouvindo');
  });

  it('recusa a escuta quando o contexto não sai de suspenso', async () => {
    ContextoFalso.resumeFunciona = false;
    await microfone.iniciar();

    expect(microfone.estado()).toBe('erro');
    expect(microfone.mensagemErro()).toContain('bloqueou');
    // Fingir que está ouvindo com o áudio parado é o pior desfecho possível:
    // a permissão fica acesa e nada acontece na tela.
    expect(microfone.ativo).toBe(false);
    expect(faixa.stop).toHaveBeenCalled();
  });

  it('fecha a cadeia no destino, mudo', async () => {
    // Sem chegar ao destino o Safari pode nunca alimentar o analisador; o
    // ganho zero garante o caminho sem devolver som ao alto-falante.
    await microfone.iniciar();
    expect(ligadosAoDestino).toEqual(['gain', 'destino']);
  });

  it('reporta permissão negada', async () => {
    erroDaCaptura = new DOMException('negado', 'NotAllowedError');
    await microfone.iniciar();

    expect(microfone.estado()).toBe('negado');
    expect(microfone.mensagemErro()).toContain('Permissão');
  });

  it('reporta aparelho sem microfone', async () => {
    erroDaCaptura = new DOMException('sem device', 'NotFoundError');
    await microfone.iniciar();
    expect(microfone.estado()).toBe('indisponivel');
  });

  it('ignora um segundo início enquanto já está ouvindo', async () => {
    await microfone.iniciar();
    await microfone.iniciar();
    expect(cronologia.filter((e) => e === 'novo-contexto')).toHaveLength(1);
  });

  describe('sinal', () => {
    it('é mudo quando não chega nível nenhum', () => {
      microfone.nivel.set(0);
      expect(microfone.sinal()).toBe('mudo');
    });

    it('é som quando há nível mas nenhuma nota fechou', () => {
      microfone.nivel.set(0.05);
      expect(microfone.sinal()).toBe('som');
    });

    it('é nota quando a detecção fechou', () => {
      microfone.nivel.set(0.05);
      microfone.leitura.set({ frequencia: 110, clareza: 0.9, volume: 0.05 });
      expect(microfone.sinal()).toBe('nota');
    });
  });

  it('parar zera nível e leitura', async () => {
    await microfone.iniciar();
    microfone.nivel.set(0.4);
    microfone.parar();

    expect(microfone.estado()).toBe('parado');
    expect(microfone.nivel()).toBe(0);
    expect(microfone.leitura()).toBeNull();
    expect(faixa.stop).toHaveBeenCalled();
  });
});
