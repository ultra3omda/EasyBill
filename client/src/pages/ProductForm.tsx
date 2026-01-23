import DashboardLayout, { useCompany } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Save } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProductFormData {
  type: "product" | "service";
  name: string;
  description: string;
  reference: string;
  barcode: string;
  unitPrice: string;
  unit: string;
  vatRate: string;
  fodecRate: string;
  consumptionTaxRate: string;
  trackStock: boolean;
  stockQuantity: string;
  minStockLevel: string;
  costPrice: string;
}

const vatRates = [
  { value: "19.00", label: "19% - Taux standard" },
  { value: "13.00", label: "13% - Taux intermédiaire" },
  { value: "7.00", label: "7% - Taux réduit" },
  { value: "0.00", label: "0% - Exonéré" },
];

const units = [
  { value: "unité", label: "Unité" },
  { value: "kg", label: "Kilogramme" },
  { value: "g", label: "Gramme" },
  { value: "l", label: "Litre" },
  { value: "ml", label: "Millilitre" },
  { value: "m", label: "Mètre" },
  { value: "m²", label: "Mètre carré" },
  { value: "m³", label: "Mètre cube" },
  { value: "h", label: "Heure" },
  { value: "jour", label: "Jour" },
  { value: "forfait", label: "Forfait" },
];

function ProductFormContent() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { selectedCompanyId } = useCompany();
  const isEdit = !!params.id;
  const utils = trpc.useUtils();

  const { data: product, isLoading: productLoading } = trpc.product.get.useQuery(
    { id: parseInt(params.id || "0") },
    { enabled: isEdit }
  );

  const form = useForm<ProductFormData>({
    defaultValues: {
      type: "product",
      name: "",
      description: "",
      reference: "",
      barcode: "",
      unitPrice: "",
      unit: "unité",
      vatRate: "19.00",
      fodecRate: "0.00",
      consumptionTaxRate: "0.00",
      trackStock: false,
      stockQuantity: "0",
      minStockLevel: "0",
      costPrice: "",
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        type: (product.type as "product" | "service") || "product",
        name: product.name || "",
        description: product.description || "",
        reference: product.reference || "",
        barcode: product.barcode || "",
        unitPrice: product.unitPrice || "",
        unit: product.unit || "unité",
        vatRate: product.vatRate || "19.00",
        fodecRate: product.fodecRate || "0.00",
        consumptionTaxRate: product.consumptionTaxRate || "0.00",
        trackStock: product.trackStock || false,
        stockQuantity: product.stockQuantity || "0",
        minStockLevel: product.minStockLevel || "0",
        costPrice: product.costPrice || "",
      });
    }
  }, [product, form]);

  const createMutation = trpc.product.create.useMutation({
    onSuccess: () => {
      toast.success("Produit créé avec succès");
      utils.product.list.invalidate();
      setLocation("/products");
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la création");
    },
  });

  const updateMutation = trpc.product.update.useMutation({
    onSuccess: () => {
      toast.success("Produit mis à jour");
      utils.product.list.invalidate();
      setLocation("/products");
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la mise à jour");
    },
  });

  const onSubmit = (data: ProductFormData) => {
    if (!selectedCompanyId) {
      toast.error("Veuillez sélectionner une entreprise");
      return;
    }
    if (isEdit) {
      updateMutation.mutate({ id: parseInt(params.id!), data });
    } else {
      createMutation.mutate({ ...data, companyId: selectedCompanyId });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const watchType = form.watch("type");
  const watchTrackStock = form.watch("trackStock");

  if (isEdit && productLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/products">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? "Modifier le produit" : "Nouveau produit"}
          </h1>
          <p className="text-muted-foreground">
            {isEdit ? "Modifiez les informations du produit" : "Ajoutez un nouveau produit ou service"}
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.watch("type")}
                  onValueChange={(value: "product" | "service") => form.setValue("type", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Produit</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  {...form.register("name", { required: true })}
                  placeholder="Nom du produit ou service"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...form.register("description")}
                  placeholder="Description détaillée..."
                  rows={3}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="reference">Référence</Label>
                  <Input
                    id="reference"
                    {...form.register("reference")}
                    placeholder="REF-001"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barcode">Code-barres</Label>
                  <Input
                    id="barcode"
                    {...form.register("barcode")}
                    placeholder="1234567890123"
                    className="font-mono"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prix et taxes</CardTitle>
              <CardDescription>Tarification conforme à la fiscalité tunisienne</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="unitPrice">Prix unitaire HT *</Label>
                  <div className="relative">
                    <Input
                      id="unitPrice"
                      type="number"
                      step="0.001"
                      {...form.register("unitPrice", { required: true })}
                      placeholder="0.000"
                      className="pr-14"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      TND
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Unité</Label>
                  <Select
                    value={form.watch("unit")}
                    onValueChange={(value) => form.setValue("unit", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((unit) => (
                        <SelectItem key={unit.value} value={unit.value}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Taux de TVA</Label>
                <Select
                  value={form.watch("vatRate")}
                  onValueChange={(value) => form.setValue("vatRate", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {vatRates.map((rate) => (
                      <SelectItem key={rate.value} value={rate.value}>
                        {rate.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fodecRate">FODEC (%)</Label>
                  <Input
                    id="fodecRate"
                    type="number"
                    step="0.01"
                    {...form.register("fodecRate")}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Fonds de Développement de la Compétitivité
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="consumptionTaxRate">Droit de consommation (%)</Label>
                  <Input
                    id="consumptionTaxRate"
                    type="number"
                    step="0.01"
                    {...form.register("consumptionTaxRate")}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="costPrice">Prix de revient</Label>
                <div className="relative">
                  <Input
                    id="costPrice"
                    type="number"
                    step="0.001"
                    {...form.register("costPrice")}
                    placeholder="0.000"
                    className="pr-14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    TND
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pour le calcul de la marge
                </p>
              </div>
            </CardContent>
          </Card>

          {watchType === "product" && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Gestion de stock</CardTitle>
                <CardDescription>Activez le suivi de stock pour ce produit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Suivre le stock</Label>
                    <p className="text-sm text-muted-foreground">
                      Activer la gestion des quantités en stock
                    </p>
                  </div>
                  <Switch
                    checked={watchTrackStock}
                    onCheckedChange={(checked) => form.setValue("trackStock", checked)}
                  />
                </div>

                {watchTrackStock && (
                  <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="stockQuantity">Quantité en stock</Label>
                      <Input
                        id="stockQuantity"
                        type="number"
                        {...form.register("stockQuantity")}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="minStockLevel">Seuil d'alerte</Label>
                      <Input
                        id="minStockLevel"
                        type="number"
                        {...form.register("minStockLevel")}
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">
                        Alerte quand le stock descend sous ce niveau
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end gap-4 mt-6">
          <Link href="/products">
            <Button type="button" variant="outline">Annuler</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            <Save className="h-4 w-4" />
            {isSubmitting ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function ProductForm() {
  return (
    <DashboardLayout>
      <ProductFormContent />
    </DashboardLayout>
  );
}
