from fastapi import APIRouter, HTTPException, status, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime
import os
from typing import Optional
from models.project import Project, ProjectCreate, ProjectUpdate
from models.timesheet import Timesheet, TimesheetCreate
from utils.dependencies import get_current_user, get_current_company

router = APIRouter(prefix="/api/projects", tags=["Projects"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    project_dict = project_data.dict()
    project_dict.update({
        "company_id": ObjectId(company_id),
        "customer_id": ObjectId(project_data.customer_id),
        "spent": 0.0,
        "total_hours": 0.0,
        "status": "planning",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "created_by": current_user["_id"]
    })
    
    result = await db.projects.insert_one(project_dict)
    return {"id": str(result.inserted_id), "message": "Project created successfully"}

@router.get("/")
async def list_projects(
    company_id: str = Query(...),
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    query = {"company_id": ObjectId(company_id)}
    if status:
        query["status"] = status
    
    projects = await db.projects.find(query).sort("start_date", -1).to_list(1000)
    
    # Populate customer names
    for project in projects:
        customer = await db.customers.find_one({"_id": project["customer_id"]})
        project["customer_name"] = customer["display_name"] if customer else "Unknown"
    
    return [{"id": str(p["_id"]), **{k: v for k, v in p.items() if k != "_id"}} for p in projects]

@router.get("/{project_id}")
async def get_project(
    project_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    project = await db.projects.find_one({
        "_id": ObjectId(project_id),
        "company_id": ObjectId(company_id)
    })
    
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    return {"id": str(project["_id"]), **{k: v for k, v in project.items() if k != "_id"}}

@router.put("/{project_id}")
async def update_project(
    project_id: str,
    project_update: ProjectUpdate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    update_data = {k: v for k, v in project_update.dict(exclude_unset=True).items()}
    update_data["updated_at"] = datetime.utcnow()
    
    if "customer_id" in update_data:
        update_data["customer_id"] = ObjectId(update_data["customer_id"])
    
    result = await db.projects.update_one(
        {"_id": ObjectId(project_id), "company_id": ObjectId(company_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    return {"message": "Project updated successfully"}

@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    result = await db.projects.delete_one({
        "_id": ObjectId(project_id),
        "company_id": ObjectId(company_id)
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    return {"message": "Project deleted successfully"}

# Timesheets
@router.post("/{project_id}/timesheets", status_code=status.HTTP_201_CREATED)
async def create_timesheet(
    project_id: str,
    timesheet_data: TimesheetCreate,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    # Verify project exists
    project = await db.projects.find_one({
        "_id": ObjectId(project_id),
        "company_id": ObjectId(company_id)
    })
    
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    timesheet_dict = timesheet_data.dict()
    timesheet_dict.update({
        "company_id": ObjectId(company_id),
        "project_id": ObjectId(project_id),
        "user_id": current_user["_id"],
        "is_billed": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    })
    
    result = await db.timesheets.insert_one(timesheet_dict)
    
    # Update project hours and spent
    hours_cost = timesheet_data.hours * timesheet_data.hourly_rate
    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {
            "$inc": {
                "total_hours": timesheet_data.hours,
                "spent": hours_cost if timesheet_data.is_billable else 0
            }
        }
    )
    
    return {"id": str(result.inserted_id), "message": "Timesheet created successfully"}

@router.get("/{project_id}/timesheets")
async def list_timesheets(
    project_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    timesheets = await db.timesheets.find({
        "project_id": ObjectId(project_id),
        "company_id": ObjectId(company_id)
    }).sort("date", -1).to_list(1000)
    
    return [{"id": str(t["_id"]), **{k: v for k, v in t.items() if k != "_id"}} for t in timesheets]