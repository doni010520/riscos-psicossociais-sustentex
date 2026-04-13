import { NextResponse } from 'next/server';
import { getDimensionSummary } from '@/lib/db-service';

export async function GET() {
  try {
    const summary = getDimensionSummary();
    return NextResponse.json(summary);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
