import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Poll ID required' }, { status: 400 });
    }

    const poll = await prisma.poll.findUnique({
      where: { id },
      include: { options: true },
    });

    if (!poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }

    if (poll.expiresAt && new Date() > poll.expiresAt) {
      return NextResponse.json(
        { error: 'This poll has expired' },
        { status: 410 }
      );
    }

    const totalVotes = poll.options.reduce((sum, o) => sum + o.votesCount, 0);

    return NextResponse.json({
      poll: {
        id: poll.id,
        question: poll.question,
        createdAt: poll.createdAt,
        expiresAt: poll.expiresAt ?? undefined,
        options: poll.options.map((o) => ({
          id: o.id,
          text: o.text,
          votesCount: o.votesCount,
        })),
        totalVotes,
      },
    });
  } catch (e) {
    console.error('Get poll error:', e);
    return NextResponse.json(
      { error: 'Failed to fetch poll' },
      { status: 500 }
    );
  }
}
