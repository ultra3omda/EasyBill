import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Edit, Download, Send, FileCheck, Printer } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

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
  sent: "Envoyé",
  accepted: "Accepté",
  rejected: "Refusé",
  expired: "Expiré",
  converted: "Converti",
};

function QuoteViewContent() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: quote, isLoading } = trpc.quote.get.useQuery(
    { id: parseInt(params.id || "0") },
    { enabled: !!params.id }
  );

  const updateStatusMutation = trpc.quote.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Statut mis à jour");
      utils.quote.get.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur");
    },
  });

  const convertToInvoiceMutation = trpc.quote.convertToInvoice.useMutation({
    onSuccess: (data) => {
      toast.success("Devis converti en facture");
      utils.quote.get.invalidate();
      utils.invoice.list.invalidate();
      setLocation(`/invoices/${data.invoiceId}`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-semibold mb-2">Devis introuvable</h2>
        <Link href="/quotes">
          <Button>Retour aux devis</Button>
        </Link>
      </div>
    );
  }

  const items = (quote as any).items || [];
  const client = (quote as any).client;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/quotes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight font-mono">
                {quote.quoteNumber}
              </h1>
              <Badge className={`status-${quote.status}`}>
                {statusLabels[quote.status] || quote.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Émis le {formatDate(quote.issueDate)} - Valide jusqu'au {formatDate(quote.validUntil)}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {quote.status === "draft" && (
            <>
              <Link href={`/quotes/${quote.id}/edit`}>
                <Button variant="outline" className="gap-2">
                  <Edit className="h-4 w-4" />
                  Modifier
                </Button>
              </Link>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => updateStatusMutation.mutate({ id: quote.id, status: "sent" })}
              >
                <Send className="h-4 w-4" />
                Marquer envoyé
              </Button>
            </>
          )}
          
          {(quote.status === "sent" || quote.status === "accepted") && (
            <Button
              className="gap-2"
              onClick={() => convertToInvoiceMutation.mutate({ id: quote.id })}
            >
              <FileCheck className="h-4 w-4" />
              Convertir en facture
            </Button>
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

      <Card className="print:shadow-none">
        <CardContent className="p-8">
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div>
              <h2 className="text-xl font-bold mb-2">{(quote as any).company?.name || "Entreprise"}</h2>
              {(quote as any).company?.address && (
                <p className="text-muted-foreground">{(quote as any).company.address}</p>
              )}
              {(quote as any).company?.city && (
                <p className="text-muted-foreground">
                  {(quote as any).company.postalCode} {(quote as any).company.city}
                </p>
              )}
              {(quote as any).company?.taxId && (
                <p className="text-sm font-mono mt-2">
                  MF: {(quote as any).company.taxId}
                </p>
              )}
            </div>
            <div className="text-right">
              <h3 className="font-semibold mb-2">Destinataire:</h3>
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

          <div className="grid md:grid-cols-3 gap-4 mb-8 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Numéro</p>
              <p className="font-mono font-medium">{quote.quoteNumber}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date d'émission</p>
              <p className="font-medium">{formatDate(quote.issueDate)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valide jusqu'au</p>
              <p className="font-medium">{formatDate(quote.validUntil)}</p>
            </div>
          </div>

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

          <div className="flex justify-end">
            <div className="w-full md:w-80 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sous-total HT</span>
                <span>{formatCurrency(quote.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">TVA</span>
                <span>{formatCurrency((quote as any).vatAmount || "0")}</span>
              </div>
              <div className="flex justify-between pt-2 border-t font-semibold text-lg">
                <span>Total TTC</span>
                <span>{formatCurrency(quote.total)}</span>
              </div>
            </div>
          </div>

          {quote.notes && (
            <div className="mt-8 pt-8 border-t">
              <h4 className="font-medium mb-2">Notes</h4>
              <p className="text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function QuoteView() {
  return (
    <DashboardLayout>
      <QuoteViewContent />
    </DashboardLayout>
  );
}
