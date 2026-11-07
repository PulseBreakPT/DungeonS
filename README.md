# METRÓPOLE · City Builder

Um simulador de construção e gestão de cidades isométrico, desenvolvido em HTML, CSS e JavaScript para funcionar em Android e desktop, diretamente no browser. Este projeto transforma o antigo **DungeonS / ABISMO** num jogo de planeamento urbano inspirado no género de *Cities: Skylines*. É um protótipo independente, não uma cópia do jogo original.

**Jogar:** https://pulsebreakpt.github.io/DungeonS/

## O que já é jogável

- Terreno isométrico de **36 × 36** células, lago, vegetação, edifícios com alturas diferentes e veículos animados.
- Construção e demolição de estradas, zonas residenciais, comerciais e industriais.
- Edifícios residenciais e empresas a desenvolverem-se em 3 níveis conforme procura, acesso e condições da cidade.
- Central elétrica, estação de água, bombeiros, polícia, escola, hospital e parques.
- Simulação mensal de população, emprego, desemprego, felicidade, valor de terreno, poluição simplificada, capacidade de água e energia.
- Economia com receitas fiscais, manutenção, saldo mensal e impostos de 4% a 20%.
- Controlo da velocidade, pausa, zoom, movimento da câmara, construção por arrastamento e desfazer.
- Save automático em `localStorage`, exportação e importação JSON e captura PNG.
- Painel financeiro, eventos e recompensas por marcos de população.
- Interface responsiva para ecrãs pequenos e grandes, com controlos táteis e pinch-to-zoom.

## Como jogar

Escolhe **Estradas** e liga novas vias à cidade. Seleciona **Residencial**, **Comércio** e **Indústria** e pinta os terrenos adjacentes às estradas. Deixa os meses passar para os edifícios se desenvolverem. Acompanha a procura de zonas, o abastecimento de energia e água, os empregos e a felicidade. Acrescenta serviços perto dos bairros e ajusta impostos se necessário.

No Android: desliza a barra de ferramentas na parte inferior; arrasta para pintar várias células. Seleciona **Explorar** para deslocar o mapa. Faz zoom com dois dedos ou com os botões `+` e `−`.

No computador: roda do rato para zoom, arrasta no modo Explorar para mover o mapa, teclas `1` a `9` para ferramentas, `Espaço` para pausa e `Ctrl+Z` para desfazer.

## Tecnologia e estrutura

| Ficheiro | Função |
|---|---|
| `index.html` | Interface e layout |
| `style.css` | Interface desktop e mobile |
| `engine.js` | Motor puro e determinístico da cidade, orçamento e regras |
| `game.js` | Desenho isométrico, eventos, UI e persistência |
| `tests/smoke.cjs` | Testes sem dependências externas |
| `.github/workflows/pages.yml` | Validação e publicação automática no GitHub Pages |

### Verificar o jogo

```bash
node --check engine.js
node --check game.js
node tests/smoke.cjs
node tests/ui-smoke.cjs
```

Basta servir esta pasta com um servidor de ficheiros estáticos. Não precisa de NPM, Vite, motor 3D, backend ou base de dados.

## Limites atuais

Este é um **primeiro protótipo jogável**, não um Cities: Skylines completo. O mapa é isométrico 2D, não 3D livre. O tráfego é visual com um índice simplificado, não tem rotas reais por habitante; energia e água usam capacidade municipal global quando as instalações estão ligadas à rede rodoviária; não inclui esgotos, transportes coletivos, cadeias logísticas, desastres, ruas curvas, ferramentas de terreno ou simulação por agente. Estes seriam passos seguintes.

Os saves são locais em cada browser. Exporta o JSON se quiseres mudar de dispositivo. O jogo não recolhe dados pessoais nem depende de APIs.

## Licença

Projeto original experimental. Não afiliado à Colossal Order nem à Paradox Interactive.


## Visual SSS (v2)

- Interface redesenhada com identidade verde-lima, ferramentas vetoriais e painéis translúcidos.
- Mundo isométrico com fachadas, telhados, árvores, estradas e veículos com mais detalhe.
- Minimapa interativo para saltar entre zonas da cidade (desktop).
- Camadas **Cidade**, **Zonas** e **Trânsito**, sem alterar a simulação existente.
- Interface adaptada a ecrãs Android, incluindo barra horizontal de construção, controlos e painel de métricas recolhível.
- Design com indicadores de crescimento, capacidade dos serviços e saúde urbana.

Todos os gráficos do mundo são desenhados localmente com Canvas 2D, sem motor 3D externo.

## Director Edition — SSS+ (novembro de 2026)

A interface foi redesenhada para privilegiar o mapa e a jogabilidade:

- HUD cinematográfica com barra superior compacta, ferramentas recolhíveis e relatório municipal opcional.
- Ferramentas separadas por categorias, modo de construção contextual com preço, pré-visualização de terreno válido/inválido e possibilidade de sair rapidamente da ferramenta.
- Vistas de cidade, zonamento e trânsito, minimapa no desktop e inspetor de parcela.
- Iluminação selecionável entre **dia, crepúsculo e noite**, com janelas iluminadas à noite e nomes dos setores desenhados sobre o mapa no desktop.
- Indicador de próxima decisão derivado dos dados reais do motor e apresentação especial dos marcos de população existentes (500 e 1 000 habitantes).
- Controlos Android reorganizados com gaveta de construção, interface adaptativa e acessibilidade de botões.
- Sem frameworks nem serviços pagos. Todos os saves do formato `dungeons-metropole-v1` continuam válidos.

**Testes:** `node tests/smoke.cjs` e `node tests/ui-smoke.cjs`.


## METRÓPOLE P0 — Mobilidade, cidadãos, redes e economia (novembro de 2026)

A versão P0 acrescenta `p0.js` (carregado depois de `engine.js` e antes de `game.js`):

- **Rotas reais** por ruas usando Dijkstra com pesos de velocidade e regras direcionais para vias de sentido único. As rotas calculadas alimentam os veículos animados e o mapa de congestionamento por parcela.
- **Habitantes simulados** com nome, idade, casa, emprego, rendimento, satisfação e tempo de deslocação. Simula até **480 cidadãos representativos**, para proteger a performance no Android. A população total continua calculada por capacidade residencial; não existe ainda um simulador completo da vida individual de cada cidadão.
- **Logística básica**: percursos de entrega entre fábricas e comércio, com indicador de entregas realizadas. Não existe stock persistente nem mercado externo detalhado.
- **Tipos de rua**: estrada local, avenida, via rápida, sentido único com orientação ajustável (botão "Rodar direção" ou tecla R) e pontes nas células aquáticas. É possível converter ruas existentes pagando a diferença mínima de custo; sentido único afeta efetivamente as rotas.
- **Redes por componentes** de distribuição elétrica e água/esgotos, com estradas como corredores técnicos e extensões por linhas elétricas e condutas. Zonas desconectadas podem ficar sem serviços; as estações de tratamento de esgotos têm capacidade separada.
- **Finanças avançadas**: taxas residenciais/comerciais/industriais, salários e bem-estar simplificados, custos de estradas e infraestruturas, entregas, dívida, juros, amortizações, histórico de 48 meses.
- **Vistas** de energia e água, além de trânsito e zonamento; painel de habitantes e deslocações; novos indicadores de esgotos e mobilidade no relatório urbano.

### Compatibilidade

Os saves antigos com chave `dungeons-metropole-v1` e `version:1` continuam aceites: `E.migrate` acrescenta os novos campos `p0`, sem mexer nas células e no dinheiro. Para evitar uma quebra súbita em cidades antigas, a contratação externa de tratamento de esgotos fornece capacidade de transição (com custo mensal) enquanto não for instalada uma estação. As cidades novas têm estação de tratamento inicial.

A ferramenta **Demolir** remove também linhas, condutas e pontes. A importação JSON valida a versão e aplica a migração automaticamente. Exporta uma cópia de segurança antes de importares ou criares uma nova cidade.

### Testes P0

```bash
node --check engine.js
node --check p0.js
node --check game.js
node tests/smoke.cjs
node tests/p0.cjs
node tests/ui-smoke.cjs
```

**Limites honestos:** o tráfego é modelado por viagens de trabalho e entregas agregadas por mês, não por cada veículo com colisões ou semáforos; os cidadãos são uma amostra com rotina casa-trabalho, não uma simulação social contínua; as redes usam corredores e conectividade discretizada por parcela; as estradas continuam numa grelha isométrica sem curvas livres, viadutos a vários níveis ou nós complexos. São sistemas funcionais de uma **primeira fase**, não equivalentes à profundidade de Cities: Skylines.

## P0.1 — Estabilidade, saves e testes de regressão (novembro de 2026)

Esta fase consolida o motor P0 sem alterar a versão do ficheiro de cidade (`version: 1`) nem a chave de armazenamento `dungeons-metropole-v1`.

- `CityEngine.analyze()` deixa de substituir os cidadãos no estado persistente durante simples leituras. O snapshot com os percursos é atualizado uma vez por mês em `tick()`.
- A construção por arrastamento interpola as parcelas atravessadas (evitando falhas quando o ponteiro se move depressa), atualiza os indicadores e guarda apenas no fim de cada gesto.
- Cada gesto de construção é desfeito como uma só ação; o desfazer incrementa a revisão da rede para invalidar trajetos em cache.
- Ao importar um save ou criar uma cidade nova, o save anterior é copiado para `dungeons-metropole-v1-backup` no mesmo browser, quando existir espaço disponível. Isto não substitui a exportação manual.
- A importação rejeita ficheiros acima de 5 MB e saves incompatíveis ou com campos inválidos, mantendo compatibilidade com cidades v1 válidas.
- O desenho procura atingir 30 FPS no mobile e 60 FPS no desktop (limites de atualização, não garantias de desempenho).

Verificação local, sem dependências externas:

```bash
node --check engine.js
node --check p0.js
node --check game.js
node tests/smoke.cjs
node tests/p0.cjs
node tests/p01.cjs
node tests/ui-smoke.cjs
```

O workflow `p01-ci.yml` executa os testes em branches de manutenção e pull requests. `pages.yml` exige a mesma suite antes de publicar a `main`. A validação automatizada não substitui testes manuais de desempenho em Android.


## Motor gráfico P2 — Renderização isométrica 3D (novembro de 2026)

Foi introduzido um **renderer WebGL/Three.js progressivo**, separado da simulação e dos saves existentes.

- `graphics-model.js`: gera geometria visual determinística, sem alterar a cidade. Constrói terreno, água, estradas, marcas de circulação, edifícios com volume, janelas, telhados, serviços municipais, árvores e candeeiros.
- `graphics3d.mjs`: converte a descrição em **InstancedMesh** para evitar milhares de draw calls. Usa câmara ortográfica calibrada para os mesmos pontos de construção do Canvas original, iluminação de dia/crepúsculo/noite, materiais diferentes, animação simples da água e veículos com percurso real.
- `game.js`: liga o novo renderer às ferramentas de construção, zoom, câmara, camadas do mapa e captura PNG. A ação **3D/2D** permite alternar entre os dois motores sem perder a cidade.
- A qualidade gráfica adapta-se ao dispositivo: menos geometria de janelas e árvores em ecrãs pequenos, resolução interna limitada pela densidade de pixels. Não existem ainda benchmarks de FPS para todos os Android.
- `graphics3d.mjs` importa **Three.js 0.186.1** de um CDN fixo. **O primeiro acesso ao modo 3D exige ligação à internet e suporte WebGL**. Se o CDN, WebGL ou renderer falhar, o Canvas 2D anterior mantém o jogo utilizável; os saves continuam inteiramente locais.
- Não foram introduzidas alterações no motor económico, na migração de saves, nas regras de construção ou na chave `dungeons-metropole-v1`.

### Testes do motor gráfico

```bash
node --check graphics-model.js
node --check graphics3d.mjs
node tests/graphics.cjs
```

A suite `tests/graphics.cjs` valida os objetos gerados, os níveis de detalhe, sobreposições e determinismo. O workflow `graphics-ci.yml` executa também os testes existentes e um teste de browser Chromium com screenshot guardado nos artefactos do GitHub Actions. Para executar manualmente este teste, instala `playwright-core` e fornece o caminho do navegador na variável `CHROME_BIN`.

**Limitações conhecidas:** a câmara continua com orientação isométrica fixa para manter a correspondência com os controlos; não existem sombras dinâmicas por GPU, reflexos físicos, modo livre de câmara nem terreno com altura editável. O 3D é um salto visual e de arquitetura, não um motor completo de cidades com ruas curvas ou objetos 3D detalhados importados.
