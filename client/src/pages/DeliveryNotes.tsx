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
import { Plus, Search, Truck, Calendar, Eye, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCompany } from "@/components/DashboardLayout";
import { Link } from "wouter";

// Mock data
const mockDeliveryNotes = [
  {
    id: 1,
    noteNumber: "BL-2025-0001",
    issueDate: "2025-01-08",
    deliveryDate: "2025-01-09",
    client: "Transport terrestre de M/dises",
    status: "delivered",
    itemCount: 3,
    invoiceNumber: "FAC-2025-0001",
  },
  {
    id: 2,
    noteNumber: "BL-2025-0002",
    issueDate: "2025-01-07",
    deliveryDate: null,
    client: "Société ABC",
    status: "draft",
    itemCount: 5,
    invoiceNumber: null,
  },
  {
    id: 3,
    noteNumber: "BL-2024-0045",
    issueDate: "2024-12-28",
    deliveryDate: "2024-12-29",
    client: "Entreprise XYZ",
    status: "delivered",
    itemCount: 2,
    invoiceNumber: "FAC-2024-0089",
  },
];

const statusConfig = {
  draft: { label: "Brouillon", variant: "secondary" as const },
  delivered: { label: "Livré", variant: "default" as const },
  cancelled: { label: "Annulé", variant: "destructive" as const },
};

function DeliveryNotesContent() {
  const { selectedCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredNotes = mockDeliveryNotes.filter(
    (n) =>
      n.noteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.client.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-2xl font-bold tracking-tight">Bons de livraison</h1>
          <p className="text-muted-foreground">
            Gérez vos bons de livraison
          </p>
        </div>
        <Button className="gap-2" onClick={() => toast.info("Création à venir")}>
          <Plus className="h-4 w-4" />
          Nouveau bon
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockDeliveryNotes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Livrés</CardTitle>
            <Truck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {mockDeliveryNotes.filter((n) => n.status === "delivered").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En attente</CardTitle>
            <Truck className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {mockDeliveryNotes.filter((n) => n.status === "draft").length}
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
                <TableHead>N° Bon</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date émission</TableHead>
                <TableHead>Date livraison</TableHead>
                <TableHead className="text-center">Articles</TableHead>
                <TableHead>Facture liée</TableHead>
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
                        <Truck className="h-4 w-4 text-primary" />
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
                      {note.deliveryDate ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {new Date(note.deliveryDate).toLocaleDateString("fr-TN")}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{note.itemCount}</TableCell>
                    <TableCell>
                      {note.invoiceNumber ? (
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          {note.invoiceNumber}
                        </div>
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

export default function DeliveryNotes() {
  return (
    <DashboardLayout>
      <DeliveryNotesContent />
    </DashboardLayout>
  );
}
