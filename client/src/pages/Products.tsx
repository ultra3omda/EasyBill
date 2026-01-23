import DashboardLayout, { useCompany } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Plus, Package, Edit, Trash2, MoreHorizontal, Search, Building2 } from "lucide-react";
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

function formatCurrency(amount: string | number) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("fr-TN", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 3,
  }).format(num);
}

function ProductsContent() {
  const { selectedCompanyId, companies } = useCompany();
  const [, setLocation] = useLocation();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();

  const { data: products = [], isLoading } = trpc.product.list.useQuery(
    { companyId: selectedCompanyId!, search: search || undefined },
    { enabled: !!selectedCompanyId }
  );

  const deleteMutation = trpc.product.delete.useMutation({
    onSuccess: () => {
      toast.success("Produit supprimé");
      utils.product.list.invalidate();
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
          Créez d'abord une entreprise pour gérer vos produits.
        </p>
        <Link href="/companies/new">
          <Button>Créer une entreprise</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produits & Services</h1>
          <p className="text-muted-foreground">Gérez votre catalogue</p>
        </div>
        <Link href="/products/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nouveau produit
          </Button>
        </Link>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun produit</h3>
              <p className="text-muted-foreground text-center mb-4">
                {search ? "Aucun produit ne correspond à votre recherche" : "Ajoutez votre premier produit ou service"}
              </p>
              {!search && (
                <Link href="/products/new">
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Ajouter un produit
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead className="text-right">Prix HT</TableHead>
                  <TableHead className="text-right">TVA</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        {product.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{product.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {product.type === "product" ? "Produit" : "Service"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {product.reference || "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(product.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.vatRate}%
                    </TableCell>
                    <TableCell className="text-right">
                      {product.trackStock ? (
                        <span className={parseFloat(product.stockQuantity || "0") <= parseFloat(product.minStockLevel || "0") ? "text-red-600 font-medium" : ""}>
                          {product.stockQuantity}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setLocation(`/products/${product.id}/edit`)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => setDeleteId(product.id)}
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le produit ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
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

export default function Products() {
  return (
    <DashboardLayout>
      <ProductsContent />
    </DashboardLayout>
  );
}
