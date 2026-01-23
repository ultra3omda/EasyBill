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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, ClipboardList, Calendar, CheckCircle, Clock, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCompany } from "@/components/DashboardLayout";

// Mock data
const mockInventoryCounts = [
  {
    id: 1,
    reference: "INV-2024-001",
    countDate: "2024-12-15",
    warehouse: "Entrepôt Principal",
    status: "completed",
    totalProducts: 45,
    differences: 3,
    completedAt: "2024-12-15 16:30",
  },
  {
    id: 2,
    reference: "INV-2024-002",
    countDate: "2024-12-20",
    warehouse: "Dépôt Sfax",
    status: "in_progress",
    totalProducts: 28,
    differences: 0,
    completedAt: null,
  },
  {
    id: 3,
    reference: "INV-2025-001",
    countDate: "2025-01-05",
    warehouse: "Tous les entrepôts",
    status: "draft",
    totalProducts: 0,
    differences: 0,
    completedAt: null,
  },
];

const statusConfig = {
  draft: { label: "Brouillon", variant: "secondary" as const, icon: Clock },
  in_progress: { label: "En cours", variant: "default" as const, icon: Play },
  completed: { label: "Terminé", variant: "outline" as const, icon: CheckCircle },
  cancelled: { label: "Annulé", variant: "destructive" as const, icon: Clock },
};

function InventoryContent() {
  const { selectedCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filteredCounts = mockInventoryCounts.filter(
    (c) =>
      c.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.warehouse.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = () => {
    toast.success("Inventaire créé avec succès");
    setIsCreateOpen(false);
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
          <h1 className="text-2xl font-bold tracking-tight">Inventaire</h1>
          <p className="text-muted-foreground">
            Gérez vos comptages d'inventaire
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nouvel inventaire
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un inventaire</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Référence</Label>
                <Input placeholder="INV-2025-002" />
              </div>
              <div className="space-y-2">
                <Label>Date de comptage</Label>
                <Input type="date" />
              </div>
              <div className="space-y-2">
                <Label>Entrepôt</Label>
                <Input placeholder="Sélectionner un entrepôt" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input placeholder="Notes optionnelles..." />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleCreate}>Créer</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inventaires</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockInventoryCounts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En cours</CardTitle>
            <Play className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockInventoryCounts.filter((c) => c.status === "in_progress").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Terminés</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockInventoryCounts.filter((c) => c.status === "completed").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Écarts détectés</CardTitle>
            <ClipboardList className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockInventoryCounts.reduce((sum, c) => sum + c.differences, 0)}
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
              placeholder="Rechercher par référence ou entrepôt..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Inventory Counts Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Entrepôt</TableHead>
                <TableHead className="text-center">Produits</TableHead>
                <TableHead className="text-center">Écarts</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCounts.map((count) => {
                const status = statusConfig[count.status as keyof typeof statusConfig];
                const StatusIcon = status.icon;
                return (
                  <TableRow key={count.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <ClipboardList className="h-5 w-5 text-primary" />
                        </div>
                        <div className="font-medium">{count.reference}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {new Date(count.countDate).toLocaleDateString("fr-TN")}
                      </div>
                    </TableCell>
                    <TableCell>{count.warehouse}</TableCell>
                    <TableCell className="text-center font-medium">
                      {count.totalProducts}
                    </TableCell>
                    <TableCell className="text-center">
                      {count.differences > 0 ? (
                        <Badge variant="destructive">{count.differences}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toast.info("Détails à venir")}
                      >
                        Voir
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

export default function Inventory() {
  return (
    <DashboardLayout>
      <InventoryContent />
    </DashboardLayout>
  );
}
