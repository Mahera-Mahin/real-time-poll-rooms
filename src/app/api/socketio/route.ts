export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response(null, { status: 426, statusText: 'Upgrade Required' });
}
