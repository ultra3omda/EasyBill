import React, { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Badge } from '../components/ui/badge';
import { Plus, UserPlus, MoreVertical, Pencil, Trash2, Mail, UserX, UserCheck } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import { useCompany } from '../hooks/useCompany';
import { collaboratorsAPI } from '../services/api';

const ROLE_LABELS = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  manager: 'Manager',
  accountant: 'Comptable',
  sales: 'Commercial',
  purchases: 'Acheteur',
  viewer: 'Lecteur'
};

const STATUS_LABELS = {
  pending: 'En attente',
  active: 'Actif',
  suspended: 'Suspendu',
  revoked: 'Révoqué'
};

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-800',
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-orange-100 text-orange-800',
  revoked: 'bg-red-100 text-red-800'
};

const CollaboratorsPage = () => {
  const { currentCompany } = useCompany();
  const [collaborators, setCollaborators] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [editingCollab, setEditingCollab] = useState(null);
  const [editRole, setEditRole] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role: 'viewer',
    message: ''
  });

  useEffect(() => {
    if (currentCompany?.id) {
      loadData();
    }
  }, [currentCompany]);

  const loadData = async () => {
    try {
      const [collabRes, rolesRes] = await Promise.all([
        collaboratorsAPI.list(currentCompany.id),
        collaboratorsAPI.getRoles()
      ]);
      setCollaborators(collabRes.data.items || []);
      setRoles(rolesRes.data.roles || []);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les collaborateurs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    try {
      await collaboratorsAPI.invite(currentCompany.id, {
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        role: formData.role,
        message: formData.message || undefined
      });
      toast({ title: 'Succès', description: 'Invitation envoyée' });
      setIsDialogOpen(false);
      setFormData({ email: '', first_name: '', last_name: '', role: 'viewer', message: '' });
      loadData();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible d\'envoyer l\'invitation',
        variant: 'destructive'
      });
    }
  };

  const openEditRole = (c) => {
    setEditingCollab(c);
    setEditRole(c.role);
    setEditRoleOpen(true);
  };

  const handleUpdateRole = async (e) => {
    e?.preventDefault();
    if (!editingCollab) return;
    try {
      await collaboratorsAPI.update(currentCompany.id, editingCollab.id, { role: editRole });
      toast({ title: 'Succès', description: 'Rôle mis à jour' });
      setEditRoleOpen(false);
      setEditingCollab(null);
      loadData();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de modifier le rôle',
        variant: 'destructive'
      });
    }
  };

  const handleSuspend = async (collabId) => {
    if (!window.confirm('Suspendre ce collaborateur ?')) return;
    try {
      await collaboratorsAPI.suspend(currentCompany.id, collabId);
      toast({ title: 'Succès', description: 'Collaborateur suspendu' });
      loadData();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de suspendre',
        variant: 'destructive'
      });
    }
  };

  const handleReactivate = async (collabId) => {
    try {
      await collaboratorsAPI.reactivate(currentCompany.id, collabId);
      toast({ title: 'Succès', description: 'Collaborateur réactivé' });
      loadData();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de réactiver',
        variant: 'destructive'
      });
    }
  };

  const handleRevoke = async (collabId) => {
    if (!window.confirm('Révoquer définitivement l\'accès de ce collaborateur ?')) return;
    try {
      await collaboratorsAPI.revoke(currentCompany.id, collabId);
      toast({ title: 'Succès', description: 'Accès révoqué' });
      loadData();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de révoquer',
        variant: 'destructive'
      });
    }
  };

  const handleResendInvitation = async (collabId) => {
    try {
      const res = await collaboratorsAPI.resendInvitation(currentCompany.id, collabId);
      toast({ title: 'Succès', description: 'Invitation renvoyée' });
      if (res.data?.invitation_url) {
        navigator.clipboard.writeText(res.data.invitation_url);
        toast({ title: 'Succès', description: 'Lien copié dans le presse-papier' });
      }
      loadData();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de renvoyer',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (collabId) => {
    if (!window.confirm('Supprimer cette invitation en attente ?')) return;
    try {
      await collaboratorsAPI.delete(currentCompany.id, collabId);
      toast({ title: 'Succès', description: 'Invitation supprimée' });
      loadData();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de supprimer',
        variant: 'destructive'
      });
    }
  };

  const openNewDialog = () => {
    setFormData({ email: '', first_name: '', last_name: '', role: 'viewer', message: '' });
    setIsDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Collaborateurs</h1>
            <p className="text-gray-500 mt-1">Gérez les invitations et accès de votre équipe</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-2" onClick={openNewDialog}>
                <UserPlus className="w-4 h-4" />
                Inviter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Inviter un collaborateur</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Prénom</Label>
                    <Input
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      placeholder="Prénom"
                      required
                    />
                  </div>
                  <div>
                    <Label>Nom</Label>
                    <Input
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      placeholder="Nom"
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemple.com"
                    required
                  />
                </div>
                <div>
                  <Label>Rôle</Label>
                  <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.filter(r => r.value !== 'owner').map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Message (optionnel)</Label>
                  <Input
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Message personnalisé"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                  <Button type="submit" className="bg-violet-600 hover:bg-violet-700">Envoyer l'invitation</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          {loading ? (
            <div className="p-8 text-center text-gray-500">Chargement...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collaborators.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      Aucun collaborateur. Invitez des membres pour commencer.
                    </TableCell>
                  </TableRow>
                ) : (
                  collaborators.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <span className="font-medium">{c.full_name || `${c.first_name} ${c.last_name}`}</span>
                      </TableCell>
                      <TableCell>{c.email}</TableCell>
                      <TableCell>{ROLE_LABELS[c.role] || c.role_label || c.role}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-800'}>
                          {STATUS_LABELS[c.status] || c.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {c.role !== 'owner' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {c.status === 'pending' && (
                                <>
                                  <DropdownMenuItem onClick={() => handleResendInvitation(c.id)}>
                                    <Mail className="w-4 h-4 mr-2" />
                                    Renvoyer l'invitation
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDelete(c.id)} className="text-red-600">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Supprimer
                                  </DropdownMenuItem>
                                </>
                              )}
                              {c.status === 'active' && (
                                <>
                                  <DropdownMenuItem onClick={() => openEditRole(c)}>
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Modifier le rôle
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleSuspend(c.id)}>
                                    <UserX className="w-4 h-4 mr-2" />
                                    Suspendre
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleRevoke(c.id)} className="text-red-600">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Révoquer
                                  </DropdownMenuItem>
                                </>
                              )}
                              {c.status === 'suspended' && (
                                <DropdownMenuItem onClick={() => handleReactivate(c.id)}>
                                  <UserCheck className="w-4 h-4 mr-2" />
                                  Réactiver
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </Card>

        <Dialog open={editRoleOpen} onOpenChange={setEditRoleOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier le rôle</DialogTitle>
            </DialogHeader>
            {editingCollab && (
              <form onSubmit={handleUpdateRole} className="space-y-4">
                <p className="text-sm text-gray-600">
                  {editingCollab.full_name || `${editingCollab.first_name} ${editingCollab.last_name}`} — {editingCollab.email}
                </p>
                <div>
                  <Label>Nouveau rôle</Label>
                  <Select value={editRole} onValueChange={setEditRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.filter(r => r.value !== 'owner').map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditRoleOpen(false)}>Annuler</Button>
                  <Button type="submit" className="bg-violet-600 hover:bg-violet-700">Enregistrer</Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default CollaboratorsPage;
