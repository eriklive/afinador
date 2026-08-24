# Afinador

Afinador cromático de **violão** e **ukulele** que ouve pelo microfone. Feito em Angular,
pensado primeiro para o celular e publicado como página estática no GitHub Pages.

## O que ele faz

- **Detecta a nota pelo microfone** e mostra o desvio numa flor que abre quando a corda
  entra na faixa afinada — ±5 cents — e numa fita de ±50 cents com a marca do desvio.
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

O caminho do som até o mostrador está em `src/app/nucleo/`:

1. **`microfone.ts`** abre o microfone com `echoCancellation`, `noiseSuppression` e
   `autoGainControl` **desligados** — os processamentos de voz do navegador destroem a
   periodicidade do sinal e inviabilizam a detecção. Em seguida filtra a entrada (passa-alta em
   55 Hz, passa-baixa em 1300 Hz) para sobrar a faixa das fundamentais, e analisa uma janela de
   4096 amostras a cada 45 ms.

   Duas armadilhas de Safari estão resolvidas aqui e têm teste próprio: o `AudioContext` é criado
   **antes** do primeiro `await` (criado depois, ele nasce suspenso e o analisador só devolve
   zeros, sem erro nenhum), e a cadeia termina num ganho zero ligado ao `destination` (o Safari
   pode não alimentar um analisador pendurado no vácuo). O nível RMS é medido a cada quadro
   independentemente da detecção, para a tela conseguir dizer _"nenhum som chegando ao
   microfone"_ em vez de simplesmente não reagir.

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

## A linguagem visual

O afinador não usa números como retorno principal — usa **cor e forma**, porque quem está
afinando olha o braço do instrumento, não a tela.

**A cor é contínua, não são três estados.** `nucleo/cor-do-desvio.ts` mapeia o desvio numa rampa
de cinco paradas em HSL — verde, limão, amarelo, laranja, vermelho — e o componente raiz escreve o
resultado em três variáveis CSS (`--acento`, `--acento-fundo`, `--acento-tinta`). Nada mais na
interface decide cor: nota, flor, fita, pílula de instrução, corda mirada e barra de nível só leem
essas três. Dentro da tolerância a rampa devolve verde puro — a faixa afinada não é um degradê que
já começa a esquentar —, e sem nota nenhuma o acento sai da rampa e vira o lilás da interface, para
que "esperando" nunca se pareça com "afinado".

As três variáveis são registradas com `@property` em `styles.scss`. É isso que permite
interpolá-las: sem o registro, o navegador trocaria a cor de degrau em degrau a cada leitura do
microfone; com ele, a cor escorre.

**A forma diz o mesmo que a cor, para quem não a distingue.** O mostrador é uma flor de sete
pétalas (`nucleo/flor.ts`): uma circunferência cujo raio é modulado por um cosseno. Fora do tom a
amplitude é quase zero e ela é um círculo que treme e gira; conforme a corda entra na faixa, as
pétalas se abrem e o giro quase para. Quem só vê a forma tem a mesma informação de quem só vê a
cor.

O movimento roda em `requestAnimationFrame`, com molas amortecidas (`nucleo/mola.ts`) no lugar de
transições CSS: o alvo muda a cada leitura do microfone, e uma transição reiniciada a cada valor
novo fica picada — a mola carrega a velocidade de um quadro para o outro. O laço escreve direto nos
nós do SVG, sem passar pela detecção de mudanças do Angular, que custaria um ciclo por quadro sem
mudar um pixel. Com `prefers-reduced-motion` a mola some: a forma vira função só da leitura, e o
quadro é descartado inteiro enquanto a leitura não muda.

**Os controles mudam de forma, não só de cor.** O instrumento escolhido cresce e diminui o raio; a
corda mirada assume um raio assimétrico; botões apertados encolhem o raio e a escala. As curvas
estão em `--mola` e `--enfase`.

**Tipografia.** Roboto Flex, variável em peso e largura — os dois eixos separam a corda mirada das
outras sem trocar de família — e Roboto Mono nos números. As duas são servidas do próprio pacote,
recortadas com `fonttools` para o subconjunto latino e para a faixa de eixos que a interface usa:
63 kB somados, contra 384 kB dos arquivos originais. Detalhes e licença em `src/fontes/LICENCA.txt`.

## Rodando localmente

```bash
npm install
npm start          # http://localhost:4200
npm test           # 89 testes de unidade e de componente
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
