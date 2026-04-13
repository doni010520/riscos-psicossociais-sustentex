import { NextRequest, NextResponse } from 'next/server';
import { logAccess } from '@/lib/db-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ip = request.headers.get('x-forwarded-for') || '0.0.0.0';
    logAccess(ip, body.action || 'unknown', body.metadata);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
