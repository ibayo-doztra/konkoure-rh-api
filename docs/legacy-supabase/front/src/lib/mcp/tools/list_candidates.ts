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
  name: "list_candidates",
  title: "List candidates",
  description:
    "List candidates in the signed-in user's organization. Optionally filter by job_id or stage.",
  inputSchema: {
    job_id: z.string().uuid().optional().describe("Optional job UUID to filter candidates for that opening."),
    stage: z.string().trim().optional().describe("Optional pipeline stage filter."),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ job_id, stage, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("candidates")
      .select("id, first_name, last_name, email, phone, stage, job_id, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (job_id) q = q.eq("job_id", job_id);
    if (stage) q = q.eq("stage", stage);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { candidates: data ?? [] },
    };
  },
});
