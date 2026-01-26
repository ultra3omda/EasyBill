"""
Routes API pour la Gestion des Collaborateurs
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List
import os
import logging
import secrets

from models.collaborator import (
    CollaboratorInvite,
    CollaboratorUpdate,
    CollaboratorResponse,
    CollaboratorRole,
    CollaboratorStatus,
    Permissions,
    DEFAULT_PERMISSIONS,
    ROLE_LABELS
)
from utils.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/collaborators", tags=["Collaborators"])

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'easybill')]


def generate_invitation_token() -> str:
    """Génère un token d'invitation unique"""
    return secrets.token_urlsafe(32)


@router.get("/")
async def list_collaborators(
    company_id: str = Query(...),
    status: Optional[str] = None,
    role: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Liste tous les collaborateurs d'une entreprise"""
    
    query = {"company_id": ObjectId(company_id)}
    
    if status:
        query["status"] = status
    if role:
        query["role"] = role
    
    collaborators = await db.collaborators.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.collaborators.count_documents(query)
    
    for collab in collaborators:
        collab["id"] = str(collab["_id"])
        collab["full_name"] = f"{collab.get('first_name', '')} {collab.get('last_name', '')}".strip()
        collab["role_label"] = ROLE_LABELS.get(collab.get("role"), collab.get("role"))
        
        # Récupérer les infos utilisateur si lié
        if collab.get("user_id"):
            user = await db.users.find_one({"_id": collab["user_id"]})
            if user:
                collab["last_login"] = user.get("last_login")
    
    return {
        "items": collaborators,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/roles")
async def get_available_roles(
    current_user: dict = Depends(get_current_user)
):
    """Retourne la liste des rôles disponibles"""
    
    roles = []
    for role_value, role_label in ROLE_LABELS.items():
        roles.append({
            "value": role_value,
            "label": role_label,
            "permissions": DEFAULT_PERMISSIONS.get(role_value, Permissions()).dict()
        })
    
    return {"roles": roles}


@router.get("/{collaborator_id}")
async def get_collaborator(
    collaborator_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Récupère un collaborateur par ID"""
    
    collab = await db.collaborators.find_one({
        "_id": ObjectId(collaborator_id),
        "company_id": ObjectId(company_id)
    })
    
    if not collab:
        raise HTTPException(status_code=404, detail="Collaborateur non trouvé")
    
    collab["id"] = str(collab["_id"])
    collab["full_name"] = f"{collab.get('first_name', '')} {collab.get('last_name', '')}".strip()
    collab["role_label"] = ROLE_LABELS.get(collab.get("role"), collab.get("role"))
    
    return collab


@router.post("/invite")
async def invite_collaborator(
    invitation: CollaboratorInvite,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Invite un nouveau collaborateur"""
    
    # Vérifier que l'utilisateur actuel a les droits d'inviter
    current_collab = await db.collaborators.find_one({
        "user_id": ObjectId(current_user["id"]),
        "company_id": ObjectId(company_id),
        "status": "active"
    })
    
    if not current_collab:
        # Vérifier si c'est le propriétaire de l'entreprise
        company = await db.companies.find_one({
            "_id": ObjectId(company_id),
            "owner_id": ObjectId(current_user["id"])
        })
        if not company:
            raise HTTPException(status_code=403, detail="Vous n'avez pas les droits pour inviter des collaborateurs")
    elif current_collab.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Seuls les propriétaires et administrateurs peuvent inviter des collaborateurs")
    
    # Vérifier si l'email n'est pas déjà invité
    existing = await db.collaborators.find_one({
        "email": invitation.email.lower(),
        "company_id": ObjectId(company_id),
        "status": {"$ne": "revoked"}
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Cet email a déjà été invité")
    
    # Vérifier si l'utilisateur existe déjà
    existing_user = await db.users.find_one({"email": invitation.email.lower()})
    
    # Déterminer les permissions
    permissions = invitation.custom_permissions
    if not permissions:
        permissions = DEFAULT_PERMISSIONS.get(invitation.role.value, Permissions())
    
    # Générer le token d'invitation
    invitation_token = generate_invitation_token()
    
    collab_data = {
        "email": invitation.email.lower(),
        "first_name": invitation.first_name,
        "last_name": invitation.last_name,
        "role": invitation.role.value,
        "permissions": permissions.dict() if isinstance(permissions, Permissions) else permissions,
        "status": CollaboratorStatus.PENDING.value,
        "invitation_token": invitation_token,
        "invitation_message": invitation.message,
        "company_id": ObjectId(company_id),
        "invited_by": ObjectId(current_user["id"]),
        "invited_at": datetime.now(timezone.utc),
        "user_id": existing_user["_id"] if existing_user else None
    }
    
    result = await db.collaborators.insert_one(collab_data)
    
    # TODO: Envoyer l'email d'invitation
    # from services.email_service import EmailService
    # email_service = EmailService()
    # await email_service.send_collaborator_invitation(...)
    
    # Récupérer le nom de l'entreprise
    company = await db.companies.find_one({"_id": ObjectId(company_id)})
    company_name = company.get("name") if company else "EasyBill"
    
    # URL d'invitation (à configurer selon l'environnement)
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    invitation_url = f"{frontend_url}/accept-invitation?token={invitation_token}"
    
    return {
        "id": str(result.inserted_id),
        "message": f"Invitation envoyée à {invitation.email}",
        "invitation_url": invitation_url  # Pour le développement
    }


@router.post("/accept-invitation")
async def accept_invitation(
    token: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Accepte une invitation de collaborateur"""
    
    collab = await db.collaborators.find_one({
        "invitation_token": token,
        "status": "pending"
    })
    
    if not collab:
        raise HTTPException(status_code=404, detail="Invitation invalide ou expirée")
    
    # Vérifier que l'email correspond
    if collab.get("email") != current_user.get("email", "").lower():
        raise HTTPException(status_code=403, detail="Cette invitation n'est pas pour vous")
    
    # Mettre à jour le collaborateur
    await db.collaborators.update_one(
        {"_id": collab["_id"]},
        {
            "$set": {
                "status": "active",
                "user_id": ObjectId(current_user["id"]),
                "accepted_at": datetime.now(timezone.utc)
            },
            "$unset": {"invitation_token": ""}
        }
    )
    
    # Ajouter l'entreprise aux entreprises de l'utilisateur
    await db.users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$addToSet": {"companies": collab["company_id"]}}
    )
    
    return {"message": "Invitation acceptée avec succès"}


@router.put("/{collaborator_id}")
async def update_collaborator(
    collaborator_id: str,
    update: CollaboratorUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Met à jour un collaborateur"""
    
    # Vérifier les droits
    current_collab = await db.collaborators.find_one({
        "user_id": ObjectId(current_user["id"]),
        "company_id": ObjectId(company_id),
        "status": "active",
        "role": {"$in": ["owner", "admin"]}
    })
    
    if not current_collab:
        company = await db.companies.find_one({
            "_id": ObjectId(company_id),
            "owner_id": ObjectId(current_user["id"])
        })
        if not company:
            raise HTTPException(status_code=403, detail="Vous n'avez pas les droits pour modifier les collaborateurs")
    
    collab = await db.collaborators.find_one({
        "_id": ObjectId(collaborator_id),
        "company_id": ObjectId(company_id)
    })
    
    if not collab:
        raise HTTPException(status_code=404, detail="Collaborateur non trouvé")
    
    # Empêcher la modification du propriétaire
    if collab.get("role") == "owner" and update.role and update.role.value != "owner":
        raise HTTPException(status_code=400, detail="Impossible de rétrograder le propriétaire")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    
    if "role" in update_data:
        update_data["role"] = update_data["role"].value if hasattr(update_data["role"], 'value') else update_data["role"]
        # Mettre à jour les permissions par défaut si pas de permissions personnalisées
        if "custom_permissions" not in update_data:
            update_data["permissions"] = DEFAULT_PERMISSIONS.get(update_data["role"], Permissions()).dict()
    
    if "custom_permissions" in update_data:
        update_data["permissions"] = update_data.pop("custom_permissions")
        if hasattr(update_data["permissions"], 'dict'):
            update_data["permissions"] = update_data["permissions"].dict()
    
    if "status" in update_data:
        update_data["status"] = update_data["status"].value if hasattr(update_data["status"], 'value') else update_data["status"]
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.collaborators.update_one(
        {"_id": ObjectId(collaborator_id)},
        {"$set": update_data}
    )
    
    return {"message": "Collaborateur mis à jour avec succès"}


@router.post("/{collaborator_id}/suspend")
async def suspend_collaborator(
    collaborator_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Suspend un collaborateur"""
    
    collab = await db.collaborators.find_one({
        "_id": ObjectId(collaborator_id),
        "company_id": ObjectId(company_id)
    })
    
    if not collab:
        raise HTTPException(status_code=404, detail="Collaborateur non trouvé")
    
    if collab.get("role") == "owner":
        raise HTTPException(status_code=400, detail="Impossible de suspendre le propriétaire")
    
    await db.collaborators.update_one(
        {"_id": ObjectId(collaborator_id)},
        {
            "$set": {
                "status": "suspended",
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "Collaborateur suspendu avec succès"}


@router.post("/{collaborator_id}/reactivate")
async def reactivate_collaborator(
    collaborator_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Réactive un collaborateur suspendu"""
    
    collab = await db.collaborators.find_one({
        "_id": ObjectId(collaborator_id),
        "company_id": ObjectId(company_id)
    })
    
    if not collab:
        raise HTTPException(status_code=404, detail="Collaborateur non trouvé")
    
    if collab.get("status") != "suspended":
        raise HTTPException(status_code=400, detail="Ce collaborateur n'est pas suspendu")
    
    await db.collaborators.update_one(
        {"_id": ObjectId(collaborator_id)},
        {
            "$set": {
                "status": "active",
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "Collaborateur réactivé avec succès"}


@router.post("/{collaborator_id}/revoke")
async def revoke_collaborator(
    collaborator_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Révoque l'accès d'un collaborateur"""
    
    collab = await db.collaborators.find_one({
        "_id": ObjectId(collaborator_id),
        "company_id": ObjectId(company_id)
    })
    
    if not collab:
        raise HTTPException(status_code=404, detail="Collaborateur non trouvé")
    
    if collab.get("role") == "owner":
        raise HTTPException(status_code=400, detail="Impossible de révoquer le propriétaire")
    
    await db.collaborators.update_one(
        {"_id": ObjectId(collaborator_id)},
        {
            "$set": {
                "status": "revoked",
                "revoked_at": datetime.now(timezone.utc),
                "revoked_by": ObjectId(current_user["id"]),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Retirer l'entreprise des entreprises de l'utilisateur
    if collab.get("user_id"):
        await db.users.update_one(
            {"_id": collab["user_id"]},
            {"$pull": {"companies": collab["company_id"]}}
        )
    
    return {"message": "Accès du collaborateur révoqué avec succès"}


@router.post("/{collaborator_id}/resend-invitation")
async def resend_invitation(
    collaborator_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Renvoie l'invitation à un collaborateur"""
    
    collab = await db.collaborators.find_one({
        "_id": ObjectId(collaborator_id),
        "company_id": ObjectId(company_id)
    })
    
    if not collab:
        raise HTTPException(status_code=404, detail="Collaborateur non trouvé")
    
    if collab.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Ce collaborateur n'est pas en attente d'invitation")
    
    # Générer un nouveau token
    new_token = generate_invitation_token()
    
    await db.collaborators.update_one(
        {"_id": ObjectId(collaborator_id)},
        {
            "$set": {
                "invitation_token": new_token,
                "invited_at": datetime.now(timezone.utc),
                "invited_by": ObjectId(current_user["id"])
            }
        }
    )
    
    # TODO: Envoyer l'email d'invitation
    
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    invitation_url = f"{frontend_url}/accept-invitation?token={new_token}"
    
    return {
        "message": f"Invitation renvoyée à {collab.get('email')}",
        "invitation_url": invitation_url
    }


@router.delete("/{collaborator_id}")
async def delete_collaborator(
    collaborator_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Supprime un collaborateur (uniquement si en attente)"""
    
    collab = await db.collaborators.find_one({
        "_id": ObjectId(collaborator_id),
        "company_id": ObjectId(company_id)
    })
    
    if not collab:
        raise HTTPException(status_code=404, detail="Collaborateur non trouvé")
    
    if collab.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Seules les invitations en attente peuvent être supprimées")
    
    await db.collaborators.delete_one({"_id": ObjectId(collaborator_id)})
    
    return {"message": "Invitation supprimée avec succès"}


@router.get("/me/permissions")
async def get_my_permissions(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Récupère les permissions de l'utilisateur actuel pour une entreprise"""
    
    # Vérifier si c'est le propriétaire
    user_id = current_user.get("_id") or current_user.get("id")
    company = await db.companies.find_one({
        "_id": ObjectId(company_id),
        "owner_id": ObjectId(user_id) if isinstance(user_id, str) else user_id
    })
    
    if company:
        return {
            "role": "owner",
            "role_label": "Propriétaire",
            "permissions": DEFAULT_PERMISSIONS["owner"].dict()
        }
    
    # Sinon, chercher dans les collaborateurs
    collab = await db.collaborators.find_one({
        "user_id": ObjectId(current_user["id"]),
        "company_id": ObjectId(company_id),
        "status": "active"
    })
    
    if not collab:
        raise HTTPException(status_code=403, detail="Vous n'avez pas accès à cette entreprise")
    
    return {
        "role": collab.get("role"),
        "role_label": ROLE_LABELS.get(collab.get("role"), collab.get("role")),
        "permissions": collab.get("permissions", DEFAULT_PERMISSIONS.get(collab.get("role"), Permissions()).dict())
    }
