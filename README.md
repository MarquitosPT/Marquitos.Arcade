# Marquitos.Arcade
Coleção de jogos casuais online desenvolvidos nos GameStudios do MarquitosPT compilados numa Arcada.

## Estrutura inicial

- `index.html`: portal principal com branding, catálogo de jogos em scroll horizontal e dashboard de pontuações dinâmico.
- `games/tasca-do-ze/`: mini-jogo jogável com registo de score.
- `games/pong/`: versão retro jogável de Pong com registo de score.

As pontuações são persistidas em `localStorage` com a chave `marquitosArcadeScores` e alimentam o dashboard da página principal.
