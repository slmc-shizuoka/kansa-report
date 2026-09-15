import { onRequestGet as getMeta } from "./functions/api/meta.js";
import { onRequestPost as exportReport } from "./functions/api/export.js";

function methodNotAllowed(allowed) {
  return Response.json(
    { error: "Method not allowed" },
    {
      status: 405,
      headers: { allow: allowed.join(", ") }
    }
  );
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/meta") {
      if (request.method !== "GET") return methodNotAllowed(["GET"]);
      return getMeta({ request, env });
    }

    if (pathname === "/api/export") {
      if (request.method !== "POST") return methodNotAllowed(["POST"]);
      return exportReport({ request, env });
    }

    return env.ASSETS.fetch(request);
  }
};
