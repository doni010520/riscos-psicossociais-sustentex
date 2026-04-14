import { NextRequest, NextResponse } from 'next/server';
import { insertResponse, logAccess } from '@/lib/db-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ip = request.headers.get('x-forwarded-for') || '0.0.0.0';
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    const result = await insertResponse(ip, body.answers, body.completion_time_seconds, userAgent);
    await logAccess(ip, 'form_submit', { response_id: result.id });

    return NextResponse.json({
      success: true,
      message: 'Formulário enviado com sucesso',
      response_id: result.id,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
