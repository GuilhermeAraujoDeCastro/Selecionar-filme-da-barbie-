// Copie esse arquivo pra "js/config.js" (que fica de fora do git, olha o
// .gitignore) e preenche com suas chaves de verdade. Sem isso o site abre,
// mas mostra um aviso e nao busca filme nenhum.
//
// TMDB_API_KEY:
//   1. Crie uma conta de graca em https://www.themoviedb.org
//   2. Configuracoes > API > pede uma "API Key (v3 auth)"
//   3. Cola a chave aqui embaixo
//
// FIREBASE_CONFIG (so' necessario se quiser o login com Google; o modo
// visitante funciona sem isso):
//   1. Crie um projeto de graca em https://console.firebase.google.com
//   2. Build > Authentication > Sign-in method > ativa "Google"
//   3. Build > Firestore Database > cria o banco (modo de producao ou teste)
//   4. Configuracoes do projeto > Geral > Seus apps > cria um "app da Web"
//   5. Cola o objeto de config que o Firebase gera aqui embaixo

export const TMDB_API_KEY = "coloque-sua-chave-da-tmdb-aqui";

export const FIREBASE_CONFIG = {
  apiKey: "coloque-aqui",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "coloque-aqui",
  appId: "coloque-aqui",
};
