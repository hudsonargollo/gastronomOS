import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gastronomos.hudsonargollo2.workers.dev';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization');
    const response = await fetch(`${API_BASE}/api/v1/menu/categories/list`, {
      headers: {
        'Authorization': token || '',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
