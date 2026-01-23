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
import { Plus, Search, FileX, Calendar, Eye, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCompany } from "@/components/DashboardLayout";

// Mock data
const mockCreditNotes = [
  {
    id: 1,
    noteNumber: "AV-2025-0001",
    issueDate: "2025-01-05",
    client: "Transport terrestre de M/dises",
    status: "issued",
    subtotal: 500.000,
    totalVat: 95.000,
    total: 595.000,
    invoiceNumber: "FAC-2024-0087",
    reason: "Retour marchandise défectueuse",
  },
  {
    id: 2,
    noteNumber: "AV-2024-0012",
    issueDate: "2024-12-20",
    client: "Société ABC",
    status: "applied",
    subtotal: 1200.000,
    totalVat: 228.000,
    total: 1428.000,
    invoiceNumber: "FAC-2024-0075",
    reason: "Erreur de facturation",
  },
];

const statusConfig = {
  draft: { label: "Brouillon", variant: "secondary" as const },
  issued: { label: "Émis", variant: "default" as const },
  applied: { label: "Appliqué", variant: "outline" as const },
  cancelled: { label: "Annulé", variant: "destructive" as const },
};

function CreditNotesContent() {
  const { selectedCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredNotes = mockCreditNotes.filter(
    (n) =>
      n.noteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.client.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-2xl font-bold tracking-tight">Factures d'avoir</h1>
          <p className="text-muted-foreground">
            Gérez vos avoirs et remboursements
          </p>
        </div>
        <Button className="gap-2" onClick={() => toast.info("Création à venir")}>
          <Plus className="h-4 w-4" />
          Nouvel avoir
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Avoirs</CardTitle>
            <FileX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockCreditNotes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Montant Total</CardTitle>
            <FileX className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(mockCreditNotes.reduce((sum, n) => sum + n.total, 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En attente</CardTitle>
            <FileX className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {mockCreditNotes.filter((n) => n.status === "issued").length}
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
                <TableHead>N° Avoir</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Facture liée</TableHead>
                <TableHead>Raison</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNotes.map((note) => {
                const status = statusConfig[note.status as keyof typeof statusConfig];
                return (
                  <TableRow key={note.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileX className="h-4 w-4 text-red-500" />
                        <span className="font-medium">{note.noteNumber}</span>
                      </div>
                    </TableCell>
                    <TableCell>{note.client}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {new Date(note.issueDate).toLocaleDateString("fr-TN")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        {note.invoiceNumber}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{note.reason}</span>
                    </TableCell>
                    <TableCell className="text-right font-medium text-red-600">
                      -{formatCurrency(note.total)}
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

export default function CreditNotes() {
  return (
    <DashboardLayout>
      <CreditNotesContent />
    </DashboardLayout>
  );
}
