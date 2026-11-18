![Paper Map: papers on a timeline, joined by hand-drawn lines](assets/preview.png)

<p align="center">
  <a href="https://liamxluo.github.io/paper-map/"><img src="icons/icon-512.png" width="64" alt="Paper Map app icon"></a>
</p>

<p align="center">
  <a href="https://liamxluo.github.io/paper-map/">Get the app</a> &nbsp;·&nbsp;
  <a href="#how-it-works">How it works</a> &nbsp;·&nbsp;
  <a href="#get-started">Get started</a> &nbsp;·&nbsp;
  <a href="#good-to-know">Good to know</a>
</p>

I built this simply because I wanted a better way to organise what I read and understand how ideas connect.

![Structure: topics inside topics, to any depth. Connect: lines between papers, concepts and topics. Explore: a field laid out over time.](assets/features.svg)

---

## How it works

### Lines

![How each kind of line looks: builds on is solid, responds to is dashed, related to is dotted, needs runs in long dashes from a concept, related topics are marked ⇄ and light up together](assets/lines-legend.svg)

![Linking a paper to one in another subtopic, giving the line a note and the Main line colour, seeing the whole colour line light up, then How far → Whole line](assets/lines.gif)

Click a paper to light up the lines around it; notes on lines appear only then, so the map stays clean. **How far** in its panel goes further, up to **Whole line**; the further away a paper is, the fainter it looks, and a count says how much is lit. **Options** there limits it to what came earlier or later.

Give a main line of thought its own colour from a line's ✎. **Colour lines** above the map keeps them in one place: name a path, see what is on it, or hide it for a while.

### Topics

Top-level topics are big areas, such as a field or a project. Related topics carry ⇄ beside their names and light up together; colour a link to say which path it belongs to.

### Concepts

A concept is an idea papers need, with the year it appeared, such as Nash equilibrium (1950). Concepts have their own row at the top of the map and their own page in Contents. Add one from **+ New paper ▾ → Concept**, or from a paper's Prerequisite concepts.

---

## Get started

### I. Get the app

1. Open **[liamxluo.github.io/paper-map](https://liamxluo.github.io/paper-map/)** in Chrome or Edge. It shows a made-up example.
2. Click **Install** at the top right. On iPhone or iPad, tap **Share → Add to Home Screen**.

It opens in its own window, works offline, and updates itself with every release.

<details>
<summary>No Chrome or Edge? Use it as a file</summary>

1. Download [`index.html`](index.html): open it and click **Download raw file**.
2. Double-click it to open it in any browser.

The app and the file keep separate lists. Connect sync in both to share one list, or move it with **Settings → Data → Export backup** and **Import backup**.

</details>

### II. Sync (recommended)

Your list lives in the app until you connect sync; then it is safe, keeps earlier versions, and follows you to every device. Open **Settings → Sync** and choose one.

**GitHub, the most reliable.** Every save is kept for good, and it works on phones too.
1. [Create a private repository](https://github.com/new?name=paper-map-data&visibility=private) and tick **Add a README file**.
2. [Create a token](https://github.com/settings/personal-access-tokens/new?name=Paper+Map&expires_in=366&contents=write): under Repository access choose **Only select repositories** and pick that repository. The link already sets the one permission it needs, **Contents: Read and write**.
3. Paste the token under **Settings → Sync → GitHub** and click **Connect**. Paper Map asks when the token expires, then reminds you two weeks before, with the steps to renew it.

**An iCloud Drive, Dropbox or OneDrive folder.** Under **Settings → Sync → iCloud / Dropbox folder**, click **Choose a folder** and pick one inside iCloud Drive, Dropbox or OneDrive: that app copies it to your other computers and keeps its own history, and Paper Map keeps earlier copies in `data/backups`. No account or token needed. Works in Chrome and Edge on a computer; on a phone, use GitHub.

<details>
<summary>Still confused? First time, or on another device</summary>

- Your whole list is one file, `data/paper-map.json`. Notes are copied into `notes/` for reading, and PDFs go into `pdfs/`.
- On another device, install the app and connect the same way: your list loads from there.
- Changed things on two devices? Paper Map combines them. It only asks about something changed on both, such as the same paper.
- If iCloud Drive, Dropbox or OneDrive ever makes a second copy of the file (two computers at once), Paper Map notices it and offers to combine it into your list.
- A new or empty page never saves over your list: it loads it instead. **Earlier versions** brings back any past save.
- GitHub says the repository can't be found? The token doesn't include it yet: open the token on GitHub and add the repository under **Repository access**.

</details>

### III. Notes and PDFs

![Opening a paper’s notes, attaching its PDF, writing Markdown notes beside it, exporting them](assets/notes.gif)

PDFs need sync. **Settings → Data → Export notes** exports every note at once.

### IV. More you might want to know

<details>
<summary>Zoom the timeline</summary>

![Dragging along the years to zoom in, dragging sideways to move, double-clicking a point](assets/zoom.gif)

</details>

<details>
<summary>Subtopics inside subtopics</summary>

![Dragging a subtopic under another topic, then making it a topic of its own, then undoing](assets/drag.gif)

</details>

<details>
<summary>Can't drag, on a phone say?</summary>

Modify the subtopic and choose its new place under **Inside**.

![Opening Exam season › Procrastination, adding a subtopic inside it, and seeing every level on the map](assets/subtopics.gif)

</details>

<details>
<summary>Move a paper, or hide rows for a while</summary>

Drag a paper's dot up or down to another row, or drag its year in the list onto a topic in Contents. To hide rows, untick them in **Topics on the map**; **Show all** brings them back.

</details>

<details>
<summary>Import papers from Zotero, a CSV, BibTeX or RIS file</summary>

Choose **+ New paper ▾ → Import papers** (on a phone, **⋯ → Import papers**). In Zotero, right-click a collection, choose **Export Collection…** and pick CSV or BibTeX; any spreadsheet saved as CSV works too, and you can say which column is which. Before anything is added you choose the topic and subtopic, see every paper with a tick box, and keep or drop their tags and notes. Papers already in your map are recognised by DOI or by title and year, and left unticked. Undo puts everything back.

</details>

<details>
<summary>Fill in a paper from its DOI</summary>

Paste the DOI (or a doi.org link) at the top of **New paper** and click **Fill from DOI**: the title, authors, year and source come from Crossref, DataCite or the other DOI agencies. Anything you already typed stays as it is.

</details>

<details>
<summary>Export a map as PNG or PDF</summary>

**Export**, next to Colour lines, lets you tick the topics to include. It shows which topics outside your choice are linked, and how many lines go there: add them, or leave them out and those lines are dropped (a colour line keeps the part inside your choice). Show all lines, only colour lines, or just the papers; a note on the picture says the lines are your own reading, not a citation network. Save it wherever you like, a Dropbox or iCloud Drive folder included.

![An exported map: a title, the chosen topics with their lines, a legend, and a note that the lines are the author’s own reading](assets/export.png)

</details>

<details>
<summary>Lists</summary>

![Each topic as a table, with status, notes, tags and the concepts its papers use](assets/table.png)

</details>

<details>
<summary>Related topics, in colour</summary>

![Board games is related to Procrastination by a blue link and to Dinner by a yellow one; in Board games both light up in their colours, and hovering the yellow mark lights up only Dinner](assets/related-topics.png)

</details>

<details>
<summary>Colour lines, all in one place</summary>

![The Colour lines manager: each path with its colour and what uses it, Hide or Show, Rename or recolour, the connections on Main line, and two paths named in advance](assets/colour-lines.png)

</details>

<details>
<summary>Fancy another style?</summary>

![Contents in Mist, in Modify mode while hovering a row, in Warm white and in Dark](assets/styles.png)

Pick Mist, Warm white or Pure white in **Settings → Paper**, and Light, Dark or Match my system in the same place.

</details>

---

## Good to know

**Updates.** The app updates itself: each new release reaches it the next time you open it, with a note saying what's new. **Settings** shows which version you have.

**Your data.** Without sync your list lives only in this browser, and clearing its data deletes it. With sync, a new or empty page loads your list rather than saving over it, and **Settings → Sync → Earlier versions** brings back any past save.

**Undo.** After a change, Undo stays in the top bar for 10 minutes or until your next change (Ctrl or Cmd + Z works too). Every delete says in red how many papers go with it.

**Not a reference manager.** It maps and annotates what you read; it doesn't look up DOIs or format citations the way Zotero does.

**Your token.** It stays in the browser where you connect. Give it one private repository and **Contents: Read and write** only, and don't connect on shared computers.

**PDFs and copyright.** Attached PDFs are stored in your own repository. Keep it private, and only add papers you may keep a copy of.

**Privacy.** Paper Map connects only to what you choose: your sync (GitHub or a folder), and Crossref or DataCite when you press **Fill from DOI**.

**Credits.** The interface and code were built with help from Claude, an AI model made by Anthropic.

<details>
<summary>Repository structure</summary>

```
/
├── index.html              the whole app
├── manifest.webmanifest    lets browsers install it as an app
├── sw.js                   keeps the app working offline (never stores your data)
├── icons/                  the app icon, in each size
├── example/
│   └── displaydata.json    the example on the website
└── assets/                 the pictures in this README
```

</details>
