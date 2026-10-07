from fastapi import APIRouter

from app.api.routes import auth, candidate, employer, fsp, invitations

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(candidate.router)
api_router.include_router(employer.router)
api_router.include_router(invitations.router)
api_router.include_router(fsp.router)
