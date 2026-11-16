import { createFileRoute } from "@tanstack/react-router";
// Import the markdown file as a raw string at build time.
// The endpoint therefore always serves the version bundled with the current build,
// which is the version committed to the repo.
import markdown from "../../../../../docs/mobile/flutter-timeclock.md?raw";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

export const Route = createFileRoute("/api/public/docs/flutter-timeclock")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const download = url.searchParams.get("download") === "1";
        const headers: Record<string, string> = {
          "Content-Type": "text/markdown; charset=utf-8",
          "Cache-Control": "public, max-age=60, must-revalidate",
          ...CORS_HEADERS,
        };
        if (download) {
          headers["Content-Disposition"] =
            'attachment; filename="flutter-timeclock.md"';
        }
        return new Response(markdown, { status: 200, headers });
      },
    },
  },
});
