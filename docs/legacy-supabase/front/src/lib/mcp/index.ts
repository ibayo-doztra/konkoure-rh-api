import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listEmployees from "./tools/list_employees";
import listJobs from "./tools/list_jobs";
import listCandidates from "./tools/list_candidates";
import addCandidateNote from "./tools/add_candidate_note";

// Build the OAuth issuer from the Supabase project ref. `import.meta.env`
// is inlined by Vite at build time; `process.env.SUPABASE_URL` on published
// Workers is rewritten to the `.lovable.cloud` proxy, which mcp-js rejects
// on discovery (RFC 8414 issuer mismatch).
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "konkoure-mcp",
  title: "Konkouré SIRH",
  version: "0.1.0",
  instructions:
    "Tools to browse and act on HR data (employees, jobs, candidates) inside the signed-in user's Konkouré organization. All calls run as the connected HR user and respect Konkouré's row-level security. Use `list_employees`, `list_jobs`, `list_candidates` to read, and `add_candidate_note` to attach a note to a candidate.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listEmployees, listJobs, listCandidates, addCandidateNote],
});
