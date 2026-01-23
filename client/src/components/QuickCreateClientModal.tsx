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
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface QuickCreateClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  onClientCreated: (client: { id: number; name: string }) => void;
}

export function QuickCreateClientModal({
  open,
  onOpenChange,
  companyId,
  onClientCreated,
}: QuickCreateClientModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");

  const utils = trpc.useUtils();
  const createClient = trpc.customers.create.useMutation({
    onSuccess: (data) => {
      toast.success("Client créé avec succès");
      utils.customers.list.invalidate();
      onClientCreated({ id: data.id, name: name });
      onOpenChange(false);
      // Reset form
      setName("");
      setEmail("");
      setPhone("");
      setTaxId("");
      setAddress("");
    },
    onError: (error) => {
      toast.error("Erreur lors de la création du client: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Le nom du client est obligatoire");
      return;
    }
    createClient.mutate({
      companyId,
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      taxId: taxId.trim() || undefined,
      address: address.trim() || undefined,
      type: "company",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nouveau client</DialogTitle>
            <DialogDescription>
              Créez rapidement un nouveau client. Vous pourrez compléter les informations plus tard.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nom / Raison sociale *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom du client"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemple.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+216 XX XXX XXX"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="taxId">Matricule fiscal</Label>
              <Input
                id="taxId"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="0000000/L/A/M/000"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Adresse complète"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createClient.isPending}>
              {createClient.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer le client
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
