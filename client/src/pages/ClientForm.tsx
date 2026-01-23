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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ClientFormData {
  type: "individual" | "company";
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
  notes: string;
}

function ClientFormContent() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { selectedCompanyId } = useCompany();
  const isEdit = !!params.id;
  const utils = trpc.useUtils();

  const { data: client, isLoading: clientLoading } = trpc.customers.get.useQuery(
    { id: parseInt(params.id || "0") },
    { enabled: isEdit }
  );

  const form = useForm<ClientFormData>({
    defaultValues: {
      type: "company",
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
      notes: "",
    },
  });

  useEffect(() => {
    if (client) {
      form.reset({
        type: (client.type as "individual" | "company") || "company",
        name: client.name || "",
        taxId: client.taxId || "",
        contactName: client.contactName || "",
        email: client.email || "",
        phone: client.phone || "",
        address: client.address || "",
        city: client.city || "",
        postalCode: client.postalCode || "",
        country: client.country || "Tunisie",
        paymentTermDays: client.paymentTermDays || 30,
        category: client.category || "",
        notes: client.notes || "",
      });
    }
  }, [client, form]);

  const createMutation = trpc.customers.create.useMutation({
    onSuccess: () => {
      toast.success("Client créé avec succès");
      utils.customers.list.invalidate();
      setLocation("/clients");
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la création");
    },
  });

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: () => {
      toast.success("Client mis à jour");
      utils.customers.list.invalidate();
      setLocation("/clients");
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la mise à jour");
    },
  });

  const onSubmit = (data: ClientFormData) => {
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

  if (isEdit && clientLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/clients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? "Modifier le client" : "Nouveau client"}
          </h1>
          <p className="text-muted-foreground">
            {isEdit ? "Modifiez les informations du client" : "Ajoutez un nouveau client à votre portefeuille"}
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
              <CardDescription>Identité et coordonnées du client</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Type de client</Label>
                <Select
                  value={form.watch("type")}
                  onValueChange={(value: "individual" | "company") => form.setValue("type", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">Entreprise</SelectItem>
                    <SelectItem value="individual">Particulier</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">
                  {form.watch("type") === "company" ? "Raison sociale *" : "Nom complet *"}
                </Label>
                <Input
                  id="name"
                  {...form.register("name", { required: true })}
                  placeholder={form.watch("type") === "company" ? "Nom de l'entreprise" : "Nom et prénom"}
                />
              </div>

              {form.watch("type") === "company" && (
                <>
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
                </>
              )}

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
              <CardDescription>Adresse de facturation</CardDescription>
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
              <CardTitle>Paramètres</CardTitle>
              <CardDescription>Conditions de paiement et catégorie</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paymentTermDays">Délai de paiement (jours)</Label>
                <Input
                  id="paymentTermDays"
                  type="number"
                  {...form.register("paymentTermDays", { valueAsNumber: true })}
                  placeholder="30"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Catégorie</Label>
                <Input
                  id="category"
                  {...form.register("category")}
                  placeholder="Ex: VIP, Régulier..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
              <CardDescription>Informations complémentaires</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                {...form.register("notes")}
                placeholder="Notes internes sur ce client..."
                rows={4}
              />
            </CardContent>
          </Card>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4 mt-6">
          <Link href="/clients">
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

export default function ClientForm() {
  return (
    <DashboardLayout>
      <ClientFormContent />
    </DashboardLayout>
  );
}
