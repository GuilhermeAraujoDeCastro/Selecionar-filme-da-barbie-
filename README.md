# Barbie Movies Tracker

Site pra acompanhar quais filmes da Barbie você já assistiu, dar nota de 1 a 5 estrelas pra cada um e ver seu progresso. Os dados dos filmes (título, ano, poster) vêm da TMDB (The Movie Database) via API, então a lista fica sempre atualizada sem precisar editar código toda vez que sai um filme novo.

Dá pra usar de dois jeitos: só digitando um nome (modo visitante, progresso salvo no navegador) ou entrando com a conta Google (progresso salvo na nuvem via Firebase, sincroniza entre aparelhos).

## Layout de app de celular

A tela fica numa faixa central com largura de celular (480px), com cabeçalho fixo no topo e um menu fixo embaixo com duas abas, Coleção e Perfil, em vez do layout de site largo que o projeto tinha antes. Isso vale tanto no celular (onde a faixa já ocupa a tela toda) quanto no computador (onde ela fica centralizada, com uma sombra ao redor, para dar a mesma sensação de app). Os filtros (ano, ordenação, somente não assistidos) saíram da barra de ferramentas e viraram um painel que sobe de baixo (bottom sheet) ao tocar no botão de engrenagem ao lado da busca, e o botão de atualizar a lista da TMDB virou um botão flutuante circular no canto inferior direito. Isso é só CSS/HTML/JS, não é um app instalável (sem ícone na tela inicial nem funcionamento offline).

## Por que não existe uma "collection" da Barbie na TMDB

Antes de escrever o `js/tmdb.js` eu procurei um jeito de buscar os filmes por um ID de collection fixo, que seria mais direto. Só que a TMDB não tem uma collection única reunindo todos os filmes: existem várias fragmentadas (Barbie Collection, Barbie Fairytopia Collection, Barbie Mariposa Collection, entre outras), cada uma cobrindo só uma sub-série. Por isso o `searchBarbieMovies` busca por texto ("Barbie") no endpoint de busca normal de filmes e filtra o resultado pelo título, com uma trava de segurança de no máximo 5 páginas.

## Como rodar

1. Instale as dependências de teste (o site em si não usa nenhuma biblioteca, isso é só pro `npm test`):
   ```
   npm install
   ```
   (Não tem nenhuma dependência real pra instalar, mas roda o comando mesmo assim caso o npm crie o `package-lock.json`.)

2. Copie `js/config.example.js` pra `js/config.js` e preencha:
   - `TMDB_API_KEY`: crie de graça em https://www.themoviedb.org (Configurações > API > API Key v3).
   - `FIREBASE_CONFIG`: só precisa se quiser o login com Google. Sem isso configurado, o botão "Entrar com Google" fica desabilitado e o modo visitante funciona normalmente.

   (Isso já está feito localmente: o `js/config.js` já existe com a chave da TMDB e o Firebase config reais, criados em 10/09/2026. Esse passo só volta a valer se você recriar o projeto do zero ou trocar de chave.)

3. Como o `main.js` usa módulos ES (`import`), abrir o `index.html` direto no navegador (com `file://`) não funciona, o navegador bloqueia isso. Precisa servir os arquivos por HTTP. Qualquer servidor estático simples resolve, por exemplo:
   ```
   npx serve .
   ```
   ou, se tiver Python instalado:
   ```
   python3 -m http.server 8000
   ```
   Depois abre `http://localhost:8000` (ou a porta que o `serve` mostrar).

## Configurando o login com Google (opcional)

1. Crie um projeto de graça em https://console.firebase.google.com.
2. Em Build > Authentication > Sign-in method, ative o provedor "Google".
3. Em Build > Firestore Database, crie o banco.
4. Em Configurações do projeto > Geral > Seus apps, crie um "app da Web" e copia o objeto de config gerado pro `FIREBASE_CONFIG` do seu `js/config.js`.
5. Quando for publicar o site na Vercel, volta em Authentication > Settings > Authorized domains e adiciona o domínio publicado. Sem isso o login com Google funciona no localhost mas falha no site publicado.

## Rodando os testes

```
npm test
```

36 testes, todos passando, cobrindo cálculo de progresso, filtros e ordenação, validação de nota, normalização dos dados da TMDB (com paginação e trava de segurança simuladas) e o modo visitante (salvar, carregar, trocar de perfil, recuperar de um JSON corrompido no localStorage).

## O que eu consegui testar e o que eu não consegui

Os módulos com a lógica principal (`progress.js`, `filters.js`, `ratings.js`, `tmdb.js`, `storage-local.js`) são funções puras, sem tocar em DOM nem em rede de verdade, então dá pra testar sem depender de nada externo. Isso eu testei de verdade: os 36 testes acima rodam e passam.

O `js/main.js` (o arquivo que liga tudo isso na página: formulários, cliques, checkboxes, estrelas) não tem teste automatizado, porque isso exigiria simular um navegador inteiro. Em vez de só confiar que ele funciona, eu abri o site de verdade num Chromium headless, mockei a resposta da TMDB e conferi na prática: login visitante, lista de filmes aparecendo (incluindo o caso de filme sem poster), busca por título, marcar como assistido, dar nota, o cálculo de progresso e nota média atualizando na tela, e o progresso persistindo depois de recarregar a página. Tudo funcionou nesse teste.

O que eu não consegui testar foi o `js/firebase-app.js` (login com Google e leitura/escrita no Firestore) contra um projeto Firebase de verdade, porque isso exige uma conta e uma config real que só você tem, e o ambiente onde escrevi esse projeto não tem acesso à rede pro Firebase. O código segue a documentação oficial do SDK modular (`initializeApp`, `getAuth`, `signInWithPopup`, `getFirestore`, `doc`/`getDoc`/`setDoc`), mas antes de confiar 100% nisso, testa na prática depois de configurar seu `js/config.js`: entra com Google, marca um filme como assistido, dá uma nota, recarrega a página e confere se o progresso continua lá. Se der algum erro, abre o console do navegador (F12) que a mensagem deve ajudar a achar o problema.

## Publicando (Vercel)

Esse projeto é HTML, CSS e JS estático, mas tem um passo de build pequeno só pra gerar o `js/config.js` (que fica fora do git) a partir de variáveis de ambiente, assim a chave da TMDB e o config do Firebase não ficam expostos no repositório público.

Conecte o repositório na Vercel e, em **Project Settings > Environment Variables**, cadastre:

```
TMDB_API_KEY
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
```

O `vercel.json` já diz pra Vercel rodar `npm run build` (que gera o `js/config.js` e depois minifica o JS/CSS publicado, veja a seção abaixo) e servir a raiz do projeto como está, então não precisa mexer nas build settings, só cadastrar essas variáveis com os valores do seu `js/config.js` local.

Não esqueça do passo de "Authorized domains" no Firebase (seção acima) se for usar o login com Google. Adiciona o domínio que a Vercel te der (algo como `seu-projeto.vercel.app`) depois do primeiro deploy.

## Minificação do código publicado

O `npm run build` (que a Vercel roda sozinha a cada deploy) também minifica o JS e o CSS que vão pro navegador com as bibliotecas `terser` (JS) e `clean-css` (CSS): tira comentário e espaço em branco e dá nome curto pras variáveis internas de cada função. Isso é só estética, pra não deixar o código tão confortável de ler em "Ver código-fonte"/F12. Não é e não substitui proteção de verdade: qualquer coisa que roda no navegador de quem visita pode ser vista por ele de algum jeito, minificado ou não. O que esse projeto expõe no navegador (chave da TMDB, config do Firebase) já é público por design, então não tem segredo real sendo escondido aqui, só um código menos confortável de ler à toa. O código-fonte continua legível no repositório e ao rodar localmente; só a cópia publicada na Vercel fica minificada.

## Estrutura do projeto

```
index.html              página única
css/styles.css           estilos
js/
  progress.js             cálculo de progresso assistido/total
  filters.js               busca, filtro por ano/não-assistido, ordenação
  ratings.js                validação de nota e média
  tmdb.js                    busca e normalização dos filmes na TMDB
  storage-local.js            persistência do modo visitante (localStorage)
  firebase-app.js              autenticação Google e persistência no Firestore
  main.js                       liga tudo isso na página (DOM)
  config.example.js              modelo de config (copiar pra config.js)
scripts/
  generate-config.js       gera js/config.js a partir de variáveis de ambiente (só roda no build da Vercel)
  minify.js                 minifica o JS/CSS publicado (cosmético, só roda no build da Vercel)
vercel.json                build command e pasta de publicação pra Vercel
tests/                    testes automatizados (Node --test), um arquivo por módulo
```
