import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import rawFirebaseConfig from '../../firebase-applet-config.json';

const metaEnv = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || rawFirebaseConfig.apiKey,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || rawFirebaseConfig.authDomain,
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || rawFirebaseConfig.projectId,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || rawFirebaseConfig.storageBucket,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || rawFirebaseConfig.messagingSenderId,
  appId: metaEnv.VITE_FIREBASE_APP_ID || rawFirebaseConfig.appId,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

let cachedAccessToken: string | null = (typeof window !== 'undefined' && localStorage.getItem('asistente_financiero_google_token')) || null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Catch redirect authentication results on load (for mobile or popups fallback)
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          if (typeof window !== 'undefined') {
            localStorage.setItem('asistente_financiero_google_token', cachedAccessToken);
          }
          if (onAuthSuccess) onAuthSuccess(result.user, cachedAccessToken);
        }
      }
    })
    .catch((err) => {
      console.error('Error al procesar el retorno de autenticación (redirect):', err);
    });

  return onAuthStateChanged(auth, async (user: User | null) => {
    const token = cachedAccessToken || (typeof window !== 'undefined' && localStorage.getItem('asistente_financiero_google_token')) || null;
    if (user && token) {
      cachedAccessToken = token;
      if (onAuthSuccess) onAuthSuccess(user, token);
    } else if (user && !token) {
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
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el token de acceso de Google');
    }

    cachedAccessToken = credential.accessToken;
    if (typeof window !== 'undefined') {
      localStorage.setItem('asistente_financiero_google_token', cachedAccessToken);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Error de autenticación Google con Popup:', error);

    // Common issue when deploying on Vercel or when popups are blocked
    if (
      error?.code === 'auth/unauthorized-domain' ||
      error?.code === 'auth/popup-blocked' ||
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      if (error?.code === 'auth/unauthorized-domain') {
        const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'tu-app.vercel.app';
        alert(
          `⚠️ Dominio no autorizado en Firebase (${currentDomain})\n\n` +
          `Nota: Los proyectos generados automáticamente por AI Studio no permiten agregar dominios personalizados en la consola GCP.\n\n` +
          `Para usar Google Sign-In / Google Drive en Vercel:\n` +
          `1. Crea tu propio proyecto en Firebase Console (https://console.firebase.google.com).\n` +
          `2. En tu proyecto, ve a Authentication > Dominios Autorizados y agrega: "${currentDomain}".\n` +
          `3. En Vercel, configura las Variables de Entorno (Environment Variables):\n` +
          `   - VITE_FIREBASE_API_KEY\n` +
          `   - VITE_FIREBASE_AUTH_DOMAIN\n` +
          `   - VITE_FIREBASE_PROJECT_ID\n` +
          `   - VITE_FIREBASE_APP_ID`
        );
      }

      // Fallback to signInWithRedirect for popup issues or blocked popups
      try {
        console.log('Iniciando redirección a Google Sign-In...');
        await signInWithRedirect(auth, provider);
        return null;
      } catch (redirectErr) {
        console.error('Error en signInWithRedirect:', redirectErr);
        throw redirectErr;
      }
    }
    throw error;
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

