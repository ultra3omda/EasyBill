import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Save, Building2 } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const taxIdRegex = /^\d{7}\/[A-Z]\/[A-Z]\/[A-Z]\/\d{3}$/;

const companySchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  legalForm: z.string().optional(),
  taxId: z.string().regex(taxIdRegex, "Format: 0000000/L/A/M/000").optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default("Tunisie"),
  phone: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  website: z.string().optional(),
  invoicePrefix: z.string().default("FAC"),
  quotePrefix: z.string().default("DEV"),
  defaultVatRate: z.string().default("19.00"),
  bankName: z.string().optional(),
  bankIban: z.string().optional(),
  bankBic: z.string().optional(),
});

type CompanyFormData = z.infer<typeof companySchema>;

const legalForms = [
  { value: "SARL", label: "SARL - Société à Responsabilité Limitée" },
  { value: "SUARL", label: "SUARL - Société Unipersonnelle à Responsabilité Limitée" },
  { value: "SA", label: "SA - Société Anonyme" },
  { value: "SNC", label: "SNC - Société en Nom Collectif" },
  { value: "SCS", label: "SCS - Société en Commandite Simple" },
  { value: "EI", label: "Entreprise Individuelle" },
  { value: "AUTRE", label: "Autre" },
];

const vatRates = [
  { value: "19.00", label: "19% - Taux standard" },
  { value: "13.00", label: "13% - Taux intermédiaire" },
  { value: "7.00", label: "7% - Taux réduit" },
  { value: "0.00", label: "0% - Exonéré" },
];

function CompanyFormContent() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const isEdit = !!params.id;
  const utils = trpc.useUtils();

  const { data: company, isLoading: companyLoading } = trpc.company.get.useQuery(
    { id: parseInt(params.id || "0") },
    { enabled: isEdit }
  );

  const form = useForm({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "",
      legalForm: "",
      taxId: "",
      address: "",
      city: "",
      postalCode: "",
      country: "Tunisie",
      phone: "",
      email: "",
      website: "",
      invoicePrefix: "FAC",
      quotePrefix: "DEV",
      defaultVatRate: "19.00",
      bankName: "",
      bankIban: "",
      bankBic: "",
    },
  });

  useEffect(() => {
    if (company) {
      form.reset({
        name: company.name || "",
        legalForm: company.legalForm || "",
        taxId: company.taxId || "",
        address: company.address || "",
        city: company.city || "",
        postalCode: company.postalCode || "",
        country: company.country || "Tunisie",
        phone: company.phone || "",
        email: company.email || "",
        website: company.website || "",
        invoicePrefix: company.invoicePrefix || "FAC",
        quotePrefix: company.quotePrefix || "DEV",
        defaultVatRate: company.defaultVatRate || "19.00",
        bankName: company.bankName || "",
        bankIban: company.bankIban || "",
        bankBic: company.bankBic || "",
      });
    }
  }, [company, form]);

  const createMutation = trpc.company.create.useMutation({
    onSuccess: () => {
      toast.success("Entreprise créée avec succès");
      utils.company.list.invalidate();
      setLocation("/companies");
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la création");
    },
  });

  const updateMutation = trpc.company.update.useMutation({
    onSuccess: () => {
      toast.success("Entreprise mise à jour");
      utils.company.list.invalidate();
      setLocation("/companies");
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la mise à jour");
    },
  });

  const onSubmit = (data: CompanyFormData) => {
    if (isEdit) {
      updateMutation.mutate({ id: parseInt(params.id!), data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (isEdit && companyLoading) {
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
        <Link href="/companies">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? "Modifier l'entreprise" : "Nouvelle entreprise"}
          </h1>
          <p className="text-muted-foreground">
            {isEdit ? "Modifiez les informations de votre entreprise" : "Renseignez les informations de votre entreprise"}
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">Informations générales</TabsTrigger>
            <TabsTrigger value="fiscal">Informations fiscales</TabsTrigger>
            <TabsTrigger value="bank">Coordonnées bancaires</TabsTrigger>
            <TabsTrigger value="settings">Paramètres</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Informations générales</CardTitle>
                <CardDescription>
                  Les informations de base de votre entreprise
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom de l'entreprise *</Label>
                    <Input
                      id="name"
                      {...form.register("name")}
                      placeholder="Ma Société SARL"
                    />
                    {form.formState.errors.name && (
                      <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legalForm">Forme juridique</Label>
                    <Select
                      value={form.watch("legalForm")}
                      onValueChange={(value) => form.setValue("legalForm", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        {legalForms.map((form) => (
                          <SelectItem key={form.value} value={form.value}>
                            {form.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Adresse</Label>
                  <Input
                    id="address"
                    {...form.register("address")}
                    placeholder="123 Rue de l'Exemple"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
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
                  <div className="space-y-2">
                    <Label htmlFor="country">Pays</Label>
                    <Input
                      id="country"
                      {...form.register("country")}
                      placeholder="Tunisie"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      {...form.register("phone")}
                      placeholder="+216 XX XXX XXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      {...form.register("email")}
                      placeholder="contact@entreprise.tn"
                    />
                    {form.formState.errors.email && (
                      <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Site web</Label>
                  <Input
                    id="website"
                    {...form.register("website")}
                    placeholder="https://www.entreprise.tn"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fiscal">
            <Card>
              <CardHeader>
                <CardTitle>Informations fiscales</CardTitle>
                <CardDescription>
                  Votre matricule fiscal et informations légales tunisiennes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="taxId">Matricule fiscal</Label>
                  <Input
                    id="taxId"
                    {...form.register("taxId")}
                    placeholder="0000000/L/A/M/000"
                    className="font-mono"
                  />
                  {form.formState.errors.taxId && (
                    <p className="text-sm text-destructive">{form.formState.errors.taxId.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Format: 7 chiffres / Lettre / Lettre / Lettre / 3 chiffres (ex: 1234567/A/B/M/000)
                  </p>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Structure du matricule fiscal tunisien</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• <strong>7 premiers chiffres</strong>: Numéro d'identification</li>
                    <li>• <strong>1ère lettre</strong>: Catégorie du contribuable</li>
                    <li>• <strong>2ème lettre</strong>: Code de l'activité</li>
                    <li>• <strong>3ème lettre</strong>: Code du bureau de contrôle</li>
                    <li>• <strong>3 derniers chiffres</strong>: Numéro d'ordre</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bank">
            <Card>
              <CardHeader>
                <CardTitle>Coordonnées bancaires</CardTitle>
                <CardDescription>
                  Ces informations apparaîtront sur vos factures
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bankName">Nom de la banque</Label>
                  <Input
                    id="bankName"
                    {...form.register("bankName")}
                    placeholder="Banque de Tunisie"
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
                <div className="space-y-2">
                  <Label htmlFor="bankBic">Code BIC/SWIFT</Label>
                  <Input
                    id="bankBic"
                    {...form.register("bankBic")}
                    placeholder="BTBKTNTT"
                    className="font-mono"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Paramètres de facturation</CardTitle>
                <CardDescription>
                  Personnalisez les préfixes et taux par défaut
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="invoicePrefix">Préfixe factures</Label>
                    <Input
                      id="invoicePrefix"
                      {...form.register("invoicePrefix")}
                      placeholder="FAC"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Ex: FAC-2026-00001
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quotePrefix">Préfixe devis</Label>
                    <Input
                      id="quotePrefix"
                      {...form.register("quotePrefix")}
                      placeholder="DEV"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Ex: DEV-2026-00001
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultVatRate">Taux de TVA par défaut</Label>
                  <Select
                    value={form.watch("defaultVatRate")}
                    onValueChange={(value) => form.setValue("defaultVatRate", value)}
                  >
                    <SelectTrigger className="w-full md:w-64">
                      <SelectValue placeholder="Sélectionner..." />
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Submit Button */}
        <div className="flex justify-end gap-4 mt-6">
          <Link href="/companies">
            <Button type="button" variant="outline">
              Annuler
            </Button>
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

export default function CompanyForm() {
  return (
    <DashboardLayout>
      <CompanyFormContent />
    </DashboardLayout>
  );
}
