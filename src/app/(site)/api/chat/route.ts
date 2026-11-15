export async function POST() {
  return Response.json({ available: false, error: 'AI chat is unavailable in this local demo. Please use the animal filters or published rescue information.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
}
