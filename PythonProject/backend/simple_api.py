from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from typing import List
import sqlite3
import json

# ========== SIMPLE SQLITE SETUP ==========
DB_FILE = "carbon_tracker.db"


def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute
    conn.commit()
    conn.close()


init_db()

# ========== FASTAPI APP ==========
app = FastAPI(
    title="CarbonTrack Pro",
    version="1.0",
    description="Simple Carbon Calculator API"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== CARBON FACTORS ==========
CARBON_FACTORS = {
    "transport": {
        "car_petrol": 0.192,
        "car_diesel": 0.171,
        "bus": 0.105,
        "train": 0.041,
        "plane": 0.15,
        "electric_car": 0.05,
    },
    "electricity": {
        "grid": 0.5,
        "solar": 0.05,
        "wind": 0.011,
    },
    "food": {
        "beef": 6.0,
        "chicken": 6.9,
        "rice": 4.0,
        "vegetables": 2.0,
    },
    "waste": {
        "landfill": 0.5,
        "recycled": 0.1,
        "composted": 0.3,
    }
}


# ========== REQUEST MODELS ==========
class CalculationRequest(BaseModel):
    category: str
    activity: str
    amount: float


# ========== HELPER FUNCTIONS ==========
def save_to_db(category: str, activity: str, amount: float, co2_kg: float):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
                   INSERT INTO emissions (category, activity, amount, unit, co2_kg, timestamp)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ''', (category, activity, amount, get_unit(category), co2_kg, datetime.now().isoformat()))
    conn.commit()
    last_id = cursor.lastrowid
    conn.close()
    return last_id


def get_all_records():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM emissions ORDER BY timestamp DESC LIMIT 20')
    records = cursor.fetchall()
    conn.close()
    return records


def get_unit(category: str):
    units = {
        "transport": "km",
        "electricity": "kWh",
        "food": "kg",
        "waste": "kg"
    }
    return units.get(category, "unit")


# ========== API ENDPOINTS ==========
@app.get("/")
def root():
    return {"message": "CarbonTrack Pro API", "status": "running"}


@app.get("/health")
def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.post("/calculate")
def calculate(data: CalculationRequest):
    category = data.category.lower()
    activity = data.activity.lower()

    if category not in CARBON_FACTORS:
        raise HTTPException(400, f"Unknown category. Use: {list(CARBON_FACTORS.keys())}")

    if activity not in CARBON_FACTORS[category]:
        raise HTTPException(400, f"Unknown activity for {category}")

    # Calculate CO2
    factor = CARBON_FACTORS[category][activity]
    co2_kg = data.amount * factor

    # Save to DB
    record_id = save_to_db(category, activity, data.amount, co2_kg)

    return {
        "success": True,
        "id": record_id,
        "category": category,
        "activity": activity,
        "amount": data.amount,
        "unit": get_unit(category),
        "co2_kg": round(co2_kg, 2),
        "factor_used": factor,
        "timestamp": datetime.now().isoformat()
    }


@app.get("/history")
def history():
    records = get_all_records()

    result = []
    total_co2 = 0

    for rec in records:
        total_co2 += rec[5]  # co2_kg column
        result.append({
            "id": rec[0],
            "category": rec[1],
            "activity": rec[2],
            "amount": rec[3],
            "unit": rec[4],
            "co2_kg": rec[5],
            "timestamp": rec[6]
        })

    return {
        "total_records": len(records),
        "total_co2_kg": round(total_co2, 2),
        "records": result
    }


@app.get("/stats")
def stats():
    records = get_all_records()

    if not records:
        return {"message": "No data yet"}

    total_co2 = sum(rec[5] for rec in records)

    # Breakdown by category
    breakdown = {}
    for rec in records:
        cat = rec[1]
        if cat not in breakdown:
            breakdown[cat] = 0
        breakdown[cat] += rec[5]

    # Calculate percentages
    percentages = {}
    for cat, co2 in breakdown.items():
        percentages[cat] = round((co2 / total_co2) * 100, 1)

    return {
        "total_emissions_kg": round(total_co2, 2),
        "total_records": len(records),
        "breakdown": breakdown,
        "percentages": percentages,
        "equivalents": {
            "trees_needed": round(total_co2 / 21.77, 1),
            "km_by_car": round(total_co2 / 0.192, 1)
        }
    }


@app.get("/categories")
def categories():
    return {
        "categories": CARBON_FACTORS,
        "units": {
            "transport": "km",
            "electricity": "kWh",
            "food": "kg",
            "waste": "kg"
        }
    }


# ========== RUN SERVER ==========
if __name__ == "__main__":
    import uvicorn

    print("\n" + "=" * 50)
    print("🚀 CARBONTRACK PRO - SIMPLE VERSION")
    print("=" * 50)
    print("🌐 Server: http://127.0.0.1:8000")
    print("📚 Docs: http://127.0.0.1:8000/docs")
    print("=" * 50 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)