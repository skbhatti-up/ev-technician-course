/**
 * Receives progress from the EV course app and writes it to this Google Sheet.
 *
 *   "Latest" tab: one row per trainee, always the newest figures.
 *   "Log" tab:    one row for every update received (history).
 *
 * Setup steps are in sync/README.md.
 * Version 2: adds "Needs help with", "Comments" and "Weak in exams".
 */
var HEADERS = ['Name', 'Last update', 'Study hours', 'Study days', 'Modules read', 'Quizzes passed',
  'Quiz average %', 'Exam attempts', 'Exams not finished', 'Exam passes', 'Best exam %',
  'Best exam safety', 'Last exam', 'Practice answered', 'Practice correct', 'Ready', 'Device id',
  'Needs help with', 'Comments', 'Weak in exams'];
var ID_COL = 17; // "Device id" stays in column 17 so rows made by version 1 still match

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var raw = e && e.postData ? e.postData.contents : '';
    if (!raw || raw.length > 30000) return reply('ignored');
    var d = JSON.parse(raw);
    if (!d.id || !d.name) return reply('ignored');

    var help = Object.prototype.toString.call(d.needHelp) === '[object Array]' ? d.needHelp.join('\n') : '';
    var row = [
      clean(d.name, 60), new Date(),
      Math.round((d.studySeconds || 0) / 360) / 10, d.studyDays || 0,
      (d.modulesRead || 0) + ' / ' + (d.modulesTotal || 0),
      (d.quizzesPassed || 0) + ' / ' + (d.quizzesTotal || 0),
      d.quizAverage || 0, d.examAttempts || 0, d.examAbandoned || 0, d.examPasses || 0,
      d.bestExam === null || d.bestExam === undefined ? '' : d.bestExam,
      clean(d.bestExamSafety, 10), d.lastExam ? new Date(d.lastExam) : '',
      d.practiceAnswered || 0, d.practiceCorrect || 0, d.ready ? 'YES' : 'not yet', clean(d.id, 40),
      clean(help, 4000), clean(d.comments, 3000), clean(d.examWeak, 200)
    ];

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var latest = sheet(ss, 'Latest'), log = sheet(ss, 'Log');
    log.appendRow(row);

    var ids = latest.getLastRow() > 1 ? latest.getRange(2, ID_COL, latest.getLastRow() - 1, 1).getValues() : [];
    var at = -1;
    for (var i = 0; i < ids.length; i++) if (ids[i][0] === row[ID_COL - 1]) { at = i + 2; break; }
    if (at < 0) latest.appendRow(row); else latest.getRange(at, 1, 1, row.length).setValues([row]);
    return reply('ok');
  } catch (err) {
    return reply('error');
  } finally {
    lock.releaseLock();
  }
}

// Text typed by trainees is stored as plain text, never as a formula.
function clean(v, max) {
  var s = String(v === null || v === undefined ? '' : v).slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function sheet(ss, name) {
  var s = ss.getSheetByName(name);
  if (!s) s = ss.insertSheet(name);
  // write or refresh the header row (adds the new columns to sheets made by version 1)
  s.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  s.setFrozenRows(1);
  return s;
}

function reply(text) {
  return ContentService.createTextOutput(text);
}
