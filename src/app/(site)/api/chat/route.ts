export async function POST() {
  return Response.json({ available: false, error: 'Chat is unavailable. Please use the animal filters or adoption resources.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
}
