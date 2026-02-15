import { NextRequest, NextResponse } from 'next/server';

const BROADCAST_URL = process.env.BROADCAST_URL || 'http://localhost:3001';
const BROADCAST_SECRET = process.env.BROADCAST_SECRET || '';

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const expected = BROADCAST_SECRET ? `Bearer ${BROADCAST_SECRET}` : '';
  if (BROADCAST_SECRET && auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { pollId, results, totalVotes } = body as {
      pollId: string;
      results: { id: string; text: string; votesCount: number; percentage: number }[];
      totalVotes: number;
    };

    if (!pollId) {
      return NextResponse.json({ error: 'pollId required' }, { status: 400 });
    }

    const res = await fetch(`${BROADCAST_URL}/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(BROADCAST_SECRET ? { Authorization: `Bearer ${BROADCAST_SECRET}` } : {}),
      },
      body: JSON.stringify({ pollId, results, totalVotes }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Broadcast failed:', res.status, text);
      return NextResponse.json(
        { error: 'Broadcast failed' },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Broadcast error:', e);
    return NextResponse.json(
      { error: 'Broadcast failed' },
      { status: 500 }
    );
  }
}
