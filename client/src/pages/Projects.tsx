import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, FolderKanban, Calendar, Eye, Users, CheckCircle, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCompany } from "@/components/DashboardLayout";

// Mock data
const mockProjects = [
  {
    id: 1,
    name: "Installation Système Irrigation",
    code: "PRJ-2025-001",
    client: "Ferme El Baraka",
    startDate: "2025-01-02",
    endDate: "2025-02-28",
    status: "in_progress",
    budget: 25000.000,
    spent: 8500.000,
    progress: 35,
    tasksTotal: 12,
    tasksCompleted: 4,
  },
  {
    id: 2,
    name: "Fourniture Citernes Industrielles",
    code: "PRJ-2025-002",
    client: "Société ABC",
    startDate: "2025-01-10",
    endDate: "2025-01-31",
    status: "planning",
    budget: 45000.000,
    spent: 0,
    progress: 0,
    tasksTotal: 8,
    tasksCompleted: 0,
  },
  {
    id: 3,
    name: "Maintenance Annuelle",
    code: "PRJ-2024-089",
    client: "Transport terrestre de M/dises",
    startDate: "2024-11-01",
    endDate: "2024-12-31",
    status: "completed",
    budget: 15000.000,
    spent: 14200.000,
    progress: 100,
    tasksTotal: 20,
    tasksCompleted: 20,
  },
];

const statusConfig = {
  planning: { label: "Planification", variant: "secondary" as const, color: "text-gray-600" },
  in_progress: { label: "En cours", variant: "default" as const, color: "text-blue-600" },
  on_hold: { label: "En pause", variant: "outline" as const, color: "text-orange-600" },
  completed: { label: "Terminé", variant: "outline" as const, color: "text-green-600" },
  cancelled: { label: "Annulé", variant: "destructive" as const, color: "text-red-600" },
};

function ProjectsContent() {
  const { selectedCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProjects = mockProjects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.client.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h1 className="text-2xl font-bold tracking-tight">Projets</h1>
          <p className="text-muted-foreground">
            Gérez vos projets et suivez leur avancement
          </p>
        </div>
        <Button className="gap-2" onClick={() => toast.info("Création à venir")}>
          <Plus className="h-4 w-4" />
          Nouveau projet
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projets</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockProjects.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En cours</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {mockProjects.filter((p) => p.status === "in_progress").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Terminés</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {mockProjects.filter((p) => p.status === "completed").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget Total</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(mockProjects.reduce((sum, p) => sum + p.budget, 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, code ou client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Projects Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredProjects.map((project) => {
          const status = statusConfig[project.status as keyof typeof statusConfig];
          return (
            <Card key={project.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{project.code}</p>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{project.client}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {new Date(project.startDate).toLocaleDateString("fr-TN")} - {new Date(project.endDate).toLocaleDateString("fr-TN")}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progression</span>
                    <span className="font-medium">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} className="h-2" />
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tâches</span>
                  <span className="font-medium">
                    {project.tasksCompleted}/{project.tasksTotal}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Budget</span>
                  <span className="font-medium">{formatCurrency(project.budget)}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Dépensé</span>
                  <span className={`font-medium ${project.spent > project.budget ? "text-red-600" : ""}`}>
                    {formatCurrency(project.spent)}
                  </span>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={() => toast.info("Détails à venir")}
                >
                  <Eye className="h-4 w-4" />
                  Voir le projet
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function Projects() {
  return (
    <DashboardLayout>
      <ProjectsContent />
    </DashboardLayout>
  );
}
