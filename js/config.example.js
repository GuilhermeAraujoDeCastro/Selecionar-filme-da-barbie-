// Copie esse arquivo pra "js/config.js" (que fica de fora do git, olha o
// .gitignore) e preenche com suas chaves de verdade. Sem isso o site abre,
// mas mostra um aviso e nao busca filme nenhum.
//
// TMDB_API_KEY:
//   1. Crie uma conta de graca em https://www.themoviedb.org
//   2. Configuracoes > API > pede uma "API Key (v3 auth)"
//   3. Cola a chave aqui embaixo
//
// FIREBASE_CONFIG (so' necessario se quiser o login com Google/e-mail, o
// link publico compartilhavel ou as notificacoes; o modo visitante
// funciona sem isso):
//   1. Crie um projeto de graca em https://console.firebase.google.com
//   2. Build > Authentication > Sign-in method > ativa "Google" e "E-mail/senha"
//   3. Build > Firestore Database > cria o banco (modo de producao ou teste)
//   4. Cole o conteudo de firestore.rules (raiz do projeto) em Build >
//      Firestore Database > Regras
//   5. Configuracoes do projeto > Geral > Seus apps > cria um "app da Web"
//   6. Cola o objeto de config que o Firebase gera aqui embaixo
//
// SENTRY_DSN (opcional, item 20 - monitoramento de erro em producao):
//   string vazia desativa, sem precisar de nenhuma conta pro resto do site
//   funcionar. Criando uma conta gratis em https://sentry.io, o DSN fica em
//   Settings > Projects > <projeto> > Client Keys (DSN).
//
// VAPID_PUBLIC_KEY (opcional, item 13 - notificacao de filme novo):
//   string vazia desativa o botao "Ativar notificacoes". Gere o par de
//   chaves rodando `npx web-push generate-vapid-keys` localmente - a
//   publica vai aqui, a privada vira variavel de ambiente da function
//   (veja api/notify-new-movies.js).

export const TMDB_API_KEY = "coloque-sua-chave-da-tmdb-aqui";

export const FIREBASE_CONFIG = {
  apiKey: "coloque-aqui",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "coloque-aqui",
  appId: "coloque-aqui",
};

export const SENTRY_DSN = "";

export const VAPID_PUBLIC_KEY = "";
