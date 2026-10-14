// Runs in GitHub Actions (.github/workflows/instagram.yml) when Lasse adds the "approve"
// label to an Instagram issue. Publishes the carousel in social/<date>/post.json through
// the Instagram API with Instagram Login, then reports back on the issue.
import fs from "node:fs";
import path from "node:path";

const { IG_USER_ID, IG_ACCESS_TOKEN, ISSUE_NUMBER, ISSUE_BODY = "", GITHUB_TOKEN, GITHUB_REPOSITORY } = process.env;
const API = `https://graph.instagram.com/${process.env.IG_API_VERSION || "v25.0"}`;
const GH = `https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${ISSUE_NUMBER}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function github(method, url, body) {
  const res = await fetch(url, { method, headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) console.error(`GitHub ${method} ${url}: ${res.status} ${await res.text()}`);
  return res;
}
const comment = (text) => github("POST", `${GH}/comments`, { body: text });

async function ig(method, endpoint, params) {
  const body = new URLSearchParams({ ...params, access_token: IG_ACCESS_TOKEN });
  const url = method === "GET" ? `${API}/${endpoint}?${body}` : `${API}/${endpoint}`;
  const res = await fetch(url, method === "GET" ? {} : { method, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`Instagram ${endpoint}: ${json.error?.message ?? res.status}`);
  return json;
}

async function main() {
  if (!IG_USER_ID || !IG_ACCESS_TOKEN) throw new Error("The IG_USER_ID and IG_ACCESS_TOKEN secrets are not set yet. See INSTAGRAM.md.");
  const ref = ISSUE_BODY.match(/post:\s*(social\/\d{4}-\d{2}-\d{2}\/post\.json)/);
  if (!ref) throw new Error("The issue does not name a post file (a line like `post: social/2026-10-15/post.json`).");
  const post = JSON.parse(fs.readFileSync(path.resolve(ref[1]), "utf8"));
  if (!post.caption || post.caption.startsWith("TODO")) throw new Error(`${ref[1]} has no caption.`);

  for (const url of post.slides) {
    const head = await fetch(url, { method: "HEAD" });
    if (!head.ok) throw new Error(`Slide not reachable yet (${head.status}): ${url}. Wait for the site to deploy, then add the label again.`);
  }

  const children = [];
  for (const url of post.slides) children.push((await ig("POST", `${IG_USER_ID}/media`, { image_url: url, is_carousel_item: "true" })).id);
  const container = (await ig("POST", `${IG_USER_ID}/media`, { media_type: "CAROUSEL", children: children.join(","), caption: post.caption })).id;

  for (let i = 0; i < 24; i++) {
    const { status_code } = await ig("GET", container, { fields: "status_code" });
    if (status_code === "FINISHED") break;
    if (status_code === "ERROR" || status_code === "EXPIRED") throw new Error(`Instagram could not prepare the carousel (${status_code}).`);
    await sleep(5000);
  }
  const { id } = await ig("POST", `${IG_USER_ID}/media_publish`, { creation_id: container });
  const { permalink } = await ig("GET", id, { fields: "permalink" }).catch(() => ({}));

  await comment(`Posted to Instagram${permalink ? `: ${permalink}` : "."}`);
  await github("POST", `${GH}/labels`, { labels: ["posted"] });
  await github("PATCH", GH, { state: "closed", state_reason: "completed" });
  console.log(`Published ${post.entry} as ${id}`);
}

main().catch(async (e) => {
  console.error(e.message);
  await comment(`Could not post: ${e.message}\n\nFix the cause, then add the **approve** label again.`);
  await github("DELETE", `${GH}/labels/approve`);
  process.exit(1);
});
