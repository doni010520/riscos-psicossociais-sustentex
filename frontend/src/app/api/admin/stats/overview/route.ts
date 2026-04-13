import { NextResponse } from 'next/server';
import { getOverviewStats } from '@/lib/db-service';

export async function GET() {
  try {
    const stats = getOverviewStats();
    return NextResponse.json(stats);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
