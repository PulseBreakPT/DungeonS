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