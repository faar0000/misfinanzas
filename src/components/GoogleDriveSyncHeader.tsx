import React from 'react';
import { User } from 'firebase/auth';
import { Cloud, CloudCheck, ExternalLink, RefreshCw, LogOut, FileSpreadsheet, Trash2 } from 'lucide-react';

interface GoogleDriveSyncHeaderProps {
  user: User | null;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  spreadsheetUrl: string | null;
  onLogin: () => void;
  onLogout: () => void;
  onManualSync: () => void;
  onCleanDuplicates?: () => void;
}

export const GoogleDriveSyncHeader: React.FC<GoogleDriveSyncHeaderProps> = ({
  user,
  isSyncing,
  lastSyncedAt,
  spreadsheetUrl,
  onLogin,
  onLogout,
  onManualSync,
  onCleanDuplicates,
}) => {
  if (!user) {
    return (
      <div className="bg-indigo-900 text-white p-4 rounded-sm border border-indigo-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-700/80 rounded-sm flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Sincronización con Google Drive & Sheets
            </h4>
            <p className="text-[11px] text-indigo-200 mt-0.5">
              Conecta tu cuenta de Google para guardar automáticamente todas tus transacciones en una planilla en Drive.
            </p>
          </div>
        </div>

        {/* Standard Google Sign-In Button */}
        <button
          onClick={onLogin}
          className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs px-4 py-2 rounded-sm shadow-xs flex items-center gap-2.5 transition-colors cursor-pointer shrink-0"
        >
          <svg className="w-4 h-4" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          <span>Conectar con Google Drive</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-emerald-950 text-white p-4 rounded-sm border border-emerald-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-emerald-800 rounded-sm flex items-center justify-center shrink-0">
          <CloudCheck className="w-5 h-5 text-emerald-300" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-100">
              Google Drive Conectado
            </h4>
            <span className="text-[11px] text-emerald-300 font-mono">
              ({user.email || user.displayName})
            </span>
          </div>
          <p className="text-[11px] text-emerald-200/90 mt-0.5">
            {lastSyncedAt
              ? `Base de datos sincronizada a las ${lastSyncedAt}`
              : 'Sincronización automática activada'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
        <button
          onClick={onManualSync}
          disabled={isSyncing}
          className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-emerald-100 text-xs font-semibold rounded-sm border border-emerald-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Drive'}</span>
        </button>

        {spreadsheetUrl && (
          <a
            href={spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Abrir Planilla en Drive</span>
          </a>
        )}

        {onCleanDuplicates && (
          <button
            onClick={onCleanDuplicates}
            className="px-2.5 py-1.5 bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 text-xs font-medium rounded-sm border border-emerald-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Mover archivos duplicados en Google Drive a la papelera y conservar solo la planilla activa"
          >
            <Trash2 className="w-3 h-3 text-amber-400" />
            <span className="hidden lg:inline">Limpiar Duplicados</span>
          </button>
        )}

        <button
          onClick={onLogout}
          className="p-1.5 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 rounded-sm border border-emerald-700 transition-colors cursor-pointer"
          title="Desconectar Google Drive"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
