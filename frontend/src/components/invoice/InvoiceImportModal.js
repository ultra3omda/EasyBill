/**
 * Modal d'import de factures fournisseur avec IA.
 * Ouvre directement la zone de dépôt de fichier.
 * Animation Pennylane pendant le traitement.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Upload, FileText, XCircle, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useCompany } from '../../hooks/useCompany';

const API = process.env.REACT_APP_BACKEND_URL;
const token = () => localStorage.getItem('token');

const PROCESSING_STEPS = [
  { id: 'upload', label: 'Document reçu', desc: 'Fichier chargé' },
  { id: 'analyze', label: 'Analyse IA en cours', desc: 'Extraction des données' },
  { id: 'validate', label: 'Préparation', desc: 'Vérification des écritures' },
];

export default function InvoiceImportModal({ open, onOpenChange, onSuccess }) {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [processingStep, setProcessingStep] = useState(0);

  const handleFileSelect = useCallback((selectedFile) => {
    if (!selectedFile) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(selectedFile.type) && !selectedFile.name.match(/\.(pdf|jpg|jpeg|png|webp)$/i)) {
      toast.error('Format non supporté. Utilisez PDF, JPEG, PNG ou WebP.');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 10 Mo)');
      return;
    }
    setFile(selectedFile);
    setParseResult(null);
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => setFilePreview(e.target.result);
      reader.readAsDataURL(selectedFile);
    } else {
      setFilePreview(null);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, [handleFileSelect]);

  const handleParse = useCallback(async () => {
    if (!file || !currentCompany) return;
    setParsing(true);
    setProcessingStep(0);
    setParseResult(null);

    const stepInterval = setInterval(() => {
      setProcessingStep(prev => Math.min(prev + 1, 2));
    }, 800);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API}/api/invoice-scanner/parse?company_id=${currentCompany.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erreur analyse');
      setParseResult(data);
      setProcessingStep(3);
    } catch (e) {
      toast.error(e.message || "Erreur lors de l'analyse du document");
    } finally {
      clearInterval(stepInterval);
      setParsing(false);
    }
  }, [file, currentCompany]);

  useEffect(() => {
    if (open) {
      setFile(null);
      setFilePreview(null);
      setParseResult(null);
      setParsing(false);
      setProcessingStep(0);
    }
  }, [open]);

  useEffect(() => {
    if (file && open && !parseResult && !parsing) {
      handleParse();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, open]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const showDropzone = !parsing && !parseResult;
  const showProcessing = parsing;
  const showConfirm = parseResult && !parsing;

  const goToScannerConfirm = useCallback(() => {
    onOpenChange(false);
    navigate('/invoice-scanner', { state: { preloadedResult: parseResult } });
  }, [navigate, parseResult, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-hidden p-0"
        onPointerDownOutside={(e) => !parsing && e.defaultPrevented}
      >
        {showDropzone && (
          <>
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="w-5 h-5 text-violet-500" />
                Importer une facture (IA)
              </DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6">
              <div
                ref={dropZoneRef}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => !file && fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
                  file ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-violet-400 hover:bg-violet-50/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={e => handleFileSelect(e.target.files?.[0])}
                />
                {file ? (
                  <div className="space-y-3">
                    {filePreview ? (
                      <img src={filePreview} alt="Preview" className="max-h-32 mx-auto rounded-lg shadow-sm" />
                    ) : (
                      <FileText className="w-14 h-14 mx-auto text-violet-600" />
                    )}
                    <p className="font-semibold text-slate-800">{file.name}</p>
                    <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} Ko</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setFile(null); setFilePreview(null); }}
                      className="text-red-500 border-red-200 hover:bg-red-50"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Changer de fichier
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="w-14 h-14 mx-auto text-slate-400" />
                    <p className="font-semibold text-slate-700">Glisser-déposer ou cliquer pour sélectionner</p>
                    <p className="text-sm text-slate-500">PDF, JPEG, PNG, WebP — max 10 Mo</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {showProcessing && (
          <div className="px-6 py-12">
            <div className="flex flex-col items-center justify-center space-y-8">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-violet-100 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-violet-600 animate-spin" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-violet-500 animate-ping" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-slate-900">Analyse en cours</p>
                <p className="text-sm text-slate-500">L'IA extrait les données de votre facture</p>
              </div>
              <div className="w-full max-w-xs space-y-3">
                {PROCESSING_STEPS.map((step, i) => (
                  <div
                    key={step.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                      i <= processingStep
                        ? 'border-violet-200 bg-violet-50'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      i < processingStep ? 'bg-emerald-500 text-white' : i === processingStep ? 'bg-violet-500 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {i < processingStep ? '✓' : i === processingStep ? <Loader2 className="w-4 h-4 animate-spin" /> : i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{step.label}</p>
                      <p className="text-xs text-slate-500">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showConfirm && parseResult && (
          <div className="px-6 py-6 overflow-y-auto max-h-[80vh]">
            {parseResult.duplicate_invoice ? (
              <>
                <div className="flex items-start gap-2 bg-red-50 border border-red-300 rounded-xl p-4 mb-4 text-sm text-red-800">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Facture déjà enregistrée</p>
                    <p className="mt-1">
                      Une facture avec la même référence existe déjà : <strong>{parseResult.duplicate_invoice.supplier_number || parseResult.duplicate_invoice.number || parseResult.duplicate_invoice.id}</strong>.
                      L&apos;import est bloqué pour éviter les doublons.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setParseResult(null); setFile(null); setFilePreview(null); }}>
                    Importer une autre facture
                  </Button>
                  <Button variant="outline" onClick={() => { onOpenChange(false); navigate('/purchases/supplier-invoices'); }}>
                    Voir les factures
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-4">
                  <p className="font-semibold text-emerald-800">Extraction terminée</p>
                  <p className="text-sm text-emerald-700 mt-1">
                    Fournisseur : {parseResult.supplier?.name || '—'} · Total : {(parseResult.invoice?.total || 0).toLocaleString('fr-TN', { minimumFractionDigits: 3 })} TND
                  </p>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  Validez les informations extraites et enregistrez la facture.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setParseResult(null); setFile(null); setFilePreview(null); }}>Importer une autre</Button>
                  <Button className="bg-violet-600 hover:bg-violet-700" onClick={goToScannerConfirm}>
                    <FileText className="w-4 h-4 mr-2" /> Vérifier et enregistrer
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
