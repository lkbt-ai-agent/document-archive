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


def _assert_valid_parent(db: Session, folder: Folder, parent_id: uuid.UUID | None) -> None:
    if parent_id is None:
        return
    if parent_id == folder.id:
        raise HTTPException(status_code=400, detail="Folder cannot be its own parent.")

    folders_by_id = {item.id: item for item in db.scalars(select(Folder))}
    if parent_id not in folders_by_id:
        raise HTTPException(status_code=404, detail="Parent folder not found.")

    current = folders_by_id[parent_id]
    while current.parent_id:
        if current.parent_id == folder.id:
            raise HTTPException(status_code=400, detail="Folder cannot be moved inside one of its descendants.")
        current = folders_by_id[current.parent_id]


def _refresh_descendant_paths(folder: Folder) -> None:
    for child in folder.children:
        child.path = f"{folder.path or '/'}/{child.name}".replace("//", "/")
        _refresh_descendant_paths(child)


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
    if "parent_id" in payload.model_fields_set:
        _assert_valid_parent(db, folder, payload.parent_id)
    if payload.name is not None:
        folder.name = payload.name
    if "parent_id" in payload.model_fields_set:
        folder.parent_id = payload.parent_id
    folder.path = _path_for(db, folder.name, folder.parent_id)
    _refresh_descendant_paths(folder)
    return folder


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(folder_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    folder = db.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found.")
    db.delete(folder)
