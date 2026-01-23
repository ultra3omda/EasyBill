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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ArrowUpCircle, ArrowDownCircle, RefreshCw, Package, Calendar } from "lucide-react";
import { useState } from "react";
import { useCompany } from "@/components/DashboardLayout";

// Mock data
const mockMovements = [
  {
    id: 1,
    date: "2025-01-08 14:30",
    product: "Citerne 3000L verticale",
    reference: "C3000LV",
    type: "out",
    quantity: 2,
    previousQty: 15,
    newQty: 13,
    referenceType: "Facture",
    referenceNumber: "FAC-2025-0001",
    notes: "Vente client ABC",
  },
  {
    id: 2,
    date: "2025-01-08 10:15",
    product: "Waterbox 2000 Litres",
    reference: "WB2000L",
    type: "in",
    quantity: 10,
    previousQty: 5,
    newQty: 15,
    referenceType: "Réception",
    referenceNumber: "REC-2025-0003",
    notes: "Réception fournisseur XYZ",
  },
  {
    id: 3,
    date: "2025-01-07 16:45",
    product: "Pompe Submergée 0.5CV",
    reference: "PSM05",
    type: "adjustment",
    quantity: -1,
    previousQty: 8,
    newQty: 7,
    referenceType: "Ajustement",
    referenceNumber: "ADJ-2025-0001",
    notes: "Correction inventaire",
  },
  {
    id: 4,
    date: "2025-01-07 09:00",
    product: "Filtre à Eau Double",
    reference: "FED20",
    type: "out",
    quantity: 5,
    previousQty: 20,
    newQty: 15,
    referenceType: "Facture",
    referenceNumber: "FAC-2025-0002",
    notes: "Vente client DEF",
  },
];

const typeConfig = {
  in: { label: "Entrée", color: "text-green-600", bg: "bg-green-50", icon: ArrowDownCircle },
  out: { label: "Sortie", color: "text-red-600", bg: "bg-red-50", icon: ArrowUpCircle },
  adjustment: { label: "Ajustement", color: "text-blue-600", bg: "bg-blue-50", icon: RefreshCw },
};

function StockMovementsContent() {
  const { selectedCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filteredMovements = mockMovements.filter((m) => {
    const matchesSearch =
      m.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || m.type === typeFilter;
    return matchesSearch && matchesType;
  });

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mouvements de stock</h1>
        <p className="text-muted-foreground">
          Historique des entrées, sorties et ajustements de stock
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Mouvements</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockMovements.length}</div>
            <p className="text-xs text-muted-foreground">Ce mois</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entrées</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              +{mockMovements.filter((m) => m.type === "in").reduce((sum, m) => sum + m.quantity, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Unités reçues</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sorties</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              -{mockMovements.filter((m) => m.type === "out").reduce((sum, m) => sum + m.quantity, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Unités vendues</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ajustements</CardTitle>
            <RefreshCw className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {mockMovements.filter((m) => m.type === "adjustment").length}
            </div>
            <p className="text-xs text-muted-foreground">Corrections</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par produit, référence..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="in">Entrées</SelectItem>
                <SelectItem value="out">Sorties</SelectItem>
                <SelectItem value="adjustment">Ajustements</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Movements Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead className="text-right">Avant</TableHead>
                <TableHead className="text-right">Après</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMovements.map((movement) => {
                const type = typeConfig[movement.type as keyof typeof typeConfig];
                const TypeIcon = type.icon;
                return (
                  <TableRow key={movement.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{movement.date}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{movement.product}</div>
                          <div className="text-xs text-muted-foreground">{movement.reference}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`gap-1 ${type.color} ${type.bg}`}>
                        <TypeIcon className="h-3 w-3" />
                        {type.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-medium ${movement.type === "in" ? "text-green-600" : movement.type === "out" ? "text-red-600" : "text-blue-600"}`}>
                        {movement.type === "in" ? "+" : movement.type === "out" ? "-" : ""}
                        {Math.abs(movement.quantity)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {movement.previousQty}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {movement.newQty}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm">{movement.referenceType}</div>
                        <div className="text-xs text-muted-foreground">{movement.referenceNumber}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{movement.notes}</span>
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

export default function StockMovements() {
  return (
    <DashboardLayout>
      <StockMovementsContent />
    </DashboardLayout>
  );
}
