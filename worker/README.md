# LDT proxy Worker

`ldt-proxy.js` is a Cloudflare Worker that lets the biomarker search tool query NY State's
Wadsworth Center CLEP "Approved Laboratory Developed Tests" database. It exists only because
that site sends no `Access-Control-Allow-Origin` header — without it, a browser blocks the
tool's `fetch()` from reading the response at all. This Worker fetches the page server-side
(no CORS restriction between servers), parses it, and returns clean JSON with CORS enabled.

## Deploy (no local Node/wrangler needed)

This takes about 5 minutes, entirely in the browser, on Cloudflare's free plan (no credit
card required). Cloudflare's dashboard wording shifts slightly between account types and
over time — if a button doesn't say the exact text below, look for the button that matches
the *description* next to it; the flow itself is stable.

**1. Create a Cloudflare account (skip if you already have one)**

Go to **[dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)** and sign up with
an email address. No payment info is needed for what we're doing here.

**2. Open the Workers section**

Log in at **[dash.cloudflare.com](https://dash.cloudflare.com)**. In the left sidebar, click
**Workers & Pages** (if you don't see a sidebar, click the hamburger/menu icon top-left first).

**3. Pick a `workers.dev` subdomain (first Worker only, one-time)**

If this is the very first Worker on your account, Cloudflare will ask you to choose a
subdomain, e.g. typing `francis-tools` gives you `*.francis-tools.workers.dev` for every
Worker you ever create. Pick anything available and confirm — you can't easily change this
later, but it doesn't matter what you pick.

**4. Create the Worker**

Click **Create application** (or just **Create**, depending on what you see) → choose
**Create Worker** (sometimes labeled **"Hello World" Worker** or similar — you want the
plain/blank starter, not a framework template like Next.js or a specific gallery example).
Give it a name when prompted, e.g. `ldt-proxy` (this becomes part of the URL, so keep it
short — the boxes usually accept `-` but not spaces). Click **Deploy** to create it with its
placeholder "Hello World" code — you'll replace that code next.

**5. Replace the code**

On the Worker's page, click **Edit code** (sometimes shown as a `</>`  icon, or "Edit" in a
dropdown). This opens a browser-based code editor showing a file, usually named
`worker.js` or `index.js`, containing placeholder `Hello World` code.

- Select **all** the existing text in that file (Ctrl+A / Cmd+A) and delete it.
- Open [`ldt-proxy.js`](ldt-proxy.js) from this repo, copy its **entire contents**, and paste
  it into the editor in place of the placeholder.

**6. Deploy**

Click **Save and deploy** (or **Deploy**, top-right of the editor). Wait for the confirmation
that it deployed successfully.

**7. Get the URL and verify it works**

Go back to the Worker's main page (leave the code editor) — you'll see its URL near the top,
looking like:

```
https://ldt-proxy.<your-subdomain>.workers.dev
```

Copy that, paste `?q=GADA` on the end, and open it in a new browser tab, e.g.:

```
https://ldt-proxy.<your-subdomain>.workers.dev?q=GADA
```

You should see a page of JSON starting with `{"term":"GADA","total":...`. If instead you see
an error page or blank response, see **Troubleshooting** below before moving on.

**8. Wire it into the tool**

Open `FDA510kBiomarkerSearch.html` in a browser, click the gear icon (Settings), and paste
the Worker's base URL (**without** the `?q=...` part you added to test) into
**LDT proxy Worker URL**. Switch to the **LDT (NY State)** tab and search a biomarker to
confirm.

### Troubleshooting

| Symptom | Likely cause |
|---|---|
| Step 7's test URL shows Cloudflare's default "Hello World" text, not JSON | The code paste in step 5 didn't fully replace the placeholder, or you deployed before saving the paste. Go back to **Edit code**, confirm the file is `ldt-proxy.js`'s content top-to-bottom (starts with `// LDT search proxy for...`), then deploy again. |
| Test URL shows `{"error":"Missing required query parameter: q"}` | Working correctly — you forgot to add `?q=GADA` (or similar) to the end of the URL. |
| Test URL shows `{"error":"LDT lookup failed", ...}` | The Worker deployed fine but couldn't reach or parse wadsworth.org — check the `detail` field in the response; a timeout usually just means retry, since wadsworth.org can be slow. |
| The tool itself shows "Network error — could not reach the LDT proxy" | The URL pasted into Settings is wrong or missing — re-check it matches exactly what step 7 showed (no trailing `?q=...`, no trailing slash). |
| Can't find "Create Worker" / only see Pages options | You may be in the **Pages** tab instead of **Workers** — look for a toggle or separate tab between "Workers" and "Pages" near the top of the section. |

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
