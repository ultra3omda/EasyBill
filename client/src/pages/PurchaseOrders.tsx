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
import { Plus, Search, ShoppingCart, Calendar, Eye, Building2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCompany } from "@/components/DashboardLayout";

// Mock data
const mockPurchaseOrders = [
  {
    id: 1,
    orderNumber: "BC-2025-0001",
    orderDate: "2025-01-06",
    expectedDeliveryDate: "2025-01-15",
    supplier: "Fournisseur ABC",
    status: "sent",
    subtotal: 5000.000,
    totalVat: 950.000,
    total: 5950.000,
    itemCount: 5,
  },
  {
    id: 2,
    orderNumber: "BC-2025-0002",
    orderDate: "2025-01-08",
    expectedDeliveryDate: "2025-01-20",
    supplier: "Société XYZ Import",
    status: "draft",
    subtotal: 12500.000,
    totalVat: 2375.000,
    total: 14875.000,
    itemCount: 8,
  },
  {
    id: 3,
    orderNumber: "BC-2024-0089",
    orderDate: "2024-12-15",
    expectedDeliveryDate: "2024-12-22",
    supplier: "Fournisseur ABC",
    status: "received",
    subtotal: 3200.000,
    totalVat: 608.000,
    total: 3808.000,
    itemCount: 3,
  },
];

const statusConfig = {
  draft: { label: "Brouillon", variant: "secondary" as const },
  sent: { label: "Envoyé", variant: "default" as const },
  confirmed: { label: "Confirmé", variant: "outline" as const },
  received: { label: "Reçu", variant: "outline" as const },
  partial: { label: "Partiel", variant: "outline" as const },
  cancelled: { label: "Annulé", variant: "destructive" as const },
};

function PurchaseOrdersContent() {
  const { selectedCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredOrders = mockPurchaseOrders.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.supplier.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-2xl font-bold tracking-tight">Bons de commande</h1>
          <p className="text-muted-foreground">
            Gérez vos commandes fournisseurs
          </p>
        </div>
        <Button className="gap-2" onClick={() => toast.info("Création à venir")}>
          <Plus className="h-4 w-4" />
          Nouvelle commande
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commandes</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockPurchaseOrders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En cours</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {mockPurchaseOrders.filter((o) => o.status === "sent" || o.status === "confirmed").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reçues</CardTitle>
            <ShoppingCart className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {mockPurchaseOrders.filter((o) => o.status === "received").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Montant Total</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(mockPurchaseOrders.reduce((sum, o) => sum + o.total, 0))}
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
                <TableHead>N° Commande</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Livraison prévue</TableHead>
                <TableHead className="text-center">Articles</TableHead>
                <TableHead className="text-right">Montant TTC</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => {
                const status = statusConfig[order.status as keyof typeof statusConfig];
                return (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4 text-primary" />
                        <span className="font-medium">{order.orderNumber}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {order.supplier}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {new Date(order.orderDate).toLocaleDateString("fr-TN")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {new Date(order.expectedDeliveryDate).toLocaleDateString("fr-TN")}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{order.itemCount}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(order.total)}
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

export default function PurchaseOrders() {
  return (
    <DashboardLayout>
      <PurchaseOrdersContent />
    </DashboardLayout>
  );
}
