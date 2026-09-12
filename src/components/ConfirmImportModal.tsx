import React from 'react';
import { X, Download, AlertTriangle, RefreshCw, CloudCheck } from 'lucide-react';

interface ConfirmImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isImporting: boolean;
  spreadsheetUrl?: string | null;
}

export const ConfirmImportModal: React.FC<ConfirmImportModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isImporting,
  spreadsheetUrl,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xl w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          disabled={isImporting}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-amber-100 border border-amber-300 text-amber-700 rounded-md flex items-center justify-center shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Cargar datos desde Google Drive
            </h3>
            <p className="text-xs text-slate-500">
              Restauración y sincronización en la nube
            </p>
          </div>
        </div>

        <div className="bg-amber-50/80 border border-amber-200/80 rounded-md p-3.5 my-4 space-y-2">
          <div className="flex items-start gap-2 text-amber-800 text-xs leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">
                Esta acción actualizará tus transacciones locales con la información guardada en tu Google Sheet.
              </p>
              <p className="text-amber-700 text-[11px]">
                Si registraste o editaste compras recientemente en este dispositivo y aún no las has subido, presiona <strong>Cancelar</strong> y haz clic primero en <strong>Guardar ahora</strong> para no perderlas.
              </p>
            </div>
          </div>
        </div>

        {spreadsheetUrl && (
          <div className="mb-4 text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
            <CloudCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">
              Planilla conectada:{' '}
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline font-mono"
              >
                Abrir en Google Drive
              </a>
            </span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isImporting}
            className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded-md transition-colors shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-wait"
          >
            {isImporting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Cargando datos de Drive...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Sí, cargar datos ahora</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
