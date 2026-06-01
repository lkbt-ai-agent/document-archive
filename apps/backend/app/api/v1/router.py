from fastapi import APIRouter

from app.api.v1 import documents, folders, generation, search


api_router = APIRouter(prefix="/api/v1")
api_router.include_router(folders.router)
api_router.include_router(documents.router)
api_router.include_router(search.router)
api_router.include_router(generation.router)
