import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface QuickCreateProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  onProductCreated: (product: { id: number; name: string; unitPrice: string; vatRate: string }) => void;
}

export function QuickCreateProductModal({
  open,
  onOpenChange,
  companyId,
  onProductCreated,
}: QuickCreateProductModalProps) {
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [vatRate, setVatRate] = useState("19.00");
  const [type, setType] = useState<"product" | "service">("product");

  const utils = trpc.useUtils();
  const createProduct = trpc.product.create.useMutation({
    onSuccess: (data) => {
      toast.success("Produit créé avec succès");
      utils.product.list.invalidate();
      onProductCreated({ 
        id: data.id, 
        name: name, 
        unitPrice: unitPrice || "0",
        vatRate: vatRate
      });
      onOpenChange(false);
      // Reset form
      setName("");
      setReference("");
      setUnitPrice("");
      setVatRate("19.00");
      setType("product");
    },
    onError: (error) => {
      toast.error("Erreur lors de la création du produit: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Le nom du produit est obligatoire");
      return;
    }
    createProduct.mutate({
      companyId,
      name: name.trim(),
      reference: reference.trim() || undefined,
      unitPrice: unitPrice ? unitPrice : "0",
      vatRate: vatRate,
      type: type,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nouveau produit / service</DialogTitle>
            <DialogDescription>
              Créez rapidement un nouveau produit ou service. Vous pourrez compléter les informations plus tard.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "product" | "service")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Produit</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Nom / Désignation *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom du produit ou service"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reference">Référence</Label>
              <Input
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="REF-001"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="unitPrice">Prix unitaire HT (TND)</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.001"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="0.000"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="vatRate">Taux TVA</Label>
                <Select value={vatRate} onValueChange={setVatRate}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="19.00">TVA 19%</SelectItem>
                    <SelectItem value="13.00">TVA 13%</SelectItem>
                    <SelectItem value="7.00">TVA 7%</SelectItem>
                    <SelectItem value="0.00">Exonéré 0%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createProduct.isPending}>
              {createProduct.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer le produit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
