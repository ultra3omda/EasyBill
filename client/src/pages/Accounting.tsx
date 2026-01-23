import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, Search, BookOpen, Calculator, FileSpreadsheet, Calendar, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCompany } from "@/components/DashboardLayout";

// Mock data - Plan comptable tunisien
const mockAccountingPlan = [
  {
    class: "1",
    name: "Comptes de capitaux",
    accounts: [
      { code: "101", name: "Capital social", balance: 100000.000 },
      { code: "106", name: "Réserves", balance: 25000.000 },
      { code: "12", name: "Résultat de l'exercice", balance: 45000.000 },
    ],
  },
  {
    class: "2",
    name: "Comptes d'immobilisations",
    accounts: [
      { code: "211", name: "Terrains", balance: 50000.000 },
      { code: "213", name: "Constructions", balance: 120000.000 },
      { code: "215", name: "Installations techniques", balance: 35000.000 },
    ],
  },
  {
    class: "3",
    name: "Comptes de stocks",
    accounts: [
      { code: "31", name: "Matières premières", balance: 28000.000 },
      { code: "35", name: "Produits finis", balance: 42000.000 },
      { code: "37", name: "Marchandises", balance: 65000.000 },
    ],
  },
  {
    class: "4",
    name: "Comptes de tiers",
    accounts: [
      { code: "401", name: "Fournisseurs", balance: -45000.000 },
      { code: "411", name: "Clients", balance: 78000.000 },
      { code: "43", name: "État et collectivités", balance: -12000.000 },
    ],
  },
  {
    class: "5",
    name: "Comptes financiers",
    accounts: [
      { code: "512", name: "Banques", balance: 85000.000 },
      { code: "53", name: "Caisse", balance: 5000.000 },
    ],
  },
  {
    class: "6",
    name: "Comptes de charges",
    accounts: [
      { code: "60", name: "Achats", balance: 125000.000 },
      { code: "61", name: "Services extérieurs", balance: 35000.000 },
      { code: "64", name: "Charges de personnel", balance: 85000.000 },
    ],
  },
  {
    class: "7",
    name: "Comptes de produits",
    accounts: [
      { code: "70", name: "Ventes de produits", balance: 320000.000 },
      { code: "71", name: "Production stockée", balance: 15000.000 },
      { code: "75", name: "Autres produits", balance: 8000.000 },
    ],
  },
];

// Mock journal entries
const mockJournalEntries = [
  {
    id: 1,
    date: "2025-01-08",
    journal: "VE",
    reference: "FAC-2025-0001",
    description: "Vente client Transport terrestre",
    debit: 2405.041,
    credit: 2405.041,
    status: "validated",
  },
  {
    id: 2,
    date: "2025-01-07",
    journal: "AC",
    reference: "FF-2025-0001",
    description: "Achat fournisseur ABC",
    debit: 5950.000,
    credit: 5950.000,
    status: "validated",
  },
  {
    id: 3,
    date: "2025-01-06",
    journal: "BQ",
    reference: "PAY-2025-0001",
    description: "Règlement client",
    debit: 1500.000,
    credit: 1500.000,
    status: "draft",
  },
];

function AccountingContent() {
  const { selectedCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("plan");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-TN", {
      style: "currency",
      currency: "TND",
      minimumFractionDigits: 3,
    }).format(amount);
  };

  if (!selectedCompanyId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Veuillez sélectionner une entreprise</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Comptabilité</h1>
          <p className="text-muted-foreground">
            Plan comptable et écritures comptables
          </p>
        </div>
        <Button className="gap-2" onClick={() => toast.info("Création à venir")}>
          <Plus className="h-4 w-4" />
          Nouvelle écriture
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comptes actifs</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockAccountingPlan.reduce((sum, c) => sum + c.accounts.length, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Écritures ce mois</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockJournalEntries.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Débit</CardTitle>
            <Calculator className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(mockJournalEntries.reduce((sum, e) => sum + e.debit, 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Crédit</CardTitle>
            <Calculator className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(mockJournalEntries.reduce((sum, e) => sum + e.credit, 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="plan" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Plan comptable
          </TabsTrigger>
          <TabsTrigger value="entries" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Écritures
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un compte..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Accordion type="multiple" className="w-full">
                {mockAccountingPlan.map((classItem) => (
                  <AccordionItem key={classItem.class} value={classItem.class}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {classItem.class}
                        </div>
                        <span className="font-medium">{classItem.name}</span>
                        <Badge variant="secondary" className="ml-2">
                          {classItem.accounts.length} comptes
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Intitulé</TableHead>
                            <TableHead className="text-right">Solde</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {classItem.accounts.map((account) => (
                            <TableRow key={account.code}>
                              <TableCell className="font-mono">{account.code}</TableCell>
                              <TableCell>{account.name}</TableCell>
                              <TableCell className={`text-right font-medium ${account.balance < 0 ? "text-red-600" : ""}`}>
                                {formatCurrency(account.balance)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entries" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Journal</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead className="text-right">Débit</TableHead>
                    <TableHead className="text-right">Crédit</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockJournalEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {new Date(entry.date).toLocaleDateString("fr-TN")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.journal}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{entry.reference}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatCurrency(entry.debit)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-blue-600">
                        {formatCurrency(entry.credit)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={entry.status === "validated" ? "default" : "secondary"}>
                          {entry.status === "validated" ? "Validée" : "Brouillon"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function Accounting() {
  return (
    <DashboardLayout>
      <AccountingContent />
    </DashboardLayout>
  );
}
