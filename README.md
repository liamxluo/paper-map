<p align="center">
  <img src="assets/app-icon.png" width="168" alt="Paper Map app icon">
</p>

<h1 align="center">Paper Map</h1>

<p align="center"><b>Your research desk.</b><br>Every paper. Every book. Every note. On one desk.</p>

<p align="center">
  <img src="assets/icon-mac.svg" width="18" height="18" alt=""> <a href="https://github.com/liamxluo/paper-map/releases/latest/download/Paper-Map.dmg"><b>Download for macOS</b></a>
  &nbsp;·&nbsp;
  <img src="assets/icon-web.svg" width="18" height="18" alt=""> <a href="https://liamxluo.github.io/paper-map/"><b>Try the web app</b></a>
</p>

<p align="center"><sub>macOS 11 or later, Apple silicon and Intel &nbsp;·&nbsp; Chrome, Edge or Safari &nbsp;·&nbsp; free and open source (Apache-2.0)</sub></p>

![The desk: a click on Maps fans the folded maps out into a row of covers, and ‹ Desk gathers them back](assets/tour-desk.webp)

**Your papers and your books, in one library.** Papers in folders, books on shelves with their covers, how far you have read, and every highlight, Kindle and Goodreads included.

**Read where you write.** Open a paper or a book and it lies open on your desk: the PDF or the EPUB on the left, an A4 sheet of your own notes on the right. Select a line and it is quoted into your notes with its page. Highlight it, or stick a note on the page.

**Works with Zotero.** Save a paper from any website with the Zotero Connector and it is on your desk. Read on your phone in Zotero, and your highlights and notes are waiting when you sit down.

**Think in maps, when it is time to think.** For a review, a chapter or a question: lay the papers out on a boundless mind map, with lines in colour and words on them, or as a timeline of who built on whom. **Export either as a true vector PDF or SVG**: real lines and real, selectable text, sharp at any size, ready for a paper or a slide.

![Readings: the book on the desk opens into your shelves; a book leaves its shelf and opens, the EPUB on the left and your notes on the right; a line is selected and quoted into the notes with its place](assets/tour-readings.webp)

## Opening it on a Mac for the first time

Paper Map is not yet signed with a paid Apple Developer ID, so the first time you open it, macOS says it cannot check the app for malicious software. That is about the missing signature, not about anything found in the app.

1. Open **Paper-Map.dmg** and drag **Paper Map** into **Applications**.
2. Open Paper Map. When the warning appears, click **Done**.
3. Open **System Settings → Privacy & Security**, click **Open Anyway** beside Paper Map, and confirm.

You do this once; updates install themselves after that. If macOS says the app “is damaged”, run `xattr -cr "/Applications/Paper Map.app"` in Terminal and open it again.

Every line of its code is in this repository, and GitHub builds the app from it, in public, for every release ([the builds](https://github.com/liamxluo/paper-map/actions)). An update only installs if it carries the project's signature.

## Your data stays yours

- **There is no Paper Map server.** Your library is kept on your Mac, or in your own private GitHub repository, iCloud Drive or Dropbox if you choose.
- **No account, no tracking, no analytics, no ads, no AI.**
- **It goes online only for what you ask:** syncing, looking up a DOI or ISBN, Zotero if you connect it, and checking for a new version.

## Get started

1. **Install it**, or [try the web app](https://liamxluo.github.io/paper-map/), which opens with an example. To use your own library in the browser, open [the app](https://liamxluo.github.io/paper-map/?app) instead.
2. **Choose where your library lives**: on its first start the Mac app offers iCloud Drive, this Mac only, or GitHub. You can change it any time from the cloud on the map page.
3. **Add papers**: connect Zotero in the cloud, or click **+** and paste a DOI, an ISBN or a paper's web address.

<details>
<summary>Connect GitHub</summary>

1. [Create a private repository](https://github.com/new?name=paper-map-data&visibility=private) and tick **Add a README file**.
2. [Create a token](https://github.com/settings/personal-access-tokens/new?name=Paper+Map&expires_in=366&contents=write) for only that repository, with **Contents: Read and write**.
3. Click the cloud on the map page, paste the token under **GitHub** and click **Connect**.

Changes made on two devices are combined field by field; Paper Map asks only when the very same thing was changed on both.

</details>

<details>
<summary>Building Paper Map</summary>

Plain HTML, CSS and JavaScript in `src/`, joined by `node scripts/build.mjs` into `index.html` (the web app) and `dist/` (the Mac app's files, made with Tauri in `src-tauri/`). Publishing a release on GitHub builds the Mac app and attaches it to the release.

</details>

## Licence

Apache License 2.0: use it, change it and build on it, as long as you keep the attribution in [NOTICE](NOTICE). Versions up to 3.0.1 were released under MIT.

---

<p align="center"><sub>Built with help from Claude, an AI model made by Anthropic. <a href="LICENSE">LICENSE</a> · <a href="NOTICE">NOTICE</a></sub></p>
