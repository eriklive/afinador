# Afinador

Afinador cromático de **violão** e **ukulele** que ouve pelo microfone. Feito em Angular,
pensado primeiro para o celular e publicado como página estática no GitHub Pages.

## O que ele faz

- **Detecta a nota pelo microfone** e mostra o desvio em cents num ponteiro de ±50 cents.
  A faixa verde no topo do arco vale ±5 cents — dentro dela a corda está afinada.
- **Escolhe a corda sozinho**: toque qualquer corda solta e o afinador mira a mais próxima.
  Dá para fixar uma corda tocando nela na régua de baixo.
- **Instruções em vez de números**: "aperte a corda" / "afrouxe a corda", e uma vibração curta
  quando a corda entra na faixa.
- **Toca a nota de referência** da corda alvo, para afinar de ouvido quando o ambiente está
  barulhento demais para o microfone.
- **Calibra o diapasão** de 415 a 466 Hz, para tocar junto com um instrumento fora do 440.

### Afinações

| Violão                      | Ukulele                           |
| --------------------------- | --------------------------------- |
| Padrão (E A D G B E)        | Padrão (G C E A) — Sol reentrante |
| Drop D (D A D G B E)        | Sol grave / Low G (G C E A)       |
| Meio tom abaixo (Eb)        | Barítono (D G B E)                |
| Aberto em Sol (D G D G B D) |                                   |

## Como funciona a detecção

O caminho do som até o ponteiro está em `src/app/nucleo/`:

1. **`microfone.ts`** abre o microfone com `echoCancellation`, `noiseSuppression` e
   `autoGainControl` **desligados** — os processamentos de voz do navegador destroem a
   periodicidade do sinal e inviabilizam a detecção. Em seguida filtra a entrada (passa-alta em
   55 Hz, passa-baixa em 1300 Hz) para sobrar a faixa das fundamentais, e analisa uma janela de
   4096 amostras a cada 45 ms.
2. **`detector-de-tom.ts`** estima a fundamental pelo método McLeod (NSDF). Autocorrelação crua
   erra a oitava com frequência em corda dedilhada, porque o 2º harmônico rende um pico tão alto
   quanto o da fundamental; a normalização do NSDF mais a escolha do _primeiro_ pico acima de 90%
   do máximo resolvem isso. Uma parábola pelos três pontos ao redor do pico refina a estimativa —
   sem ela, no E2 a resolução de uma amostra já valeria ~3 cents.
3. **`suavizador.ts`** passa uma mediana (descarta pulos isolados) e uma média exponencial em
   espaço logarítmico (tira o tremor) antes de o valor chegar à tela. Uma variação grande e
   sustentada — o usuário trocou de corda — zera o histórico em vez de ser suavizada.
4. **`nota.ts`** converte para número MIDI e cents. Toda nota é guardada como MIDI inteiro e só
   vira Hz na comparação, o que faz a calibração do diapasão reafinar tudo de graça.

## Rodando localmente

```bash
npm install
npm start          # http://localhost:4200
npm test           # 44 testes de unidade e de componente
npm run build      # saída em dist/afinador/browser
```

O microfone só é liberado pelo navegador em **contexto seguro**: `localhost` ou HTTPS.

## Publicação

O workflow `.github/workflows/publicar.yml` roda os testes, constrói o app com o `--base-href` do
Pages e publica a cada push no branch padrão.

Antes da primeira execução o Pages precisa estar ligado no repositório: **Settings → Pages → Build
and deployment → Source: GitHub Actions**. O workflow tenta ligar sozinho
(`actions/configure-pages` com `enablement: true`), mas o `GITHUB_TOKEN` só consegue criar o site
se as permissões de workflow do repositório permitirem — quando não permitem, o passo falha com
`Resource not accessible by integration` e o interruptor tem de ser ligado à mão, uma única vez.

Para conferir a build de produção antes de publicar:

```bash
npm run build:pages
npx http-server dist/afinador/browser   # ou qualquer servidor estático
```
