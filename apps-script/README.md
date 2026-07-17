# CMMS Google Docs Sidebar

Mark, categorize, tag, and link comedy material without leaving Google Docs.
The sidebar places invisible markers (named ranges) in your doc; the CMMS
server measures them and keeps the library in sync.

## Install (one-time per document, ~3 minutes)

1. Open your Google Doc.
2. **Extensions → Apps Script**. A script editor opens in a new tab.
3. In the editor's left sidebar, click the gear (**Project Settings**) and
   check **"Show 'appsscript.json' manifest file in editor"**.
4. Back in the **Editor** tab you'll see two files. Replace their contents:
   - `appsscript.json` → paste the contents of [`appsscript.json`](./appsscript.json)
   - `Code.gs` → paste the contents of [`Code.gs`](./Code.gs)
5. Add the sidebar file: **+ → HTML**, name it exactly `Sidebar`, and paste
   the contents of [`Sidebar.html`](./Sidebar.html).
6. Save (Ctrl/Cmd+S). In the toolbar's function dropdown pick **`showSidebar`**
   and click **Run**. Google will ask you to authorize — it needs only:
   - *view and manage this document* (to place markers and highlights), and
   - *connect to an external service* (to talk to your CMMS server).

   You'll see an "unverified app" warning because it's your own private
   script — click **Advanced → Go to (project name)** to proceed.
7. Reload the Google Doc tab. A **CMMS** menu now appears — **CMMS → Open
   sidebar**.

## Connect to your account (one-time per 90 days)

1. In the CMMS web app: **Settings → Account → Google Docs add-on → Copy
   connect code**.
2. Paste the code into the sidebar's connect panel and click **Connect**.
   (The server URL is pre-filled; only change it if you self-host.)

Codes last 90 days; when one expires the sidebar tells you and you copy a
fresh one.

## Using it

| Action | How |
| --- | --- |
| Register the doc | Sidebar shows a **Register this document** button if CMMS doesn't know it yet |
| New segment | Select text → pick a category (tags/title optional) → **Create segment**. The text gets its color highlight and appears in the web app instantly |
| Link a callback | Select text → search your material under **Associate selection with…** → pick the original → choose the type → **Link selection**. Inherits the original's color |
| Insert material | Search under **Insert from library** → pick → **Insert at cursor**. "Linked copy" keeps it tracked and highlighted |
| After editing the doc | Click **Sync** — updates the library's text/positions and warns if a marked passage was deleted |
| Jump to a segment | **Go** next to any segment in the list |

## Troubleshooting

- **"Waking up the CMMS server"** — free hosting naps after ~15 idle
  minutes; the first call can take up to a minute. The sidebar pings it
  before doing real work.
- **"Document not registered"** — click the Register button in the sidebar
  (or register it from the web app's Documents page).
- **"Your connect code has expired"** — copy a fresh one from the web app's
  Settings.
- **"Marker … not found"** — the marker was deleted from the doc (e.g. the
  text was cut). Run **Sync** to see orphan warnings in the web app.

## Full verification checklist (real doc)

1. Register a doc from the sidebar → pill flips to "Registered".
2. Select a sentence → New Segment with a category → highlight appears; the
   segment shows in the web app's Browse with the exact same text.
3. Edit words *inside* the highlighted span → **Sync** → the web app's copy
   updates.
4. Delete an entire highlighted passage → **Sync** → orphan warning naming
   that segment.
5. Select other text → **Associate** with segment #2 as a callback → new
   highlight uses the same color; the association shows on the segment's
   detail page in the web app.
6. **Insert from library** with "linked copy" → text appears at your cursor,
   highlighted, with a derivative association in the web app.
7. **Go** jumps your cursor to the segment.
8. In the web app, change segment #2's color → back in the doc, **Sync** →
   the highlight repaints to the new color.
