"""
supabase_client.py — Supabase connection singleton.
All backend modules import the client from here — never re-initialize it.
"""

from supabase import create_client, create_async_client, Client
from supabase._async.client import AsyncClient
from config import SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

_client: Client | None = None
_async_client: AsyncClient | None = None


def get_client() -> Client:
    """Return the shared Supabase client (lazy singleton). Uses service key if available."""
    global _client
    if _client is None:
        key = SUPABASE_SERVICE_ROLE_KEY if SUPABASE_SERVICE_ROLE_KEY else SUPABASE_ANON_KEY
        _client = create_client(SUPABASE_URL, key)
    return _client


async def get_async_client() -> AsyncClient:
    """Return the shared async Supabase client (lazy singleton)."""
    global _async_client
    if _async_client is None:
        key = SUPABASE_SERVICE_ROLE_KEY if SUPABASE_SERVICE_ROLE_KEY else SUPABASE_ANON_KEY
        _async_client = await create_async_client(SUPABASE_URL, key)
    return _async_client


def insert_row(table: str, data: dict) -> dict:
    """Insert a single row into a Supabase table. Returns the inserted row."""
    client = get_client()
    response = client.table(table).insert(data).execute()
    return response.data[0] if response.data else {}


def fetch_latest_rows(table: str, zone: str = None, godown_id: str = None, limit: int = 30) -> list[dict]:
    """Fetch the most recent N rows for a given table, newest first."""
    client = get_client()
    query = client.table(table).select("*")
    if table != "sensor_readings":
        if godown_id:
            query = query.eq("godown_id", godown_id)
        if zone:
            query = query.eq("zone", zone)
    response = query.order("created_at", desc=True).limit(limit).execute()
    return response.data or []


def fetch_latest_m1_score(zone: str, godown_id: str) -> dict | None:
    """Fetch the single most recent M1 risk score for a zone (used by M2 fire_events)."""
    rows = fetch_latest_rows("risk_scores", zone, godown_id, limit=1)
    return rows[0] if rows else None
