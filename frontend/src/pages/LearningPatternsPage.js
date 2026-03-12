import React, { useCallback, useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { useCompany } from '../hooks/useCompany';
import { accountingMappingsAPI } from '../services/api';
import { BrainCircuit, Loader2, RefreshCw } from 'lucide-react';

export default function LearningPatternsPage() {
  const { currentCompany } = useCompany();
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadPatterns = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const res = await accountingMappingsAPI.listLearningPatterns(currentCompany.id);
      setPatterns(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur de chargement des patterns');
      setPatterns([]);
    } finally {
      setLoading(false);
    }
  }, [currentCompany]);

  useEffect(() => {
    loadPatterns();
  }, [loadPatterns]);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BrainCircuit className="w-6 h-6 text-violet-600" />
              Patterns appris
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Historique des validations réutilisées par le moteur de rapprochement et la classification.
            </p>
          </div>
          <Button variant="outline" onClick={loadPatterns} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Actualiser
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Patterns actifs</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            ) : patterns.length === 0 ? (
              <div className="py-8 text-center text-gray-400">Aucun pattern appris pour le moment</div>
            ) : (
              <div className="space-y-3">
                {patterns.map((pattern) => (
                  <div key={pattern.id} className="border rounded-lg p-4 flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="font-medium text-gray-900 break-all">{pattern.raw_pattern}</div>
                      <div className="text-sm text-gray-500">
                        Type: {pattern.pattern_type} {pattern.transaction_type ? `· ${pattern.transaction_type}` : ''} {pattern.entity_type ? `· ${pattern.entity_type}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={pattern.confidence === 'fort' ? 'bg-green-100 text-green-700' : pattern.confidence === 'moyen' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}>
                        {pattern.confidence || 'faible'}
                      </Badge>
                      <Badge variant="outline">
                        {pattern.times_confirmed || 0} confirmations
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
