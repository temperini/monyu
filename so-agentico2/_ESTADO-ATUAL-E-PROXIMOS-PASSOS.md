---
title: "v29 — Estado atual e próximos passos"
date: "2026-08-05"
purpose: "Handoff preciso para qualquer agente/sessão continuar exatamente de onde esta parou. Este arquivo é a fonte de verdade de PROGRESSO — não confundir com doc 06 (regras de negócio) nem doc 05 (histórico de decisões de produto)."
---

# v29 — Estado atual e próximos passos

**Leia isto antes de tocar em qualquer arquivo desta pasta.** Não há Git funcional
neste projeto (`.git` existe na raiz mas `git status` retorna "not a git
repository" — não depender dele para saber o que mudou). Este arquivo é a
**única fonte de verdade sobre progresso**. Mantenha-o atualizado a cada
sessão de trabalho — é mais barato manter isto correto do que outro agente
perder tempo redescobrindo o estado por leitura de código.

Contexto de produto completo: `_knowledge-base/05-piloto-so-agentico-ui.md`
(seção 27) e `_knowledge-base/06-regras-e-especificacao-dev.md` (seção 20,
regras de Rotinas). Este arquivo aqui é só **estado de execução**.

## 1. O que está rodando

```bash
# servidor local que serve esta pasta (usado durante toda a sessão)
python -m http.server 8129
# abrir http://localhost:8129/2026-08-03_monyu-so-agentico_app_v29.html
```

Configurado em `.claude/launch.json` do projeto como preview `piloto-v29`.

**Cache do navegador — duas armadilhas distintas, confirmadas em 2026-08-05:**
1. `?cb=<algo>` na URL de navegação só busta o cache do **documento HTML**
   em si. **Não** afeta os arquivos referenciados por `<link>`/`<script
   src>`, que o navegador pode continuar servindo do cache mesmo depois de
   editados no disco — sintoma: função que você acabou de criar aparece como
   `ReferenceError: X is not defined` mesmo com o arquivo `.js` correto no
   servidor (confirmado via `fetch` direto do arquivo). **Solução aplicada:**
   as 3 tags em `2026-08-03_monyu-so-agentico_app_v29.html` (linhas ~12-13 e
   ~1959) têm `?v=N`: o `<link>` dos tokens, o `<link>` do CSS do app e o
   `<script src>` do JS do app — **as três**, não só duas (o arquivo de
   tokens também já causou o mesmo sintoma, esquecido na primeira rodada).
   Números na hora em que este arquivo foi escrito: tokens `v=6`, CSS `v=22`,
   JS `v=13` — não confiar neles como "estado atual", **conferir sempre no
   próprio HTML** e **incrementar o que for editado** antes de desconfiar do
   código quando uma mudança parecer não ter efeito.
2. Ao depurar console, prefira abrir uma aba nova (`tabs_create`) a
   reaproveitar uma aba antiga: mensagens de erro de navegações anteriores
   **se acumulam** em `read_console_messages` e não são limpas
   automaticamente — geram falsos positivos de erro já corrigido (aconteceu
   2x nesta sessão).
3. **(2026-08-06)** Uma aba nova por si só **não** garante HTML fresco: em
   pelo menos um caso, `tabs_create` + `navigate` para a URL "limpa" ainda
   trouxe o documento HTML cacheado (confirmado lendo `link[rel=stylesheet]
   .href` no DOM — apontava pro `?v=` antigo mesmo com o arquivo em disco já
   correto). O que resolveu foi navegar com `?cb=<algo>` **na própria URL do
   HTML** (não só nos `<link>`/`<script>` internos). Ou seja: os itens 1 e 2
   se somam — nova aba ajuda, mas se o sintoma persistir, adicionar `?cb=`
   à URL de navegação também.

## 2. Trabalho concluído nesta sessão (2026-08-05), em ordem

Todo o trabalho abaixo foi testado no navegador (console limpo, ambos os
temas) antes de ser dado como concluído.

### 2.1 Porte de telas do v28 legado para o app real (`app_v29.html/js`)

O app real (`2026-08-03_monyu-so-agentico_app_v29.html/js`) ainda tinha views
com HTML herdado da v28 por baixo dos mockups novos. O porte é **tela por
tela**, validando o JS a cada uma (nunca substituir tudo de uma vez — cada
view tem IDs que o JS referencia por `getElementById`/`$`, e trocar o HTML
sem preservar os IDs quebra silenciosamente).

**Concluído:**
- **Home (`view-inicio`)** — hero + linha de estado dos agentes + atividade
  recente + retorno (ROI). Ver 3.1 abaixo para um bug introduzido e corrigido
  na mesma sessão.
- **Meus Agentes (`view-agentes`)** — catálogo dos 14 agentes.
- **Oportunidades (`view-radar`)** — ver 2.2, o trabalho aqui foi além de
  porte visual.

**Pendente** (mapa completo gerado por `mapear.py`, ver seção 5):
- Memória (`view-conhecimento`) — 14 IDs referenciados pelo JS
- Central de Aprovações (`view-aprovacoes`) — 14 IDs — **nota:** uma
  inspeção rápida em 2026-08-05 mostrou que esta view **já usa** o casco
  moderno (`.hero`, `.card`, `.section-head`, `.linklike`) e não parece ser
  v28 legado puro. Antes de redesenhar, audite como foi feito em Oportunidades
  (seção 2.2) — o problema pode estar escondido na lógica JS, não no HTML.
- Meus Projetos (`view-projetos`) — 6 IDs — **não tem mockup próprio**
  (`mockup-projetos.html` não existe). Decidir se cria um antes de portar ou
  se porta direto avaliando o HTML atual.
- GigaMonyU, Recompensas, Treinamentos — prioridade mais baixa, não avaliadas
  nesta sessão.

### 2.2 Oportunidades — motor de recomendação contextual religado

**Problema encontrado:** os cards de oportunidade e o modal de detalhe
mostravam uma recomendação de agente por projeto (`→ Ada · 20 fichas`) usando
`recommendedAgent(pid)`, uma função simplista que só olha o estágio do
projeto e **ignora completamente as exigências do edital**. O motor de
verdade (`nextBestAction(pid, oppId)`, já existente e correto — pesa
contrapartida, exigência de parceria, TRL, documentação) só era usado no
card "próxima ação" da Home. Ou seja: o recurso mais estratégico do produto
(recomendar Bartô/Eros/Kai antes da Ada quando o edital exige) não chegava à
tela onde o usuário mais precisa dele — comparando editais.

**Correção** (`2026-08-03_monyu-so-agentico_app_v29.js`):
- `oppMatchRow`/`oppMatchSummary` (cards) e `oppQuickMatchItem`/
  `oppQuickMatchList` (modal de detalhe) agora chamam `nextBestAction(pid,
  oppId)` via um helper novo `oppRecHTML(pid, oppId)`.
- `recommendedAgent()` foi **removida** (ficou morta).
- **Bug pego no processo:** `oppRecHTML` inicialmente buscava o nome do
  agente em `AG` (objeto pequeno, só 6 agentes — usado pelo drawer de
  execução). `nextBestAction` pode recomendar qualquer um dos 14, incluindo
  Bartô/Eros/Carlito/Banca, que não existem em `AG` → `AG[agente].name`
  lançava `TypeError`. Corrigido para usar `AGD` (catálogo completo), igual
  ao que `renderNextBest()` da Home já fazia corretamente.
- **Segundo bug pego no processo:** `renderOpps()` era chamada na
  inicialização **antes** de `AGD` ser definida no arquivo (`AGD` só existe
  ~800 linhas depois). A chamada foi movida para o bloco de boot final,
  junto de `renderNextBest()`/`renderHomeV29()`.
- **Validado:** FINEP (contrapartida mín. 20%) agora recomenda **Bartô** para
  o projeto "Plataforma IoT" (que ainda não passou pela Ada), em vez de Ada
  cegamente. "Microrredes solares" (Ada já rodou, faltam certidões) recomenda
  **Carlito**. "Baterias" (já submetido) corretamente não mostra recomendação.

### 2.3 Home — correções pontuais de UX

- **Banners consolidados:** a v28 empilhava até 3 banners simultâneos no topo
  (358px antes do primeiro conteúdo real). Função `priorizarAvisos()` nova
  garante que só um fica visível por vez, por ordem de urgência (prazo >
  aprovação). O banner promocional (`promoBanner`) foi movido do topo para o
  bloco financeiro, onde conteúdo comercial não disputa atenção com o
  trabalho do usuário.
- **Bug introduzido e corrigido na mesma sessão:** a linha de status "Rico
  rodando agora · N aprovações" foi inicialmente colocada dentro do `.hero`,
  dividindo a mesma linha flex com o botão "Resumo da semana" — quebrava em
  3 linhas e o botão "flutuava" solto. Corrigido: a linha de status virou uma
  faixa própria, full-width, com borda inferior, **acima** do `.hero` (que
  voltou à estrutura original: título + botão lado a lado). Ver classe
  `.agents-state` em `app_v29.css`.
- `nomeAgente(id)` (helper usado pela linha de status) tinha um bug latente:
  referenciava uma variável `AGENTS` que **nunca existiu** no arquivo — o
  `typeof AGENTS!=='undefined'` sempre dava falso e a função caía num
  fallback ingênuo (capitaliza a primeira letra do id), perdendo acentos
  (Íris, Bartô) e errando "A Banca" (virava "Banca"). Corrigido para usar
  `AGD.filter(...)`, mesmo padrão usado em todo o resto do arquivo.

### 2.4 Drawer de execução de agente ("Executar Rico" etc.) — redesenho completo

Pedido explícito do usuário: a modal estava com muita informação apertada
(checkboxes de projeto quebrando em 2 linhas, 4 linhas de custo separadas +
2 parágrafos de aviso) e ele pediu para repensar a interface para reduzir
esforço cognitivo, além de considerar virar drawer.

**O que mudou** (`#runModal` em `app_v29.html`, estilos em `app_v29.css`,
lógica em `app_v29.js`):
- Virou **drawer lateral** (mesmo padrão de `agDrawer`/`prDrawer` — scrim,
  `.open`, fecha por X/clique fora/Esc), não mais modal centralizada. Motivo:
  a plataforma tinha 3 padrões de overlay diferentes para o mesmo tipo de
  painel secundário; agora são 2 (drawer e modal de confirmação curta).
- Cards de projeto: de `<label>` com checkbox apertado + texto quebrando,
  para cartão de 2 linhas (nome + selo "100% elaborado" como pílula própria).
- **Busca de projeto só aparece com mais de 5 projetos** (antes aparecia
  sempre, mesmo com 2 — ruído puro no caso comum).
- **As 4 linhas de custo separadas (`Custo estimado`/`Seu saldo
  atual`/`Saldo após execução`/`Fontes de pesquisa`) + o parágrafo fixo
  "nada é cobrado sem confirmação" viraram 1 cartão único**: preço grande em
  destaque, legenda curta da regra de preço abaixo (uma frase, não um
  parágrafo — a explicação por extenso do Rico também foi encurtada), saldo
  antes→depois numa linha, fontes como detalhe secundário.
- Testado com Íris (preço unitário) e Rico (preço de lote, regra especial
  1 projeto = 1 ficha / 2-5 = 3 fichas fixas) — preço atualiza ao vivo
  conforme marca/desmarca projeto.

Funções novas em `app_v29.js`: `openRunDrawer()`, `closeRunDrawer()`. A
lógica de seleção/custo (`updateRunState`, `runProjItems`, `runPricingNote`)
foi mantida e só teve o texto/threshold ajustados — não foi reescrita.

### 2.5 Rotinas — editor de Criar/Editar (CONCLUÍDO em 2026-08-05)

**Pedido do usuário:** telas internas "Criar Rotina" e "Editar Rotina" — são
o mesmo componente, dois modos (`rotEdState.id` nulo = criar). Regras de
negócio em `_knowledge-base/06-regras-e-especificacao-dev.md` seção 20
(20.3 "lista vertical, nunca canvas" e 20.5 "regra de interrupção").
Referência visual original: `_mockups/mockup-rotinas.html` (movido pra
`_mockups/` em 2026-08-06, seção 2.21).

**O que existe agora, testado ponta a ponta no navegador:**
- **Modelo de dados estruturado** (linhas 3575–3698 do `.js`, construído numa
  sessão anterior): `ROTINAS[i].etapas = [{agente, atividade, teto, saida,
  condicao}]`. Nome, agentes, teto por execução e a frase legível em
  `renderRotinas()` são **derivados** das etapas, nunca escritos à mão —
  listagem e editor não podem divergir por construção.
  `ROT_FREQS`/`ROT_ATIVIDADES`/`ROT_ARTIGO`/`rotArtigoNome`/`rotFraseHTML`/
  `rotTetoTotal`/`rotAgentesUnicos`/`rotFreqInfo` — todos os helpers.
- **Overlay do editor** (`#rotEd` em `app_v29.html`, junto de `.ws`/`#ws`) —
  full-screen, 1 coluna (sem sidebar de dicas, diferente do `.ws-body` de
  2 colunas usado pelo workspace da Ada). CSS próprio em `app_v29.css`
  (bloco "Editor de Rotina — Criar/Editar", ao final do arquivo).
- **Motor completo em `app_v29.js`**, logo após a linha 3698: `rotEdState`,
  `rotBlankEtapa()`, `renderRotEdSteps()`, `updateRotEdPreview()`,
  `openRotEd(id)`, `closeRotEd()`, `saveRotina()`, mais a delegação de
  eventos de `#rotEdSteps` (change/input/click) para os campos de cada
  etapa e os botões mover/remover.
- **Testado e confirmado, todos os fluxos:**
  - Criar do zero (abre com 1 etapa em branco, nunca tela vazia — regra
    20.8) e editar uma rotina existente (pré-preenche nome, frequência,
    teto mensal, todas as etapas na ordem certa, incluindo `condicao`).
  - Trocar o agente de uma etapa repopula as atividades daquele agente e
    atualiza a cor do indicador.
  - Saída "só continua se…" revela o campo de condição; as outras duas
    saídas escondem.
  - Adicionar, mover (▲▼) e remover etapa — tudo recalcula a frase e a
    projeção de custo ao vivo.
  - Projeção: fichas/execução × execuções do mês (por frequência) vs. teto
    mensal editável, com barra que vira `.alerta` (amarela) quando a
    projeção ultrapassa o teto.
  - Validação ao salvar: nome obrigatório, ≥1 etapa, cada etapa com
    agente/atividade/teto válidos, `condicao` obrigatória quando a saída é
    condicional — cada caso testado individualmente, todos bloqueiam o
    salvamento com o toast certo e mantêm o editor aberto.
  - Salvar cria a rotina na listagem (modo criar) ou atualiza a existente
    sem duplicar (modo editar); Cancelar e Esc descartam sem persistir;
    fechar com X funciona.
  - Contraste AA verificado nos dois temas (menor valor: 5.11:1, tema
    escuro, bem acima do mínimo de 4.5:1). Sem overflow horizontal em
    375px (mobile).
- **Achado no processo, não específico desta feature:** `?cb=` na URL de
  navegação não invalida o cache do `<script src>`/`<link>` — precisou
  incrementar `?v=2` nas duas tags em `app_v29.html` para o navegador parar
  de servir o `.js` antigo. Ver seção 1 acima, guardar esse hábito para
  qualquer edição futura de `.css`/`.js` nesta pasta.

**Não construído nesta entrega (fora de escopo, não pedido):** a seção
"Começar de um modelo" (rotinas prontas de 1 clique, regra 20.8 do doc 06)
que aparece no `_mockups/mockup-rotinas.html` entre a listagem e o editor. A
listagem real hoje não tem essa seção — avaliar se vale a pena numa entrega
futura.

### 2.6 Decisões de design do editor de Rotinas (não reabrir sem motivo novo)

- Lista vertical simples, **nunca** canvas/diagrama — regra arquitetural
  não-negociável (20.3 do doc 06). Reordenar por setas ▲▼, não drag-and-drop
  (mais simples de implementar corretamente e mais acessível).
- Frase é sempre **gerada** a partir das etapas, nunca digitada livremente
  pelo usuário — garante que a leitura da rotina nunca fica desatualizada
  em relação ao que ela realmente faz.
- "Ativar rotina" (criar) vs. "Salvar alterações" (editar) — mesmo botão,
  texto muda conforme `rotEdState.id` é `null` ou não.
- Não modelar "Kai só roda se eu pedir" (nota da rotina "Ciclo estratégico")
  como etapa — ficou como campo `obs` de texto livre, opcional, anexado ao
  fim da frase gerada. Não vale a pena modelar exceções manuais como
  estrutura formal.

### 2.7 Correções de bugs + "selecionar tudo ao focar" + motor de sugestão de etapas (2026-08-05, mesmo dia)

Depois de usar o editor pela primeira vez, o usuário reportou 2 bugs visuais
(prints reais, fora do ambiente de automação) e pediu 2 melhorias novas.
Tudo abaixo está testado e concluído.

**Bugs corrigidos:**
- **Popup do `<select>` de frequência abrindo branco sobre o tema escuro.**
  Causa: o popup nativo de `<select>` é desenhado pelo SO/navegador, fora do
  alcance do CSS da página. Corrigido com `color-scheme:dark`/`light` em
  `2026-08-03_monyu-so-agentico_tokens_v29.css` (dentro dos blocos
  `html[data-theme="dark"/"light"]`) — o navegador passa a desenhar sozinho
  o popup do select, as setinhas de número e a scrollbar na paleta certa.
  Também corrigiu de graça 2 selects nativos que já existiam antes desta
  sessão (`#npTema` em Novo Projeto, destino em Memória).
- **Campo de teto mensal cortando o segundo dígito (mostrava "5" de "50").**
  Faltava a regra que esconde as setinhas nativas de incremento do
  `<input type="number">` nesse campo específico (`.rot-ed-teto-input`) — o
  campo irmão dentro de cada etapa (`.et-teto-input`) já tinha a regra, essa
  ficou esquecida. Corrigida, com `-moz-appearance:textfield` adicionado nos
  dois (faltava pro Firefox também).

**"Selecionar tudo ao focar campo de linha única"** — regra global via
`focusin` delegado no `document` (não por campo — cobre qualquer `<input>`
de texto/número atual e futuro). Explicitamente **não** se aplica a
`<textarea>`. Por pedido do usuário, as caixas de busca (`oppSearch`,
`kbSearch`, `cmdkInput`, `runProjFilter`) ficam de fora por enquanto — lista
em `SELALL_IDS_EXCLUIDOS` no `.js`, fácil de reavaliar depois.

**Achado importante no processo:** a primeira versão só usava um listener de
`focusin` chamando `.select()`. Funcionava em teste automatizado via
`.focus()` programático, mas **falhava com clique de mouse real** — o
`mouseup` do clique reposiciona o cursor *depois* que o `focusin` já
selecionou, desfazendo a seleção. Corrigido com o padrão consagrado pra
esse problema: um `mousedown` grava se o campo *já estava* focado antes
deste clique; se não estava (foco genuíno), o `mouseup` correspondente tem
seu comportamento padrão suprimido, preservando a seleção. Clicar de novo
num campo já focado continua posicionando o cursor normalmente. Testado com
clique de mouse real, Tab (teclado) e toque em viewport mobile (emulado —
sem acesso a iOS Safari real neste ambiente).

**Motor de sugestão de etapas** — dois pedidos do usuário viraram um só
motor (`app_v29.js`, bloco "Motor de sugestão de etapas", logo depois de
`var ROTINAS=[...]`):
- `+ Adicionar etapa` deixou de inserir sempre um passo genérico fixo — agora
  chama `rotProximaEtapaOuPadrao(rotEdState.etapas)`, que sugere 1 próximo
  passo sensato considerando o que já foi montado.
- Botão novo **"Sugerir o restante"** (nome escolhido pelo usuário —
  "Completar rotina" foi descartado por soar como confirmação de config, não
  continuidade de construção) chama o mesmo motor em loop, cada volta vendo
  o resultado da anterior, até não haver mais o que sugerir ou atingir o
  teto de segurança de 8 etapas.
- **Fonte 1 — biblioteca de sequências conhecidas** (`ROT_TEMPLATES`): as 3
  rotinas de exemplo (por referência a `ROTINAS`, nunca duplicadas) + os 4
  "modelos prontos" da regra 20.8 do doc 06 (Radar semanal, Do zero ao
  projeto, Inovação contínua, Pronto para submeter — escritos à mão pela
  primeira vez, nunca tinham virado dado real). Se o que já foi montado bate
  com o início de alguma sequência da biblioteca, usa o restante dela.
- **Fonte 2 — heurística por grupo** (`ROT_GRUPO_DE`/`ROT_GRUPO_AGENTES`,
  taxonomia da seção 2.2 do doc 06: Descobrir → Decidir → Construir →
  Depois da submissão): usada só quando nada na biblioteca cobre o que já
  existe. Olha o grupo do último agente e sugere o próximo agente não usado
  desse grupo; esgotado, avança pro grupo seguinte.
- Nunca sugere depois de uma etapa "para e me avisa" (fim lógico da
  rotina) — o botão fica desabilitado com `title` explicando o motivo.
- **Bug pego e corrigido no processo:** quando a sequência já montada batia
  **inteira** com uma sequência conhecida (ex.: Aurora→Bartô→Romeu = todo o
  "Ciclo estratégico"), mas essa sequência termina em "continua sempre" (não
  "para e me avisa" — Ciclo estratégico é assim de propósito), o motor não
  reconhecia que tinha acabado e caía na heurística por grupo, emendando 6
  etapas sem relação nenhuma até o teto de segurança. Corrigido com
  `rotBateTemplateExato()`: se a sequência atual bate ponta a ponta com uma
  sequência inteira da biblioteca, ela está completa, ponto final — não
  importa qual seja a saída da última etapa dela.
- Toast ao usar "Sugerir o restante" nomeia a sequência de referência quando
  veio de um template (ex.: `3 etapas sugeridas com base em "Captação
  contínua"`) ou é genérico quando veio da heurística.

**Contraste, achado e corrigido:** o botão "Sugerir o restante" usa
`color:var(--accent-text)` (pink calibrado contra `--surface`) mas herdava
`background` do `--bg` do overlay (mais escuro que `--surface` no tema
claro) — dava 4.51:1, dentro do AA mas sem a margem de 4.55 usada no resto
do app. Corrigido dando `background:var(--surface)` explícito ao botão —
agora 5.53:1 claro / 5.05:1 escuro. **Padrão a vigiar:** qualquer uso de
`--accent-text`/`--text-3` fora de um `.card`/`.surface-2` explícito corre o
mesmo risco — eles foram calibrados contra `--surface`, não contra `--bg`.

Nesta sessão também ficou confirmado (de novo) o problema de cache: `?v=N`
precisou subir a cada rodada de edição de `.css`/`.js` para o navegador
parar de servir versão antiga — ver seção 1.

### 2.8 Bugs de layout reportados com print real (2026-08-05, mesmo dia) + editor de Rotinas ganhou painel lateral

O usuário testou no Chrome de verdade (não no ambiente de automação) e mandou
prints. Achados e corrigidos:

**1. `<footer>` aparecendo no TOPO das telas Rotinas, Atividade e Resultados**
(parecia rodapé, mas surgia antes do título da página). Causa: o
`<footer class="app-footer">` (o logo grande da MonyU + assinatura) estava
posicionado no HTML **entre** `view-trein` e `view-rotinas` — como ele não
faz parte do sistema `.view`/`.view.active`, ele é **sempre** renderizado,
exatamente onde está no DOM. Como essas 3 views foram adicionadas numa
sessão anterior a esta (via `inject_views.py`) depois do footer já existir,
elas ficaram fisicamente DEPOIS dele no arquivo, então toda vez que uma
delas ficava ativa, o footer aparecia acima. Corrigido movendo o bloco
inteiro do `<footer>` para o fim de `<main>`, depois de `view-resultados`
(a última view) — script usado:
`C:\Users\banda\AppData\Local\Temp\claude\...\scratchpad\mover_footer.py`
(fora do repo, mas o resultado já está aplicado; recriar por número de linha
se precisar refazer algo parecido — o SVG do logo é grande demais pra mover
com Edit por correspondência de texto).

**2. Menu lateral "com scroll" em Memória e Resultados.** Causa raiz
genuína, não cosmética: `.sidebar{overflow-x:hidden}` (necessário para a
animação de recolher o menu não vazar durante a transição de largura) força
— **pela própria spec do CSS**, mesmo escrevendo `overflow-y:visible` à
mão — o eixo Y a computar como `auto`. Combinado com uma leve variação
(~17-40px, não totalmente determinística) entre a altura que o `.sidebar`
recebe (esticado via flexbox para acompanhar a altura da view ativa) e a
altura que os 14 itens de navegação realmente precisam, isso criava uma
barra de rolagem no menu inteiro — visível sobretudo em views mais curtas
(Memória, Resultados), quase invisível em views longas (Início), por isso
"as outras telas" pareciam não ter o problema.
**Correção real, não um workaround de CSS:** `.nav` (o `<div>` que envolve
os 14 itens, já existia no HTML) ganhou `flex:1;min-height:0;overflow-y:auto`
— isola qualquer sobra de conteúdo DENTRO da lista de itens, nunca no
`.sidebar` como um todo. Logo e cartão de perfil no rodapé (fora de `.nav`)
nunca são afetados. **Trade-off aceito conscientemente:** em views muito
curtas, a LISTA de itens (não o menu inteiro) pode precisar de um scroll
interno pequeno (~37px, visto em Memória a 1440×900) para alcançar
"Configurações" — isso tecnicamente diverge da regra "nunca com scroll
interno próprio" documentada no comentário original do CSS (linha ~27-30 de
`app_v29.css`), mas é uma contenção correta e discreta do problema real,
muito melhor que o vazamento de 37-83px que afetava o `.sidebar` inteiro
antes. Se isso incomodar visualmente no futuro, a alternativa é dar a
`.content`/`.app` um `min-height` fixo grande o bastante pra garantir que a
altura da página nunca fique abaixo do que a sidebar precisa — não
implementado agora por ser mais frágil (número mágico que desalinha se
algum item de menu for adicionado/removido).

**3. Conteúdo "quebrado" em Resultados** — texto embaralhado ("Estes / você
/ . A MonyU não recebe... / registrou / ..."). Causa: `.v29-nota{display:flex}`
— um container flex transforma CADA trecho de texto ao redor de um `<b>`
inline num item de flex separado, quebrando a ordem natural de leitura.
Nenhum uso real de `.v29-nota` tinha ícone ao lado (só texto corrido com
`<b>`), então o `display:flex` nunca deveria ter estado lá. Trocado para
`display:block`.

**4. Conteúdo "quebrado" em Atividade** — texto do evento e o "porquê"
grudados na mesma linha, sem separação ("Rico encontrou 3 oportunidades
novasRodou sozinho porque..."). Causa: `.v29-ev-txt` e `.v29-ev-why` são
`<span>` (inline) no HTML gerado por `renderAtividade()` — `margin-top` não
tem efeito em elemento inline. Corrigido com `display:block` nos dois
(removido também um `<br>` redundante no JS que ficou sem função depois
disso).

**5. Texto "5 passos centrais + Bartô quando a decisão exigir viabilidade
integrada"** (legenda de "Jornada de captação" na Home) — específico demais
sobre a mecânica interna do Bartô, destoando do tom genérico das legendas
de outras seções (ex.: "clique em um agente para ver tudo o que ele faz por
você"). Trocado para "os agentes que levam seu projeto do radar à
submissão".

**6. Editor de Rotinas: painel de projeção virou coluna lateral fixa**
(pedido separado do usuário, com print mostrando o rodapé antigo tomando
quase metade da tela numa janela comum). Decisão registrada: **lateral
sempre visível, não drawer/clique** — o resumo de custo precisa reagir *ao
vivo* a cada edição de etapa, e escondê-lo atrás de um clique quebraria
exatamente esse propósito. Reaproveitado o padrão já existente e já
responsivo de `.ws-body`/`.ws-side` (workspace de revisão da Ada):
- `.rot-ed-body` virou grid de 2 colunas: `.rot-ed-main` (etapas, rola) +
  `.rot-ed-side` (`position:sticky;top:0`, contém o resumo de custo E os
  botões Cancelar/Ativar rotina — antes ficavam num `.rot-ed-foot` fixo
  embaixo, que foi removido).
- Abaixo de 980px (mesmo ponto de corte de `.ws-body`), a grade colapsa pra
  1 coluna e o painel lateral vira `position:static`, empilhando abaixo das
  etapas — testado, sem overflow horizontal.
- Testado: atualização ao vivo do custo ao editar etapa continua funcionando
  dentro da nova estrutura; sticky mantém o resumo visível ao rolar etapas
  longas.

### 2.9 Sidebar: correção DEFINITIVA do scroll + dropdown + switch ON/OFF (2026-08-05, 3ª rodada)

O usuário reportou que a 1ª tentativa de corrigir o scroll do menu (seção
2.8, item 2) **piorou** o problema, e que o dropdown continuava branco.
Terceira e definitiva abordagem:

**Scroll do menu — a raiz era arquitetural, não CSS pontual.** A sidebar era
item de fluxo normal do `.app` (flex row, `align-items:stretch`), então era
**esticada até a altura da view ativa** — em telas de conteúdo longo ela
ficava mais alta que a janela, e como `overflow-x:hidden` força o eixo Y a
computar `auto` pela spec do CSS, nascia scroll interno. Duas tentativas
anteriores (`overflow-y:visible` explícito, depois conter só no `.nav`)
falharam porque atacavam o sintoma. **Solução final, em 3 partes:**
1. `.sidebar` virou `position:sticky;top:0;height:100dvh;align-self:flex-start`
   — altura fixa = janela, independente do conteúdo da página. Padrão de
   dashboard; acompanha o scroll sem se mexer.
2. **Densidade do menu recalibrada** (a parte que realmente resolveu): eram
   15 itens + 2 rótulos pedindo 781px num espaço de 612px. Item de ~42px →
   ~34px, rótulo ~37px → ~30px, `gap` .15rem → .08rem, padding da sidebar
   1.1rem → .85rem, `logo-row` padding-bottom 1.1rem → .7rem, margens do
   `.cta-spec` 1.4/.8rem → .7/.55rem. Resultado medido: `.nav` precisa 649px
   e tem 649px — **zero scroll, os 15 itens visíveis de "Início" a
   "Configurações" em todas as 9 telas testadas**. Escala equivalente à de
   Linear/Notion/Vercel para menus longos. Alvo de toque de 44px preservado
   no mobile via `@media(pointer:coarse)`.
3. `.sidebar{overflow:hidden}` (os dois eixos) como corte final: com os
   filhos somando exatamente a altura da janela, o navegador ainda reportava
   `scrollHeight` ~21px maior por arredondamento do flex e desenhava uma
   barra inútil. Nada real é cortado (verificado: nenhum descendente excede
   os limites, rodapé de perfil 100% visível). `.nav` mantém `overflow-y:auto`
   + `scrollbar-width:none` como rede de segurança silenciosa para fonte
   muito ampliada.
No mobile (<=900px) a regra de gaveta (`position:fixed`) sobrescreve tudo
isso — lá o scroll interno é correto e foi mantido.

**Dropdown branco no tema escuro — 2ª tentativa, agora resolvido.**
`color-scheme:dark` (aplicado na rodada anterior) resolve na maioria dos
casos, MAS no Chrome/Windows um `<select>` com `appearance:none` volta a
abrir o popup com fundo branco. Corrigido pintando as `<option>`
explicitamente, em **regra global** (`select option{...}`), não só no editor
de rotinas — o mesmo sintoma valia para "Área temática" (Novo Projeto) e
destino (Memória).

**Liga/desliga de rotina virou switch.** Antes eram dois rótulos alternados
("Pausar rotina"/"Ativar rotina") num botão de baixo destaque: exigia LER
para descobrir o estado, e ainda inferir se o texto descrevia o estado atual
ou a ação que seria tomada — ambiguidade clássica desse padrão. Agora:
`<input type="checkbox">` com o visual `.switch` que já existia no app
(painel de acessibilidade), **verde `--ok` quando ativa / cinza quando
pausada**, com rótulo "Ativa"/"Pausada" ao lado (cor nunca é o único
indicador). O handler mudou de `click` em botão para `change` em checkbox —
funciona por mouse, toque e teclado (Espaço) sem tratar cada um.
**Contraste:** `--ok` puro dá só 3.42:1 sobre branco (foi calibrado para
preencher áreas, não para texto pequeno) — criada variante `#0A7D48` só para
o rótulo no tema claro. Medido: 5.20:1 claro / 8.75:1 escuro para "Ativa",
5.57:1 e 5.11:1 para "Pausada". **Padrão a vigiar:** o mesmo cuidado vale
para qualquer uso futuro de `--ok`/`--warn` em TEXTO pequeno.

### 2.10 Auditoria de contraste do APP REAL — sistêmica (2026-08-05, 4ª rodada)

**Descoberta que motivou tudo:** a auditoria original da v29 ("1.086 textos,
tudo limpo", seção 27.9 do doc 05) rodou sobre os **mockups standalone**, não
sobre o app real. Auditando o app pela primeira vez, apareceram ~140 falhas
de contraste AA. Padrão único por trás de quase todas: **cores calibradas
para PREENCHER área sendo usadas como TEXTO pequeno.**

**Sistema de tokens fechado (a correção de raiz):** já existia `--accent-text`
para o pink; foram criadas as variantes que faltavam, todas em
`2026-08-03_monyu-so-agentico_tokens_v29.css`:

| Token | Tema claro | Para quê |
|---|---|---|
| `--ok-text` | `#0A7D48` | verde como texto (`--ok` puro dá 3.42:1) |
| `--warn-text` | `#7A5C00` | amarelo como texto (`--warn` dá 2.88:1) |
| `--orange-text` | `#B04A00` | laranja como texto (`--monyu-orange` dá 2.61:1) |
| `--accent-strong` | `#AB0039` | pink sobre `--accent-soft` (`--accent-text` cai para 3.97:1 sobre o rosa claro) |

No tema escuro todas apontam para a cor base (lá o fundo escuro já garante o
contraste) — assim o CSS usa **um nome só**, sem regra por tema.
**Regra a seguir daqui em diante: preenchimento usa a cor base; texto usa a
variante `-text`.**

**Aplicado em ~90 pontos**, em 4 lotes (scripts no scratchpad, resultado já
no disco): 21 usos de `color:var(--accent)` + 21 de `--monyu-pink` cru no
CSS, 17 classes de badge/chip/rótulo, 12 estilos inline no HTML/JS.
Sempre com lookbehind `(?<!-)` para **nunca** tocar em `border-color`/
`background-color`/`color-mix` — o pink de marca continua intacto em borda e
preenchimento.

**Correções pontuais na mesma rodada:** `--text-3` do tema claro
`#686868 → #5E5E5E` (passava sobre `--surface` mas caía para 4.00:1 sobre o
`--bg` cinza da página); `✓` de etapa concluída no pipeline (era branco sobre
o gradiente de marca = 3.90:1 no pink e **2.73:1** no laranja → virou verde
sobre fundo suave, que também é mais semântico); véu do badge "destaque"
(.4 → .72) e do coração de favoritar (.35 → .62) nas capas de trilha;
`#1A1A1A → #000` no ✓ do nível Bronze (4.43:1).

**Resultado medido (1.439 textos por tema, os dois temas):**
- Tema escuro: **6 falhas** restantes
- Tema claro: **11 falhas** restantes
- (eram ~140 no total antes)

**O que sobrou, e por quê — LEIA ANTES DE "CORRIGIR":**
1. **~104 casos de texto branco sobre o gradiente de marca** (`--grad-brand`,
   #FF0055 → #FF7300) — todo botão primário, `flow-here`, capas de trilha.
   Dá 3.90:1 no pink e **2.73:1 no laranja**. **Não corrigido de propósito:
   é a identidade visual central da MonyU** (definida em
   `brand/MonyU_Paleta_Cores_v1.md`), não um bug de implementação.
   Resolver exige escurecer o gradiente (muda a marca em toda a plataforma)
   — decisão do Evandro, não de quem estiver mexendo no CSS.
   Estão contados à parte no auditor (`sobreGradienteMarca`), justamente
   para não se confundirem com regressão.
2. **6 casos "20/15/10/5" a 1.78** — preço riscado dentro de botão primário;
   é o mesmo caso 1 (texto sobre o gradiente), já com branco a 75%.
3. **`Módulo em construção` (2.45), `Google Drive ✓` (3.42), `Eros` (3.98)** —
   3 pontos isolados que ainda usam cor de status/agente crua como texto;
   mesma correção dos lotes acima, ficaram para uma próxima passada.
4. **`👋` (1.00)** — emoji; falso positivo (cor própria, não herda `color`).

**O auditor de contraste está salvo como `window.__a()`** no console (medindo
composição real de camadas, gradientes com alpha, e respeitando
`aria-hidden`/`opacity` de ancestrais). Precisa de
`data-motion="reduced"` antes de rodar — senão a animação de entrada da view
deixa tudo com `opacity` baixa e o resultado vem zerado (armadilha real,
custou uma rodada inteira). Vale portar para o `_mockups/audit.html` numa
próxima sessão, para virar verificação reexecutável de verdade.

### 2.11 Auditoria funcional de Memória, Aprovações, Projetos, GigaMonyU,
Recompensas e Treinamentos (2026-08-06)

Pedido do usuário: "Auditoria funcional das telas" — verificar se as 6
telas que ainda não tinham sido auditadas nesta sessão têm bug de LÓGICA
(JS desconectado do que a tela mostra), não bug visual/contraste (isso já
foi resolvido na seção 2.10). O precedente era Oportunidades (seção 2.2),
onde a tela parecia redesenhada mas o motor de recomendação usava a versão
simplificada antiga.

**Método**: para cada tela, (1) leitura cruzada HTML↔JS dos IDs/handlers
(procurando por `$('#id')` sem handler correspondente, ou elemento no HTML
sem nenhum `addEventListener`), e (2) exercício real no browser via
`javascript_tool` — clicar filtros/abas/favoritos/botões e conferir o
efeito no DOM, não só ler o código.

**Cobertura testada**:
- **Memória**: troca de pasta (Global ↔ projeto), busca, documentos
  herdados do Global aparecendo só em pastas de projeto (o `#kbInhList`
  vazio visto numa auditoria geral anterior era falso alarme — só
  preenche fora da pasta Global, por design), excluir documento,
  mover documento de pasta.
- **Central de Aprovações**: contagem de linhas, "Selecionar todas":
  liga/desliga todas as checkboxes e recalcula total de fichas.
- **Meus Projetos**: filtro por status (`Todos/Em andamento/Submetidos/
  Rascunhos`) esconde/mostra os cards certos.
- **GigaMonyU**: grid de prestadores (8), filtro por categoria via chip E
  via card de necessidade (`data-gfilter`), fluxo de "Solicitar conexão"
  (some o botão, CONNSENT persiste no re-render).
- **Recompensas**: `#rwBody` renderiza (hero de nível/XP + 17 blocos).
- **Treinamentos**: catálogo (9 trilhas), filtro por categoria (recorta
  para grid plano sem cabeçalho de seção — comportamento correto, não
  bug), busca por nome, favoritar (♡→♥, `aria-pressed`) e aba "Minha
  lista" refletindo exatamente os favoritados.

**Resultado: nenhum bug funcional real encontrado.** Duas suspeitas
levantadas durante o teste se mostraram falsos positivos do próprio
método de teste (leitura de `aria-pressed` num nó DOM já substituído pelo
re-render — não um bug do app) e foram descartadas após reteste com
seletor fresco. `read_console_messages` sem erros em nenhuma das 6 telas.

**Achado incidental (não corrigido, baixa prioridade)**: `#aprovPromoTag`
é referenciado em `refreshAprov()` (`app_v29.js`, função em torno da linha
1603) mas esse ID não existe em `app_v29.html` — código morto guardado por
`if(pt)`, sem efeito visível, sem crash. Remover na próxima limpeza de
código, não é urgente.

### 2.12 Gradiente de marca escurecido para passar AA (2026-08-06)

Decisão do Evandro sobre o item pendente da seção 2.10: **opção 1 —
escurecer o gradiente**. Antes de decidir, montei um artifact com 2
exemplos reais (réplica exata das classes `.btn-primary` e `.flow-here`)
mostrando o problema — publicado, não fica salvo neste repo.

**Números (fórmula de luminância relativa WCAG 2.1, branco #FFF por cima):**

| | antes (`#FF0055→#FF7300`) | depois (`#DE004A→#B85300`) |
|---|---|---|
| ponta pink | 3.92:1 | 4.99:1 |
| ponta laranja | 2.72:1 | 4.91:1 |
| meio do trajeto | ~3.3:1 (estimado) | 5.40:1 |

Todo o trajeto do gradiente agora fica **acima de 4.5:1** (com margem —
o pior ponto medido ficou em 4.91:1, não bem em cima do limite). Os tons
novos preservam o mesmo ângulo (135deg) e a mesma relação de matiz
pink→laranja, só escurecidos — mesmo método (`fix_*`) de raciocínio das
seções 2.10/2.11: ver comentário no próprio token em
`2026-08-03_monyu-so-agentico_tokens_v29.css`, linha do `--grad-brand`.

**O que muda visualmente**: `--grad-brand` é token único em `:root`
(não por tema), então a mudança vale igual em claro e escuro. Afeta TODO
uso do gradiente — não só os ~104 casos de texto branco que motivaram a
decisão, mas também usos puramente decorativos que já passavam AA antes
(ex. `.hero h1 em`, texto com gradiente via `background-clip:text`, cujo
contraste é contra o `--bg` da página, não contra branco) — esses ficam
com a marca visualmente mais "queimada"/menos vibrante como efeito
colateral aceito da decisão, não um problema à parte.

**Arquivos alterados**: `tokens_v29.css` (o token) e `app_v29.html`
(`?v=6` no `<link>` dos tokens). Nenhuma mudança em `app_v29.css` ou
`app_v29.js` — o gradiente era 100% resolvido no token, nenhuma classe
tinha a cor hardcoded fora dele.

**Verificado**: computado `getComputedStyle` nas duas pontas + meio do
gradiente real renderizado (não só nos hex do token) em `.btn-primary` e
`.flow-here`; consistente nos dois temas; sem erros de console.
**Não rodei o auditor de contraste completo (`window.__a()`) de novo**
para recontar os ~104 casos após a mudança — os 3 pontos calculados
cobrem o pior caso teórico do gradiente (as duas pontas + o meio), então
matematicamente qualquer uso de `--grad-brand` com texto branco por cima
já passa; mas se quiser o número exato de "quantos dos 104 ainda
reprovam" (deveria ser 0), rodar o auditor é o próximo passo mecânico.

### 2.13 Revisão completa da tela de login (`index.html`) (2026-08-06)

Pedido do usuário via skill `frontend-design`: "revisar por completo essa
tela principal também" (a tela de login, fora do app propriamente dito).
Cobertura: contraste AA nos dois temas (todo texto do painel de marca e do
card de login, ponto a ponto via `getComputedStyle` + fórmula WCAG),
responsivo (375px mobile, sem scroll horizontal, alvo de toque dos botões
sociais 71×46px), e revisão funcional (tema, envio do form, botões
sociais, "esqueci senha", cadastro, links de demo — todos via
`javascript_tool`, não só leitura de código).

**3 bugs reais corrigidos:**

1. **Ícone da Apple invisível no tema claro.** O SVG tinha `fill="#fff"`
   hardcoded — em fundo escuro (tema escuro, `.soc` = `#1A1A1A`) ficava
   visível por acidente, mas em tema claro `.soc` = `#FFF` (branco sobre
   branco, contraste 1:1, ícone via desaparecido). Os outros 3 ícones
   (Google/Meta/Microsoft) usam cores de marca fixas e multicoloridas, por
   isso nunca tiveram esse problema. Corrigido: `fill="currentColor"` no
   SVG + `color:var(--text)` na regra `.soc` — passa a inverter com o
   tema, do jeito que o padrão de marca da própria Apple pede (glifo claro
   em botão escuro, escuro em botão claro). Verificado nos dois temas.
2. **No mobile, o form de login vinha depois de ~1,4 tela de discurso de
   marca.** `.brand` (logo + headline + 6 bullets + prova social + rodapé)
   mede 1107px de altura em 375×812 — quem já tem conta e só quer entrar
   tinha que rolar mais de uma tela inteira antes de ver o campo de
   e-mail. Corrigido com `.login{order:-1}` dentro do breakpoint de 900px
   (grid item, não mexe na ordem do HTML/DOM — leitor de tela continua
   linear marca→login, só a ordem visual muda). Verificado: `.login` no
   topo (`top:0`) em 375px depois da mudança.
3. **Toast sem `aria-live`.** O app (`app_v29.html`) já usa
   `role="status" aria-live="polite"` no toast; o login tinha só
   `<div class="toast" id="toast">`, então leitor de tela não anunciava
   "Entrando…", erros de social login simulado etc. Alinhado ao padrão do
   app.

**1 falso positivo descartado (documentado para não repetir o susto):**
ao medir contraste do headline/`.card h1` logo após clicar o toggle de
tema via JS, ambos vinham como praticamente invisíveis (~1:1). Não é bug:
`body{transition:color .25s}` só reflete a interpolação real quando o
navegador está de fato compondo frames — e como a aba do Browser pane não
estava exibida nesta sessão (mesmo erro documentado no `computer` tool:
"the page is not compositing frames"), a transição ficava congelada no
valor anterior quando lida via `getComputedStyle` logo em seguida.
Confirmado como artefato de teste (não bug real) recarregando a página do
zero já com o tema salvo em `localStorage` — sem transição envolvida, cor
correta desde o primeiro paint. **Lição**: ao auditar contraste após uma
troca de tema *via clique/JS* (não reload), ou aguardar bem mais que a
duração da transição, ou preferir setar o tema por `localStorage` +
reload, que não depende de compositing.

**Não alterado, ficou como sugestão** (fora do pedido de "revisar", não é
bug): campo de senha sem botão de mostrar/ocultar — padrão comum hoje,
mas é feature nova, não correção.

### 2.14 Login — redesign de layout/conteúdo/CTAs (2026-08-06, mesmo dia)

Depois da revisão de bugs (2.13), o usuário pediu revisão completa de
layout — "não estou feliz com o layout todo", textos pequenos. Diagnóstico
antes de mexer: escala tipográfica conservadora demais pra uma tela sem
quase nada de conteúdo pra caber (labels/inputs/legendas na faixa de
11-13px), lista de 6 diferenciais em coluna única virando parede de texto,
pilha de CTAs com peso visual quase igual (Entrar → divisor+4 sociais →
link de cadastro → **2** botões cheios de demo empilhados → LGPD) disputando
atenção, e inversão de hierarquia (tagline do painel de marca, 28px, maior
que "Bem-vindo de volta", 22px — do lado que existe pra logar, não pra
vender). Mantida a identidade "Editorial Premium Escuro" já usada no resto
do app — isto é refinamento de execução, não uma direção estética nova.

**Mudanças:**
- **Escala tipográfica geral pra cima**: inputs e texto de apoio foram de
  ~13.4px para 16px; `.card h1` de 22px→28px (agora maior que a tagline do
  painel de marca, hierarquia corrigida pro lado certo); `.proof b`
  (números de prova social) de 20px→22px; rótulos/checkbox/link
  "Esqueci senha" de ~13.4px→14.7px.
- **Lista de diferenciais virou grid 2 colunas** (`.values`) em telas
  ≥900px — lê como conjunto de features, não lista rolando; ícone um
  pouco maior (26px→30px) e o texto em negrito de cada item ganhou cor
  `--text` própria (antes herdava `--text-2`, texto de apoio, mesmo peso
  do resto da frase). Em mobile volta a 1 coluna (adicionado à media
  query de 900px que já existia).
- **CTAs de demo consolidados**: os 2 botões cheios empilhados
  ("Explorar em modo demonstração" / "Explorar como conta nova") viraram
  1 bloco com rótulo "PREFERE SÓ OLHAR PRIMEIRO?" + 1 botão real
  (`.demo-link`) + 1 link de texto discreto abaixo (`.demo-alt`, "ou
  comece do zero, como conta nova →") — mesmos 2 destinos/hrefs de antes,
  só sem competir em peso visual com "Entrar na plataforma" (que também
  ganhou padding/fonte maiores). Separado do resto do card por
  `border-top`, como uma seção própria.
- Contraste reconferido nos dois temas após as mudanças de tamanho
  (`.demo-link`/`.demo-alt`/`.values li`/etc.) — tudo ≥5.5:1, folgado.
  Testado também 375px (mobile): grid de diferenciais cai pra 1 coluna,
  sem overflow horizontal, form de login continua primeiro (`order:-1` da
  seção 2.13 preservado).
- Funcional: form submit (toast + redirect pro app), os 2 hrefs de demo,
  toggle de tema — todos reconferidos depois do redesign, sem regressão.

Nenhuma mudança de arquitetura (mesmo grid 2 colunas brand/login, mesmos
tokens compartilhados, mesmo JS) — só CSS + reestruturação de markup do
bloco de demo-links.

### 2.15 Login — assinatura desatualizada + gradiente na headline (2026-08-06)

Dois ajustes pontuais pedidos pelo usuário logo depois do redesign (2.14):

1. **Assinatura do logo ainda dizia "SO Agêntico".** A decisão de trocar
   por "Inovação financiada" já estava registrada (doc 05, seção 27.7 —
   "'agêntico' descreve a arquitetura, não o resultado") e já tinha sido
   aplicada no app (`.logo-name small` em `app_v29.html`, linha ~168) —
   só o login (`index.html`, `.b-logo small`) ficou pra trás. Corrigido
   pra ficar igual ao app.
2. **Gradiente da headline agora cobre a frase toda.** Antes só "Sistema
   Operacional Agêntico" (dentro do `<em>`) tinha o gradiente de marca;
   "Full-Service" ficava em texto normal fora do `<em>`. Movido o
   fechamento do `<em>` pra depois de "Full-Service" — mesmo CSS
   (`.tagline em`), sem token novo.

Ambos só em `index.html`. Verificado: assinatura mostra "Inovação
financiada", `<em>` contém a frase completa com o gradiente escurecido
(seção 2.12) aplicado, sem erros de console.

### 2.16 Login — "11 agentes" desatualizado + travessão vira hífen (2026-08-06)

Usuário apontou que a frase de apoio da headline ("Uma equipe de 11
agentes de IA...") estava com número errado e pediu pra não usar mais
travessão (—), só hífen (-).

**Contagem real conferida na fonte de verdade** (`AGD`, o array que
alimenta a grade "Meus Agentes" em `app_v29.js`, linha ~2206): **14
agentes**, não 11 — rico, aurora, romeu, mike, iris, kai, barto, eros,
ada, carlito, banca, laura, clara, rui. A própria tela "Meus Agentes" já
está correta (`page-sub`: "6 ativos, 8 a caminho" = 6+8 = 14) — só a
`.tagsub` do login ficou pra trás, hardcoded em 11 desde antes do catálogo
crescer com Romeu, Laura e Rui. Corrigido pra 14.

**Travessão → hífen**: varri `index.html` inteiro (só esse arquivo, é o
que estava em discussão) e troquei os 4 usos de "—" por "-" (`.tagsub`,
item "Autonomia sob seu comando" em `.values`, rodapé `.b-foot span`,
`.lgpd`). Confirmado no navegador: zero "—" restante em `document.body
.innerText`. **Preferência salva em memória** (não é ajuste pontual — o
usuário disse "não quero mais", tratado como regra permanente de copy
pra qualquer texto de UI/produto deste projeto daqui pra frente).

**Achado incidental, não corrigido**: `_knowledge-base/05-...ui.md`,
`06-...dev.md` e `INDEX.md` ainda dizem "11 agentes" em vários pontos
(o catálogo cresceu para 14 sem atualizar essa documentação). Fora do
pedido desta rodada (só a tela de login) — mencionar ao usuário se for
relevante revisar depois.

### 2.17 Login — reescrita de conteúdo do zero + vídeo "como funciona" (2026-08-06)

Usuário: "eu pedi pra revisar o conteúdo" — a rodada anterior (2.14)
resolveu tipografia/diagramação/CTAs, mas o conteúdo dos 6 diferenciais
continuava raso: não citava Rotinas, Resultados, Treinamentos/Recompensas,
e ainda chamava a Memória de "Conhecimento" (nome antigo). Pedido
explícito: GigaMonyU fica de fora da comunicação por enquanto (uso
estratégico reservado pro pré-lançamento) e adicionar um vídeo "como
funciona" logo no topo.

**Diferenciais: de 6 rasos para 8 reais**, cobrindo o produto inteiro
(exceto GigaMonyU, de propósito):
1. Radar 24/7 (Rico) — mantido
2. Diagnóstico antes do esforço (Íris) — mantido
3. Projeto pronto pro edital (Ada) — mantido, copy mais direta
4. **Rotinas que rodam sozinhas** — novo. "sequência automática + teto de
   fichas sob controle" também carrega a mensagem de "sem susto de custo"
   que antes vivia numa linha própria ("Custo sempre visível"), removida
   como bullet solo pra abrir espaço sem perder a garantia.
5. **Resultados sempre à vista** — novo, cobre a tela de Resultados/ROI.
6. **Aprenda e ganhe fichas** — novo, Treinamentos + Recompensas juntos
   (as duas telas se conectam pelo mesmo benefício: gerar fichas/vantagens
   usando a plataforma).
7. **Memória que nunca se perde** — renomeado de "Conhecimento próprio"
   pro nome real do produto (`view-conhecimento` mostra "Memória" desde a
   auditoria funcional, seção 2.11).
8. Autonomia sob seu comando — mantido.

Grid de 2 colunas (seção 2.14) preservado, só ganhou uma 4ª linha; delays
de animação recalibrados pra 8 itens (`nth-child(7)`/`(8)` não tinham
regra antes, ficariam sem stagger).

**Vídeo "como funciona"**: componente novo (`.video-card`), posicionado
logo depois da headline/subtítulo, antes da grade de diferenciais —
"vídeo de cara", como pedido, mas sem competir com o formulário de login
(que continua vindo primeiro no mobile, `order:-1` da seção 2.13). Card
com frame 16:9 em gradiente escuro de marca, botão de play e selo de
duração "1:30". Ao clicar, abre modal (`.video-modal` + `.video-modal-
scrim`, com fechar por ✕, clique fora ou Esc).

**Não existe arquivo de vídeo real neste piloto** — o modal abre um
estado de placeholder honesto ("O vídeo de 90 segundos está em
produção") com um CTA direto pra demo ao vivo, em vez de fingir tocar
algo ou deixar o lead num beco sem saída. Mesmo espírito do que já existe
em outros pontos do app (`data-toast="...em breve no piloto"`) e do que o
plano original da v29 já prescrevia pro vídeo de boas-vindas: "o redesign
entrega o componente de player + placeholder, não o conteúdo do vídeo."
Quando o vídeo real existir, trocar o conteúdo do `.video-modal-frame`
por um `<video>`/embed de verdade — a estrutura já está pronta pra isso.

**2 travessões extras encontrados e corrigidos** durante esta rodada
(fora do escopo direto, mas cai na regra permanente da seção 2.16): 1 no
texto do próprio modal novo que acabei de escrever, 1 no toast de login
social ("Login com Google — simulado no piloto" virou "...simulado no
piloto" com vírgula).

Verificado: 8 itens renderizando, zero "GigaMonyU"/"Giga" no texto da
página, zero "—" em `document.body.innerText`, modal abre/fecha (clique
no botão, no ✕, no scrim), contraste ok nos 2 temas (vídeo e modal
incluídos, 5.10-18.9:1), mobile sem overflow e login ainda primeiro.

### 2.18 Centralizar o número de agentes numa fonte única (2026-08-06)

Motivação do usuário: toda vez que o catálogo de agentes muda de tamanho
(11→14 nesta sessão), o número precisa ser caçado e corrigido em vários
documentos manualmente — quer evitar isso permanentemente, não só corrigir
desta vez.

**Fonte única designada**: `_knowledge-base/06-regras-e-especificacao-
dev.md`, seção 2.2 ("Tabela de referência"), já era de fato a lista real
e completa de agentes (é de onde tirei a contagem de 14 na seção 2.16) —
só faltava ser tratada formalmente como tal. Adicionei um aviso 📌 logo no
topo da seção declarando isso explicitamente, com a lista de pontos que
precisam ser conferidos quando o número mudar de novo.

**Regra daqui pra frente**: ao adicionar/remover/re-classificar um
agente, editar SÓ a tabela da seção 2.2. Em prosa, em vez de repetir o
número solto, escrever "ver contagem atual em 06 §2.2". Exceção:
menções **datadas** a estado passado (changelog, "v28 tinha N agentes")
não devem ser "corrigidas" — são registro histórico.

**3 pontos corrigidos nesta rodada** (estavam com "11", ficaram
apontando para a fonte única ou corretos com "14"):
- `INDEX.md`: resumo do doc 06 (linha ~106) e glossário de
  conceitos-chave (linha ~172).
- `06-regras-e-especificacao-dev.md` §18.3 e §18.7 (linhas ~727 e ~823):
  cobertura de skills técnicas, denominador e lista de "sem skill
  própria" atualizados (5 de 14; 9 agentes sem skill, não mais 6 — Romeu,
  Laura e Rui entraram na lista).
- **Não mexidos, de propósito** (registro histórico correto): as menções
  a "11 agentes" dentro de seções datadas do doc 05 (`## 24. v28 em
  2026-07-29`) e do próprio doc 06 (linha ~658, também sobre o v28) — são
  descrições precisas de um estado passado, mudar seria reescrever
  história.
- `INDEX.md` linha ~34 (descreve o conteúdo do dossiê estratégico em
  `PAM-RA/_knowledge-base/07-...md`, um documento fora desta pasta) —
  fora do escopo desta rodada; se esse dossiê também estiver desatualizado,
  é uma correção separada, em outra pasta.

### 2.19 Login — desalinhamento vertical entre os 2 painéis (2026-08-06)

Usuário mandou print apontando: "Bem-vindo de volta" (painel de login,
direita) flutuando bem abaixo de "MonyU" (painel de marca, esquerda) —
efeito colateral do vídeo (seção 2.17) ter deixado o painel de marca bem
mais alto. `.login` usava `align-items:center`, então o card era
centralizado na altura TOTAL da coluna (que cresceu com o vídeo),
puxando o heading pra baixo em vez de alinhar com o topo do logo.

Corrigido: `.login` trocou `align-items:center` por `flex-start`, com
`padding-top:var(--sp-12)` igual ao do `.brand` — os dois painéis agora
começam exatamente na mesma altura. Verificado via
`getBoundingClientRect`: `.b-logo` e `.card h1` ambos em `top:48px`
(diferença zero). Reconferido em mobile (login continua vindo primeiro,
sem overflow) e sem erros de console.

### 2.20 Login — card sticky, acompanha o scroll e para sozinho no limite (2026-08-06)

Usuário: já que o painel de marca ficou bem mais alto que o form, o card
de login devia rolar junto (não sumir de vista) e parar quando batesse o
limite. `.card` ganhou `position:sticky;top:var(--sp-12)` (mesmo valor do
padding-top que já alinhava os dois painéis, seção 2.19) — sem JS, é
comportamento nativo do CSS: gruda no topo enquanto rola, e solta sozinho
quando o fim de `.login` se aproxima (que estica pra bater a altura do
`.brand` no grid), nunca vazando por cima do rodapé.

Verificado por `getBoundingClientRect` simulando scroll (não por olho,
pane sem compositing nesta sessão): `top:48px` tanto em scroll 0 quanto
em scroll 400px (grudou, seguiu a rolagem), e ao rolar até o fim da
página o card solta e sai de vista normalmente, sempre dentro dos limites
de `.login` (nunca ultrapassa `loginBottom`). Mobile testado à parte: como
lá `.login` é uma seção curta própria (form only), o sticky solta logo
depois dela, sem soltar rolagem estranha.

### 2.21 Pasta reorganizada: mockups movidos pra `_mockups/` (2026-08-06)

Pedido do usuário: limpar a pasta, que tinha os ~34 arquivos de
mockup/tooling de uma fase anterior (mockups standalone por tela,
`frames-*.html` de comparação responsiva, `audit.html`, `diag.html`,
`mockup-tagline.html`) misturados soltos junto com os arquivos reais do
produto (`app_v29.*`, `index.html`).

**Conferido antes de mover** (para garantir zero risco ao piloto
funcional): nenhum arquivo real referencia qualquer mockup/frames/audit/
diag — só 2 comentários de código (`app_v29.js`, `app_v29.css`)
mencionavam nomes de mockup à toa, sem link funcional, atualizados pra
apontar `_mockups/`. `2026-08-03_monyu-so-agentico_people_v29.png` e
`_favicon.svg` SÃO referenciados pelo app/login — ficaram na raiz.

**Movidos** (todos pra `_mockups/`, via PowerShell `Move-Item`): os 34
arquivos `mockup-*.html`, `mockup-base.css`, `frames*.html`, `audit.html`
e `diag.html`. Raiz da pasta agora só tem produto real: `app_v29.{html,
css,js}`, `tokens_v29.css`, `index.html` e este handoff.

**Verificado depois de mover**: `_mockups/mockup-fichas.html` abre e
carrega `mockup-base.css?v=3` com 200 OK (path relativo entre mockups
continua válido, já que o grupo inteiro se moveu junto); `index.html` e
`app_v29.html` seguem sem erro de console. **Achado incidental, não
corrigido** (não é regressão desta mudança): os `frames-*.html` já
estavam quebrados antes, apontando pra nomes de revisão antigos que não
existem mais (`mockup-home-r4.html`, `mockup-resultados-r6.html`).

Atualizados todos os caminhos que citavam esses arquivos neste próprio
handoff (seções 2.5, 2.10, 3) e o file tree em
`_knowledge-base/05-piloto-so-agentico-ui.md` (seção 27.10/27.13).

**Melhoria extra, além do pedido**: a tela "Meus Agentes" do próprio
piloto (`app_v29.html`) tinha o mesmo problema em miniatura — "6 ativos,
8 a caminho" era texto hardcoded no HTML, seria a próxima coisa a
dessincronizar. Troquei por cálculo em tempo real a partir do catálogo
`AGD` (`app_v29.js`, logo após o render da grade de agentes): conta
quantos NÃO têm `soon:true` (ativos) vs. quantos têm (a caminho). Esse
ponto specific nunca mais precisa de edição manual, quem adicionar um
agente em `AGD` já atualiza o texto de graça. Verificado no navegador:
"6 ativos e 8 a caminho" bate com os 14 cards renderizados. De brinde,
corrigi mais um travessão que tinha nessa mesma frase (regra da seção
2.16). `app_v29.js` incrementado para `?v=14`.

## 3. Arquivos-chave e onde cada coisa vive

| O quê | Arquivo | Linhas aprox. |
|---|---|---|
| Tokens de design (`--sp-*`, `--fs-*`, `--radius-*`, cores por agente/tema) | `2026-08-03_monyu-so-agentico_tokens_v29.css` | arquivo inteiro, 95 linhas |
| Estrutura HTML do app real | `2026-08-03_monyu-so-agentico_app_v29.html` | 1906 linhas |
| Estilos do app real | `2026-08-03_monyu-so-agentico_app_v29.css` | 1482 linhas |
| Lógica do app real | `2026-08-03_monyu-so-agentico_app_v29.js` | 3905 linhas |
| Padrão de overlay full-screen a copiar (`.ws`) | `app_v29.html` linha 1735 / `app_v29.css` linha ~833 | — |
| Padrão de drawer lateral a copiar (`agDrawer`/`prDrawer`) | buscar `agDrawer=` e `prDrawer=` em `app_v29.js` | — |
| Motor de recomendação contextual (`nextBestAction`) | `app_v29.js`, buscar `function nextBestAction` | ~508 |
| Catálogo completo dos 14 agentes (nome, cor, etc.) | `app_v29.js`, buscar `var AGD=` | ~2162 |
| Dados/motor/render de Rotinas (listagem) | `app_v29.js`, linhas 3575–3698 | ver seção 2.5 |
| Motor do editor de Rotinas (Criar/Editar) | `app_v29.js`, logo após a linha 3698 (`rotEd=$('#rotEd')` até o wiring de `#rotEdSave`) | ver seção 2.5 |
| Overlay HTML do editor de Rotinas | `app_v29.html`, buscar `id="rotEd"` | — |
| CSS do editor de Rotinas | `app_v29.css`, buscar `Editor de Rotina — Criar/Editar` | final do arquivo |
| Referência visual original do editor de Rotinas | `_mockups/mockup-rotinas.html` | linhas 57–140 (CSS), 320–440 (HTML de exemplo) |
| Mapa de IDs por view ainda não portada | rodar `mapear.py` de novo (script ficou no scratchpad da sessão anterior, não versionado — recriar se necessário: fatiar `app_v29.html` por `<section class="view" id="view-X">`, comparar `id="..."` contra `getElementById`/`$(...)` do `.js`) | — |
| Regras de negócio de Rotinas (fonte normativa) | `_knowledge-base/06-regras-e-especificacao-dev.md` seção 20 | — |
| Histórico de decisões de produto/UX da v29 | `_knowledge-base/05-piloto-so-agentico-ui.md` seção 27 | — |

## 4. Próximos passos, em ordem de prioridade

**Atualizado 2026-08-06**: o item 1 desta lista estava desatualizado — as 6
telas citadas (Memória, Aprovações, Projetos, GigaMonyU, Recompensas,
Treinamentos) **já tinham o casco visual moderno** (`.hero`/`.card`/
`.section-head`) desde antes desta sessão; o que faltava verificar era se a
LÓGICA por trás (JS) estava corretamente religada — o mesmo tipo de bug
encontrado em Oportunidades na seção 2.2 (motor de recomendação
desconectado). Auditoria funcional feita em 2026-08-06, ver seção 2.11.
**Resultado: nenhum bug funcional encontrado nas 6 telas** — todas com
lógica corretamente religada (filtros, busca, favoritos, delete/move de
documentos, conexões GigaMonyU, seleção em lote de Aprovações, modo
automático, XP/Recompensas). Itens 1-3 abaixo estão portanto CONCLUÍDOS;
mantidos riscados para histórico.

1. ~~Portar Memória (`view-conhecimento`) e Central de Aprovações
   (`view-aprovacoes`)~~ — auditado 2026-08-06, sem bugs funcionais.
2. ~~Meus Projetos (`view-projetos`)~~ — auditado 2026-08-06, filtros e
   modo conta-nova/demo corretos.
3. ~~GigaMonyU, Recompensas, Treinamentos~~ — auditados 2026-08-06, sem
   bugs funcionais.
4. **Explicitamente adiado pelo Evandro (2026-08-06)**: "Começar de um
   modelo" nas Rotinas (rotinas prontas de 1 clique, regra 20.8 do doc 06)
   — decisão consciente de que o que já existe atende a necessidade atual;
   não construir sem novo pedido explícito (ver seção 2.5).
5. ~~Decisão pendente do Evandro sobre o gradiente de marca~~ — decidido
   2026-08-06: **opção 1, escurecer o gradiente**. Aplicado e verificado,
   ver seção 2.12. `#aprovPromoTag` (código morto apontado na seção 2.11)
   também já removido — nenhuma pendência aberta nesta lista no momento.

## 5. Como validar qualquer mudança nesta pasta

1. Servidor rodando em `localhost:8129` (seção 1). Se editar `.css`/`.js`,
   incrementar `?v=N` nas tags `<link>`/`<script src>` de `app_v29.html`
   (seção 1) — `?cb=` na URL de navegação sozinho não é suficiente.
2. Abrir aba **nova** ao depurar console (mensagens antigas não somem).
3. `read_console_messages` com `onlyErrors:true` depois de toda mudança.
4. Testar nos dois temas: `document.documentElement.setAttribute('data-theme','light'|'dark')`.
5. Nunca usar `cp`/`cat`/`wc -l` de terminal para copiar ou conferir arquivo
   recém-editado nesta sessão — o terminal pode enxergar uma versão
   desatualizada do arquivo (risco documentado na seção 1 do doc 05). Usar
   sempre Read/Grep.
