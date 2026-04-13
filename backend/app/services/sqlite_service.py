import json
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from passlib.context import CryptContext
from app.database import get_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DIMENSIONS = ["demandas", "controle", "relacionamento", "cargo", "mudanca", "apoio_chefia", "apoio_colegas"]
MAX_POINTS = {
    "demandas": 80, "controle": 60, "relacionamento": 40,
    "cargo": 30, "mudanca": 30, "apoio_chefia": 50, "apoio_colegas": 40
}


def _classify_risk(percentage: float) -> str:
    if percentage < 30:
        return "baixo"
    elif percentage < 50:
        return "moderado"
    elif percentage < 90:
        return "alto"
    return "critico"


# ============================================================================
# AUTH
# ============================================================================

async def login_admin(email: str, password: str) -> dict:
    conn = get_db()
    row = conn.execute("SELECT * FROM admin_users WHERE email = ? AND is_active = 1", (email,)).fetchone()
    conn.close()

    if not row or not pwd_context.verify(password, row["password_hash"]):
        return {"success": False}

    # Atualizar last_login
    conn = get_db()
    conn.execute("UPDATE admin_users SET last_login = ? WHERE id = ?", (datetime.now().isoformat(), row["id"]))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "admin": {
            "id": str(row["id"]),
            "email": row["email"],
            "full_name": row["full_name"],
            "access_token": f"sqlite-token-{row['id']}",
            "token_type": "bearer"
        }
    }


# ============================================================================
# FORM
# ============================================================================

async def insert_response(
    ip_address: str,
    answers: dict,
    completion_time_seconds: int,
    user_agent: Optional[str] = None
) -> dict:
    conn = get_db()
    cursor = conn.execute(
        "INSERT INTO responses (ip_address, answers, completion_time_seconds, user_agent) VALUES (?, ?, ?, ?)",
        (ip_address, json.dumps(answers), completion_time_seconds, user_agent)
    )
    response_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": str(response_id), "success": True}


# ============================================================================
# ACCESS LOG
# ============================================================================

async def log_access(ip_address: str, action: str, metadata: Optional[dict] = None):
    conn = get_db()
    conn.execute(
        "INSERT INTO access_log (ip_address, action, metadata) VALUES (?, ?, ?)",
        (ip_address, action, json.dumps(metadata) if metadata else None)
    )
    conn.commit()
    conn.close()


# ============================================================================
# STATS
# ============================================================================

async def get_overview_stats() -> dict:
    conn = get_db()
    now = datetime.now()

    total = conn.execute("SELECT COUNT(*) as c FROM responses").fetchone()["c"]
    avg_time = conn.execute("SELECT COALESCE(AVG(completion_time_seconds), 0) as a FROM responses").fetchone()["a"]
    unique_ips = conn.execute("SELECT COUNT(DISTINCT ip_address) as c FROM responses").fetchone()["c"]

    last_24h = conn.execute(
        "SELECT COUNT(*) as c FROM responses WHERE submitted_at >= ?",
        ((now - timedelta(hours=24)).isoformat(),)
    ).fetchone()["c"]

    last_7d = conn.execute(
        "SELECT COUNT(*) as c FROM responses WHERE submitted_at >= ?",
        ((now - timedelta(days=7)).isoformat(),)
    ).fetchone()["c"]

    last_30d = conn.execute(
        "SELECT COUNT(*) as c FROM responses WHERE submitted_at >= ?",
        ((now - timedelta(days=30)).isoformat(),)
    ).fetchone()["c"]

    conn.close()

    return {
        "total_responses": total,
        "avg_completion_time": round(avg_time, 1),
        "unique_ips": unique_ips,
        "responses_last_24h": last_24h,
        "responses_last_7d": last_7d,
        "responses_last_30d": last_30d
    }


async def get_risk_distribution() -> List[dict]:
    conn = get_db()
    rows = conn.execute("SELECT answers FROM responses").fetchall()
    conn.close()

    distribution = []
    for dim in DIMENSIONS:
        counts = {"baixo": 0, "moderado": 0, "alto": 0, "critico": 0}
        max_pts = MAX_POINTS.get(dim, 50)

        for row in rows:
            answers = json.loads(row["answers"])
            scores = answers.get(dim, [])
            if scores:
                total = sum(scores)
                pct = (total / max_pts) * 100 if max_pts > 0 else 0
                level = _classify_risk(pct)
                counts[level] += 1

        distribution.append({"dimension": dim, **counts})

    return distribution


async def get_dimension_summary() -> List[dict]:
    conn = get_db()
    rows = conn.execute("SELECT answers FROM responses").fetchall()
    conn.close()

    summary = []
    for dim in DIMENSIONS:
        max_pts = MAX_POINTS.get(dim, 50)
        totals = []

        for row in rows:
            answers = json.loads(row["answers"])
            scores = answers.get(dim, [])
            if scores:
                totals.append(sum(scores))

        avg_pts = sum(totals) / len(totals) if totals else 0
        pct = (avg_pts / max_pts) * 100 if max_pts > 0 else 0

        summary.append({
            "dimension": dim,
            "max_points": max_pts,
            "avg_points": f"{avg_pts:.1f}",
            "percentage": f"{pct:.1f}",
            "risk_level": _classify_risk(pct)
        })

    return summary


async def get_submissions_timeline(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> List[dict]:
    conn = get_db()

    query = "SELECT submitted_at, ip_address FROM responses WHERE 1=1"
    params = []

    if start_date:
        query += " AND submitted_at >= ?"
        params.append(start_date.isoformat())
    if end_date:
        query += " AND submitted_at <= ?"
        params.append(end_date.isoformat())

    query += " ORDER BY submitted_at"
    rows = conn.execute(query, params).fetchall()
    conn.close()

    # Agrupar por hora
    hours: Dict[str, dict] = {}
    for row in rows:
        hour = row["submitted_at"][:13] + ":00:00"
        if hour not in hours:
            hours[hour] = {"hour": hour, "submissions": 0, "unique_ips": set()}
        hours[hour]["submissions"] += 1
        hours[hour]["unique_ips"].add(row["ip_address"])

    return [
        {"hour": v["hour"], "submissions": v["submissions"], "unique_ips": len(v["unique_ips"])}
        for v in hours.values()
    ]


# ============================================================================
# REPORTS
# ============================================================================

async def get_responses_by_filters(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    risk_level: Optional[str] = None,
    dimension: Optional[str] = None,
    limit: int = 100
) -> List[dict]:
    conn = get_db()

    query = "SELECT * FROM responses WHERE 1=1"
    params = []

    if start_date:
        query += " AND submitted_at >= ?"
        params.append(start_date.isoformat())
    if end_date:
        query += " AND submitted_at <= ?"
        params.append(end_date.isoformat())

    query += " ORDER BY submitted_at DESC LIMIT ?"
    params.append(limit)

    rows = conn.execute(query, params).fetchall()
    conn.close()

    results = []
    for row in rows:
        answers = json.loads(row["answers"])
        entry = {
            "id": str(row["id"]),
            "ip_address": row["ip_address"],
            "answers": answers,
            "completion_time_seconds": row["completion_time_seconds"],
            "user_agent": row["user_agent"],
            "submitted_at": row["submitted_at"]
        }

        # Filtrar por nível de risco se solicitado
        if risk_level and dimension:
            scores = answers.get(dimension, [])
            max_pts = MAX_POINTS.get(dimension, 50)
            if scores:
                pct = (sum(scores) / max_pts) * 100
                if _classify_risk(pct) != risk_level:
                    continue

        results.append(entry)

    return results


async def export_for_ai(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> List[dict]:
    return await get_responses_by_filters(start_date=start_date, end_date=end_date, limit=10000)


async def get_dimension_detailed_analysis(dimension: str) -> dict:
    conn = get_db()
    rows = conn.execute("SELECT answers FROM responses").fetchall()
    conn.close()

    max_pts = MAX_POINTS.get(dimension, 50)
    all_scores = []

    for row in rows:
        answers = json.loads(row["answers"])
        scores = answers.get(dimension, [])
        if scores:
            all_scores.append(sum(scores))

    if not all_scores:
        return {"dimension": dimension, "total_responses": 0, "avg": 0, "percentage": 0, "risk_level": "baixo"}

    avg = sum(all_scores) / len(all_scores)
    pct = (avg / max_pts) * 100

    return {
        "dimension": dimension,
        "total_responses": len(all_scores),
        "avg": round(avg, 1),
        "max_points": max_pts,
        "percentage": round(pct, 1),
        "risk_level": _classify_risk(pct),
        "min": min(all_scores),
        "max": max(all_scores)
    }
