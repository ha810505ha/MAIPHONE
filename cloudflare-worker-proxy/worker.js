const PROVIDERS = {
  claude: {
    baseUrl: "https://api.anthropic.com/v1",
    allowedPaths: [/^\/messages$/, /^\/models$/],
  },
  ollama: {
    baseUrl: "https://ollama.com/v1",
    allowedPaths: [/^\/chat\/completions$/, /^\/models$/],
  },
};

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://ha810505ha.github.io",
];

const corsHeaders = (request, env) => {
  const origin = request.headers.get("Origin") || "";
  const configured = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const allowedOrigins = configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,x-api-key,anthropic-version,anthropic-dangerous-direct-browser-access,HTTP-Referer,X-Title",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Expose-Headers": "Content-Type",
    "Vary": "Origin",
  };
};

const json = (request, env, body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request, env),
    },
  });

const sanitizeHeaders = (request, providerKey) => {
  const headers = new Headers();
  const contentType = request.headers.get("Content-Type");
  const authorization = request.headers.get("Authorization");
  const apiKey = request.headers.get("x-api-key");
  const anthropicVersion = request.headers.get("anthropic-version");
  const referer = request.headers.get("HTTP-Referer");
  const title = request.headers.get("X-Title");

  if (contentType) headers.set("Content-Type", contentType);
  if (authorization) headers.set("Authorization", authorization);
  if (apiKey) headers.set("x-api-key", apiKey);
  if (anthropicVersion || providerKey === "claude") {
    headers.set("anthropic-version", anthropicVersion || "2023-06-01");
  }
  if (providerKey === "claude") {
    headers.set("anthropic-dangerous-direct-browser-access", "true");
  }
  if (referer) headers.set("HTTP-Referer", referer);
  if (title) headers.set("X-Title", title);

  return headers;
};

const stripProviderPrefix = (pathname) => {
  const parts = pathname.split("/").filter(Boolean);
  const providerKey = parts.shift();
  const providerPath = `/${parts.join("/")}`;
  return { providerKey, providerPath: providerPath === "/" ? "/" : providerPath };
};

const isAllowedPath = (provider, path) => provider.allowedPaths.some((pattern) => pattern.test(path));

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return json(request, env, {
        ok: true,
        name: "MALIPHONE Cloudflare AI Proxy",
        usage: "/claude/messages, /claude/models, /ollama/chat/completions, /ollama/models",
      });
    }

    const { providerKey, providerPath } = stripProviderPrefix(url.pathname);
    const provider = PROVIDERS[providerKey];
    if (!provider) {
      return json(request, env, { error: "Unsupported provider" }, 404);
    }
    if (!["GET", "POST"].includes(request.method)) {
      return json(request, env, { error: "Method not allowed" }, 405);
    }
    if (!isAllowedPath(provider, providerPath)) {
      return json(request, env, { error: "Path is not allowed for this provider" }, 403);
    }

    const targetUrl = new URL(`${provider.baseUrl}${providerPath}`);
    url.searchParams.forEach((value, key) => targetUrl.searchParams.set(key, value));

    const init = {
      method: request.method,
      headers: sanitizeHeaders(request, providerKey),
      body: request.method === "GET" ? undefined : request.body,
      redirect: "follow",
    };

    try {
      const upstream = await fetch(targetUrl.toString(), init);
      const headers = new Headers(upstream.headers);
      Object.entries(corsHeaders(request, env)).forEach(([key, value]) => headers.set(key, value));
      return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
    } catch (error) {
      return json(request, env, { error: "Proxy request failed", message: error?.message || "Unknown error" }, 502);
    }
  },
};
