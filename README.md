# Barbie Movies Tracker

Site pra acompanhar quais filmes da Barbie você já assistiu, dar nota de 1 a 5 estrelas pra cada um e ver seu progresso. Os dados dos filmes (título, ano, poster) vêm da TMDB (The Movie Database) via API, então a lista fica sempre atualizada sem precisar editar código toda vez que sai um filme novo.

Site no ar: https://selecionar-filme-da-barbie.vercel.app/

## O que dá pra fazer

Tem três jeitos de entrar: só digitando um nome (modo visitante, progresso salvo no navegador), com a conta Google ou com email e senha, esses dois últimos salvam o progresso na nuvem e sincronizam entre aparelhos.

A coleção fica numa grade com pôster, checkbox de "assistido" e 5 estrelas pra nota. Assim que um filme fica marcado como assistido e com nota, ele some da grade principal e passa a aparecer numa lista separada na aba Perfil, junto com o total de filmes assistidos e a nota média.

## Layout de app de celular

A tela fica numa faixa central com largura de celular, com cabeçalho fixo no topo e um menu fixo embaixo com duas abas, Coleção e Perfil. Isso vale tanto no celular (a faixa já ocupa a tela toda) quanto no computador (ela fica centralizada, com uma sombra ao redor, pra dar a mesma sensação de app). Os filtros (ano, ordenação, somente não assistidos) ficam num painel que sobe de baixo ao tocar no botão de engrenagem do lado da busca, e atualizar a lista da TMDB é um botão flutuante no canto inferior direito.

## Tecnologias

Por baixo do capô é só JS puro, sem framework: módulos ES nativos do navegador (`import`/`export`), carregados direto pelo `<script type="module">`. A lógica principal (progresso, filtros, notas, normalização dos dados da TMDB, persistência local) fica em funções puras separadas do código que mexe no DOM, então dá pra testar sem precisar simular um navegador inteiro. É isso que os testes com `node --test` (o test runner que já vem com o Node, sem precisar de biblioteca extra) cobrem: cálculo de progresso, filtros, ordenação, validação de nota e a separação entre filmes ativos e concluídos.

O login com Google e email/senha e o progresso salvo na nuvem usam Firebase (Authentication + Firestore): um documento por usuário, na coleção `progress`. Os dados dos filmes vêm da TMDB API; como não existe uma collection única reunindo todos os filmes da Barbie lá, a busca é por texto no endpoint normal de filmes, filtrando pelo título.

O deploy é na Vercel. O `npm run build` gera o `js/config.js` a partir das variáveis de ambiente (assim a chave da TMDB e o config do Firebase não ficam expostos no repositório), troca id/class do HTML/CSS/JS publicados por nomes curtos e minifica tudo com `terser`/`clean-css`. É cosmético: só deixa o código um pouco mais chato de ler no F12. O repositório continua com os nomes e a formatação de verdade.

## Estrutura do projeto

```
index.html                pagina unica
css/styles.css             estilos
js/
  progress.js               calculo de progresso assistido/total
  filters.js                 busca, filtro por ano/nao-assistido, ordenacao, separa assistido+avaliado
  ratings.js                  validacao de nota e media
  tmdb.js                       busca e normalizacao dos filmes na TMDB
  storage-local.js               persistencia do modo visitante (localStorage)
  firebase-app.js                 autenticacao (Google e email/senha) e persistencia no Firestore
  main.js                          liga tudo isso na pagina (DOM)
  config.example.js                 modelo de config (copiar pra config.js)
scripts/
  generate-config.js         gera js/config.js a partir de variaveis de ambiente (roda no build da Vercel)
  mangle-names.js              troca id/class por nomes curtos na copia publicada (roda no build da Vercel)
  minify.js                      minifica o JS/CSS publicado (roda no build da Vercel)
vercel.json                build command e pasta de publicacao pra Vercel
tests/                     testes automatizados (Node --test), um arquivo por modulo
```
