from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.schemas import FolderCreate, FolderRead, FolderUpdate
from app.core.database import get_db
from app.db.models import Folder


router = APIRouter(prefix="/folders", tags=["folders"])


def _path_for(db: Session, name: str, parent_id: uuid.UUID | None) -> str:
    if not parent_id:
        return f"/{name}"
    parent = db.get(Folder, parent_id)
    if not parent:
        raise HTTPException(status_code=404, detail="Parent folder not found.")
    return f"{parent.path or '/'}/{name}".replace("//", "/")


@router.get("", response_model=list[FolderRead])
def list_folders(db: Session = Depends(get_db)) -> list[Folder]:
    return list(db.scalars(select(Folder).order_by(Folder.path, Folder.name)))


@router.post("", response_model=FolderRead, status_code=status.HTTP_201_CREATED)
def create_folder(payload: FolderCreate, db: Session = Depends(get_db)) -> Folder:
    folder = Folder(name=payload.name, parent_id=payload.parent_id, path=_path_for(db, payload.name, payload.parent_id))
    db.add(folder)
    db.flush()
    return folder


@router.patch("/{folder_id}", response_model=FolderRead)
def update_folder(folder_id: uuid.UUID, payload: FolderUpdate, db: Session = Depends(get_db)) -> Folder:
    folder = db.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found.")
    if payload.name is not None:
        folder.name = payload.name
    if "parent_id" in payload.model_fields_set:
        folder.parent_id = payload.parent_id
    folder.path = _path_for(db, folder.name, folder.parent_id)
    return folder


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(folder_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    folder = db.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found.")
    db.delete(folder)
