from fastapi import APIRouter, HTTPException, status, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
import os
from typing import Optional
from utils.dependencies import get_current_user, get_current_company

router = APIRouter(prefix="/api/projects", tags=["Projects"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def serialize_project(p: dict) -> dict:
    return {
        "id": str(p["_id"]),
        "company_id": str(p.get("company_id")) if p.get("company_id") else None,
        "customer_id": str(p.get("customer_id")) if p.get("customer_id") else None,
        "customer_name": p.get("customer_name", ""),
        "name": p.get("name", ""),
        "description": p.get("description", ""),
        "status": p.get("status", "active"),
        "start_date": p.get("start_date").isoformat() if p.get("start_date") else None,
        "end_date": p.get("end_date").isoformat() if p.get("end_date") else None,
        "budget": p.get("budget", 0),
        "spent": p.get("spent", 0),
        "hourly_rate": p.get("hourly_rate", 0),
        "total_hours": p.get("total_hours", 0),
        "task_count": p.get("task_count", 0),
        "completed_tasks": p.get("completed_tasks", 0),
        "created_at": p.get("created_at").isoformat() if p.get("created_at") else None,
    }


def serialize_task(t: dict) -> dict:
    return {
        "id": str(t["_id"]),
        "project_id": str(t.get("project_id")) if t.get("project_id") else None,
        "name": t.get("name", ""),
        "description": t.get("description", ""),
        "status": t.get("status", "todo"),
        "priority": t.get("priority", "medium"),
        "assigned_to": t.get("assigned_to"),
        "assigned_name": t.get("assigned_name", ""),
        "due_date": t.get("due_date").isoformat() if t.get("due_date") else None,
        "estimated_hours": t.get("estimated_hours", 0),
        "actual_hours": t.get("actual_hours", 0),
        "created_at": t.get("created_at").isoformat() if t.get("created_at") else None,
    }


def serialize_timesheet(ts: dict) -> dict:
    return {
        "id": str(ts["_id"]),
        "project_id": str(ts.get("project_id")) if ts.get("project_id") else None,
        "task_id": str(ts.get("task_id")) if ts.get("task_id") else None,
        "task_name": ts.get("task_name", ""),
        "user_id": str(ts.get("user_id")) if ts.get("user_id") else None,
        "user_name": ts.get("user_name", ""),
        "date": ts.get("date").isoformat() if ts.get("date") else None,
        "hours": ts.get("hours", 0),
        "description": ts.get("description", ""),
        "billable": ts.get("billable", True),
        "is_billed": ts.get("is_billed", False),
        "created_at": ts.get("created_at").isoformat() if ts.get("created_at") else None,
    }


@router.get("/stats")
async def get_project_stats(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Get project statistics"""
    company = await get_current_company(current_user, company_id)
    
    pipeline = [
        {"$match": {"company_id": ObjectId(company_id)}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_budget": {"$sum": "$budget"},
            "total_spent": {"$sum": "$spent"},
            "total_hours": {"$sum": "$total_hours"}
        }}
    ]
    
    results = await db.projects.aggregate(pipeline).to_list(10)
    
    stats = {
        "total_projects": 0,
        "active": 0,
        "on_hold": 0,
        "completed": 0,
        "total_budget": 0,
        "total_spent": 0,
        "total_hours": 0
    }
    
    for r in results:
        stats["total_projects"] += r["count"]
        status_key = r["_id"] if r["_id"] in stats else "active"
        if status_key in stats:
            stats[status_key] = r["count"]
        stats["total_budget"] += r.get("total_budget", 0) or 0
        stats["total_spent"] += r.get("total_spent", 0) or 0
        stats["total_hours"] += r.get("total_hours", 0) or 0
    
    return stats


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_project(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
    name: str = None,
    description: str = None,
    customer_id: str = None,
    start_date: str = None,
    end_date: str = None,
    budget: float = None,
    hourly_rate: float = None
):
    from fastapi import Body
    pass


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_project_body(
    data: dict,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    now = datetime.now(timezone.utc)
    project_dict = {
        "company_id": ObjectId(company_id),
        "name": data.get("name"),
        "description": data.get("description"),
        "status": data.get("status", "active"),
        "budget": data.get("budget", 0),
        "hourly_rate": data.get("hourly_rate", 0),
        "spent": 0,
        "total_hours": 0,
        "task_count": 0,
        "completed_tasks": 0,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["_id"]
    }
    
    if data.get("customer_id"):
        project_dict["customer_id"] = ObjectId(data["customer_id"])
    
    if data.get("start_date"):
        project_dict["start_date"] = datetime.fromisoformat(data["start_date"].replace('Z', '+00:00'))
    if data.get("end_date"):
        project_dict["end_date"] = datetime.fromisoformat(data["end_date"].replace('Z', '+00:00'))
    
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
    
    projects = await db.projects.find(query).sort("created_at", -1).to_list(1000)
    
    # Populate customer names
    for project in projects:
        if project.get("customer_id"):
            customer = await db.customers.find_one({"_id": project["customer_id"]})
            project["customer_name"] = customer.get("display_name", "") if customer else ""
        else:
            project["customer_name"] = ""
    
    return [serialize_project(p) for p in projects]


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
    
    if project.get("customer_id"):
        customer = await db.customers.find_one({"_id": project["customer_id"]})
        project["customer_name"] = customer.get("display_name", "") if customer else ""
    
    return serialize_project(project)


@router.put("/{project_id}")
async def update_project(
    project_id: str,
    data: dict,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    for field in ["name", "description", "status", "budget", "hourly_rate"]:
        if field in data:
            update_data[field] = data[field]
    
    if "customer_id" in data and data["customer_id"]:
        update_data["customer_id"] = ObjectId(data["customer_id"])
    
    if "start_date" in data and data["start_date"]:
        update_data["start_date"] = datetime.fromisoformat(data["start_date"].replace('Z', '+00:00'))
    if "end_date" in data and data["end_date"]:
        update_data["end_date"] = datetime.fromisoformat(data["end_date"].replace('Z', '+00:00'))
    
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
    
    # Delete related tasks and timesheets
    await db.tasks.delete_many({"project_id": ObjectId(project_id)})
    await db.timesheets.delete_many({"project_id": ObjectId(project_id)})
    
    return {"message": "Project deleted successfully"}


# ============ TASKS ============

@router.get("/{project_id}/tasks")
async def list_tasks(
    project_id: str,
    company_id: str = Query(...),
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    query = {"project_id": ObjectId(project_id)}
    if status:
        query["status"] = status
    
    tasks = await db.tasks.find(query).sort("created_at", -1).to_list(1000)
    return [serialize_task(t) for t in tasks]


@router.post("/{project_id}/tasks", status_code=status.HTTP_201_CREATED)
async def create_task(
    project_id: str,
    data: dict,
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
    
    now = datetime.now(timezone.utc)
    task_dict = {
        "project_id": ObjectId(project_id),
        "company_id": ObjectId(company_id),
        "name": data.get("name"),
        "description": data.get("description"),
        "status": data.get("status", "todo"),
        "priority": data.get("priority", "medium"),
        "assigned_to": data.get("assigned_to"),
        "estimated_hours": data.get("estimated_hours", 0),
        "actual_hours": 0,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["_id"]
    }
    
    if data.get("due_date"):
        task_dict["due_date"] = datetime.fromisoformat(data["due_date"].replace('Z', '+00:00'))
    
    result = await db.tasks.insert_one(task_dict)
    
    # Update project task count
    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$inc": {"task_count": 1}}
    )
    
    return {"id": str(result.inserted_id), "message": "Task created successfully"}


@router.put("/{project_id}/tasks/{task_id}")
async def update_task(
    project_id: str,
    task_id: str,
    data: dict,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    task = await db.tasks.find_one({
        "_id": ObjectId(task_id),
        "project_id": ObjectId(project_id)
    })
    
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    
    old_status = task.get("status")
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    for field in ["name", "description", "status", "priority", "assigned_to", "estimated_hours", "actual_hours"]:
        if field in data:
            update_data[field] = data[field]
    
    if "due_date" in data and data["due_date"]:
        update_data["due_date"] = datetime.fromisoformat(data["due_date"].replace('Z', '+00:00'))
    
    await db.tasks.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": update_data}
    )
    
    # Update completed tasks count if status changed
    new_status = data.get("status")
    if new_status and old_status != new_status:
        if new_status == "completed" and old_status != "completed":
            await db.projects.update_one(
                {"_id": ObjectId(project_id)},
                {"$inc": {"completed_tasks": 1}}
            )
        elif old_status == "completed" and new_status != "completed":
            await db.projects.update_one(
                {"_id": ObjectId(project_id)},
                {"$inc": {"completed_tasks": -1}}
            )
    
    return {"message": "Task updated successfully"}


@router.delete("/{project_id}/tasks/{task_id}")
async def delete_task(
    project_id: str,
    task_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    task = await db.tasks.find_one({
        "_id": ObjectId(task_id),
        "project_id": ObjectId(project_id)
    })
    
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    
    await db.tasks.delete_one({"_id": ObjectId(task_id)})
    
    # Update project counts
    update = {"$inc": {"task_count": -1}}
    if task.get("status") == "completed":
        update["$inc"]["completed_tasks"] = -1
    
    await db.projects.update_one({"_id": ObjectId(project_id)}, update)
    
    return {"message": "Task deleted successfully"}


# ============ TIMESHEETS ============

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
    
    # Populate task and user names
    for ts in timesheets:
        if ts.get("task_id"):
            task = await db.tasks.find_one({"_id": ts["task_id"]})
            ts["task_name"] = task.get("name", "") if task else ""
        if ts.get("user_id"):
            user = await db.users.find_one({"_id": ts["user_id"]})
            ts["user_name"] = user.get("full_name", user.get("email", "")) if user else ""
    
    return [serialize_timesheet(ts) for ts in timesheets]


@router.post("/{project_id}/timesheets", status_code=status.HTTP_201_CREATED)
async def create_timesheet(
    project_id: str,
    data: dict,
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
    
    now = datetime.now(timezone.utc)
    hours = data.get("hours", 0)
    billable = data.get("billable", True)
    hourly_rate = project.get("hourly_rate", 0)
    
    timesheet_dict = {
        "company_id": ObjectId(company_id),
        "project_id": ObjectId(project_id),
        "user_id": current_user["_id"],
        "date": datetime.fromisoformat(data["date"].replace('Z', '+00:00')) if data.get("date") else now,
        "hours": hours,
        "description": data.get("description"),
        "billable": billable,
        "is_billed": False,
        "created_at": now,
        "updated_at": now
    }
    
    if data.get("task_id"):
        timesheet_dict["task_id"] = ObjectId(data["task_id"])
        # Update task actual hours
        await db.tasks.update_one(
            {"_id": ObjectId(data["task_id"])},
            {"$inc": {"actual_hours": hours}}
        )
    
    result = await db.timesheets.insert_one(timesheet_dict)
    
    # Update project hours and spent
    hours_cost = hours * hourly_rate if billable else 0
    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$inc": {"total_hours": hours, "spent": hours_cost}}
    )
    
    return {"id": str(result.inserted_id), "message": "Timesheet created successfully"}


@router.delete("/{project_id}/timesheets/{timesheet_id}")
async def delete_timesheet(
    project_id: str,
    timesheet_id: str,
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    company = await get_current_company(current_user, company_id)
    
    timesheet = await db.timesheets.find_one({
        "_id": ObjectId(timesheet_id),
        "project_id": ObjectId(project_id)
    })
    
    if not timesheet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timesheet not found")
    
    await db.timesheets.delete_one({"_id": ObjectId(timesheet_id)})
    
    # Update project hours
    hours = timesheet.get("hours", 0)
    project = await db.projects.find_one({"_id": ObjectId(project_id)})
    hourly_rate = project.get("hourly_rate", 0) if project else 0
    hours_cost = hours * hourly_rate if timesheet.get("billable") else 0
    
    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$inc": {"total_hours": -hours, "spent": -hours_cost}}
    )
    
    # Update task hours if applicable
    if timesheet.get("task_id"):
        await db.tasks.update_one(
            {"_id": timesheet["task_id"]},
            {"$inc": {"actual_hours": -hours}}
        )
    
    return {"message": "Timesheet deleted successfully"}