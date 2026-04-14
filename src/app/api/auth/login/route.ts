import { NextRequest, NextResponse } from 'next/server';
import { loginAdmin } from '@/lib/db-service';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    const result = await loginAdmin(email, password);

    if (!result.success) {
      return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      admin: result.admin,
      access_token: result.admin!.access_token,
      token_type: 'bearer',
      expires_in: 86400,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
