import React, { useState } from 'react';
import {
  MessageSquare,
  Send,
  Bot,
  Copy,
  Check,
  Zap,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  X,
  Sparkles,
} from 'lucide-react';
import { TransactionRecord } from '../types';

interface WhatsAppBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNewTransactionFromWhatsApp: (tx: TransactionRecord) => void;
}

export const WhatsAppBotModal: React.FC<WhatsAppBotModalProps> = ({
  isOpen,
  onClose,
  onNewTransactionFromWhatsApp,
}) => {
  const [activeTab, setActiveTab] = useState<'simulator' | 'webhook' | 'guide'>('simulator');
  const [chatMessage, setChatMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const [chatHistory, setChatHistory] = useState<Array<{ sender: 'user' | 'bot'; text: string; time: string }>>([
    {
      sender: 'bot',
      text: '🤖 *¡Hola! Soy tu Asistente Financiero de WhatsApp.*\n\nPuedes escribir tus gastos e ingresos como le escribirías a un amigo. Por ejemplo:\n• *"Gasté 35 soles en Yape en el almuerzo"*\n• *"Pagué 180 soles de luz con Interbank"*\n• *"Me pagaron 2,500 soles de mi quincena"*\n• *"Compré TV en 3 cuotas de 200 soles con BCP"*',
      time: '12:00 PM',
    },
  ]);

  if (!isOpen) return null;

  const currentDomain = typeof window !== 'undefined' ? window.location.origin : 'https://mi-app.com';
  const publicDomain = currentDomain.replace('ais-dev-', 'ais-pre-');
  const webhookUrl = `${publicDomain}/api/whatsapp/webhook`;
  const verifyToken = 'asistente_financiero_token';

  const handleCopy = (text: string, type: 'url' | 'token') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleSendSimulation = async (msgText?: string) => {
    const textToSend = msgText || chatMessage;
    if (!textToSend.trim() || isSubmitting) return;

    const userTime = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    setChatHistory((prev) => [...prev, { sender: 'user', text: textToSend, time: userTime }]);
    if (!msgText) setChatMessage('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/whatsapp/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageText: textToSend, phone: '+51 987 654 321' }),
      });

      const data = await res.json();
      const botTime = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

      if (data.success && data.replyMessage) {
        setChatHistory((prev) => [
          ...prev,
          { sender: 'bot', text: data.replyMessage, time: botTime },
        ]);
        if (data.transaction) {
          onNewTransactionFromWhatsApp(data.transaction);
        }
      } else {
        setChatHistory((prev) => [
          ...prev,
          { sender: 'bot', text: '⚠️ Ocurrió un inconveniente procesando el mensaje.', time: botTime },
        ]);
      }
    } catch {
      const errTime = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      setChatHistory((prev) => [
        ...prev,
        { sender: 'bot', text: '⚠️ Error de conexión con el servidor del bot.', time: errTime },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const samplePrompts = [
    'Gasté 45 soles en Yape en el almuerzo',
    'Pagué 180 soles de luz con tarjeta Interbank',
    'Me pagaron 2,500 soles de mi quincena',
    'Compré laptop de 900 soles a 3 cuotas con BCP',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-200 dark:border-slate-800 bg-emerald-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-lg">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white">Bot de WhatsApp para Finanzas</h3>
                <span className="bg-emerald-400/30 text-white text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border border-emerald-300/30">
                  IA & Sheets Sync
                </span>
              </div>
              <p className="text-xs text-emerald-100">
                Registra ingresos y gastos enviando un mensaje de WhatsApp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-1">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex-1 py-2.5 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'simulator'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Simulador Interactivo</span>
          </button>
          <button
            onClick={() => setActiveTab('webhook')}
            className={`flex-1 py-2.5 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'webhook'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Webhook URL Vivo</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex-1 py-2.5 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'guide'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Guía de Configuración</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950">
          {activeTab === 'simulator' && (
            <div className="flex flex-col h-[420px] max-w-lg mx-auto bg-[#efeae2] dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-800 overflow-hidden shadow-inner">
              {/* Chat Header */}
              <div className="bg-[#075e54] dark:bg-slate-800 text-white p-3 px-4 flex items-center gap-3">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center font-bold text-white text-xs">
                    WA
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full"></span>
                </div>
                <div>
                  <p className="font-semibold text-xs text-white">Bot Asistente Financiero</p>
                  <p className="text-[10px] text-emerald-200">En línea (Simulador Activo)</p>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 font-sans">
                {chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-2.5 text-xs shadow-sm whitespace-pre-wrap leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-[#dcf8c6] dark:bg-emerald-950 dark:text-emerald-100 text-slate-800 rounded-tr-none'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {msg.text}
                      <span className="block text-[9px] text-slate-400 text-right mt-1 font-mono">
                        {msg.time}
                      </span>
                    </div>
                  </div>
                ))}
                {isSubmitting && (
                  <div className="flex items-start">
                    <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg text-xs text-slate-500 animate-pulse border border-slate-200 dark:border-slate-700">
                      🤖 Procesando con IA y actualizando Sheets...
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Prompt Suggestions */}
              <div className="p-2 bg-slate-200/80 dark:bg-slate-800/80 border-t border-slate-300 dark:border-slate-700 flex gap-1.5 overflow-x-auto scrollbar-none">
                {samplePrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendSimulation(prompt)}
                    className="text-[11px] bg-white dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-full whitespace-nowrap border border-slate-300 dark:border-slate-600 transition-colors"
                  >
                    ⚡ {prompt}
                  </button>
                ))}
              </div>

              {/* Input Bar */}
              <div className="p-2 bg-slate-200 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Escribe un mensaje como en WhatsApp..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendSimulation()}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-full px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                />
                <button
                  onClick={() => handleSendSimulation()}
                  disabled={isSubmitting || !chatMessage.trim()}
                  className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'webhook' && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-emerald-900 dark:text-emerald-200">
                    Endpoint Webhook Activo
                  </h4>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Tu servidor backend Express tiene activa la ruta de Webhook para recibir mensajes reales desde Meta WhatsApp Business API o Twilio.
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    URL del Webhook (Callback URL)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={webhookUrl}
                      className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                    <button
                      onClick={() => handleCopy(webhookUrl, 'url')}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedUrl ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Token de Verificación (Verify Token)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={verifyToken}
                      className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                    <button
                      onClick={() => handleCopy(verifyToken, 'token')}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedToken ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-4 max-w-xl mx-auto text-slate-700 dark:text-slate-300 text-xs">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Opción 1: Meta WhatsApp Business API (100% Oficial)
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-slate-600 dark:text-slate-300 leading-relaxed">
                  <li>
                    Ingresa a{' '}
                    <a
                      href="https://developers.facebook.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline inline-flex items-center gap-1"
                    >
                      Meta for Developers <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    y crea una aplicación de tipo <strong>Business</strong>.
                  </li>
                  <li>Agrega el producto <strong>WhatsApp</strong> a tu app.</li>
                  <li>Ve a <strong>WhatsApp &gt; Configuración de Webhook</strong>.</li>
                  <li>Copia la <strong>URL del Webhook</strong> y el <strong>Verify Token</strong> del tab anterior y pégalos en Meta.</li>
                  <li>¡Listo! Los mensajes enviados a tu número de WhatsApp de prueba crearán registros automáticos en tu cuenta y se sincronizarán con Google Sheets.</li>
                </ol>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                  Opción 2: Twilio WhatsApp Sandbox (Súper fácil para pruebas)
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-slate-600 dark:text-slate-300 leading-relaxed">
                  <li>Regístrate gratis en Twilio y abre el <strong>WhatsApp Sandbox</strong>.</li>
                  <li>Configura la URL en <em>"WHEN A MESSAGE COMES IN"</em> como: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">{webhookUrl}</code></li>
                  <li>Envía un mensaje de texto a tu número de Sandbox y verás la respuesta inteligente al instante.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center">
          <p className="text-[11px] text-slate-500">
            Sincronización automática habilitada con Google Drive y Sheets
          </p>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
