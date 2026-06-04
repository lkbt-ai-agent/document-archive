const BACKEND_API_URL = (process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const upstreamResponse = await fetch(`${BACKEND_API_URL}/api/v1/search/rag`, {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
    cache: "no-store",
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: upstreamResponse.headers,
  });
}
