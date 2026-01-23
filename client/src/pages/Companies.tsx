import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Plus, Building2, Edit, Trash2, MoreHorizontal } from "lucide-react";
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
import { useState } from "react";
import { toast } from "sonner";

function CompaniesContent() {
  const [, setLocation] = useLocation();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: companies = [], isLoading } = trpc.company.list.useQuery();

  const deleteMutation = trpc.company.delete.useMutation({
    onSuccess: () => {
      toast.success("Entreprise supprimée");
      utils.company.list.invalidate();
      setDeleteId(null);
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la suppression");
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mes entreprises</h1>
          <p className="text-muted-foreground">
            Gérez vos entreprises et leurs paramètres
          </p>
        </div>
        <Link href="/companies/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle entreprise
          </Button>
        </Link>
      </div>

      {/* Companies Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : companies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Aucune entreprise</h3>
            <p className="text-muted-foreground text-center mb-4 max-w-sm">
              Créez votre première entreprise pour commencer à facturer vos clients.
            </p>
            <Link href="/companies/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Créer une entreprise
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <Card key={company.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{company.name}</CardTitle>
                  <CardDescription>{company.legalForm || "Entreprise"}</CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setLocation(`/companies/${company.id}/edit`)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => setDeleteId(company.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {company.taxId && (
                  <div>
                    <span className="text-muted-foreground">Matricule fiscal: </span>
                    <span className="font-mono">{company.taxId}</span>
                  </div>
                )}
                {company.address && (
                  <div className="text-muted-foreground">
                    {company.address}
                    {company.city && `, ${company.city}`}
                  </div>
                )}
                {company.email && (
                  <div className="text-muted-foreground">{company.email}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'entreprise ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Toutes les données associées à cette 
              entreprise (factures, devis, clients, etc.) seront définitivement supprimées.
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

export default function Companies() {
  return (
    <DashboardLayout>
      <CompaniesContent />
    </DashboardLayout>
  );
}
