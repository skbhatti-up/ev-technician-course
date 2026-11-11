# EV & Hybrid Vehicle Technician Foundation Course

A self-study course for new electric and hybrid vehicle technicians, delivered as an installable phone app and a printable PDF.

**Open the app:** https://skbhatti-up.github.io/ev-technician-course/

On an Android phone, open the link in Chrome and choose **Add to Home screen / Install app**. On an iPhone, open it in Safari and choose **Share → Add to Home Screen**. After the first visit it works without internet.

## What the app does

- The full course: 21 modules with diagrams, plus reference appendices
- Tracks study time (only while the app is open and being used) and which modules have been read to the end
- A quiz at the end of each module
- A separate **Quiz** tab with a bank of over 200 questions: practice mode, and a timed 40-question exam
- A readiness check: all modules read, every module quiz at 80% or more, and two exam passes on different days with every safety question correct
- A progress report that can be shared on WhatsApp, and optional automatic sharing to a Google Sheet (see [sync/README.md](sync/README.md))

Study records are stored on the trainee's own phone. Nothing is sent anywhere unless automatic sharing has been switched on.

> This course gives knowledge only. It does not qualify anyone to work on high-voltage systems. Supervised practical training is required first.

## Folders

| Folder | Contents |
|---|---|
| `src/` | The course text, in parts (`p00.html` … `p06.html`), and `build.py` |
| `app/` | The app shell, question bank additions and `build_app.py` |
| `docs/` | The built app, served by GitHub Pages. Do not edit by hand. |
| `sync/` | The Google Sheet script for automatic progress sharing |

## Updating

```
py src/build.py          # joins the course parts into one HTML file
.\make-pdf.ps1           # rebuilds the PDF (uses Microsoft Edge)
py app/build_app.py      # rebuilds the app into docs/
git add -A
git commit -m "Update course"
git push
```

The live app updates a minute or two after the push. Phones pick up the new version the next time the app is opened while online.
