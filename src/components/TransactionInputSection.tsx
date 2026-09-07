import React, { useState, useRef } from 'react';
import {
  MessageSquareText,
  Mic,
  Camera,
  Upload,
  Sparkles,
  RefreshCw,
  X,
  Volume2,
  Info,
} from 'lucide-react';

interface TransactionInputSectionProps {
  onProcess: (params: {
    inputMode: 'text' | 'voice' | 'image';
    textPrompt?: string;
    audioBase64?: string;
    audioMimeType?: string;
    imageBase64?: string;
    imageMimeType?: string;
  }) => Promise<void>;
  isProcessing: boolean;
  monedaSimbolo: string;
}

export const TransactionInputSection: React.FC<TransactionInputSectionProps> = ({
  onProcess,
  isProcessing,
  monedaSimbolo,
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'voice' | 'image'>('text');
  const [textInput, setTextInput] = useState('');
  
  // Image mode states
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice mode states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string>('audio/webm');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Handle Image File Select
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageMimeType(file.type || 'image/jpeg');
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle Recording Audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mime = mediaRecorder.mimeType || 'audio/webm';
        setAudioMimeType(mime);
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioBase64(reader.result as string);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accediendo al micrófono:', err);
      alert('No se pudo acceder al micrófono. Verifica los permisos.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleClearAudio = () => {
    setAudioBase64(null);
    setRecordingTime(0);
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;

    if (activeTab === 'text') {
      if (!textInput.trim()) return;
      onProcess({
        inputMode: 'text',
        textPrompt: textInput,
      });
    } else if (activeTab === 'image') {
      if (!imagePreview) return;
      onProcess({
        inputMode: 'image',
        textPrompt: textInput || 'Analiza esta boleta y desglosa ítems de dieta vs antojos.',
        imageBase64: imagePreview,
        imageMimeType,
      });
    } else if (activeTab === 'voice') {
      if (!audioBase64 && !textInput.trim()) return;
      onProcess({
        inputMode: 'voice',
        textPrompt: textInput || 'Procesa este registro de voz',
        audioBase64: audioBase64 || undefined,
        audioMimeType,
      });
    }
  };

  // Quick Preset Prompts for testing ease
  const handleQuickPreset = (presetText: string) => {
    setTextInput(presetText);
    setActiveTab('text');
  };

  return (
    <div className="bg-white border border-slate-200 p-6 shadow-sm rounded-sm mb-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Nuevo Registro Inteligente
        </h2>
        <span className="text-[11px] font-medium text-slate-400">Texto • Foto Boleta • Audio</span>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-sm mb-4 text-xs font-semibold text-slate-600">
        <button
          type="button"
          onClick={() => setActiveTab('text')}
          className={`flex-1 py-2 px-3 rounded-sm flex items-center justify-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'text'
              ? 'bg-white text-indigo-600 shadow-xs font-bold'
              : 'hover:text-slate-900'
          }`}
        >
          <MessageSquareText className="w-3.5 h-3.5" />
          <span>Texto</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('image')}
          className={`flex-1 py-2 px-3 rounded-sm flex items-center justify-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'image'
              ? 'bg-white text-indigo-600 shadow-xs font-bold'
              : 'hover:text-slate-900'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Foto Boleta (OCR)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('voice')}
          className={`flex-1 py-2 px-3 rounded-sm flex items-center justify-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'voice'
              ? 'bg-white text-indigo-600 shadow-xs font-bold'
              : 'hover:text-slate-900'
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
          <span>Audio / Voz</span>
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* TAB 1: TEXT INPUT */}
        {activeTab === 'text' && (
          <div>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Ej: Compré un monitor por 300 soles a 3 cuotas con tarjeta de crédito..."
              className="w-full h-28 p-4 bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-sm resize-none"
            />

            {/* Quick Sample Presets */}
            <div className="mt-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
                Ejemplos Rápidos:
              </span>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    handleQuickPreset(
                      'Me abonaron el 50% restante de mi sueldo: 2500 soles ingresados a mi cuenta bancaria en débito'
                    )
                  }
                  className="px-2.5 py-1 rounded-sm bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-pointer transition-colors text-xs font-medium flex items-center gap-1"
                >
                  💵 Ingreso: 50% Sueldo Restante (S/. 2,500)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleQuickPreset(
                      'Compré 1 laptop por 1200 soles a 4 cuotas con tarjeta de crédito'
                    )
                  }
                  className="px-2.5 py-1 rounded-sm bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer transition-colors text-xs font-medium"
                >
                  💳 Compra Crédito 4 cuotas
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleQuickPreset(
                      'Compré pechuga de pollo, avena y claras de huevo por 65 soles en débito para la dieta'
                    )
                  }
                  className="px-2.5 py-1 rounded-sm bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer transition-colors text-xs font-medium"
                >
                  🥗 Alimentos de Dieta
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleQuickPreset(
                      'Pedí pollo a la brasa por delivery 75 soles en efectivo con antojo espontáneo'
                    )
                  }
                  className="px-2.5 py-1 rounded-sm bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer transition-colors text-xs font-medium"
                >
                  🍗 Antojo / Gasto Hormiga
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: IMAGE OCR */}
        {activeTab === 'image' && (
          <div className="space-y-3">
            {!imagePreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-sm p-8 text-center bg-slate-50 cursor-pointer transition-colors group"
              >
                <Upload className="w-8 h-8 mx-auto text-slate-400 group-hover:text-indigo-600 mb-2 transition-colors" />
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Haz clic para subir o capturar foto de tu boleta
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Gemini Vision desglosará ítem por ítem clasificando dieta vs antojos/fijos.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="relative rounded-sm overflow-hidden border border-slate-200 bg-slate-900 max-h-64 flex items-center justify-center p-2">
                <img
                  src={imagePreview}
                  alt="Vista previa boleta"
                  className="max-h-60 object-contain rounded-sm"
                />
                <button
                  type="button"
                  onClick={handleClearImage}
                  className="absolute top-2 right-2 bg-slate-900/80 hover:bg-rose-600 text-white p-1.5 rounded-sm transition-colors"
                  title="Eliminar imagen"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Comentario opcional para la boleta (ej. 'Pagado con tarjeta débito')"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 text-xs text-slate-900 rounded-sm focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
        )}

        {/* TAB 3: VOICE INPUT */}
        {activeTab === 'voice' && (
          <div className="space-y-4 text-center py-4 bg-slate-50 border border-slate-200 rounded-sm">
            <div className="flex flex-col items-center justify-center gap-3">
              {!isRecording && !audioBase64 && (
                <button
                  type="button"
                  onClick={startRecording}
                  className="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md transition-transform active:scale-95 cursor-pointer"
                  title="Iniciar grabación"
                >
                  <Mic className="w-7 h-7" />
                </button>
              )}

              {isRecording && (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-full bg-rose-500 text-white flex items-center justify-center animate-pulse">
                    <Mic className="w-7 h-7" />
                  </div>
                  <div className="text-xs font-bold text-rose-600">
                    Grabando... {recordingTime}s
                  </div>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-3 py-1 bg-slate-800 text-white text-xs font-semibold rounded-sm hover:bg-slate-700 cursor-pointer"
                  >
                    Detener Grabación
                  </button>
                </div>
              )}

              {audioBase64 && !isRecording && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-3 w-11/12 max-w-md flex items-center justify-between mx-auto">
                  <div className="flex items-center gap-2 text-left">
                    <Volume2 className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div className="text-xs font-bold text-emerald-900">
                        Audio grabado listo ({recordingTime}s)
                      </div>
                      <div className="text-[10px] text-emerald-700">
                        Listo para ser analizado por Gemini IA
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearAudio}
                    className="text-slate-400 hover:text-rose-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500">
              Presiona el micrófono y di tu gasto libremente (ej. "Gasté 45 soles en Uber en tarjeta crédito").
            </p>
          </div>
        )}

        {/* Footer info & Action Button */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 italic">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Puedes escribir, grabar voz o subir tu boleta en foto para desglose OCR.</span>
          </div>

          <button
            type="submit"
            disabled={
              isProcessing ||
              (activeTab === 'text' && !textInput.trim()) ||
              (activeTab === 'image' && !imagePreview) ||
              (activeTab === 'voice' && !audioBase64 && !textInput.trim())
            }
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors rounded-sm flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Procesando...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Procesar Transacción</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
