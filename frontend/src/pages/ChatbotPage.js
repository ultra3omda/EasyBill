import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../hooks/useCompany';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Send, Bot, User, Zap, HelpCircle } from 'lucide-react';
import { chatbotAPI } from '../services/api';

const EXAMPLES = [
  { text: 'facture 250 dt pour Ali réparation moteur', intent: 'Créer une facture' },
  { text: 'devis 500 dt pour Ahmed installation clim', intent: 'Créer un devis' },
  { text: 'client Ahmed', intent: 'Consulter un client' },
  { text: 'factures impayées', intent: 'Voir les impayés' },
  { text: 'Ali a payé 200', intent: 'Enregistrer paiement' },
  { text: 'rappeler Ahmed', intent: 'Envoyer rappel' },
  { text: 'rapport aujourd\'hui', intent: 'Rapport journalier' },
];

function MessageBubble({ msg, onNavigate, onSuggestClick }) {
  const isBot = msg.role === 'bot';
  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-4`}>
      {isBot && (
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
          <Bot className="h-4 w-4 text-blue-600" />
        </div>
      )}
      <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${isBot ? 'bg-white border shadow-sm' : 'bg-blue-600 text-white'}`}>
        <p className="text-sm">{msg.text}</p>

        {/* Résultat de l'action */}
        {msg.action_result && (
          <div className="mt-3 border-t pt-3 space-y-2">
            {msg.action_result.message && (
              <p className="text-xs font-medium text-gray-700">{msg.action_result.message}</p>
            )}

            {/* Liste factures impayées */}
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

            {/* Info client */}
            {msg.action_result.action === 'consult_client' && msg.action_result.found && (
              <div className="text-xs space-y-1">
                <div className="flex justify-between"><span>Tél</span><span>{msg.action_result.phone || '—'}</span></div>
                <div className="flex justify-between"><span>Solde dû</span>
                  <span className="font-medium text-red-600">{msg.action_result.balance_due?.toFixed(3)} TND</span>
                </div>
              </div>
            )}

            {/* Document créé (facture, devis, paiement) */}
            {['create_invoice', 'create_quote', 'register_payment'].includes(msg.action_result.action) && msg.action_result.id && (
              <div className="mt-2">
                <Badge className="text-xs bg-green-100 text-green-800 border-green-200">✓ Document créé</Badge>
                <div className="text-xs mt-1 text-gray-600">
                  {msg.action_result.number && <span>N° {msg.action_result.number}</span>}
                </div>
              </div>
            )}

            {/* Pre-fill (fallback si ancienne réponse) */}
            {msg.action_result.prefill && (
              <div className="mt-2">
                <Badge className="text-xs">Données pré-remplies</Badge>
                <div className="text-xs mt-1 text-gray-500">
                  Client : {msg.action_result.prefill.customer_name || '?'} · {msg.action_result.prefill.amount} TND
                </div>
              </div>
            )}

            {/* Résumé journalier */}
            {msg.action_result.action === 'daily_summary' && (
              <div className="text-xs space-y-1 mt-1">
                <div className="flex justify-between"><span>Factures créées</span><span>{msg.action_result.invoices_created_today ?? 0}</span></div>
                <div className="flex justify-between"><span>Paiements reçus</span><span>{msg.action_result.payments_count ?? 0}</span></div>
                <div className="flex justify-between"><span>Encaissé aujourd'hui</span><span className="font-medium text-green-600">{msg.action_result.total_collected_today?.toFixed(3) ?? 0} TND</span></div>
                <div className="flex justify-between"><span>Impayés en attente</span><span className="font-medium text-red-600">{msg.action_result.unpaid_invoices_total ?? 0}</span></div>
              </div>
            )}

            {/* Rappel envoyé */}
            {msg.action_result.action === 'send_reminder' && msg.action_result.invoice_count > 0 && (
              <div className="text-xs mt-1">
                {msg.action_result.invoice_count} facture(s) · {msg.action_result.total_due?.toFixed(3)} TND à rappeler
              </div>
            )}

            {/* Suggestions intelligentes (client non trouvé, etc.) */}
            {msg.action_result?.suggestions && msg.action_result.suggestions.length > 0 && (
              <div className="mt-2 pt-2 border-t border-dashed">
                <p className="text-xs text-amber-700 font-medium mb-1">💡 Essayez :</p>
                <div className="flex flex-wrap gap-1">
                  {msg.action_result.suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSuggestClick && onSuggestClick(s)}
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

        {/* Suggestions globales (hints) */}
        {msg.hints && msg.hints.length > 0 && (
          <div className="mt-2 pt-2 border-t border-dashed">
            <p className="text-xs text-amber-700 font-medium mb-1">💡 Essayez :</p>
            <div className="flex flex-wrap gap-1">
              {msg.hints.map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSuggestClick && onSuggestClick(h)}
                  className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                >
                  « {h} »
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Boutons d'action rapide */}
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

        {/* Confiance */}
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

const WELCOME_MSG = {
  role: 'bot',
  text: '👋 Bonjour ! Je suis votre assistant financier. Tapez une commande en langage naturel.',
  id: 'welcome'
};

const MAX_MESSAGES = 20;

export default function ChatbotPage() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!currentCompany) return;
    const loadHistory = async () => {
      try {
        const res = await chatbotAPI.getHistory(currentCompany.id, MAX_MESSAGES);
        const hist = res.data?.messages || [];
        setMessages(hist.length > 0 ? hist : [WELCOME_MSG]);
      } catch {
        setMessages([WELCOME_MSG]);
      } finally {
        setLoadingHistory(false);
      }
    };
    loadHistory();
  }, [currentCompany?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    if (!text.trim() || !currentCompany) return;

    const userMsg = { role: 'user', text, id: Date.now() };
    setMessages(prev => {
      const next = [...prev, userMsg];
      return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
    });
    setInput('');
    setLoading(true);

    try {
      const res = await chatbotAPI.sendMessage(currentCompany.id, { text });
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
        return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
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

  return (
    <AppLayout>
      <div className="p-6 h-[calc(100vh-80px)] flex gap-6">
        {/* Chat principal */}
        <div className="flex-1 flex flex-col">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bot className="h-6 w-6 text-blue-600" /> Assistant Financier
            </h1>
            <p className="text-gray-500 text-sm">Commandes en langage naturel — compatible WhatsApp & Messenger</p>
          </div>

          {/* Messages */}
          <Card className="flex-1 overflow-y-auto p-4">
            {loadingHistory ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Chargement de l'historique…</div>
            ) : (
              messages.map(msg => <MessageBubble key={msg.id} msg={msg} onNavigate={navigate} onSuggestClick={sendMessage} />)
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
          </Card>

          {/* Input */}
          <div className="flex gap-2 mt-4">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              placeholder="Ex: facture 250 dt pour Ali réparation moteur…"
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Panneau d'exemples */}
        <div className="w-72 flex-shrink-0">
          <Card className="p-4">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" /> Commandes rapides
            </h2>
            <div className="space-y-2">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(ex.text)}
                  className="w-full text-left p-2 rounded-lg border hover:bg-blue-50 hover:border-blue-200 transition-colors"
                >
                  <div className="text-xs font-medium text-blue-600">{ex.intent}</div>
                  <div className="text-xs text-gray-500 mt-0.5 italic">"{ex.text}"</div>
                </button>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t">
              <h3 className="text-xs font-medium text-gray-500 mb-2">Variables supportées</h3>
              <div className="text-xs text-gray-400 space-y-1">
                <div>• <code className="bg-gray-100 px-1 rounded">dt</code> ou <code className="bg-gray-100 px-1 rounded">dinar</code> pour TND</div>
                <div>• Nom du client après <code className="bg-gray-100 px-1 rounded">pour</code></div>
                <div>• Description après le client</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
