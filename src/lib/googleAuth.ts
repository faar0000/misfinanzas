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

declare global {
  interface Window {
    google?: any;
  }
}

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

// Use localStorage persistence so sessions survive between days and browser restarts
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

let cachedAccessToken: string | null = null;
let cachedExpiresAt: number | null = null;

export interface StoredAuthData {
  token: string | null;
  expiresAt: number | null;
  isValid: boolean;
  user: {
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    uid: string;
  } | null;
}

export const getStoredAuthData = (): StoredAuthData => {
  if (typeof window === 'undefined') {
    return { token: null, expiresAt: null, isValid: false, user: null };
  }
  const token = localStorage.getItem('asistente_financiero_google_token');
  const expiresAtStr = localStorage.getItem('asistente_financiero_token_expires_at');
  const userJson = localStorage.getItem('asistente_financiero_google_user');

  const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : null;
  const now = Date.now();
  // Token is considered valid if expiresAt is in the future (with 30s buffer)
  const isValid = !!token && (!expiresAt || expiresAt > now + 30000);

  let user = null;
  if (userJson) {
    try {
      user = JSON.parse(userJson);
    } catch {}
  }

  return { token: isValid ? token : token, expiresAt, isValid, user };
};

export const saveAuthTokenAndUser = (
  token?: string | null,
  user?: User | { email: string | null; displayName: string | null; photoURL: string | null; uid: string } | null,
  expiresInSeconds: number = 3550
) => {
  if (typeof window === 'undefined') return;

  if (token) {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    cachedAccessToken = token;
    cachedExpiresAt = expiresAt;
    localStorage.setItem('asistente_financiero_google_token', token);
    localStorage.setItem('asistente_financiero_token_expires_at', expiresAt.toString());
  }

  if (user) {
    const serializedUser = {
      email: user.email || null,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      uid: user.uid,
    };
    localStorage.setItem('asistente_financiero_google_user', JSON.stringify(serializedUser));
  }
};

export const clearStoredAuth = () => {
  cachedAccessToken = null;
  cachedExpiresAt = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('asistente_financiero_google_token');
    localStorage.removeItem('asistente_financiero_token_expires_at');
    localStorage.removeItem('asistente_financiero_google_user');
  }
};

/**
 * Google Identity Services (GIS) TokenClient does not support silent iframe authentication
 * without user interaction. Calling requestAccessToken() without a direct user click causes
 * browsers to block the popup window with "[GSI_LOGGER]: Failed to open popup window".
 * To avoid blocked popup errors, background silent requests return null safely without opening windows.
 */
export const requestGisTokenSilently = async (_userEmail?: string): Promise<string | null> => {
  return null;
};

/**
 * Refreshes the Google OAuth token interactively with a 1-click popup pre-selecting the user's account.
 * MUST only be invoked from an explicit user click handler.
 */
export const refreshGoogleTokenInteractive = async (userEmail?: string): Promise<string | null> => {
  try {
    const stored = getStoredAuthData();
    const email = userEmail || stored.user?.email || undefined;
    if (email) {
      provider.setCustomParameters({ login_hint: email });
    }
    const res = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(res);
    if (credential?.accessToken) {
      saveAuthTokenAndUser(credential.accessToken, res.user);
      return credential.accessToken;
    }
  } catch (err: any) {
    console.warn('Interactive token renewal cancelled or error:', err);
  }
  return null;
};

/**
 * Retrieves the current Google OAuth access token from memory or storage.
 * Does NOT open unprompted popups in the background.
 */
export const getValidGoogleAccessToken = async (_forceRefresh: boolean = false): Promise<string | null> => {
  const now = Date.now();
  if (
    cachedAccessToken &&
    cachedExpiresAt &&
    cachedExpiresAt > now + 60000
  ) {
    return cachedAccessToken;
  }

  const stored = getStoredAuthData();
  if (stored.token) {
    cachedAccessToken = stored.token;
    if (stored.expiresAt) cachedExpiresAt = stored.expiresAt;
    return stored.token;
  }

  return cachedAccessToken;
};

export const initAuth = (
  onAuthSuccess?: (user: User | any, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (typeof window !== 'undefined') {
    setPersistence(auth, browserLocalPersistence).catch(() => {
      setPersistence(auth, inMemoryPersistence).catch(() => {});
    });

    // Immediate hydration from localStorage: preserve user identity across days!
    const stored = getStoredAuthData();
    if (stored.user) {
      if (stored.token) {
        cachedAccessToken = stored.token;
        cachedExpiresAt = stored.expiresAt;
      }
      if (onAuthSuccess) {
        onAuthSuccess(stored.user as any, stored.token || '');
      }
    }
  }

  // Catch redirect authentication results on load (for mobile fallback)
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          saveAuthTokenAndUser(credential.accessToken, result.user);
          if (onAuthSuccess) onAuthSuccess(result.user, credential.accessToken);
        }
      }
    })
    .catch((err) => {
      console.warn('Error al procesar el retorno de autenticación (redirect):', err);
    });

  return onAuthStateChanged(auth, async (user: User | null) => {
    const stored = getStoredAuthData();
    if (user) {
      const activeToken = stored.token || cachedAccessToken || '';
      saveAuthTokenAndUser(activeToken || null, user);
      if (onAuthSuccess) onAuthSuccess(user, activeToken);
    } else if (stored.user) {
      // User is remembered locally even if Firebase auth is initializing
      if (onAuthSuccess) onAuthSuccess(stored.user as any, stored.token || '');
    } else {
      clearStoredAuth();
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    await setPersistence(auth, inMemoryPersistence).catch(() => {});
  }

  const stored = getStoredAuthData();
  if (stored.user?.email) {
    provider.setCustomParameters({ login_hint: stored.user.email });
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
    saveAuthTokenAndUser(data.accessToken, data.user);
    return data;
  } catch (error: any) {
    const errorMsg = String(error?.message || error?.code || error || '');
    const isDbClosing =
      errorMsg.includes('Database is closing') ||
      errorMsg.includes('Database is hidden') ||
      errorMsg.includes('IndexedDB') ||
      error?.code === 'auth/internal-error';

    if (isDbClosing) {
      console.warn('Detectado IndexedDB cerrado. Reintentando con inMemoryPersistence...');
      try {
        await setPersistence(auth, inMemoryPersistence);
        const retryData = await runPopup();
        saveAuthTokenAndUser(retryData.accessToken, retryData.user);
        return retryData;
      } catch (retryError: any) {
        console.warn('Reintento con inMemoryPersistence falló:', retryError);
        error = retryError;
      }
    }

    if (
      error?.code === 'auth/unauthorized-domain' ||
      error?.code === 'auth/popup-blocked' ||
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request' ||
      errorMsg.includes('popup')
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
  return getValidGoogleAccessToken();
};

export const logoutGoogle = async () => {
  await signOut(auth);
  clearStoredAuth();
};


