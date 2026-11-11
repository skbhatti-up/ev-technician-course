# Automatic progress sharing

With this switched on, each trainee's app sends their study time and quiz results to a Google Sheet that only you can see. No action is needed from the trainee.

## When the app sends

- Every time the app is opened, and again when it is closed or put in the background
- Straight after every module quiz and every exam (including when an exam is started, so an abandoned attempt is visible)
- Every 15 minutes while the app stays open
- If the phone is offline, the update is held and sent the next time the app is open with a connection

A phone app of this kind cannot send while it is closed. That does not hide anything: if a trainee is not studying there is nothing new to send, and the **Last update** column shows exactly when each person was last active.

## Set-up (about 10 minutes, done once)

1. Go to [sheets.new](https://sheets.new) while signed in to your Google account. Name the sheet, for example "EV course progress".
2. In the menu choose **Extensions → Apps Script**.
3. Delete the sample code. Paste in everything from [`google-apps-script.js`](google-apps-script.js). Press **Save**.
4. Press **Deploy → New deployment**. Click the gear icon and choose **Web app**.
   - **Execute as:** Me
   - **Who has access:** Anyone
5. Press **Deploy**. Google asks you to authorise the script: choose your account and allow it. (Google shows an "unverified app" warning because the script is your own; choose **Advanced → Go to …** to continue.)
6. Copy the **Web app URL**. It ends in `/exec`.
7. Open `app/config.js` and paste the address between the quotes after `syncUrl:`.
8. Rebuild and publish:

```
py app/build_app.py
git add -A
git commit -m "Switch on progress sharing"
git push
```

## Updating the script (keeps the same address)

When `google-apps-script.js` changes (for example version 3 added the Car tab columns):

1. Open the sheet, then **Extensions → Apps Script**. Replace all the code with the new file and press **Save**.
2. Press **Deploy → Manage deployments**, click the pencil (edit) icon, set **Version** to **New version**, and press **Deploy**.

The web app address stays the same, so the app needs no change. New columns appear at the right of both tabs after the next update arrives. Until you do this, the old script keeps working and simply ignores the new fields.

## What you will see

- **Latest** tab: one row per trainee with name, last update, study hours, study days, modules read, quizzes passed, exam attempts and passes, best exam score, safety score and whether they have met the readiness rule.
- **Log** tab: every update received, so you can see progress over time.

## Things to know

- The web app address is visible to anyone who reads this public repository, so someone could send junk rows. The script ignores anything oversized or malformed. If it is ever abused, create a new deployment and replace the address.
- Each phone is one "device id". A trainee who reinstalls the app or changes phone starts a new row.
- Results come from the trainee's own phone and can be retaken or, by a determined person, faked. Treat the sheet as evidence of effort, and watch one exam attempt on a video call before making the final decision.
