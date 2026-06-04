const BACKEND_API_URL = (process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export const runtime = "nodejs";
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function upstreamUrl(path: string[], requestUrl: string) {
  const url = new URL(requestUrl);
  const upstreamPath = path.map((segment) => encodeURIComponent(segment)).join("/");
  return `${BACKEND_API_URL}/api/v1/${upstreamPath}${url.search}`;
}

async function proxyRequest(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");

  const upstreamResponse = await fetch(upstreamUrl(path, request.url), {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    cache: "no-store",
  });

  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}

export async function GET(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}
