import type {
  PlanJson,
  FeedbackPayload,
  FeedbackComment,
} from "../lib/types/index.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPhaseStatus(
  phaseId: string,
  feedback: FeedbackPayload | null,
): string {
  if (!feedback) return "";
  const ps = feedback.phaseStatuses[phaseId];
  if (!ps) return "";

  const colors: Record<string, string> = {
    approved: "background:#22c55e;color:#fff",
    "needs-work": "background:#ef4444;color:#fff",
    pending: "background:#6b7280;color:#fff",
  };

  return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:12px;font-weight:600;${colors[ps.status] ?? colors.pending}">${ps.status}</span>`;
}

function renderComments(comments: FeedbackComment[], phaseId?: string): string {
  const filtered = phaseId
    ? comments.filter((c) => c.phaseId === phaseId)
    : comments.filter((c) => !c.phaseId);

  if (filtered.length === 0) return "";

  const items = filtered
    .map((c) => {
      const resolved = c.resolved ? ' style="opacity:0.5"' : "";
      const badge = c.resolved
        ? '<span style="color:#22c55e;font-size:12px"> (resolved)</span>'
        : "";
      return `<div${resolved} style="margin:8px 0;padding:8px 12px;border-left:3px solid #60a5fa;background:rgba(96,165,250,0.1);border-radius:0 4px 4px 0">
        ${c.quote ? `<div style="font-style:italic;color:#9ca3af;margin-bottom:4px">"${escapeHtml(c.quote)}"</div>` : ""}
        <div>${escapeHtml(c.comment)}${badge}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:4px">${c.section} &middot; ${new Date(c.createdAt).toLocaleString()}</div>
      </div>`;
    })
    .join("\n");

  return `<div style="margin:12px 0">${items}</div>`;
}

import { createRequire } from "node:module";

type HljsLike = {
  getLanguage(lang: string): unknown;
  highlight(code: string, opts: { language: string }): { value: string };
  highlightAuto(code: string): { value: string };
};

let hljs: HljsLike | null = null;
try {
  const require = createRequire(import.meta.url);
  hljs = require("highlight.js") as HljsLike;
} catch {
  // highlight.js not available
}

function highlightCode(code: string, lang?: string): string {
  if (!hljs) return escapeHtml(code);
  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch {
    return escapeHtml(code);
  }
}

export function renderPlanToHtml(
  plan: PlanJson,
  feedback: FeedbackPayload | null,
): string {
  const title = escapeHtml(plan.meta.title);
  const statusBadge = feedback
    ? `<span style="display:inline-block;padding:4px 12px;border-radius:9999px;font-size:14px;font-weight:600;margin-left:12px;${
        feedback.status === "approved"
          ? "background:#22c55e;color:#fff"
          : feedback.status === "needs-work"
            ? "background:#ef4444;color:#fff"
            : "background:#3b82f6;color:#fff"
      }">${feedback.status}</span>`
    : "";

  const phasesHtml = plan.phases
    .map((phase) => {
      const changesHtml = phase.changes
        .map(
          (change) => `
        <div style="margin:12px 0;padding:12px;background:#1e1e2e;border-radius:6px">
          <h4 style="margin:0 0 8px;color:#cdd6f4">${escapeHtml(change.componentName)}</h4>
          ${change.filePath ? `<div style="font-family:monospace;font-size:13px;color:#89b4fa;margin-bottom:8px">${escapeHtml(change.filePath)}</div>` : ""}
          <div style="color:#bac2de">${escapeHtml(change.description)}</div>
          ${
            change.codeSnippet
              ? `<pre style="margin:8px 0 0;padding:12px;background:#11111b;border-radius:4px;overflow-x:auto;font-size:13px"><code class="hljs">${highlightCode(change.codeSnippet, change.codeLanguage)}</code></pre>`
              : ""
          }
        </div>`,
        )
        .join("\n");

      const criteriaHtml = [
        ...phase.successCriteria.automated.map(
          (c) =>
            `<li>${escapeHtml(c.text)}${c.command ? ` <code style="background:#1e1e2e;padding:2px 6px;border-radius:3px;font-size:13px">${escapeHtml(c.command)}</code>` : ""}</li>`,
        ),
        ...phase.successCriteria.manual.map(
          (c) => `<li>${escapeHtml(c.text)}</li>`,
        ),
      ].join("\n");

      return `
      <section style="margin:24px 0;padding:20px;background:#181825;border-radius:8px;border:1px solid #313244">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
          <h2 style="margin:0;color:#cdd6f4">Phase ${phase.number}: ${escapeHtml(phase.name)}</h2>
          ${renderPhaseStatus(phase.id, feedback)}
        </div>
        ${phase.overview ? `<p style="color:#a6adc8">${escapeHtml(phase.overview)}</p>` : ""}
        ${changesHtml}
        ${criteriaHtml ? `<div style="margin-top:16px"><h4 style="color:#cdd6f4;margin:0 0 8px">Success Criteria</h4><ul style="color:#bac2de;padding-left:20px">${criteriaHtml}</ul></div>` : ""}
        ${renderComments(feedback?.comments ?? [], phase.id)}
      </section>`;
    })
    .join("\n");

  const generalComments = renderComments(feedback?.comments ?? []);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    :root {
      --bg: #1e1e2e;
      --surface: #181825;
      --text: #cdd6f4;
      --text-dim: #a6adc8;
      --border: #313244;
      --blue: #89b4fa;
      --green: #a6e3a1;
      --red: #f38ba8;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #11111b;
      color: var(--text);
      line-height: 1.6;
      padding: 24px;
      max-width: 900px;
      margin: 0 auto;
    }
    h1 { font-size: 28px; margin-bottom: 8px; }
    h2 { font-size: 20px; }
    h3 { font-size: 16px; color: var(--text-dim); }
    h4 { font-size: 14px; }
    code { font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace; }
    pre { line-height: 1.4; }
    a { color: var(--blue); }
    .hljs { background: transparent !important; }
    .mermaid { background: #fff; padding: 16px; border-radius: 6px; margin: 16px 0; }
  </style>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/github-dark.min.css">
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true, theme: 'default' });
  </script>
</head>
<body>
  <header style="margin-bottom:32px">
    <div style="display:flex;align-items:center">
      <h1>${title}</h1>
      ${statusBadge}
    </div>
    <div style="color:#6b7280;font-size:14px;margin-top:4px">
      Version ${plan.meta.version} &middot; ${plan.meta.date}
    </div>
  </header>

  ${plan.overview ? `<section style="margin-bottom:24px"><h3>Overview</h3><p style="margin-top:8px;color:var(--text-dim)">${escapeHtml(plan.overview)}</p></section>` : ""}

  ${plan.diagrams.map((d) => `<div class="mermaid">${escapeHtml(d.mermaidCode)}</div>`).join("\n")}

  ${phasesHtml}

  ${generalComments ? `<section style="margin-top:32px"><h3>General Comments</h3>${generalComments}</section>` : ""}

  <footer style="margin-top:48px;padding-top:16px;border-top:1px solid var(--border);color:#6b7280;font-size:12px">
    Generated by Plan Assistant &middot; ${new Date().toISOString().slice(0, 10)}
  </footer>
</body>
</html>`;
}
