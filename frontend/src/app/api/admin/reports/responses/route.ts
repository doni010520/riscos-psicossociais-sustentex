import { NextRequest, NextResponse } from 'next/server';
import { getResponses } from '@/lib/db-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const responses = getResponses(limit);
    return NextResponse.json(responses);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
