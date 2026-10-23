// ─────────────────────────────────────────────────────────────────────────────
// Caption composer (FR-42). Same content record, second output format —
// ready-to-paste post text. No AI call, no STORE write.
// ─────────────────────────────────────────────────────────────────────────────

import type { ContentRecord } from "./types";

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

export function composeCaption(record: ContentRecord): string {
  const parts: string[] = [];
  parts.push(record.content.headline.trim());

  if (record.content.body) parts.push(record.content.body.trim());
  if (record.content.tip) parts.push(`Quick tip: ${record.content.tip.trim()}`);
  if (record.content.closing) parts.push(record.content.closing.trim().toUpperCase());

  const tags = new Set<string>(["#ostudioinnovations"]);
  const catTag = slug(record.source.categoryId);
  const subjTag = slug(record.source.subjectId);
  if (catTag) tags.add(`#${catTag}`);
  if (subjTag && subjTag !== catTag) tags.add(`#${subjTag}`);

  parts.push([...tags].join(" "));
  return parts.join("\n\n");
}
