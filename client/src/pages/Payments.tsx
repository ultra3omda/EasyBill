import DashboardLayout, { useCompany } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { CreditCard, Building2, Trash2, MoreHorizontal } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

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
    month: "2-digit",
    year: "numeric",
  });
}

const methodLabels: Record<string, string> = {
  cash: "Espèces",
  check: "Chèque",
  bank_transfer: "Virement",
  card: "Carte bancaire",
  other: "Autre",
};

function PaymentsContent() {
  const { selectedCompanyId, companies } = useCompany();
  const [, setLocation] = useLocation();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: payments = [], isLoading } = trpc.payment.list.useQuery(
    { companyId: selectedCompanyId! },
    { enabled: !!selectedCompanyId }
  );

  const deleteMutation = (trpc.payment as any).delete.useMutation({
    onSuccess: () => {
      toast.success("Paiement supprimé");
      utils.payment.list.invalidate();
      utils.invoice.list.invalidate();
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la suppression");
    },
  });

  if (!selectedCompanyId && companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Aucune entreprise</h2>
        <p className="text-muted-foreground mb-4">
          Créez d'abord une entreprise pour voir les paiements.
        </p>
        <Link href="/companies/new">
          <Button>Créer une entreprise</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paiements</h1>
          <p className="text-muted-foreground">Historique des paiements reçus</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun paiement</h3>
              <p className="text-muted-foreground text-center mb-4">
                Les paiements apparaîtront ici une fois enregistrés sur vos factures.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Facture</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                    <TableCell>
                      <Link href={`/invoices/${payment.invoiceId}`}>
                        <span className="font-mono text-primary hover:underline cursor-pointer">
                          {(payment as any).invoiceNumber || `#${payment.invoiceId}`}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>{(payment as any).clientName || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {methodLabels[payment.paymentMethod || "other"] || payment.paymentMethod}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      +{formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => setDeleteId(payment.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le paiement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le solde de la facture sera mis à jour.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Payments() {
  return (
    <DashboardLayout>
      <PaymentsContent />
    </DashboardLayout>
  );
}
