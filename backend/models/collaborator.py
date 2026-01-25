"""
Modèle pour la Gestion des Collaborateurs avec Rôles
Permet de gérer les utilisateurs d'une entreprise avec différents niveaux d'accès
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum


class CollaboratorRole(str, Enum):
    OWNER = "owner"  # Propriétaire - Tous les droits
    ADMIN = "admin"  # Administrateur - Presque tous les droits
    MANAGER = "manager"  # Manager - Gestion quotidienne
    ACCOUNTANT = "accountant"  # Comptable - Accès comptabilité
    SALES = "sales"  # Commercial - Ventes uniquement
    PURCHASES = "purchases"  # Acheteur - Achats uniquement
    VIEWER = "viewer"  # Lecteur - Lecture seule


class CollaboratorStatus(str, Enum):
    PENDING = "pending"  # Invitation envoyée
    ACTIVE = "active"  # Actif
    SUSPENDED = "suspended"  # Suspendu
    REVOKED = "revoked"  # Accès révoqué


# Permissions par module
class ModulePermissions(BaseModel):
    view: bool = False
    create: bool = False
    edit: bool = False
    delete: bool = False
    export: bool = False


class Permissions(BaseModel):
    dashboard: ModulePermissions = ModulePermissions(view=True)
    customers: ModulePermissions = ModulePermissions()
    suppliers: ModulePermissions = ModulePermissions()
    products: ModulePermissions = ModulePermissions()
    invoices: ModulePermissions = ModulePermissions()
    quotes: ModulePermissions = ModulePermissions()
    payments: ModulePermissions = ModulePermissions()
    purchases: ModulePermissions = ModulePermissions()
    accounting: ModulePermissions = ModulePermissions()
    projects: ModulePermissions = ModulePermissions()
    treasury: ModulePermissions = ModulePermissions()
    reports: ModulePermissions = ModulePermissions()
    settings: ModulePermissions = ModulePermissions()


# Permissions par défaut pour chaque rôle
DEFAULT_PERMISSIONS = {
    "owner": Permissions(
        dashboard=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        customers=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        suppliers=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        products=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        invoices=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        quotes=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        payments=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        purchases=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        accounting=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        projects=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        treasury=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        reports=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        settings=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True)
    ),
    "admin": Permissions(
        dashboard=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        customers=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        suppliers=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        products=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        invoices=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        quotes=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        payments=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        purchases=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        accounting=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        projects=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        treasury=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        reports=ModulePermissions(view=True, create=True, edit=True, delete=True, export=True),
        settings=ModulePermissions(view=True, create=True, edit=True, delete=False, export=True)
    ),
    "manager": Permissions(
        dashboard=ModulePermissions(view=True, create=True, edit=True, delete=False, export=True),
        customers=ModulePermissions(view=True, create=True, edit=True, delete=False, export=True),
        suppliers=ModulePermissions(view=True, create=True, edit=True, delete=False, export=True),
        products=ModulePermissions(view=True, create=True, edit=True, delete=False, export=True),
        invoices=ModulePermissions(view=True, create=True, edit=True, delete=False, export=True),
        quotes=ModulePermissions(view=True, create=True, edit=True, delete=False, export=True),
        payments=ModulePermissions(view=True, create=True, edit=True, delete=False, export=True),
        purchases=ModulePermissions(view=True, create=True, edit=True, delete=False, export=True),
        accounting=ModulePermissions(view=True, create=False, edit=False, delete=False, export=True),
        projects=ModulePermissions(view=True, create=True, edit=True, delete=False, export=True),
        treasury=ModulePermissions(view=True, create=False, edit=False, delete=False, export=True),
        reports=ModulePermissions(view=True, create=False, edit=False, delete=False, export=True),
        settings=ModulePermissions(view=True, create=False, edit=False, delete=False, export=False)
    ),
    "accountant": Permissions(
        dashboard=ModulePermissions(view=True, create=False, edit=False, delete=False, export=True),
        customers=ModulePermissions(view=True, create=False, edit=False, delete=False, export=True),
        suppliers=ModulePermissions(view=True, create=False, edit=False, delete=False, export=True),
        products=ModulePermissions(view=True, create=False, edit=False, delete=False, export=True),
        invoices=ModulePermissions(view=True, create=False, edit=False, delete=False, export=True),
        quotes=ModulePermissions(view=True, create=False, edit=False, delete=False, export=True),
        payments=ModulePermissions(view=True, create=True, edit=True, delete=False, export=True),
        purchases=ModulePermissions(view=True, create=False, edit=False, delete=False, export=True),
        accounting=ModulePermissions(view=True, create=True, edit=True, delete=False, export=True),
        projects=ModulePermissions(view=True, create=False, edit=False, delete=False, export=True),
        treasury=ModulePermissions(view=True, create=True, edit=True, delete=False, export=True),
        reports=ModulePermissions(view=True, create=True, edit=False, delete=False, export=True),
        settings=ModulePermissions(view=False, create=False, edit=False, delete=False, export=False)
    ),
    "sales": Permissions(
        dashboard=ModulePermissions(view=True, create=False, edit=False, delete=False, export=False),
        customers=ModulePermissions(view=True, create=True, edit=True, delete=False, export=True),
        suppliers=ModulePermissions(view=False, create=False, edit=False, delete=False, export=False),
        products=ModulePermissions(view=True, create=False, edit=False, delete=False, export=False),
        invoices=ModulePermissions(view=True, create=True, edit=True, delete=False, export=True),
        quotes=ModulePermissions(view=True, create=True, edit=True, delete=False, export=True),
        payments=ModulePermissions(view=True, create=True, edit=False, delete=False, export=False),
        purchases=ModulePermissions(view=False, create=False, edit=False, delete=False, export=False),
        accounting=ModulePermissions(view=False, create=False, edit=False, delete=False, export=False),
        projects=ModulePermissions(view=True, create=True, edit=True, delete=False, export=False),
        treasury=ModulePermissions(view=False, create=False, edit=False, delete=False, export=False),
        reports=ModulePermissions(view=True, create=False, edit=False, delete=False, export=False),
        settings=ModulePermissions(view=False, create=False, edit=False, delete=False, export=False)
    ),
    "purchases": Permissions(
        dashboard=ModulePermissions(view=True, create=False, edit=False, delete=False, export=False),
        customers=ModulePermissions(view=False, create=False, edit=False, delete=False, export=False),
        suppliers=ModulePermissions(view=True, create=True, edit=True, delete=False, export=True),
        products=ModulePermissions(view=True, create=True, edit=True, delete=False, export=True),
        invoices=ModulePermissions(view=False, create=False, edit=False, delete=False, export=False),
        quotes=ModulePermissions(view=False, create=False, edit=False, delete=False, export=False),
        payments=ModulePermissions(view=True, create=True, edit=False, delete=False, export=False),
        purchases=ModulePermissions(view=True, create=True, edit=True, delete=False, export=True),
        accounting=ModulePermissions(view=False, create=False, edit=False, delete=False, export=False),
        projects=ModulePermissions(view=False, create=False, edit=False, delete=False, export=False),
        treasury=ModulePermissions(view=False, create=False, edit=False, delete=False, export=False),
        reports=ModulePermissions(view=True, create=False, edit=False, delete=False, export=False),
        settings=ModulePermissions(view=False, create=False, edit=False, delete=False, export=False)
    ),
    "viewer": Permissions(
        dashboard=ModulePermissions(view=True, create=False, edit=False, delete=False, export=False),
        customers=ModulePermissions(view=True, create=False, edit=False, delete=False, export=False),
        suppliers=ModulePermissions(view=True, create=False, edit=False, delete=False, export=False),
        products=ModulePermissions(view=True, create=False, edit=False, delete=False, export=False),
        invoices=ModulePermissions(view=True, create=False, edit=False, delete=False, export=False),
        quotes=ModulePermissions(view=True, create=False, edit=False, delete=False, export=False),
        payments=ModulePermissions(view=True, create=False, edit=False, delete=False, export=False),
        purchases=ModulePermissions(view=True, create=False, edit=False, delete=False, export=False),
        accounting=ModulePermissions(view=True, create=False, edit=False, delete=False, export=False),
        projects=ModulePermissions(view=True, create=False, edit=False, delete=False, export=False),
        treasury=ModulePermissions(view=True, create=False, edit=False, delete=False, export=False),
        reports=ModulePermissions(view=True, create=False, edit=False, delete=False, export=False),
        settings=ModulePermissions(view=False, create=False, edit=False, delete=False, export=False)
    )
}


class CollaboratorInvite(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: CollaboratorRole
    custom_permissions: Optional[Permissions] = None
    message: Optional[str] = None  # Message personnalisé dans l'invitation


class CollaboratorUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[CollaboratorRole] = None
    custom_permissions: Optional[Permissions] = None
    status: Optional[CollaboratorStatus] = None


class CollaboratorResponse(BaseModel):
    id: str
    user_id: Optional[str] = None  # Lié à un utilisateur existant
    email: str
    first_name: str
    last_name: str
    full_name: Optional[str] = None
    role: CollaboratorRole
    role_label: Optional[str] = None
    permissions: Permissions
    status: CollaboratorStatus
    company_id: str
    invited_by: str
    invited_at: datetime
    accepted_at: Optional[datetime] = None
    last_login: Optional[datetime] = None


# Labels pour les rôles
ROLE_LABELS = {
    "owner": "Propriétaire",
    "admin": "Administrateur",
    "manager": "Manager",
    "accountant": "Comptable",
    "sales": "Commercial",
    "purchases": "Acheteur",
    "viewer": "Lecteur"
}
