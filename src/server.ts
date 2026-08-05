import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// A client that navigates away / cancels mid-SSR makes the dev server socket
// close with "Error: aborted" (ECONNRESET). It is not an app error — ignore it.
function isClientAbort(error: unknown): boolean {
  const err = error as { message?: string; code?: string; name?: string } | undefined;
  const message = String(err?.message ?? "");
  return (
    err?.name === "AbortError" ||
    err?.code === "ECONNRESET" ||
    err?.code === "ECONNABORTED" ||
    /aborted|ECONNRESET|socket hang up/i.test(message)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  request: Request,
  response: Response,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  const captured = consumeLastCapturedError();
  if (request.signal?.aborted || isClientAbort(captured)) {
    // Request was cancelled by the client; nothing to render or report.
    return new Response(null, { status: 499 });
  }

  console.error(captured ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}


function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * Mise en cache CDN (edge). Le HTML rendu côté serveur est anonyme — toutes les
 * données utilisateur sont chargées côté navigateur avec la session — donc il peut
 * être servi depuis le cache périphérique à des millions de visiteurs sans
 * retoucher au serveur. `stale-while-revalidate` sert instantanément une version
 * légèrement ancienne pendant la régénération en arrière-plan.
 */
function applyCacheHeaders(request: Request, response: Response): Response {
  if (request.method !== "GET" || response.status !== 200) return response;

  const url = new URL(request.url);
  const path = url.pathname;

  // Jamais de cache partagé pour les endpoints dynamiques / server functions.
  if (path.startsWith("/api/") || path.startsWith("/_serverFn/")) return response;

  // Une requête portant une session ne doit pas alimenter le cache partagé.
  if (request.headers.get("authorization") || request.headers.get("cookie")) return response;

  const headers = new Headers(response.headers);
  if (headers.has("cache-control")) return response;

  const isHashedAsset = /\/assets\/|\.[0-9a-f]{8,}\.(js|css|woff2?|png|jpg|jpeg|webp|avif|svg)$/i.test(path);
  if (isHashedAsset) {
    headers.set("cache-control", "public, max-age=31536000, immutable");
  } else if ((headers.get("content-type") ?? "").includes("text/html")) {
    headers.set(
      "cache-control",
      "public, max-age=0, s-maxage=60, stale-while-revalidate=86400, stale-if-error=86400",
    );
    headers.set("vary", "Accept-Encoding");
  } else {
    return response;
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(request, response);
      return applyCacheHeaders(request, normalized);
    } catch (error) {
      if (request.signal?.aborted || isClientAbort(error)) {
        return new Response(null, { status: 499 });
      }
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};


