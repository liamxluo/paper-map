# Reading List

A family tree for the papers you read.

![Papers on a timeline, joined by hand-drawn lines](assets/preview.png)

Papers sit on a timeline, one row per topic. Mark what you have read and what you want to read, tag things in your own colours, and draw the lines between papers yourself. It is one HTML file, with nothing to install.

The live preview (link at the top right of this page) shows the made-up example in [`example/displaydata.json`](example/displaydata.json).

## Use it

1. Download [`index.html`](index.html): open it and click **Download raw file**.
2. Double-click it to open it in your browser.
3. Click **Modify** to add topics and papers. Everything is saved in that browser.

To start from the example instead, use **Settings → Data → Import backup** and choose `displaydata.json`.

## Sync with GitHub (recommended)

The copy in your browser is lost if its data is cleared. A private repository of your own keeps every change and every earlier version, and works on any computer.

1. [Create a private repository](https://github.com/new?name=readinglist-data&visibility=private) and tick **Add a README file**.
2. [Create a token](https://github.com/settings/personal-access-tokens/new?name=Reading+List&expires_in=366&contents=write). Under Repository access, choose **Only select repositories** and pick that repository.
3. In the page, open **Settings → GitHub sync**, paste the token and click **Connect**.

On another computer, download `index.html` again and paste the token once more.

## Structure

```
/
├── index.html              the whole app
├── README.md
├── .gitignore
├── example/
│   └── displaydata.json    the example shown in the live preview
└── assets/
    └── preview.png         the picture at the top of this page
```

## Privacy

The file contains no data and connects to nothing except your own repository, and only once you set one up. The token stays in the browser where you enter it. Don't use it on shared computers.

## Credits

The interface and code were built with help from Claude, an AI model made by Anthropic.
