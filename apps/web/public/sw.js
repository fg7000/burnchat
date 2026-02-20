// Service worker that intercepts /auth/callback requests.
// The static server returns 404 for this path, but the service worker
// catches it first and returns a page that extracts the token.

self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);

  // Only intercept /auth/callback (not /api/auth/callback)
  if (url.pathname !== "/auth/callback") return;

  var token =
    url.searchParams.get("token") || url.searchParams.get("auth_token");
  if (!token) return;

  var html =
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    "<title>Signing in\u2026</title></head>" +
    '<body style="background:#030712;color:#9ca3af;display:flex;' +
    "align-items:center;justify-content:center;height:100vh;margin:0;" +
    'font-family:sans-serif"><p>Signing you in\u2026</p>' +
    "<script>" +
    'try{localStorage.setItem("burnchat_pending_token",' +
    "JSON.stringify(" +
    JSON.stringify(token) +
    "))}catch(e){}" +
    "if(window.opener){try{window.opener.postMessage(" +
    '{type:"burnchat_auth_token",token:' +
    JSON.stringify(token) +
    '},"*")}catch(e){}' +
    "setTimeout(function(){window.close()},400)" +
    "}else{window.location.replace('/')}" +
    "</" +
    "script></body></html>";

  event.respondWith(
    new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  );
});

// Activate immediately
self.addEventListener("install", function () {
  self.skipWaiting();
});
self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});
