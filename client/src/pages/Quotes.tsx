import DashboardLayout, { useCompany } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Plus, FileText, Edit, Trash2, MoreHorizontal, Building2, Eye, Send, FileCheck } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  rejected: "Refusé",
  expired: "Expiré",
  converted: "Converti",
};

function QuotesContent() {
  const { selectedCompanyId, companies } = useCompany();
  const [, setLocation] = useLocation();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const utils = trpc.useUtils();

  const { data: quotes = [], isLoading } = trpc.quote.list.useQuery(
    { 
      companyId: selectedCompanyId!, 
      status: statusFilter !== "all" ? statusFilter : undefined 
    },
    { enabled: !!selectedCompanyId }
  );

  const deleteMutation = (trpc.quote as any).delete.useMutation({
    onSuccess: () => {
      toast.success("Devis supprimé");
      utils.quote.list.invalidate();
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la suppression");
    },
  });

  const updateStatusMutation = trpc.quote.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Statut mis à jour");
      utils.quote.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la mise à jour");
    },
  });

  const convertToInvoiceMutation = trpc.quote.convertToInvoice.useMutation({
    onSuccess: (data) => {
      toast.success("Devis converti en facture");
      utils.quote.list.invalidate();
      utils.invoice.list.invalidate();
      setLocation(`/invoices/${data.invoiceId}`);
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la conversion");
    },
  });

  if (!selectedCompanyId && companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Aucune entreprise</h2>
        <p className="text-muted-foreground mb-4">
          Créez d'abord une entreprise pour créer des devis.
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
          <h1 className="text-2xl font-bold tracking-tight">Devis</h1>
          <p className="text-muted-foreground">Gérez vos devis clients</p>
        </div>
        <Link href="/quotes/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nouveau devis
          </Button>
        </Link>
      </div>

      <div className="flex gap-4 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="draft">Brouillon</SelectItem>
            <SelectItem value="sent">Envoyé</SelectItem>
            <SelectItem value="accepted">Accepté</SelectItem>
            <SelectItem value="rejected">Refusé</SelectItem>
            <SelectItem value="expired">Expiré</SelectItem>
            <SelectItem value="converted">Converti</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : quotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun devis</h3>
              <p className="text-muted-foreground text-center mb-4">
                {statusFilter !== "all" 
                  ? "Aucun devis avec ce statut" 
                  : "Créez votre premier devis"}
              </p>
              {statusFilter === "all" && (
                <Link href="/quotes/new">
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Créer un devis
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Validité</TableHead>
                  <TableHead className="text-right">Total TTC</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((quote) => (
                  <TableRow 
                    key={quote.id} 
                    className="cursor-pointer"
                    onClick={() => setLocation(`/quotes/${quote.id}`)}
                  >
                    <TableCell className="font-mono font-medium">
                      {quote.quoteNumber}
                    </TableCell>
                    <TableCell>
                      {(quote as any).clientName || "Client"}
                    </TableCell>
                    <TableCell>{formatDate(quote.issueDate)}</TableCell>
                    <TableCell>{formatDate(quote.validUntil)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(quote.total)}
                    </TableCell>
                    <TableCell>
                      <Badge className={`status-${quote.status}`}>
                        {statusLabels[quote.status] || quote.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/quotes/${quote.id}`);
                          }}>
                            <Eye className="mr-2 h-4 w-4" />
                            Voir
                          </DropdownMenuItem>
                          {quote.status === "draft" && (
                            <>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setLocation(`/quotes/${quote.id}/edit`);
                              }}>
                                <Edit className="mr-2 h-4 w-4" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                updateStatusMutation.mutate({ id: quote.id, status: "sent" });
                              }}>
                                <Send className="mr-2 h-4 w-4" />
                                Marquer envoyé
                              </DropdownMenuItem>
                            </>
                          )}
                          {(quote.status === "sent" || quote.status === "accepted") && (
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              convertToInvoiceMutation.mutate({ id: quote.id });
                            }}>
                              <FileCheck className="mr-2 h-4 w-4" />
                              Convertir en facture
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(quote.id);
                            }}
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
            <AlertDialogTitle>Supprimer le devis ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
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

export default function Quotes() {
  return (
    <DashboardLayout>
      <QuotesContent />
    </DashboardLayout>
  );
}
