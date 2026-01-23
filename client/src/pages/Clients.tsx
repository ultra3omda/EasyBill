import DashboardLayout, { useCompany } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Plus, Users, Edit, Trash2, MoreHorizontal, Search, Building2, User } from "lucide-react";
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

function ClientsContent() {
  const { selectedCompanyId, companies } = useCompany();
  const [, setLocation] = useLocation();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();

  const { data: clients = [], isLoading } = trpc.customers.list.useQuery(
    { companyId: selectedCompanyId!, search: search || undefined },
    { enabled: !!selectedCompanyId }
  );

  const deleteMutation = trpc.customers.delete.useMutation({
    onSuccess: () => {
      toast.success("Client supprimé");
      utils.customers.list.invalidate();
      setDeleteId(null);
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la suppression");
    },
  });

  if (!selectedCompanyId && companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Aucune entreprise</h2>
        <p className="text-muted-foreground mb-4">
          Créez d'abord une entreprise pour gérer vos clients.
        </p>
        <Link href="/companies/new">
          <Button>Créer une entreprise</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">
            Gérez votre portefeuille clients
          </p>
        </div>
        <Link href="/clients/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nouveau client
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Clients Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun client</h3>
              <p className="text-muted-foreground text-center mb-4">
                {search ? "Aucun client ne correspond à votre recherche" : "Ajoutez votre premier client"}
              </p>
              {!search && (
                <Link href="/clients/new">
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Ajouter un client
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          {client.type === "company" ? (
                            <Building2 className="h-5 w-5 text-primary" />
                          ) : (
                            <User className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{client.name}</p>
                          {client.taxId && (
                            <p className="text-xs text-muted-foreground font-mono">{client.taxId}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {client.type === "company" ? "Entreprise" : "Particulier"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {client.email && <p>{client.email}</p>}
                        {client.phone && <p className="text-muted-foreground">{client.phone}</p>}
                      </div>
                    </TableCell>
                    <TableCell>{client.city || "-"}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setLocation(`/clients/${client.id}/edit`)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => setDeleteId(client.id)}
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

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'historique des transactions sera conservé.
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

export default function Clients() {
  return (
    <DashboardLayout>
      <ClientsContent />
    </DashboardLayout>
  );
}
