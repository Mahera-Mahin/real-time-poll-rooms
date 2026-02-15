import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rateLimit';

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP;
  return '127.0.0.1';
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(`create:${getClientIP(request)}`);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  try {
    const body = await request.json();
    const { question, options, expiresAt } = body as {
      question?: string;
      options?: string[];
      expiresAt?: string | null;
    };

    const trimmedQuestion = typeof question === 'string' ? question.trim() : '';
    if (!trimmedQuestion) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    const opts = Array.isArray(options) ? options : [];
    const validOptions = opts
      .map((o: unknown) => (typeof o === 'string' ? o.trim() : ''))
      .filter(Boolean);

    if (validOptions.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 options are required' },
        { status: 400 }
      );
    }

    const expiresAtDate =
      typeof expiresAt === 'string' && expiresAt
        ? new Date(expiresAt)
        : undefined;
    const poll = await prisma.poll.create({
      data: {
        question: trimmedQuestion,
        ...(expiresAtDate && { expiresAt: expiresAtDate }),
        options: {
          create: validOptions.map((text) => ({ text })),
        },
      },
      include: {
        options: true,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    const shareUrl = `${baseUrl}/poll/${poll.id}`;

    return NextResponse.json({
      poll: {
        id: poll.id,
        question: poll.question,
        createdAt: poll.createdAt,
        options: poll.options,
      },
      shareUrl,
    });
  } catch (e) {
    console.error('Create poll error:', e);
    return NextResponse.json(
      { error: 'Failed to create poll' },
      { status: 500 }
    );
  }
}
