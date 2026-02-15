import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashIP } from '@/lib/hash';
import { rateLimit } from '@/lib/rateLimit';

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP;
  return '127.0.0.1';
}

declare global {
  var io: import('socket.io').Server | undefined;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pollId } = await context.params;
    if (!pollId) {
      return NextResponse.json({ error: 'Poll ID required' }, { status: 400 });
    }

    const ip = getClientIP(request);
    const rl = rateLimit(`vote:${ip}`);
    if (!rl.ok) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const { optionId, voterToken } = body as { optionId?: string; voterToken?: string };

    if (!optionId || typeof optionId !== 'string') {
      return NextResponse.json(
        { error: 'Option ID is required' },
        { status: 400 }
      );
    }

    const token = typeof voterToken === 'string' && voterToken.trim() ? voterToken.trim() : null;
    if (!token) {
      return NextResponse.json(
        { error: 'Voter token is required' },
        { status: 400 }
      );
    }

    const hashedIP = hashIP(ip);

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
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

    const option = poll.options.find((o) => o.id === optionId);
    if (!option) {
      return NextResponse.json({ error: 'Option not found' }, { status: 404 });
    }

    const existingByIP = await prisma.vote.findUnique({
      where: { pollId_hashedIP: { pollId, hashedIP } },
    });
    if (existingByIP) {
      return NextResponse.json(
        { error: 'You have already voted on this poll' },
        { status: 409 }
      );
    }

    const existingByToken = await prisma.vote.findUnique({
      where: { pollId_voterToken: { pollId, voterToken: token } },
    });
    if (existingByToken) {
      return NextResponse.json(
        { error: 'You have already voted on this poll' },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.vote.create({
        data: {
          pollId,
          optionId,
          hashedIP,
          voterToken: token,
        },
      });
      await tx.option.update({
        where: { id: optionId },
        data: { votesCount: { increment: 1 } },
      });
    });

    const updated = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: true },
    });

    const totalVotes = updated!.options.reduce((s, o) => s + o.votesCount, 0);
    const results = updated!.options.map((o) => ({
      id: o.id,
      text: o.text,
      votesCount: o.votesCount,
      percentage: totalVotes > 0 ? Math.round((o.votesCount / totalVotes) * 100) : 0,
    }));

    if (globalThis.io) {
      globalThis.io.to(`poll:${pollId}`).emit('results', { results, totalVotes });
    }

    return NextResponse.json({
      success: true,
      results,
      totalVotes,
    });
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
      return NextResponse.json(
        { error: 'You have already voted on this poll' },
        { status: 409 }
      );
    }
    console.error('Vote error:', e);
    return NextResponse.json(
      { error: 'Failed to record vote' },
      { status: 500 }
    );
  }
}
