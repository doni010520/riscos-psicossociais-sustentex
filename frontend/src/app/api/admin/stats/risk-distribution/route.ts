import { NextResponse } from 'next/server';
import { getRiskDistribution } from '@/lib/db-service';

export async function GET() {
  try {
    const distribution = await getRiskDistribution();
    return NextResponse.json(distribution);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
