import DashboardLayout, { useCompany } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Users, 
  AlertCircle,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  Building2
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

function formatCurrency(amount: string | number) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("fr-TN", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(num);
}

function DashboardContent() {
  const { selectedCompanyId, companies, isLoading: companiesLoading } = useCompany();
  const [, setLocation] = useLocation();

  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery(
    { companyId: selectedCompanyId! },
    { enabled: !!selectedCompanyId }
  );

  // No company selected or no companies exist
  if (!companiesLoading && companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Building2 className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Bienvenue sur EasyBill</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Pour commencer, créez votre première entreprise. Vous pourrez ensuite 
          gérer vos factures, devis, clients et bien plus.
        </p>
        <Link href="/companies/new">
          <Button size="lg" className="gap-2">
            <Plus className="h-4 w-4" />
            Créer mon entreprise
          </Button>
        </Link>
      </div>
    );
  }

  if (!selectedCompanyId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isLoading = statsLoading || companiesLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-muted-foreground">
            Vue d'ensemble de votre activité
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/invoices/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nouvelle facture
            </Button>
          </Link>
          <Link href="/quotes/new">
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Nouveau devis
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA du mois</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(stats?.monthlyRevenue || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Ce mois-ci
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA annuel</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(stats?.yearlyRevenue || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Depuis janvier
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En attente</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(stats?.pendingAmount || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats?.pendingCount || 0} facture(s)
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En retard</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(stats?.overdueAmount || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats?.overdueCount || 0} facture(s)
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">TVA collectée</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(stats?.vatCollected || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Cette année
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.clientCount || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Clients actifs
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produits</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.productCount || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Articles & services
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Factures récentes</CardTitle>
            <CardDescription>
              Les 5 dernières factures créées
            </CardDescription>
          </div>
          <Link href="/invoices">
            <Button variant="ghost" size="sm" className="gap-1">
              Voir tout
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : stats?.recentInvoices && stats.recentInvoices.length > 0 ? (
            <div className="space-y-2">
              {stats.recentInvoices.map((invoice: any) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setLocation(`/invoices/${invoice.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${
                      invoice.status === "paid" ? "bg-green-500" :
                      invoice.status === "overdue" ? "bg-red-500" :
                      invoice.status === "sent" ? "bg-blue-500" :
                      "bg-gray-400"
                    }`} />
                    <div>
                      <p className="font-medium">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(invoice.issueDate).toLocaleDateString("fr-TN")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(invoice.total)}</p>
                    <p className={`text-xs px-2 py-0.5 rounded-full inline-block status-${invoice.status}`}>
                      {invoice.status === "draft" && "Brouillon"}
                      {invoice.status === "sent" && "Envoyée"}
                      {invoice.status === "paid" && "Payée"}
                      {invoice.status === "partial" && "Partielle"}
                      {invoice.status === "overdue" && "En retard"}
                      {invoice.status === "cancelled" && "Annulée"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Aucune facture pour le moment</p>
              <Link href="/invoices/new">
                <Button variant="link" className="mt-2">
                  Créer votre première facture
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  return (
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  );
}
