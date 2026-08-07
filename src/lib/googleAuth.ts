import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Configuración dinámica de Firebase (soporta Variables de Entorno de Vercel o archivo local)
const env = (import.meta as any).env || {};
const dynamicFirebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
};

const app = getApps().length > 0 ? getApp() : initializeApp(dynamicFirebaseConfig);
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

let isSigningIn = false;
let cachedAccessToken: string | null = (typeof window !== 'undefined' && localStorage.getItem('asistente_financiero_google_token')) || null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    const token = cachedAccessToken || (typeof window !== 'undefined' && localStorage.getItem('asistente_financiero_google_token')) || null;
    if (user && token) {
      cachedAccessToken = token;
      if (onAuthSuccess) onAuthSuccess(user, token);
    } else if (user && !token) {
      // User is signed into Firebase but OAuth token is missing/cleared
      if (onAuthFailure) onAuthFailure();
    } else {
      cachedAccessToken = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('asistente_financiero_google_token');
      }
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el token de acceso de Google. Revisa tus permisos.');
    }

    cachedAccessToken = credential.accessToken;
    if (typeof window !== 'undefined') {
      localStorage.setItem('asistente_financiero_google_token', cachedAccessToken);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Error de autenticación Google:', error);
    const code = error?.code || '';
    const originDomain = typeof window !== 'undefined' ? window.location.hostname : 'tu-dominio.com';

    if (code === 'auth/unauthorized-domain') {
      throw new Error(
        `⚠️ DOMINIO NO AUTORIZADO EN FIREBASE:\n\nEl dominio "${originDomain}" no está registrado en Firebase Auth.\n\n` +
        `Para solucionarlo en Vercel:\n` +
        `1. Ve a Firebase Console -> Authentication -> Settings -> Authorized domains\n` +
        `2. Haz clic en "Add domain" e ingresa "${originDomain}"\n` +
        `3. Vuelve a intentar el inicio de sesión.`
      );
    } else if (code === 'auth/operation-not-allowed') {
      throw new Error(
        `⚠️ GOOGLE SIGN-IN NO DESHABILITADO EN FIREBASE:\n\nDebes activar el proveedor de inicio de sesión de Google en Firebase Console -> Authentication -> Sign-in method -> Google.`
      );
    } else if (code === 'auth/popup-closed-by-user') {
      throw new Error('La ventana de inicio de sesión fue cerrada antes de completar la autenticación.');
    } else if (code === 'auth/cancelled-popup-request') {
      throw new Error('Solicitud de ventana emergente cancelada por otra petición en curso.');
    }

    throw new Error(error?.message || 'Error desconocido al conectar con Google Drive.');
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken && typeof window !== 'undefined') {
    cachedAccessToken = localStorage.getItem('asistente_financiero_google_token');
  }
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('asistente_financiero_google_token');
  }
};
