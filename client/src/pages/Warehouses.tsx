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
import { Plus, Search, Warehouse, MapPin, Phone, Edit, Trash2, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCompany } from "@/components/DashboardLayout";

// Mock data for now
const mockWarehouses = [
  {
    id: 1,
    name: "Entrepôt Principal",
    code: "EP001",
    address: "Zone Industrielle, Tunis",
    city: "Tunis",
    contactName: "Ahmed Ben Ali",
    phone: "+216 71 123 456",
    isDefault: true,
    isActive: true,
    productCount: 45,
    totalValue: 125000,
  },
  {
    id: 2,
    name: "Dépôt Sfax",
    code: "DS002",
    address: "Route de Gabès Km 5",
    city: "Sfax",
    contactName: "Mohamed Trabelsi",
    phone: "+216 74 654 321",
    isDefault: false,
    isActive: true,
    productCount: 28,
    totalValue: 78500,
  },
  {
    id: 3,
    name: "Magasin Sousse",
    code: "MS003",
    address: "Avenue de la République",
    city: "Sousse",
    contactName: "Fatma Gharbi",
    phone: "+216 73 987 654",
    isDefault: false,
    isActive: true,
    productCount: 15,
    totalValue: 42000,
  },
];

function WarehousesContent() {
  const { selectedCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWarehouse, setNewWarehouse] = useState({
    name: "",
    code: "",
    address: "",
    city: "",
    contactName: "",
    phone: "",
  });

  const filteredWarehouses = mockWarehouses.filter(
    (w) =>
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = () => {
    toast.success("Entrepôt créé avec succès");
    setIsCreateOpen(false);
    setNewWarehouse({ name: "", code: "", address: "", city: "", contactName: "", phone: "" });
  };

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
          <h1 className="text-2xl font-bold tracking-tight">Entrepôts</h1>
          <p className="text-muted-foreground">
            Gérez vos entrepôts et dépôts de stockage
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nouvel entrepôt
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un entrepôt</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nom *</Label>
                  <Input
                    value={newWarehouse.name}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, name: e.target.value })}
                    placeholder="Entrepôt Principal"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input
                    value={newWarehouse.code}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, code: e.target.value })}
                    placeholder="EP001"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Adresse</Label>
                <Input
                  value={newWarehouse.address}
                  onChange={(e) => setNewWarehouse({ ...newWarehouse, address: e.target.value })}
                  placeholder="Zone Industrielle..."
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Ville</Label>
                  <Input
                    value={newWarehouse.city}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, city: e.target.value })}
                    placeholder="Tunis"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input
                    value={newWarehouse.phone}
                    onChange={(e) => setNewWarehouse({ ...newWarehouse, phone: e.target.value })}
                    placeholder="+216 71 123 456"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Responsable</Label>
                <Input
                  value={newWarehouse.contactName}
                  onChange={(e) => setNewWarehouse({ ...newWarehouse, contactName: e.target.value })}
                  placeholder="Nom du responsable"
                />
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
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entrepôts</CardTitle>
            <Warehouse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockWarehouses.length}</div>
            <p className="text-xs text-muted-foreground">
              {mockWarehouses.filter((w) => w.isActive).length} actifs
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produits en Stock</CardTitle>
            <Warehouse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockWarehouses.reduce((sum, w) => sum + w.productCount, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Répartis sur tous les entrepôts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valeur Totale</CardTitle>
            <Warehouse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(mockWarehouses.reduce((sum, w) => sum + w.totalValue, 0))}
            </div>
            <p className="text-xs text-muted-foreground">Valeur du stock</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, code ou ville..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Warehouses Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entrepôt</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead className="text-right">Produits</TableHead>
                <TableHead className="text-right">Valeur</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWarehouses.map((warehouse) => (
                <TableRow key={warehouse.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Warehouse className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {warehouse.name}
                          {warehouse.isDefault && (
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">{warehouse.code}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm">{warehouse.address}</div>
                        <div className="text-sm text-muted-foreground">{warehouse.city}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="text-sm">{warehouse.contactName}</div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {warehouse.phone}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {warehouse.productCount}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(warehouse.totalValue)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={warehouse.isActive ? "default" : "secondary"}>
                      {warehouse.isActive ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toast.info("Modification à venir")}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => toast.info("Suppression à venir")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Warehouses() {
  return (
    <DashboardLayout>
      <WarehousesContent />
    </DashboardLayout>
  );
}
