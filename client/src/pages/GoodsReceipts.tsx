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
import { Plus, Search, PackageCheck, Calendar, Eye, Building2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCompany } from "@/components/DashboardLayout";

// Mock data
const mockGoodsReceipts = [
  {
    id: 1,
    receiptNumber: "BR-2025-0001",
    receiptDate: "2025-01-07",
    supplier: "Fournisseur ABC",
    status: "completed",
    purchaseOrderNumber: "BC-2024-0089",
    itemCount: 3,
    notes: "Réception complète",
  },
  {
    id: 2,
    receiptNumber: "BR-2025-0002",
    receiptDate: "2025-01-08",
    supplier: "Société XYZ Import",
    status: "partial",
    purchaseOrderNumber: "BC-2025-0001",
    itemCount: 2,
    notes: "Réception partielle - reste 3 articles",
  },
];

const statusConfig = {
  draft: { label: "Brouillon", variant: "secondary" as const },
  partial: { label: "Partiel", variant: "outline" as const },
  completed: { label: "Complet", variant: "default" as const },
  cancelled: { label: "Annulé", variant: "destructive" as const },
};

function GoodsReceiptsContent() {
  const { selectedCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredReceipts = mockGoodsReceipts.filter(
    (r) =>
      r.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.supplier.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h1 className="text-2xl font-bold tracking-tight">Bons de réception</h1>
          <p className="text-muted-foreground">
            Gérez vos réceptions de marchandises
          </p>
        </div>
        <Button className="gap-2" onClick={() => toast.info("Création à venir")}>
          <Plus className="h-4 w-4" />
          Nouvelle réception
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Réceptions</CardTitle>
            <PackageCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockGoodsReceipts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Complètes</CardTitle>
            <PackageCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {mockGoodsReceipts.filter((r) => r.status === "completed").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partielles</CardTitle>
            <PackageCheck className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {mockGoodsReceipts.filter((r) => r.status === "partial").length}
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
                <TableHead>N° Réception</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Commande liée</TableHead>
                <TableHead className="text-center">Articles</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReceipts.map((receipt) => {
                const status = statusConfig[receipt.status as keyof typeof statusConfig];
                return (
                  <TableRow key={receipt.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <PackageCheck className="h-4 w-4 text-primary" />
                        <span className="font-medium">{receipt.receiptNumber}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {receipt.supplier}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {new Date(receipt.receiptDate).toLocaleDateString("fr-TN")}
                      </div>
                    </TableCell>
                    <TableCell>{receipt.purchaseOrderNumber}</TableCell>
                    <TableCell className="text-center">{receipt.itemCount}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{receipt.notes}</span>
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

export default function GoodsReceipts() {
  return (
    <DashboardLayout>
      <GoodsReceiptsContent />
    </DashboardLayout>
  );
}
