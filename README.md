# ABISMO • DungeonS

> Desce. Sobrevive. Conquista.

Um dungeon crawler de fantasia sombria, construído para funcionar no browser, em desktop e Android. Sem conta, sem backend e sem instalação.

## Jogar

**GitHub Pages:** https://pulsebreakpt.github.io/DungeonS/

Escolhe Guardião, Arcanista ou Ladino. Explora dez salas, combate criaturas, utiliza habilidades, apanha ouro e enfrenta o Guardião do Limiar. O botão "Laboratório v0.1" inicia um teste com o Guardião vs. Rato Ósseo e R=17, para verificar as contas do combate.

## Motor determinístico

A rolagem seguinte depende da anterior:

\`\`\`txt
R' = (21 × R + 17) mod 100
rolagem = R' + 1
\`\`\`

- Acerto: 80 + 2 × (AGI atacante − AGI defensor), limitado a 60–95%.
- Crítico: 5 + AGI, limitado a 5–20% (Ataque Furtivo tem +10 p.p., limite 30%).
- Dano: max(1, floor(dano-base × multiplicador crítico) − armadura).
- Guardar, exportar JSON, importar JSON e copiar checkpoint através do separador **Crónica**.
- Progressão de nível 1 a 10, pontos de atributo nos níveis pares.
- Combate um contra um e comportamento de inimigos definido por turno.

## Estrutura

- \`index.html\` — estrutura da página.
- \`style.css\` — interface dark-fantasy responsiva.
- \`game.js\` — regras, gestão de estado, renderização e persistência.
- \`assets/sigil.svg\` — ícone vetorial.
- \`.github/workflows/pages.yml\` — deploy do site estático no GitHub Pages.

## Guardar / continuar

Os saves são guardados **localmente** no browser (\`localStorage\`). Não sincronizam entre dispositivos. Para transferir um jogo, abre **Crónica → Exportar save** e importa o JSON no outro dispositivo.

## Publicação

O workflow usa \`actions/deploy-pages\`. Se a publicação não iniciar, abre **Settings → Pages → Build and deployment** e escolhe **GitHub Actions** como origem.

## Limites da versão 0.1

Uma rota de dez salas, 3 classes, 4 tipos de inimigo (incluindo boss), escolhas em salas especiais e sistema de equipamento base. Sem conta online, multiplayer, sincronização na nuvem ou IA generativa executada no browser. Os encontros seguem regras determinísticas; narrativa e lógica são implementadas localmente em JavaScript.

## Licença

Projeto original para desenvolvimento e experimentação.
