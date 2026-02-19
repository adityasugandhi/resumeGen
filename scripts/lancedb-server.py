"""
LanceDB REST API Server

A FastAPI wrapper around LanceDB providing full HTTP access to vector database
operations including table management, document CRUD, and similarity search.

Usage:
    python lancedb-server.py

Environment variables:
    LANCEDB_DATA_PATH  - Directory for LanceDB storage (default: /data/lancedb)
    LANCEDB_PORT       - Server port (default: 8002)
"""

import os
import logging
from typing import Any, Optional

import lancedb
import numpy as np
import pyarrow as pa
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lancedb-server")

DATA_PATH = os.environ.get("LANCEDB_DATA_PATH", "/data/lancedb")
PORT = int(os.environ.get("LANCEDB_PORT", "8002"))

app = FastAPI(title="LanceDB REST API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db: lancedb.DBConnection = None


@app.on_event("startup")
async def startup():
    """Connect to LanceDB on startup."""
    global db
    os.makedirs(DATA_PATH, exist_ok=True)
    db = lancedb.connect(DATA_PATH)
    logger.info("Connected to LanceDB at %s", DATA_PATH)


def _to_serializable(value: Any) -> Any:
    """Convert numpy/pyarrow types to JSON-serializable Python types."""
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    if isinstance(value, (pa.Array, pa.ChunkedArray)):
        return value.to_pylist()
    if isinstance(value, list):
        return [_to_serializable(v) for v in value]
    if isinstance(value, dict):
        return {k: _to_serializable(v) for k, v in value.items()}
    return value


def _rows_to_dicts(table_result) -> list[dict[str, Any]]:
    """Convert a pyarrow Table or list of dicts to JSON-serializable dicts."""
    if hasattr(table_result, "to_pandas"):
        df = table_result.to_pandas()
        rows = df.to_dict(orient="records")
    elif hasattr(table_result, "to_pydict"):
        pydict = table_result.to_pydict()
        keys = list(pydict.keys())
        count = len(pydict[keys[0]]) if keys else 0
        rows = [{k: pydict[k][i] for k in keys} for i in range(count)]
    elif isinstance(table_result, list):
        rows = table_result
    else:
        rows = list(table_result)
    return [_to_serializable(row) for row in rows]


def _get_table(name: str):
    """Retrieve a LanceDB table by name or raise 404."""
    try:
        return db.open_table(name)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Table '{name}' not found")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class TableCreateRequest(BaseModel):
    data: list[dict[str, Any]]


class AddDocumentsRequest(BaseModel):
    data: list[dict[str, Any]]


class DeleteRequest(BaseModel):
    filter: str


class SearchRequest(BaseModel):
    vector: list[float]
    limit: int = 10
    distance_type: str = "cosine"
    filter: Optional[str] = None


class QueryRequest(BaseModel):
    filter: Optional[str] = None
    limit: int = 100


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/")
async def health():
    return {"database": "LanceDB", "status": "running"}


# ---------------------------------------------------------------------------
# Table management
# ---------------------------------------------------------------------------

@app.get("/tables")
async def list_tables():
    tables = db.table_names()
    return {"tables": list(tables)}


@app.post("/tables/{name}")
async def create_table(name: str, body: TableCreateRequest):
    if not body.data:
        raise HTTPException(status_code=400, detail="Data array must not be empty")
    try:
        table = db.create_table(name, data=body.data)
        return {"table": name, "rows": len(body.data)}
    except Exception as e:
        if "already exists" in str(e).lower():
            raise HTTPException(status_code=409, detail=f"Table '{name}' already exists")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/tables/{name}")
async def drop_table(name: str):
    try:
        db.drop_table(name)
        return {"deleted": name}
    except Exception:
        raise HTTPException(status_code=404, detail=f"Table '{name}' not found")


# ---------------------------------------------------------------------------
# Document operations
# ---------------------------------------------------------------------------

@app.get("/tables/{name}/count")
async def count_rows(name: str):
    table = _get_table(name)
    try:
        count = table.count_rows()
    except Exception:
        count = len(table.to_pandas())
    return {"count": count}


@app.post("/tables/{name}/add")
async def add_documents(name: str, body: AddDocumentsRequest):
    table = _get_table(name)
    if not body.data:
        raise HTTPException(status_code=400, detail="Data array must not be empty")
    table.add(body.data)
    return {"added": len(body.data)}


@app.post("/tables/{name}/delete")
async def delete_documents(name: str, body: DeleteRequest):
    table = _get_table(name)
    if not body.filter:
        raise HTTPException(status_code=400, detail="Filter expression is required")
    table.delete(body.filter)
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Search & Query
# ---------------------------------------------------------------------------

@app.post("/tables/{name}/search")
async def vector_search(name: str, body: SearchRequest):
    table = _get_table(name)

    try:
        count = table.count_rows()
    except Exception:
        count = len(table.to_pandas())

    if count == 0:
        return {"results": []}

    query = table.search(body.vector, vector_column_name="vector")

    if body.distance_type:
        query = query.metric(body.distance_type)

    if body.filter:
        query = query.where(body.filter)

    query = query.limit(body.limit)
    results = query.to_arrow()
    rows = _rows_to_dicts(results)
    return {"results": rows}


@app.post("/tables/{name}/query")
async def query_table(name: str, body: QueryRequest):
    table = _get_table(name)

    try:
        count = table.count_rows()
    except Exception:
        count = len(table.to_pandas())

    if count == 0:
        return {"results": []}

    if body.filter:
        arrow_table = table.search().where(body.filter).limit(body.limit).to_arrow()
    else:
        arrow_table = table.search().limit(body.limit).to_arrow()

    rows = _rows_to_dicts(arrow_table)
    return {"results": rows}


if __name__ == "__main__":
    logger.info("Starting LanceDB server on port %d (data: %s)", PORT, DATA_PATH)
    uvicorn.run(app, host="0.0.0.0", port=PORT)
