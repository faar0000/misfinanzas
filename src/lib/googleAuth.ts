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

export async function checkBackendSession(): Promise<{
  authenticated: boolean;
  user: { email: string | null; displayName: string | null; photoURL: string | null; uid: string } | null;
  hasRefreshToken: boolean;
  hasOAuthEnv?: boolean;
}> {
  try {
    const res = await fetch('/api/auth/session', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      return {
        authenticated: Boolean(data.authenticated),
        user: data.user
          ? {
              email: data.user.email || null,
              displayName: data.user.displayName || null,
              photoURL: data.user.photoURL || null,
              uid: data.user.id || data.user.uid || 'google-user',
            }
          : null,
        hasRefreshToken: Boolean(data.hasRefreshToken),
        hasOAuthEnv: Boolean(data.hasOAuthEnv),
      };
    }
  } catch (err) {
    console.warn('Verificación de sesión backend:', err);
  }
  return { authenticated: false, user: null, hasRefreshToken: false };
}

export const initAuth = (
  onAuthSuccess?: (user: User | any, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (typeof window !== 'undefined') {
    // Check URL parameters for OAuth redirects
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('auth_error')) {
      const err = params.get('auth_error');
      window.history.replaceState({}, document.title, window.location.pathname);
      console.warn('OAuth callback error:', err);
    }

    setPersistence(auth, browserLocalPersistence).catch(() => {
      setPersistence(auth, inMemoryPersistence).catch(() => {});
    });

    // Immediate hydration from localStorage: preserve user identity if valid client token
    const stored = getStoredAuthData();
    if (stored.user && stored.token && stored.token.startsWith('ya29.') && stored.isValid) {
      cachedAccessToken = stored.token;
      cachedExpiresAt = stored.expiresAt;
      if (onAuthSuccess) {
        onAuthSuccess(stored.user as any, stored.token);
      }
    } else if (stored.user && stored.token !== 'backend-session') {
      if (onAuthSuccess) {
        onAuthSuccess(stored.user as any, stored.token || '');
      }
    }

    // Verify session with the backend server (Web Server Flow with refresh_token cookie)
    checkBackendSession().then((session) => {
      if (session.authenticated && session.user) {
        saveAuthTokenAndUser('backend-session', session.user, 30 * 24 * 3600);
        if (onAuthSuccess) {
          onAuthSuccess(session.user, 'backend-session');
        }
      } else if (stored.token === 'backend-session') {
        clearStoredAuth();
        if (onAuthFailure) onAuthFailure();
      }
    });
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
    } else {
      // Check backend session before clearing
      const session = await checkBackendSession();
      if (session.authenticated && session.user) {
        saveAuthTokenAndUser('backend-session', session.user, 30 * 24 * 3600);
        if (onAuthSuccess) onAuthSuccess(session.user, 'backend-session');
      } else {
        if (stored.token === 'backend-session' || !stored.isValid) {
          clearStoredAuth();
          if (onAuthFailure) onAuthFailure();
        }
      }
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User | any; accessToken: string } | null> => {
  // Check if Web Server OAuth is available in backend
  try {
    const sessionInfo = await checkBackendSession();
    if (sessionInfo.hasOAuthEnv) {
      // Redirect to Google Web Server Flow endpoint
      window.location.href = '/api/auth/login';
      return null;
    }
  } catch (err) {
    console.warn('No se pudo verificar entorno backend para OAuth:', err);
  }

  // Fallback: If GOOGLE_CLIENT_ID is not configured in backend yet, inform the user or use popup
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

    // If popup fails or is blocked on Vercel, navigate to server login
    window.location.href = '/api/auth/login';
    return null;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return getValidGoogleAccessToken();
};

export const logoutGoogle = async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch (err) {
    console.warn('Error al cerrar sesión en el backend:', err);
  }
  await signOut(auth).catch(() => {});
  clearStoredAuth();
};


