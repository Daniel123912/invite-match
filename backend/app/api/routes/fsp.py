"""Заглушка интеграции с ФСП achievements (боевого API нет)."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FspAchievement

router = APIRouter(prefix="/fsp", tags=["fsp"])


class FspAchievementOut(BaseModel):
    id: int
    fsp_id: str
    title: str
    points: float
    achieved_at: str | None = None

    model_config = {"from_attributes": True}


class FspProfileOut(BaseModel):
    fsp_id: str
    has_history: bool
    total_points: float
    achievements: list[FspAchievementOut]
    note: str = "Заглушка: боевой API ФСП недоступен на хакатоне"


@router.get("/{fsp_id}/achievements", response_model=FspProfileOut)
def get_achievements(fsp_id: str, db: Session = Depends(get_db)):
    fsp_id = fsp_id.strip()
    if not fsp_id:
        raise HTTPException(400, "Укажите FSP ID")

    rows = db.query(FspAchievement).filter(FspAchievement.fsp_id == fsp_id).all()
    achievements = [
        FspAchievementOut(
            id=a.id,
            fsp_id=a.fsp_id,
            title=a.title,
            points=a.points,
            achieved_at=a.achieved_at.isoformat() if a.achieved_at else None,
        )
        for a in rows
    ]
    total = sum(a.points for a in rows)
    return FspProfileOut(
        fsp_id=fsp_id,
        has_history=bool(rows),
        total_points=total,
        achievements=achievements,
    )
