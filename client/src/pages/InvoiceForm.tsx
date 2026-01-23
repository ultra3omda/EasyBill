import DashboardLayout, { useCompany } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Save, Plus, Trash2, Calculator } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { toast } from "sonner";
import { useEffect, useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuickCreateClientModal } from "@/components/QuickCreateClientModal";
import { QuickCreateProductModal } from "@/components/QuickCreateProductModal";

interface InvoiceLineItem {
  productId?: number;
  description: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
  fodecRate: string;
  discount: string;
}

interface InvoiceFormData {
  customerId: number;
  issueDate: string;
  dueDate: string;
  paymentTerms: string;
  notes: string;
  items: InvoiceLineItem[];
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("fr-TN", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 3,
  }).format(amount);
}

function InvoiceFormContent() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { selectedCompanyId } = useCompany();
  const isEdit = !!params.id;
  const utils = trpc.useUtils();

  const { data: customers = [] } = trpc.customers.list.useQuery(
    { companyId: selectedCompanyId! },
    { enabled: !!selectedCompanyId }
  );

  const { data: products = [] } = trpc.product.list.useQuery(
    { companyId: selectedCompanyId! },
    { enabled: !!selectedCompanyId }
  );

  const { data: invoice, isLoading: invoiceLoading } = trpc.invoice.get.useQuery(
    { id: parseInt(params.id || "0") },
    { enabled: isEdit }
  );

  const form = useForm<InvoiceFormData>({
    defaultValues: {
      customerId: 0,
      issueDate: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      paymentTerms: "30 jours",
      notes: "",
      items: [
        {
          description: "",
          quantity: "1",
          unitPrice: "0",
          vatRate: "19.00",
          fodecRate: "0",
          discount: "0",
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const [showClientModal, setShowClientModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);

  useEffect(() => {
    if (invoice) {
      form.reset({
        customerId: invoice.clientId,
        issueDate: new Date(invoice.issueDate).toISOString().split("T")[0],
        dueDate: new Date(invoice.dueDate).toISOString().split("T")[0],
        paymentTerms: (invoice as any).paymentTerms || "30 jours",
        notes: invoice.notes || "",
        items: (invoice as any).items?.map((item: any) => ({
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          fodecRate: item.fodecRate || "0",
          discount: item.discount || "0",
        })) || [],
      });
    }
  }, [invoice, form]);

  const createMutation = trpc.invoice.create.useMutation({
    onSuccess: (data) => {
      toast.success("Facture créée avec succès");
      utils.invoice.list.invalidate();
      setLocation(`/invoices/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la création");
    },
  });

  const updateMutation = trpc.invoice.update.useMutation({
    onSuccess: () => {
      toast.success("Facture mise à jour");
      utils.invoice.list.invalidate();
      setLocation(`/invoices/${params.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la mise à jour");
    },
  });

  const watchItems = form.watch("items");

  const totals = useMemo(() => {
    let subtotal = 0;
    let totalVat = 0;
    let totalFodec = 0;
    let totalDiscount = 0;

    watchItems.forEach((item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      const discount = parseFloat(item.discount) || 0;
      const vatRate = parseFloat(item.vatRate) || 0;
      const fodecRate = parseFloat(item.fodecRate) || 0;

      const lineTotal = qty * price;
      const lineDiscount = lineTotal * (discount / 100);
      const lineSubtotal = lineTotal - lineDiscount;
      const lineVat = lineSubtotal * (vatRate / 100);
      const lineFodec = lineSubtotal * (fodecRate / 100);

      subtotal += lineSubtotal;
      totalVat += lineVat;
      totalFodec += lineFodec;
      totalDiscount += lineDiscount;
    });

    const total = subtotal + totalVat + totalFodec;

    return { subtotal, totalVat, totalFodec, totalDiscount, total };
  }, [watchItems]);

  const onSubmit = (data: InvoiceFormData) => {
    if (!selectedCompanyId) {
      toast.error("Veuillez sélectionner une entreprise");
      return;
    }
    if (!data.customerId) {
      toast.error("Veuillez sélectionner un client");
      return;
    }
    if (data.items.length === 0) {
      toast.error("Ajoutez au moins une ligne");
      return;
    }

    const payload = {
      companyId: selectedCompanyId,
      clientId: data.customerId,
      issueDate: new Date(data.issueDate),
      dueDate: new Date(data.dueDate),
      paymentTerms: data.paymentTerms,
      notes: data.notes,
      items: data.items.map((item) => ({
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
        fodecRate: item.fodecRate,
        discount: item.discount,
      })),
      subtotal: totals.subtotal.toFixed(3),
      vatAmount: totals.totalVat.toFixed(3),
      fodecAmount: totals.totalFodec.toFixed(3),
      total: totals.total.toFixed(3),
    };

    if (isEdit) {
      updateMutation.mutate({ id: parseInt(params.id!), data: payload as any });
    } else {
      createMutation.mutate(payload as any);
    }
  };

  const addProductLine = (productId: number) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      append({
        productId: product.id,
        description: product.name,
        quantity: "1",
        unitPrice: product.unitPrice,
        vatRate: product.vatRate || "19.00",
        fodecRate: product.fodecRate || "0",
        discount: "0",
      });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (isEdit && invoiceLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/invoices">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? "Modifier la facture" : "Nouvelle facture"}
          </h1>
          <p className="text-muted-foreground">
            {isEdit ? "Modifiez les détails de la facture" : "Créez une nouvelle facture client"}
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column - Main info */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informations générales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Client *</Label>
                  <div className="flex gap-2">
                    <Select
                      value={form.watch("customerId")?.toString() || ""}
                      onValueChange={(value) => form.setValue("customerId", parseInt(value))}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Sélectionner un client" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id.toString()}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0 bg-green-50 border-green-200 hover:bg-green-100 text-green-600"
                      onClick={() => setShowClientModal(true)}
                      title="Créer un nouveau client"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="issueDate">Date d'émission</Label>
                    <Input
                      id="issueDate"
                      type="date"
                      {...form.register("issueDate")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Date d'échéance</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      {...form.register("dueDate")}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentTerms">Conditions de paiement</Label>
                  <Input
                    id="paymentTerms"
                    {...form.register("paymentTerms")}
                    placeholder="30 jours"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Lignes de facture</CardTitle>
                <div className="flex gap-2">
                  <Select onValueChange={(value) => addProductLine(parseInt(value))}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Ajouter un produit" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0 bg-green-50 border-green-200 hover:bg-green-100 text-green-600"
                    onClick={() => setShowProductModal(true)}
                    title="Créer un nouveau produit"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="p-4 border rounded-lg space-y-4">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-muted-foreground">
                          Ligne {index + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          {...form.register(`items.${index}.description`)}
                          placeholder="Description du produit ou service"
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-2">
                          <Label>Quantité</Label>
                          <Input
                            type="number"
                            step="0.001"
                            {...form.register(`items.${index}.quantity`)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Prix unitaire HT</Label>
                          <Input
                            type="number"
                            step="0.001"
                            {...form.register(`items.${index}.unitPrice`)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>TVA (%)</Label>
                          <Select
                            value={form.watch(`items.${index}.vatRate`)}
                            onValueChange={(value) => form.setValue(`items.${index}.vatRate`, value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="19.00">19%</SelectItem>
                              <SelectItem value="13.00">13%</SelectItem>
                              <SelectItem value="7.00">7%</SelectItem>
                              <SelectItem value="0.00">0%</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Remise (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            {...form.register(`items.${index}.discount`)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() =>
                      append({
                        description: "",
                        quantity: "1",
                        unitPrice: "0",
                        vatRate: "19.00",
                        fodecRate: "0",
                        discount: "0",
                      })
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter une ligne
                  </Button>
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
                  placeholder="Notes ou conditions particulières..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right column - Totals */}
          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Récapitulatif
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sous-total HT</span>
                    <span>{formatCurrency(totals.subtotal)}</span>
                  </div>
                  {totals.totalDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Remises</span>
                      <span className="text-red-600">-{formatCurrency(totals.totalDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TVA</span>
                    <span>{formatCurrency(totals.totalVat)}</span>
                  </div>
                  {totals.totalFodec > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">FODEC</span>
                      <span>{formatCurrency(totals.totalFodec)}</span>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total TTC</span>
                    <span className="text-primary">{formatCurrency(totals.total)}</span>
                  </div>
                </div>

                <div className="pt-4 space-y-2">
                  <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                    <Save className="h-4 w-4" />
                    {isSubmitting ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                  <Link href="/invoices">
                    <Button type="button" variant="outline" className="w-full">
                      Annuler
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
      {/* Modals de création rapide */}
      {selectedCompanyId && (
        <>
          <QuickCreateClientModal
            open={showClientModal}
            onOpenChange={setShowClientModal}
            companyId={selectedCompanyId}
            onClientCreated={(client) => {
              form.setValue("customerId", client.id);
            }}
          />
          <QuickCreateProductModal
            open={showProductModal}
            onOpenChange={setShowProductModal}
            companyId={selectedCompanyId}
            onProductCreated={(product) => {
              append({
                productId: product.id,
                description: product.name,
                quantity: "1",
                unitPrice: product.unitPrice,
                vatRate: product.vatRate,
                fodecRate: "0",
                discount: "0",
              });
            }}
          />
        </>
      )}
    </div>
  );
}

export default function InvoiceForm() {
  return (
    <DashboardLayout>
      <InvoiceFormContent />
    </DashboardLayout>
  );
}
