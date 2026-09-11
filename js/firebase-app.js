// Integracao com Firebase (Authentication com Google + email/senha, e
// Firestore). Usa o SDK modular do Firebase v9+ direto via CDN
// (gstatic.com), sem bundler nem "npm install" pra rodar esse site
// estatico. Versao fixada em 12.18.0 (a mais recente no site oficial de
// release notes do Firebase JS SDK quando esse arquivo foi escrito).
//
// Google e email/senha usam o mesmo Firestore (progress/{uid}): o
// documento e' identificado pelo uid que o Firebase Auth gera pra qualquer
// provedor, entao loadUserProgress/saveUserProgress nao precisam saber
// qual login a pessoa usou.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

export function initFirebase(firebaseConfig) {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  return { app, auth, db };
}

export async function loginWithGoogle(auth) {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

// Cria uma conta nova com email/senha. Se o email ja tiver conta, o
// Firebase rejeita com o erro "auth/email-already-in-use" (quem chama
// decide a mensagem pra mostrar, veja emailErrorMessage em main.js).
export async function signUpWithEmail(auth, email, password) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
}

// Entra numa conta que ja existe. Senha errada ou email sem conta vira
// erro ("auth/invalid-credential" nas versoes recentes do SDK).
export async function loginWithEmail(auth, email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export function logout(auth) {
  return signOut(auth);
}

// callback recebe o objeto "user" do Firebase (ou null quando ninguem esta
// logado). Devolve a funcao de "unsubscribe" que o proprio Firebase gera.
export function watchAuthState(auth, callback) {
  return onAuthStateChanged(auth, callback);
}

function emptyProgress() {
  return { watched: [], ratings: {} };
}

// Mesma forma de progresso usada em storage-local.js ({watched, ratings}),
// so que lendo de "progress/{userId}" no Firestore em vez do localStorage.
export async function loadUserProgress(db, userId) {
  const ref = doc(db, "progress", userId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    return emptyProgress();
  }
  const data = snapshot.data();
  return {
    watched: Array.isArray(data.watched) ? data.watched : [],
    ratings: data.ratings && typeof data.ratings === "object" ? data.ratings : {},
  };
}

export async function saveUserProgress(db, userId, progress) {
  const ref = doc(db, "progress", userId);
  await setDoc(ref, progress);
}
