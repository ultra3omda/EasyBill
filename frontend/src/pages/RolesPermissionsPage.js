import React, { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card } from '../components/ui/card';
import { Shield } from 'lucide-react';
import { useCompany } from '../hooks/useCompany';
import { collaboratorsAPI } from '../services/api';

const MODULE_LABELS = {
  dashboard: 'Tableau de bord',
  customers: 'Clients',
  suppliers: 'Fournisseurs',
  products: 'Produits',
  invoices: 'Factures',
  quotes: 'Devis',
  payments: 'Paiements',
  purchases: 'Achats',
  accounting: 'Comptabilité',
  projects: 'Projets',
  treasury: 'Trésorerie',
  reports: 'Rapports',
  settings: 'Paramètres'
};

const PERM_LABELS = {
  view: 'Voir',
  create: 'Créer',
  edit: 'Modifier',
  delete: 'Supprimer',
  export: 'Exporter'
};

const RolesPermissionsPage = () => {
  const { currentCompany } = useCompany();
  const [roles, setRoles] = useState([]);
  const [myPermissions, setMyPermissions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany?.id) {
      loadData();
    }
  }, [currentCompany]);

  const loadData = async () => {
    try {
      const [rolesRes, permRes] = await Promise.all([
        collaboratorsAPI.getRoles(),
        collaboratorsAPI.getMyPermissions(currentCompany.id)
      ]);
      setRoles(rolesRes.data.roles || []);
      setMyPermissions(permRes.data);
    } catch (error) {
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const renderPermissions = (permissions) => {
    if (!permissions) return null;
    const perms = typeof permissions === 'object' && !Array.isArray(permissions) ? permissions : {};
    return Object.entries(perms).map(([moduleKey, modulePerms]) => {
      if (typeof modulePerms !== 'object' || !modulePerms) return null;
      const permList = Object.entries(modulePerms)
        .filter(([, v]) => v === true)
        .map(([k]) => PERM_LABELS[k] || k);
      if (permList.length === 0) return null;
      return (
        <div key={moduleKey} className="flex flex-wrap gap-1">
          <span className="w-24 text-xs font-medium text-slate-600">{MODULE_LABELS[moduleKey] || moduleKey}:</span>
          <span className="text-xs text-slate-700">{permList.join(', ')}</span>
        </div>
      );
    }).filter(Boolean);
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="page-header-title">Rôles & permissions</h1>
          <p className="page-header-subtitle">Vue d'ensemble des rôles et droits d'accès par module</p>
        </div>

        {myPermissions && (
          <Card className="stat-surface border-violet-200 bg-violet-50/50 p-4">
            <h3 className="mb-2 font-semibold text-slate-900">Votre rôle actuel</h3>
            <p className="text-sm text-slate-600">
              <span className="font-medium">{myPermissions.role_label}</span> — Permissions associées à votre compte pour cette entreprise.
            </p>
          </Card>
        )}

        {loading ? (
          <div className="p-8 text-center text-slate-500">Chargement...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role) => (
              <Card key={role.value} className="stat-surface p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100">
                    <Shield className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{role.label}</h3>
                    <p className="text-xs text-slate-500">{role.value}</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {role.permissions && renderPermissions(role.permissions)}
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card className="stat-surface p-6">
          <h3 className="mb-2 font-semibold text-slate-900">À propos des rôles</h3>
          <p className="text-sm text-slate-600">
            Les rôles définissent les niveaux d'accès dans EasyBill. Le <strong>Propriétaire</strong> a tous les droits.
            Les <strong>Administrateurs</strong> peuvent gérer les collaborateurs mais pas supprimer l'entreprise.
            Les autres rôles (Manager, Comptable, Commercial, Acheteur, Lecteur) ont des permissions restreintes par module.
            Vous pouvez inviter des collaborateurs depuis la page Collaborateurs et leur attribuer un rôle.
          </p>
        </Card>
      </div>
    </AppLayout>
  );
};

export default RolesPermissionsPage;
