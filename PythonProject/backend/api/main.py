from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
import json

# ========== DATABASE SETUP ==========
SQLALCHEMY_DATABASE_URL = "sqlite:///./carbon.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ========== DATABASE MODELS ==========
class EmissionRecord(Base):
    __tablename__ = "emissions"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, index=True)
    activity = Column(String)
    amount = Column(Float)
    unit = Column(String)
    co2_kg = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)
    user_id = Column(String, default="demo_user")


# Create tables
Base.metadata.create_all(bind=engine)


# ========== PYDANTIC SCHEMAS ==========
class EmissionInput(BaseModel):
    category: str
    activity: str
    amount: float
    unit: str


# ========== FASTAPI APP ==========
app = FastAPI(
    title="CarbonTrack Pro API",
    version="1.0",
    description="Hackathon-ready carbon emission calculator"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== CARBON FACTORS (kg CO2 per unit) ==========
CARBON_FACTORS = {
    "transport": {
        "car_petrol": 0.192,
        "car_diesel": 0.171,
        "bus": 0.105,
        "train": 0.041,
        "plane_short": 0.15,
        "plane_long": 0.09,
        "motorcycle": 0.103,
        "electric_car": 0.05,
    },
    "electricity": {
        "grid": 0.5,
        "solar": 0.05,
        "wind": 0.011,
        "coal": 0.82,
    },
    "food": {
        "beef": 27.0,
        "chicken": 6.9,
        "pork": 12.1,
        "fish": 6.1,
        "rice": 4.0,
        "vegetables": 2.0,
        "milk": 1.9,
        "cheese": 13.5,
    },
    "waste": {
        "landfill": 0.5,
        "recycled": 0.1,
        "composted": 0.3,
        "plastic": 2.5,
    }
}


# ========== DATABASE DEPENDENCY ==========
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ========== HELPER FUNCTIONS ==========
def get_equivalents(co2_kg: float):
    """Get real-world equivalents for CO2 amount"""
    return {
        "trees_needed": round(co2_kg / 21.77, 1),
        "km_by_car": round(co2_kg / 0.192, 1),
        "smartphones_charged": round(co2_kg / 0.008, 0),
        "hours_of_tv": round(co2_kg / 0.088, 1),
    }


# ========== API ENDPOINTS ==========
@app.get("/")
def root():
    return {
        "message": "🚀 CarbonTrack Pro API",
        "version": "1.0",
        "endpoints": [
            "GET  / - This info",
            "GET  /categories - List all activities",
            "POST /calculate - Calculate emissions",
            "GET  /history - Get past calculations",
            "GET  /stats - Get statistics",
            "GET  /health - Health check"
        ]
    }


@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.get("/categories")
def get_categories():
    """Get all available categories and activities"""
    categories_info = {}
    for category, activities in CARBON_FACTORS.items():
        categories_info[category] = {
            "activities": list(activities.keys()),
            "default_unit": get_default_unit(category)
        }

    return {
        "categories": categories_info,
        "example_payload": {
            "category": "transport",
            "activity": "car_petrol",
            "amount": 100,
            "unit": "km"
        }
    }


def get_default_unit(category: str) -> str:
    units = {
        "transport": "km",
        "electricity": "kWh",
        "food": "kg",
        "waste": "kg"
    }
    return units.get(category, "unit")


@app.post("/calculate")
def calculate_emission(data: EmissionInput, db: Session = Depends(get_db)):
    """Calculate CO2 emissions for an activity"""

    category = data.category.lower()
    if category not in CARBON_FACTORS:
        raise HTTPException(400, f"Unknown category. Available: {list(CARBON_FACTORS.keys())}")

    activity = data.activity.lower()
    if activity not in CARBON_FACTORS[category]:
        raise HTTPException(400, f"Unknown activity for {category}")

    # Calculate CO2
    factor = CARBON_FACTORS[category][activity]
    co2_kg = data.amount * factor

    # Save to database
    record = EmissionRecord(
        category=category,
        activity=activity,
        amount=data.amount,
        unit=data.unit,
        co2_kg=co2_kg
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    response = {
        "success": True,
        "id": record.id,
        "calculation": {
            "category": category,
            "activity": activity,
            "amount": data.amount,
            "unit": data.unit,
            "co2_kg": round(co2_kg, 2),
            "factor_used": factor,
            "equivalents": get_equivalents(co2_kg)
        },
        "timestamp": record.timestamp.isoformat()
    }

    return response


@app.get("/history")
def get_history(limit: int = 20, db: Session = Depends(get_db)):
    """Get calculation history"""
    records = db.query(EmissionRecord).order_by(EmissionRecord.timestamp.desc()).limit(limit).all()

    total_co2 = sum(r.co2_kg for r in records) if records else 0

    return {
        "total_records": len(records),
        "total_co2_kg": round(total_co2, 2),
        "records": [
            {
                "id": r.id,
                "category": r.category,
                "activity": r.activity,
                "amount": r.amount,
                "unit": r.unit,
                "co2_kg": round(r.co2_kg, 2),
                "timestamp": r.timestamp.isoformat()
            }
            for r in records
        ]
    }


@app.get("/stats")
def get_statistics(db: Session = Depends(get_db)):
    """Get statistics and breakdown"""
    records = db.query(EmissionRecord).all()

    if not records:
        return {"message": "No data yet. Make some calculations first!"}

    total_co2 = sum(r.co2_kg for r in records)

    # Breakdown by category
    breakdown = {}
    for r in records:
        if r.category not in breakdown:
            breakdown[r.category] = {"total": 0, "count": 0, "activities": {}}
        breakdown[r.category]["total"] += r.co2_kg
        breakdown[r.category]["count"] += 1

        if r.activity not in breakdown[r.category]["activities"]:
            breakdown[r.category]["activities"][r.activity] = 0
        breakdown[r.category]["activities"][r.activity] += r.co2_kg

    # Calculate percentages
    for cat in breakdown:
        breakdown[cat]["percentage"] = round((breakdown[cat]["total"] / total_co2) * 100, 1)
        breakdown[cat]["total"] = round(breakdown[cat]["total"], 2)

    # Daily average
    oldest = min(r.timestamp for r in records)
    newest = max(r.timestamp for r in records)
    days_diff = (newest - oldest).days or 1
    daily_avg = total_co2 / days_diff

    return {
        "summary": {
            "total_emissions_kg": round(total_co2, 2),
            "total_records": len(records),
            "daily_average_kg": round(daily_avg, 2),
            "recording_period_days": days_diff
        },
        "breakdown": breakdown,
        "equivalents": get_equivalents(total_co2),
        "recommendations": get_recommendations(breakdown)
    }


def get_recommendations(breakdown):
    """Generate personalized recommendations"""
    recs = []

    for category, data in breakdown.items():
        if data["percentage"] > 40:
            if category == "transport":
                recs.append("🚗 Your transport emissions are high. Consider carpooling or public transport.")
            elif category == "food":
                recs.append("🍖 Consider reducing meat consumption, especially beef.")
            elif category == "electricity":
                recs.append("💡 Switch to energy-efficient appliances and LED bulbs.")

    if not recs:
        recs.append("✅ Your emissions are well balanced across categories!")

    return recs


# ========== RUN SCRIPT ==========
if __name__ == "__main__":
    import uvicorn

    print("\n" + "=" * 50)
    print("🚀 CARBONTRACK PRO - HACKATHON PROJECT")
    print("=" * 50)
    print("📊 Categories: transport, electricity, food, waste")
    print("🌐 Local: http://127.0.0.1:8000")
    print("📚 Docs: http://127.0.0.1:8000/docs")
    print("🎮 Test UI: Open frontend/index.html")
    print("=" * 50 + "\n")

    uvicorn.run(
        "backend.api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )