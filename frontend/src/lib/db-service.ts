import { getDb } from './database';
import bcrypt from 'bcryptjs';

const DIMENSIONS = ['demandas', 'controle', 'relacionamento', 'cargo', 'mudanca', 'apoio_chefia', 'apoio_colegas'];
const MAX_POINTS: Record<string, number> = {
  demandas: 80, controle: 60, relacionamento: 40,
  cargo: 30, mudanca: 30, apoio_chefia: 50, apoio_colegas: 40,
};

function classifyRisk(percentage: number): string {
  if (percentage < 30) return 'baixo';
  if (percentage < 50) return 'moderado';
  if (percentage < 90) return 'alto';
  return 'critico';
}

// ============================================================================
// AUTH
// ============================================================================

export function loginAdmin(email: string, password: string) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM admin_users WHERE email = ? AND is_active = 1').get(email) as any;

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return { success: false };
  }

  db.prepare('UPDATE admin_users SET last_login = datetime("now") WHERE id = ?').run(row.id);

  return {
    success: true,
    admin: {
      id: String(row.id),
      email: row.email,
      full_name: row.full_name,
      access_token: `token-${row.id}-${Date.now()}`,
      token_type: 'bearer',
    },
  };
}

// ============================================================================
// FORM
// ============================================================================

export function insertResponse(ipAddress: string, answers: any, completionTimeSeconds: number, userAgent?: string) {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO responses (ip_address, answers, completion_time_seconds, user_agent) VALUES (?, ?, ?, ?)'
  ).run(ipAddress, JSON.stringify(answers), completionTimeSeconds, userAgent || null);

  return { id: String(result.lastInsertRowid), success: true };
}

export function logAccess(ipAddress: string, action: string, metadata?: any) {
  const db = getDb();
  db.prepare('INSERT INTO access_log (ip_address, action, metadata) VALUES (?, ?, ?)').run(
    ipAddress, action, metadata ? JSON.stringify(metadata) : null
  );
}

// ============================================================================
// STATS
// ============================================================================

export function getOverviewStats() {
  const db = getDb();
  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const total = (db.prepare('SELECT COUNT(*) as c FROM responses').get() as any).c;
  const avgTime = (db.prepare('SELECT COALESCE(AVG(completion_time_seconds), 0) as a FROM responses').get() as any).a;
  const uniqueIps = (db.prepare('SELECT COUNT(DISTINCT ip_address) as c FROM responses').get() as any).c;
  const last24h = (db.prepare('SELECT COUNT(*) as c FROM responses WHERE submitted_at >= ?').get(h24) as any).c;
  const last7d = (db.prepare('SELECT COUNT(*) as c FROM responses WHERE submitted_at >= ?').get(d7) as any).c;
  const last30d = (db.prepare('SELECT COUNT(*) as c FROM responses WHERE submitted_at >= ?').get(d30) as any).c;

  return {
    total_responses: total,
    avg_completion_time: Math.round(avgTime * 10) / 10,
    unique_ips: uniqueIps,
    responses_last_24h: last24h,
    responses_last_7d: last7d,
    responses_last_30d: last30d,
  };
}

export function getRiskDistribution() {
  const db = getDb();
  const rows = db.prepare('SELECT answers FROM responses').all() as any[];

  return DIMENSIONS.map((dim) => {
    const counts = { baixo: 0, moderado: 0, alto: 0, critico: 0 };
    const maxPts = MAX_POINTS[dim] || 50;

    for (const row of rows) {
      const answers = JSON.parse(row.answers);
      const scores: number[] = answers[dim] || [];
      if (scores.length > 0) {
        const total = scores.reduce((a: number, b: number) => a + b, 0);
        const pct = (total / maxPts) * 100;
        const level = classifyRisk(pct) as keyof typeof counts;
        counts[level]++;
      }
    }

    return { dimension: dim, ...counts };
  });
}

export function getDimensionSummary() {
  const db = getDb();
  const rows = db.prepare('SELECT answers FROM responses').all() as any[];

  return DIMENSIONS.map((dim) => {
    const maxPts = MAX_POINTS[dim] || 50;
    const totals: number[] = [];

    for (const row of rows) {
      const answers = JSON.parse(row.answers);
      const scores: number[] = answers[dim] || [];
      if (scores.length > 0) {
        totals.push(scores.reduce((a: number, b: number) => a + b, 0));
      }
    }

    const avgPts = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
    const pct = maxPts > 0 ? (avgPts / maxPts) * 100 : 0;

    return {
      dimension: dim,
      max_points: maxPts,
      avg_points: avgPts.toFixed(1),
      percentage: pct.toFixed(1),
      risk_level: classifyRisk(pct),
    };
  });
}

export function getResponses(limit = 100) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM responses ORDER BY submitted_at DESC LIMIT ?').all(limit) as any[];

  return rows.map((row) => ({
    id: String(row.id),
    ip_address: row.ip_address,
    answers: JSON.parse(row.answers),
    completion_time_seconds: row.completion_time_seconds,
    user_agent: row.user_agent,
    submitted_at: row.submitted_at,
  }));
}
