import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
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

// Use localStorage or memory persistence to avoid IndexedDB "Database is closing/hidden" errors in iframes/popups
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {
    setPersistence(auth, inMemoryPersistence).catch(() => {});
  });
}

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
  if (typeof window !== 'undefined') {
    setPersistence(auth, browserLocalPersistence).catch(() => {
      setPersistence(auth, inMemoryPersistence).catch(() => {});
    });
  }

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
      console.warn('Error al procesar el retorno de autenticación (redirect):', err);
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
  // Enforce browserLocalPersistence or inMemoryPersistence to bypass IndexedDB connection closing bugs
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    await setPersistence(auth, inMemoryPersistence).catch(() => {});
  }

  const runPopup = async () => {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el token de acceso de Google');
    }
    return { user: result.user, accessToken: credential.accessToken };
  };

  try {
    const data = await runPopup();
    cachedAccessToken = data.accessToken;
    if (typeof window !== 'undefined') {
      localStorage.setItem('asistente_financiero_google_token', cachedAccessToken);
    }
    return data;
  } catch (error: any) {
    const errorMsg = String(error?.message || error?.code || error || '');
    const isDbClosing =
      errorMsg.includes('Database is closing') ||
      errorMsg.includes('Database is hidden') ||
      errorMsg.includes('IndexedDB') ||
      error?.code === 'auth/internal-error';

    if (isDbClosing) {
      console.warn('Se detectó cierre de conexión IndexedDB ("Database is closing/hidden"). Reintentando con inMemoryPersistence...');
      try {
        await setPersistence(auth, inMemoryPersistence);
        const retryData = await runPopup();
        cachedAccessToken = retryData.accessToken;
        if (typeof window !== 'undefined') {
          localStorage.setItem('asistente_financiero_google_token', cachedAccessToken);
        }
        return retryData;
      } catch (retryError: any) {
        console.warn('Reintento con inMemoryPersistence falló:', retryError);
        error = retryError;
      }
    }

    const currentErrorMsg = String(error?.message || error?.code || error || '');

    if (
      error?.code === 'auth/unauthorized-domain' ||
      error?.code === 'auth/popup-blocked' ||
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request' ||
      currentErrorMsg.includes('popup')
    ) {
      if (error?.code === 'auth/unauthorized-domain') {
        const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'tu-app.vercel.app';
        alert(
          `⚠️ Dominio no autorizado en Firebase (${currentDomain})\n\n` +
          `Para usar Google Sign-In / Google Drive en Vercel:\n` +
          `1. Crea tu propio proyecto en Firebase Console (https://console.firebase.google.com).\n` +
          `2. En tu proyecto, ve a Authentication > Dominios Autorizados y agrega: "${currentDomain}".\n` +
          `3. En Vercel, configura las Variables de Entorno:\n` +
          `   - VITE_FIREBASE_API_KEY\n` +
          `   - VITE_FIREBASE_AUTH_DOMAIN\n` +
          `   - VITE_FIREBASE_PROJECT_ID\n` +
          `   - VITE_FIREBASE_APP_ID`
        );
      }

      if (error?.code === 'auth/popup-blocked') {
        alert('⚠️ La ventana emergente fue bloqueada por tu navegador. Por favor permite las ventanas emergentes (popups) para este sitio.');
      }

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

