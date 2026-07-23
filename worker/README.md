# LDT proxy Worker

`ldt-proxy.js` is a Cloudflare Worker that lets the biomarker search tool query NY State's
Wadsworth Center CLEP "Approved Laboratory Developed Tests" database. It exists only because
that site sends no `Access-Control-Allow-Origin` header — without it, a browser blocks the
tool's `fetch()` from reading the response at all. This Worker fetches the page server-side
(no CORS restriction between servers), parses it, and returns clean JSON with CORS enabled.

## Deploy (no local Node/wrangler needed)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) and sign in (a free account works).
2. **Workers & Pages** → **Create** → **Create Worker**. Give it any name (e.g. `ldt-proxy`).
3. Click **Edit code**, delete the placeholder content, and paste in the full contents of
   `ldt-proxy.js`.
4. Click **Deploy**.
5. Copy the deployed URL (looks like `https://ldt-proxy.<your-subdomain>.workers.dev`).
6. In the biomarker search tool, open **Settings** (gear icon) and paste that URL into
   **LDT proxy Worker URL**.

That's it — no build step, no CLI, no account beyond the free Cloudflare signup.

## What it does

`GET <worker-url>?q=<term>&status=All|approved|conditionally_approved` →

```json
{
  "term": "CENP-B",
  "total": 1,
  "count": 1,
  "records": [
    {
      "facilityName": "Quest Diagnostics Nichols Institute",
      "facilityId": "...", "projectId": "...", "facilityState": "...",
      "analyte": "...", "method": "...", "specimenType": "...",
      "permitCategory": "...", "status": "Approved",
      "detailLink": "https://www.wadsworth.org/node/.../printable/print"
    }
  ]
}
```

`total` is the true match count reported by the site (accurate even though only the first
50 records are returned — `records` is capped to keep response size/latency predictable,
since a bare 2-3 letter antigen abbreviation can otherwise match thousands of rows).

## Notes for anyone modifying this

- The upstream query always requests the antigen/analyte term as typed by the caller — the
  *client* (not this Worker) is responsible for stripping "Anti-"/Ig-class suffixes before
  calling it, since NY's site defaults to "contains any word" matching and words like "IgG"
  are present in a huge fraction of test names on their own.
- `items_per_page` must be one of the site's actual exposed-filter options (`5`, `10`, `20`,
  `25`, `50`, or `All`) — an arbitrary value like `100` silently breaks the filter server-side
  and the page renders as if nothing matched. This was found the hard way; don't "optimize"
  it back to a round number without re-checking against the real site.
