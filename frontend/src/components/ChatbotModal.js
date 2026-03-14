import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../hooks/useCompany';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Send, Bot, User, HelpCircle } from 'lucide-react';
import { chatbotAPI } from '../services/api';

const WELCOME_SUGGESTIONS = [
  'client Ahmed',
  'factures impayées',
  'ventes du jour',
  'facture 250 dt pour Ali',
  'Ali a payé 200',
];

const WELCOME_MSG = {
  role: 'bot',
  text: '👋 Bonjour ! Je suis votre assistant financier. Tapez une commande ou cliquez sur une suggestion.',
  id: 'welcome',
  hints: WELCOME_SUGGESTIONS,
};

const MAX_MESSAGES = 100;

function MessageBubble({ msg, onNavigate, onSuggestInsert, onConfirmClient, onConfirmAction, onCancelAction }) {
  const isBot = msg.role === 'bot';
  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-4`}>
      {isBot && (
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
          <Bot className="h-4 w-4 text-blue-600" />
        </div>
      )}
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${isBot ? 'bg-white border shadow-sm' : 'bg-blue-600 text-white'}`}>
        <p className="text-sm">{msg.text}</p>

        {msg.action_result && (
          <div className="mt-3 border-t pt-3 space-y-2">
            {msg.action_result.message && (
              <p className="text-xs font-medium text-gray-700">{msg.action_result.message}</p>
            )}
            {msg.action_result.items && msg.action_result.action === 'list_unpaid' && (
              <div className="space-y-1">
                {msg.action_result.items.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex justify-between text-xs bg-gray-50 rounded px-2 py-1">
                    <span>{item.customer} — {item.number}</span>
                    <span className="font-medium text-red-600">{item.balance_due?.toFixed(3)}</span>
                  </div>
                ))}
                {msg.action_result.count > 5 && (
                  <p className="text-xs text-gray-400">…et {msg.action_result.count - 5} de plus</p>
                )}
              </div>
            )}
            {msg.action_result.action === 'consult_client' && msg.action_result.found && (
              <div className="text-xs space-y-1">
                <div className="flex justify-between"><span>Tél</span><span>{msg.action_result.phone || '—'}</span></div>
                <div className="flex justify-between"><span>Solde dû</span>
                  <span className="font-medium text-red-600">{msg.action_result.balance_due?.toFixed(3)} TND</span>
                </div>
              </div>
            )}
            {['create_invoice', 'create_quote', 'register_payment', 'create_client', 'create_supplier', 'register_purchase'].includes(msg.action_result.action) && msg.action_result.id && (
              <div className="mt-2">
                <Badge className="text-xs bg-green-100 text-green-800 border-green-200">✓ Document créé</Badge>
                <div className="text-xs mt-1 text-gray-600">
                  {msg.action_result.number && <span>N° {msg.action_result.number}</span>}
                </div>
              </div>
            )}
            {msg.action_result.action === 'daily_summary' && (
              <div className="text-xs space-y-1 mt-1">
                <div className="flex justify-between"><span>Factures créées</span><span>{msg.action_result.invoices_created_today ?? 0}</span></div>
                <div className="flex justify-between"><span>Paiements reçus</span><span>{msg.action_result.payments_count ?? 0}</span></div>
                <div className="flex justify-between"><span>Encaissé aujourd'hui</span><span className="font-medium text-green-600">{msg.action_result.total_collected_today?.toFixed(3) ?? 0} TND</span></div>
                <div className="flex justify-between"><span>Impayés en attente</span><span className="font-medium text-red-600">{msg.action_result.unpaid_invoices_total ?? 0}</span></div>
              </div>
            )}
            {msg.action_result.action === 'send_reminder' && msg.action_result.invoice_count > 0 && (
              <div className="text-xs mt-1">
                {msg.action_result.invoice_count} facture(s) · {msg.action_result.total_due?.toFixed(3)} TND à rappeler
              </div>
            )}
            {msg.action_result?.action === 'confirm_execution' && msg.action_result?.action_summary?.length > 0 && !msg.action_result?._resolved && (
              <div className="mt-3 pt-3 border-t border-dashed">
                <ul className="text-xs space-y-1 mb-3">
                  {msg.action_result.action_summary.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-600">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onConfirmAction && onConfirmAction()}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700"
                  >
                    Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={() => onCancelAction && onCancelAction()}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
            {msg.action_result?.action === 'confirm_client' && msg.action_result?.client_suggestions?.length > 0 && !msg.action_result?._resolved && (
              <div className="mt-3 pt-3 border-t border-dashed">
                <p className="text-xs text-gray-600 font-medium mb-2">Sélectionnez le client :</p>
                <div className="flex flex-col gap-2">
                  {msg.action_result.client_suggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onConfirmClient && onConfirmClient(c.id, c.display_name)}
                      className="text-left px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-sm font-medium text-blue-900 transition-colors"
                    >
                      <span>{c.display_name}</span>
                      {c.company_name && <span className="text-xs text-gray-500 ml-1">— {c.company_name}</span>}
                      {c.email && <span className="block text-xs text-gray-500 mt-0.5">{c.email}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msg.action_result?.suggestions && msg.action_result.suggestions.length > 0 && msg.action_result?.action !== 'confirm_client' && (
              <div className="mt-2 pt-2 border-t border-dashed">
                <p className="text-xs text-amber-700 font-medium mb-1">💡 Essayez :</p>
                <div className="flex flex-wrap gap-1">
                  {msg.action_result.suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSuggestInsert && onSuggestInsert(s)}
                      className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                    >
                      « {s} »
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {msg.hints && msg.hints.length > 0 && (
          <div className="mt-2 pt-2 border-t border-dashed">
            <p className="text-xs text-amber-700 font-medium mb-1">💡 Essayez :</p>
            <div className="flex flex-wrap gap-1">
              {msg.hints.map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSuggestInsert && onSuggestInsert(h)}
                  className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                >
                  « {h} »
                </button>
              ))}
            </div>
          </div>
        )}
        {msg.suggested_actions && msg.suggested_actions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {msg.suggested_actions.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => { if (a.path && onNavigate) onNavigate(a.path); }}
                className="text-xs border rounded-full px-2 py-0.5 text-blue-600 border-blue-200 hover:bg-blue-50 cursor-pointer"
              >
                {a.title}
              </button>
            ))}
          </div>
        )}
        {msg.confidence !== undefined && msg.confidence < 0.7 && (
          <div className="mt-2 flex items-center gap-1">
            <HelpCircle className="h-3 w-3 text-yellow-500" />
            <span className="text-xs text-yellow-600">Confiance : {Math.round(msg.confidence * 100)}%</span>
          </div>
        )}
      </div>
      {!isBot && (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center ml-2 flex-shrink-0">
          <User className="h-4 w-4 text-gray-600" />
        </div>
      )}
    </div>
  );
}

export default function ChatbotModal({ open, onOpenChange }) {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const bottomRef = useRef(null);

  const markResolvedFromHistory = (msgs) => {
    return msgs.map((m, i) => {
      if (m.role === 'bot' && m.action_result && (m.action_result.action === 'confirm_execution' || m.action_result.action === 'confirm_client')) {
        const nextMsg = msgs[i + 1];
        if (nextMsg && nextMsg.role === 'user') {
          return { ...m, action_result: { ...m.action_result, _resolved: true } };
        }
      }
      return m;
    });
  };

  useEffect(() => {
    if (!open || !currentCompany) return;
    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const res = await chatbotAPI.getHistory(currentCompany.id, 50);
        const hist = res.data?.messages || [];
        const processed = hist.length > 0 ? markResolvedFromHistory(hist) : hist;
        setMessages(processed.length > 0 ? processed : [WELCOME_MSG]);
      } catch {
        setMessages([WELCOME_MSG]);
      } finally {
        setLoadingHistory(false);
      }
    };
    loadHistory();
  }, [open, currentCompany?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text, selectedClientId = null, confirmAction = false, cancelAction = false) => {
    const displayText = typeof text === 'string' ? text : (text?.display_name || '');
    if (!displayText.trim() && !selectedClientId && !confirmAction && !cancelAction) return;
    if (!currentCompany) return;

    const userMsg = { role: 'user', text: confirmAction ? 'Confirmer' : (cancelAction ? 'Annuler' : (displayText || 'Confirmation client')), id: Date.now() };
    setMessages(prev => {
      const next = [...prev, userMsg];
      const trimmed = next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      if (confirmAction || cancelAction || selectedClientId) {
        return trimmed.map(m => {
          if (m.role === 'bot' && m.action_result && (m.action_result.action === 'confirm_execution' || m.action_result.action === 'confirm_client')) {
            return { ...m, action_result: { ...m.action_result, _resolved: true } };
          }
          return m;
        });
      }
      return trimmed;
    });
    setInput('');
    setLoading(true);

    try {
      const payload = {
        text: displayText || (confirmAction ? 'Confirmer' : (cancelAction ? 'Annuler' : 'Confirmation')),
        ...(selectedClientId && { selected_client_id: selectedClientId }),
        ...(confirmAction && { confirm_action: true }),
        ...(cancelAction && { cancel_action: true }),
      };
      const res = await chatbotAPI.sendMessage(currentCompany.id, payload);
      const data = res.data;
      const botMsg = {
        role: 'bot',
        text: data.response_text || 'Commande traitée.',
        intent: data.intent,
        confidence: data.confidence,
        missing_fields: data.missing_fields,
        action_result: data.action_result,
        suggested_actions: data.suggested_actions,
        hints: data.hints || [],
        id: Date.now() + 1
      };
      setMessages(prev => {
        const next = [...prev, botMsg];
        const out = next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
        if (confirmAction || cancelAction || selectedClientId) {
          return out.map(m => {
            if (m.role === 'bot' && m.action_result && (m.action_result.action === 'confirm_execution' || m.action_result.action === 'confirm_client') && m.id !== botMsg.id) {
              return { ...m, action_result: { ...m.action_result, _resolved: true } };
            }
            return m;
          });
        }
        return out;
      });
    } catch (e) {
      setMessages(prev => {
        const next = [...prev, {
          role: 'bot',
          text: 'Erreur : impossible de traiter la commande.',
          id: Date.now() + 1
        }];
        return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (path) => {
    onOpenChange?.(false);
    navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            Assistant Financier
          </DialogTitle>
          <p className="text-xs text-gray-500 mt-1">Commandes en langage naturel</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 min-h-[280px] bg-gray-50/50">
          {loadingHistory ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Chargement…</div>
          ) : (
            messages.map(msg => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onNavigate={handleNavigate}
                onSuggestInsert={setInput}
                onConfirmClient={(clientId, displayName) => sendMessage(displayName, clientId)}
                onConfirmAction={() => sendMessage('', null, true)}
                onCancelAction={() => sendMessage('', null, false, true)}
              />
            ))
          )}
          {loading && (
            <div className="flex justify-start mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                <Bot className="h-4 w-4 text-blue-600" />
              </div>
              <div className="bg-white border rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t bg-white shrink-0">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              placeholder="Ex: facture 250 dt pour Ali, client Ahmed…"
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={() => sendMessage(input)} disabled={loading || !input.trim()} className="shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
