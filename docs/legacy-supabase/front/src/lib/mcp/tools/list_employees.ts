import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_employees",
  title: "List employees",
  description:
    "List employees the signed-in HR user can see in their organization. Returns basic profile fields only.",
  inputSchema: {
    search: z.string().trim().optional().describe("Optional case-insensitive substring to filter by name or email."),
    limit: z.number().int().min(1).max(100).default(25).describe("Max rows to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("employees")
      .select("id, first_name, last_name, email, position, department_id, status")
      .limit(limit);
    if (search && search.replace(/[,()*%\\.:"']/g, "").trim().length > 0) {
      // Strip PostgREST filter syntax characters so the search stays a plain value.
      const clean = search.replace(/[,()*%\\.:"']/g, " ").trim();
      const s = `%${clean}%`;
      q = q.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s}`);
    }
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { employees: data ?? [] },
    };
  },
});
