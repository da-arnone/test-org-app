from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
import os

app = FastAPI()

frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")


@app.get("/")
async def serve_frontend():
    return FileResponse(os.path.join(frontend_path, "index.html"))


class Organization(BaseModel):
    id: int
    name: str


class Contract(BaseModel):
    id: int
    title: str
    description: str
    status: str
    start_date: date
    end_date: Optional[date] = None
    value: float
    organization_id: int
    private_notes: Optional[str] = None


organisations = [
    Organization(id=1, name="Acme Corp"),
    Organization(id=2, name="TechStart Inc"),
    Organization(id=3, name="Global Services Ltd"),
]

contracts = [
    Contract(
        id=1,
        title="Software Development Agreement",
        description="Full-stack development services for web platform",
        status="active",
        start_date=date(2025, 1, 1),
        end_date=date(2025, 12, 31),
        value=150000.00,
        organization_id=1,
        private_notes="Contact: John Smith - john@acme.com",
    ),
    Contract(
        id=2,
        title="Cloud Infrastructure Setup",
        description="AWS infrastructure migration and setup",
        status="active",
        start_date=date(2025, 2, 15),
        value=75000.00,
        organization_id=2,
        private_notes="Budget discussion needed",
    ),
    Contract(
        id=3,
        title="Consulting Services",
        description="Business consulting for Q2 2025",
        status="completed",
        start_date=date(2025, 1, 15),
        end_date=date(2025, 3, 31),
        value=50000.00,
        organization_id=3,
        private_notes="Renewal pending",
    ),
    Contract(
        id=4,
        title="Data Analysis Project",
        description="Analytics pipeline and dashboard development",
        status="draft",
        start_date=date(2025, 6, 1),
        value=45000.00,
        organization_id=1,
    ),
]


@app.get("/api/organizations", response_model=List[Organization])
async def get_organizations():
    return organisations


@app.get("/api/contracts", response_model=List[Contract])
async def get_contracts():
    return contracts


@app.get("/api/contracts/{contract_id}", response_model=Contract)
async def get_contract(contract_id: int):
    for contract in contracts:
        if contract.id == contract_id:
            return contract
    raise HTTPException(status_code=404, detail="Contract not found")