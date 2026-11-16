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
  name: "add_candidate_note",
  title: "Add a candidate note",
  description:
    "Add a private text note to a candidate profile. The note is attributed to the signed-in HR user.",
  inputSchema: {
    candidate_id: z.string().uuid().describe("UUID of the candidate."),
    body: z.string().trim().min(1).describe("Note text to add."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ candidate_id, body }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("candidate_notes")
      .insert({ candidate_id, body, author_id: ctx.getUserId() })
      .select()
      .single();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: `Note added (id: ${data.id})` }],
      structuredContent: { note: data },
    };
  },
});
