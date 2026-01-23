import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Edit, Download, Send, CreditCard, Printer } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function formatCurrency(amount: string | number) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("fr-TN", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 3,
  }).format(num);
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("fr-TN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  paid: "Payée",
  partial: "Partielle",
  overdue: "En retard",
  cancelled: "Annulée",
};

function InvoiceViewContent() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const utils = trpc.useUtils();

  const { data: invoice, isLoading } = trpc.invoice.get.useQuery(
    { id: parseInt(params.id || "0") },
    { enabled: !!params.id }
  );

  const updateStatusMutation = trpc.invoice.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Statut mis à jour");
      utils.invoice.get.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erreur");
    },
  });

  const addPaymentMutation = trpc.payment.create.useMutation({
    onSuccess: () => {
      toast.success("Paiement enregistré");
      utils.invoice.get.invalidate();
      setPaymentOpen(false);
      setPaymentAmount("");
    },
    onError: (error) => {
      toast.error(error.message || "Erreur");
    },
  });

  const handleAddPayment = () => {
    if (!invoice || !paymentAmount) return;
    addPaymentMutation.mutate({
      companyId: invoice.companyId,
      invoiceId: invoice.id,
      amount: paymentAmount,
      paymentMethod: paymentMethod as "cash" | "check" | "bank_transfer" | "card" | "other",
      paymentDate: new Date(),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-semibold mb-2">Facture introuvable</h2>
        <Link href="/invoices">
          <Button>Retour aux factures</Button>
        </Link>
      </div>
    );
  }

  const items = (invoice as any).items || [];
  const client = (invoice as any).client;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight font-mono">
                {invoice.invoiceNumber}
              </h1>
              <Badge className={`status-${invoice.status}`}>
                {statusLabels[invoice.status] || invoice.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Émise le {formatDate(invoice.issueDate)}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {invoice.status === "draft" && (
            <>
              <Link href={`/invoices/${invoice.id}/edit`}>
                <Button variant="outline" className="gap-2">
                  <Edit className="h-4 w-4" />
                  Modifier
                </Button>
              </Link>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => updateStatusMutation.mutate({ id: invoice.id, status: "sent" })}
              >
                <Send className="h-4 w-4" />
                Marquer envoyée
              </Button>
            </>
          )}
          
          {(invoice.status === "sent" || invoice.status === "partial" || invoice.status === "overdue") && (
            <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  Enregistrer paiement
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enregistrer un paiement</DialogTitle>
                  <DialogDescription>
                    Reste à payer: {formatCurrency(invoice.amountDue)}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Montant</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="0.000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mode de paiement</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Espèces</SelectItem>
                        <SelectItem value="check">Chèque</SelectItem>
                        <SelectItem value="bank_transfer">Virement</SelectItem>
                        <SelectItem value="card">Carte bancaire</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPaymentOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleAddPayment} disabled={addPaymentMutation.isPending}>
                    Enregistrer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <Button variant="outline" className="gap-2" onClick={() => toast.info("Fonctionnalité PDF à venir")}>
            <Download className="h-4 w-4" />
            PDF
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimer
          </Button>
        </div>
      </div>

      {/* Invoice Content */}
      <Card className="print:shadow-none">
        <CardContent className="p-8">
          {/* Header */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div>
              <h2 className="text-xl font-bold mb-2">{(invoice as any).company?.name || "Entreprise"}</h2>
              {(invoice as any).company?.address && (
                <p className="text-muted-foreground">{(invoice as any).company.address}</p>
              )}
              {(invoice as any).company?.city && (
                <p className="text-muted-foreground">
                  {(invoice as any).company.postalCode} {(invoice as any).company.city}
                </p>
              )}
              {(invoice as any).company?.taxId && (
                <p className="text-sm font-mono mt-2">
                  MF: {(invoice as any).company.taxId}
                </p>
              )}
            </div>
            <div className="text-right">
              <h3 className="font-semibold mb-2">Facturé à:</h3>
              <p className="font-medium">{client?.name || "Client"}</p>
              {client?.address && <p className="text-muted-foreground">{client.address}</p>}
              {client?.city && (
                <p className="text-muted-foreground">
                  {client.postalCode} {client.city}
                </p>
              )}
              {client?.taxId && (
                <p className="text-sm font-mono mt-2">MF: {client.taxId}</p>
              )}
            </div>
          </div>

          {/* Invoice Info */}
          <div className="grid md:grid-cols-3 gap-4 mb-8 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Numéro</p>
              <p className="font-mono font-medium">{invoice.invoiceNumber}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date d'émission</p>
              <p className="font-medium">{formatDate(invoice.issueDate)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date d'échéance</p>
              <p className="font-medium">{formatDate(invoice.dueDate)}</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-8">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 font-medium">Description</th>
                  <th className="text-right py-3 font-medium">Qté</th>
                  <th className="text-right py-3 font-medium">Prix unit. HT</th>
                  <th className="text-right py-3 font-medium">TVA</th>
                  <th className="text-right py-3 font-medium">Total HT</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, index: number) => (
                  <tr key={index} className="border-b">
                    <td className="py-3">{item.description}</td>
                    <td className="text-right py-3">{item.quantity}</td>
                    <td className="text-right py-3">{formatCurrency(item.unitPrice)}</td>
                    <td className="text-right py-3">{item.vatRate}%</td>
                    <td className="text-right py-3 font-medium">
                      {formatCurrency(parseFloat(item.quantity) * parseFloat(item.unitPrice))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full md:w-80 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sous-total HT</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">TVA</span>
                <span>{formatCurrency((invoice as any).vatAmount || "0")}</span>
              </div>
              {parseFloat((invoice as any).fodecAmount || "0") > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">FODEC</span>
                  <span>{formatCurrency((invoice as any).fodecAmount || "0")}</span>
                </div>
              )}
              {(invoice as any).fiscalStampAmount && parseFloat((invoice as any).fiscalStampAmount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Timbre fiscal</span>
                  <span>{formatCurrency((invoice as any).fiscalStampAmount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t font-semibold text-lg">
                <span>Total TTC</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>
              {parseFloat(invoice.amountPaid) > 0 && (
                <>
                  <div className="flex justify-between text-green-600">
                    <span>Payé</span>
                    <span>-{formatCurrency(invoice.amountPaid)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-red-600">
                    <span>Reste à payer</span>
                    <span>{formatCurrency(invoice.amountDue)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="mt-8 pt-8 border-t">
              <h4 className="font-medium mb-2">Notes</h4>
              <p className="text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}

          {/* Bank Info */}
          {(invoice as any).company?.bankName && (
            <div className="mt-8 pt-8 border-t">
              <h4 className="font-medium mb-2">Coordonnées bancaires</h4>
              <p className="text-muted-foreground">
                {(invoice as any).company.bankName}
                {(invoice as any).company.bankIban && (
                  <span className="font-mono ml-2">RIB: {(invoice as any).company.bankIban}</span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payments History */}
      {(invoice as any).payments && (invoice as any).payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historique des paiements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(invoice as any).payments.map((payment: any) => (
                <div key={payment.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">{formatCurrency(payment.amount)}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(payment.paymentDate)} - {payment.paymentMethod}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-green-600">
                    Payé
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function InvoiceView() {
  return (
    <DashboardLayout>
      <InvoiceViewContent />
    </DashboardLayout>
  );
}
