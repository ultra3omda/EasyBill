import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, FileText, Calendar, Eye, Building2, CreditCard } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCompany } from "@/components/DashboardLayout";

// Mock data
const mockSupplierInvoices = [
  {
    id: 1,
    invoiceNumber: "FF-2025-0001",
    supplierInvoiceNumber: "INV-ABC-2025-001",
    invoiceDate: "2025-01-05",
    dueDate: "2025-02-05",
    supplier: "Fournisseur ABC",
    status: "unpaid",
    subtotal: 5000.000,
    totalVat: 950.000,
    total: 5950.000,
    paidAmount: 0,
  },
  {
    id: 2,
    invoiceNumber: "FF-2024-0089",
    supplierInvoiceNumber: "XYZ-2024-456",
    invoiceDate: "2024-12-20",
    dueDate: "2025-01-20",
    supplier: "Société XYZ Import",
    status: "partial",
    subtotal: 12500.000,
    totalVat: 2375.000,
    total: 14875.000,
    paidAmount: 7000.000,
  },
  {
    id: 3,
    invoiceNumber: "FF-2024-0085",
    supplierInvoiceNumber: "DEF-789",
    invoiceDate: "2024-12-10",
    dueDate: "2025-01-10",
    supplier: "Fournisseur DEF",
    status: "paid",
    subtotal: 3200.000,
    totalVat: 608.000,
    total: 3808.000,
    paidAmount: 3808.000,
  },
];

const statusConfig = {
  draft: { label: "Brouillon", variant: "secondary" as const },
  unpaid: { label: "Non payée", variant: "destructive" as const },
  partial: { label: "Partielle", variant: "outline" as const },
  paid: { label: "Payée", variant: "default" as const },
  overdue: { label: "En retard", variant: "destructive" as const },
};

function SupplierInvoicesContent() {
  const { selectedCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredInvoices = mockSupplierInvoices.filter(
    (i) =>
      i.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.supplierInvoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-TN", {
      style: "currency",
      currency: "TND",
      minimumFractionDigits: 3,
    }).format(amount);
  };

  if (!selectedCompanyId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Veuillez sélectionner une entreprise</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Factures fournisseur</h1>
          <p className="text-muted-foreground">
            Gérez vos factures d'achat
          </p>
        </div>
        <Button className="gap-2" onClick={() => toast.info("Création à venir")}>
          <Plus className="h-4 w-4" />
          Nouvelle facture
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Factures</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockSupplierInvoices.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">À payer</CardTitle>
            <CreditCard className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(
                mockSupplierInvoices
                  .filter((i) => i.status !== "paid")
                  .reduce((sum, i) => sum + (i.total - i.paidAmount), 0)
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payées</CardTitle>
            <CreditCard className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {mockSupplierInvoices.filter((i) => i.status === "paid").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En retard</CardTitle>
            <CreditCard className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {mockSupplierInvoices.filter((i) => i.status === "overdue").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Facture</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Réf. Fournisseur</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead className="text-right">Montant TTC</TableHead>
                <TableHead className="text-right">Reste à payer</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => {
                const status = statusConfig[invoice.status as keyof typeof statusConfig];
                const remaining = invoice.total - invoice.paidAmount;
                return (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="font-medium">{invoice.invoiceNumber}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {invoice.supplier}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {invoice.supplierInvoiceNumber}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {new Date(invoice.invoiceDate).toLocaleDateString("fr-TN")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {new Date(invoice.dueDate).toLocaleDateString("fr-TN")}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(invoice.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      {remaining > 0 ? (
                        <span className="font-medium text-red-600">{formatCurrency(remaining)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => toast.info("Détails à venir")}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SupplierInvoices() {
  return (
    <DashboardLayout>
      <SupplierInvoicesContent />
    </DashboardLayout>
  );
}
