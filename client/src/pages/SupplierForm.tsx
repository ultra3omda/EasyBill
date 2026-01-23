import DashboardLayout, { useCompany } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Save } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect } from "react";

interface SupplierFormData {
  name: string;
  taxId: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  paymentTermDays: number;
  category: string;
  bankName: string;
  bankIban: string;
  notes: string;
}

function SupplierFormContent() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { selectedCompanyId } = useCompany();
  const isEdit = !!params.id;
  const utils = trpc.useUtils();

  const { data: supplier, isLoading: supplierLoading } = trpc.supplier.get.useQuery(
    { id: parseInt(params.id || "0") },
    { enabled: isEdit }
  );

  const form = useForm<SupplierFormData>({
    defaultValues: {
      name: "",
      taxId: "",
      contactName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      postalCode: "",
      country: "Tunisie",
      paymentTermDays: 30,
      category: "",
      bankName: "",
      bankIban: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (supplier) {
      form.reset({
        name: supplier.name || "",
        taxId: supplier.taxId || "",
        contactName: supplier.contactName || "",
        email: supplier.email || "",
        phone: supplier.phone || "",
        address: supplier.address || "",
        city: supplier.city || "",
        postalCode: supplier.postalCode || "",
        country: supplier.country || "Tunisie",
        paymentTermDays: supplier.paymentTermDays || 30,
        category: supplier.category || "",
        bankName: supplier.bankName || "",
        bankIban: supplier.bankIban || "",
        notes: supplier.notes || "",
      });
    }
  }, [supplier, form]);

  const createMutation = trpc.supplier.create.useMutation({
    onSuccess: () => {
      toast.success("Fournisseur créé avec succès");
      utils.supplier.list.invalidate();
      setLocation("/suppliers");
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la création");
    },
  });

  const updateMutation = trpc.supplier.update.useMutation({
    onSuccess: () => {
      toast.success("Fournisseur mis à jour");
      utils.supplier.list.invalidate();
      setLocation("/suppliers");
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la mise à jour");
    },
  });

  const onSubmit = (data: SupplierFormData) => {
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

  if (isEdit && supplierLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/suppliers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? "Modifier le fournisseur" : "Nouveau fournisseur"}
          </h1>
          <p className="text-muted-foreground">
            {isEdit ? "Modifiez les informations du fournisseur" : "Ajoutez un nouveau fournisseur"}
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
                <Label htmlFor="name">Raison sociale *</Label>
                <Input
                  id="name"
                  {...form.register("name", { required: true })}
                  placeholder="Nom du fournisseur"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxId">Matricule fiscal</Label>
                <Input
                  id="taxId"
                  {...form.register("taxId")}
                  placeholder="0000000/L/A/M/000"
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactName">Personne de contact</Label>
                <Input
                  id="contactName"
                  {...form.register("contactName")}
                  placeholder="Nom du contact"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register("email")}
                    placeholder="email@exemple.tn"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    {...form.register("phone")}
                    placeholder="+216 XX XXX XXX"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Adresse</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  {...form.register("address")}
                  placeholder="Rue, numéro..."
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">Ville</Label>
                  <Input
                    id="city"
                    {...form.register("city")}
                    placeholder="Tunis"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Code postal</Label>
                  <Input
                    id="postalCode"
                    {...form.register("postalCode")}
                    placeholder="1000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Pays</Label>
                <Input
                  id="country"
                  {...form.register("country")}
                  placeholder="Tunisie"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Coordonnées bancaires</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bankName">Banque</Label>
                <Input
                  id="bankName"
                  {...form.register("bankName")}
                  placeholder="Nom de la banque"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankIban">RIB / IBAN</Label>
                <Input
                  id="bankIban"
                  {...form.register("bankIban")}
                  placeholder="TN59 XXXX XXXX XXXX XXXX XXXX"
                  className="font-mono"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                {...form.register("notes")}
                placeholder="Notes internes..."
                rows={4}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-4 mt-6">
          <Link href="/suppliers">
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

export default function SupplierForm() {
  return (
    <DashboardLayout>
      <SupplierFormContent />
    </DashboardLayout>
  );
}
