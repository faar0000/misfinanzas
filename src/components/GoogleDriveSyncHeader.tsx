import React from 'react';
import { User } from 'firebase/auth';
import { CloudCheck, ExternalLink, RefreshCw, LogOut, FileSpreadsheet, Download } from 'lucide-react';

interface GoogleDriveSyncHeaderProps {
  user: User | null;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  spreadsheetUrl: string | null;
  tokenNeedsRefresh?: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onManualSync: () => void;
  onImportDrive?: () => void;
  onReconnect?: () => void;
}

export const GoogleDriveSyncHeader: React.FC<GoogleDriveSyncHeaderProps> = ({
  user,
  isSyncing,
  lastSyncedAt,
  spreadsheetUrl,
  tokenNeedsRefresh = false,
  onLogin,
  onLogout,
  onManualSync,
  onImportDrive,
  onReconnect,
}) => {
  if (!user) {
    return (
      <div className="bg-slate-900 dark:bg-slate-900 text-white p-3 sm:p-3.5 rounded-md border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 mb-4 shadow-2xs">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="w-8 h-8 bg-indigo-600/20 rounded-md flex items-center justify-center shrink-0 border border-indigo-500/30">
            <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider truncate">
              Respaldo en Google Drive
            </h4>
            <p className="text-[11px] text-slate-400 truncate">
              Conecta tu cuenta para sincronizar automáticamente tu planilla.
            </p>
          </div>
        </div>

        <button
          onClick={onLogin}
          className="w-full sm:w-auto bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs px-3.5 py-1.5 rounded-md shadow-2xs flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          <span>Conectar Google Drive</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-slate-900 text-white p-2.5 sm:p-3 rounded-md border ${tokenNeedsRefresh ? 'border-amber-700/80 bg-slate-900/95' : 'border-emerald-900/60'} flex flex-col sm:flex-row items-center justify-between gap-2.5 mb-4 shadow-2xs`}>
      {/* Drive Status Info */}
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-start">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border ${tokenNeedsRefresh ? 'bg-amber-950/80 border-amber-700/80' : 'bg-emerald-950 border-emerald-800/80'}`}>
            <CloudCheck className={`w-4 h-4 ${tokenNeedsRefresh ? 'text-amber-400' : 'text-emerald-400'}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`w-2 h-2 rounded-full shrink-0 ${tokenNeedsRefresh ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
              <span className={`text-xs font-bold uppercase tracking-wider truncate ${tokenNeedsRefresh ? 'text-amber-300' : 'text-emerald-300'}`}>
                {tokenNeedsRefresh ? 'Sesión por renovar' : 'Drive Conectado'}
              </span>
              {tokenNeedsRefresh ? (
                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-950/90 text-amber-300 border border-amber-700/60 rounded-sm">
                  ⚠️ Clic para Reconectar
                </span>
              ) : (
                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 rounded-sm">
                  ⚡ Autoguardado Activo
                </span>
              )}
              <span className="text-[10px] text-slate-400 font-mono truncate hidden md:inline">
                ({user.email || user.displayName})
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
              {isSyncing ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin inline shrink-0" />
                  <span>Guardando en Drive...</span>
                </span>
              ) : tokenNeedsRefresh ? (
                <span className="text-amber-300/90">Haz clic en Reconectar o Guardar para autorizar la sincronización</span>
              ) : lastSyncedAt ? (
                <span>Guardado automático al día • Último: {lastSyncedAt}</span>
              ) : (
                <span>Autoguardado automático activo</span>
              )}
            </p>
          </div>
        </div>

        {/* Mobile-only logout button on top right of state info */}
        <button
          onClick={onLogout}
          className="sm:hidden p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
          title="Desconectar Google Drive"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Action Buttons (Compact & Responsive) */}
      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
        {tokenNeedsRefresh && (
          <button
            onClick={onReconnect || onLogin}
            className="flex-1 sm:flex-initial px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 text-xs font-bold rounded border border-amber-400 transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
            title="Haz clic para renovar los permisos de Google Drive"
          >
            <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            <span>Reconectar</span>
          </button>
        )}

        {onImportDrive && (
          <button
            onClick={onImportDrive}
            disabled={isSyncing}
            className="flex-1 sm:flex-initial px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-xs font-bold rounded border border-amber-500/80 transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 shadow-2xs"
            title="⚠️ Reemplaza datos locales con la versión de Google Drive"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Cargar</span>
          </button>
        )}

        <button
          onClick={onManualSync}
          disabled={isSyncing}
          className="flex-1 sm:flex-initial px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white text-xs font-bold rounded border border-emerald-600 transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 shadow-2xs"
          title="Fuerza un guardado inmediato en Google Drive"
        >
          <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Guardando...' : 'Guardar ahora'}</span>
        </button>

        {spreadsheetUrl && (
          <a
            href={spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-semibold rounded border border-slate-700 transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
            title="Abrir la planilla de cálculo en Google Sheets"
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span className="hidden sm:inline">Planilla</span>
          </a>
        )}

        <button
          onClick={onLogout}
          className="hidden sm:flex p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded border border-slate-800 transition-colors cursor-pointer"
          title="Desconectar Google Drive"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};


