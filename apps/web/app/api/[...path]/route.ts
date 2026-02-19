const BACKEND_URL = "http://localhost:8000";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Allow up to 5 minutes for large document processing (anonymize + chunk + embed)
export const maxDuration = 300;

async function handler(request: Request) {
  const url = new URL(request.url);
  const backendUrl = `${BACKEND_URL}${url.pathname}${url.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "host") {
      headers.set(key, value);
    }
  });

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  // Buffer and forward body for non-GET/HEAD requests
  // Buffering is more reliable than streaming through the proxy
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  try {
    const response = await fetch(backendUrl, init);

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[proxy] ${request.method} ${url.pathname} failed:`, error);
    return new Response(
      JSON.stringify({ detail: "Backend unavailable" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
export const OPTIONS = handler;
