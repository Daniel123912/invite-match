from fastapi import APIRouter

from app.api.routes import auth, candidate, candidate_extra, chat, employer, invitations

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(candidate.router)
api_router.include_router(candidate_extra.router)
api_router.include_router(employer.router)
api_router.include_router(invitations.router)
api_router.include_router(chat.router)
