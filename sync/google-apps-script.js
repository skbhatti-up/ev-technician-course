/**
 * Receives progress from the EV course app and writes it to this Google Sheet.
 *
 *   "Latest" tab: one row per trainee, always the newest figures.
 *   "Log" tab:    one row for every update received (history).
 *
 * Setup steps are in sync/README.md.
 */
var HEADERS = ['Name', 'Last update', 'Study hours', 'Study days', 'Modules read', 'Quizzes passed',
  'Quiz average %', 'Exam attempts', 'Exams not finished', 'Exam passes', 'Best exam %',
  'Best exam safety', 'Last exam', 'Practice answered', 'Practice correct', 'Ready', 'Device id'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var raw = e && e.postData ? e.postData.contents : '';
    if (!raw || raw.length > 20000) return reply('ignored');
    var d = JSON.parse(raw);
    if (!d.id || !d.name) return reply('ignored');

    var row = [
      String(d.name).slice(0, 60), new Date(),
      Math.round((d.studySeconds || 0) / 360) / 10, d.studyDays || 0,
      (d.modulesRead || 0) + ' / ' + (d.modulesTotal || 0),
      (d.quizzesPassed || 0) + ' / ' + (d.quizzesTotal || 0),
      d.quizAverage || 0, d.examAttempts || 0, d.examAbandoned || 0, d.examPasses || 0,
      d.bestExam === null || d.bestExam === undefined ? '' : d.bestExam,
      d.bestExamSafety || '', d.lastExam ? new Date(d.lastExam) : '',
      d.practiceAnswered || 0, d.practiceCorrect || 0, d.ready ? 'YES' : 'not yet', String(d.id).slice(0, 40)
    ];

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var latest = sheet(ss, 'Latest'), log = sheet(ss, 'Log');
    log.appendRow(row);

    var ids = latest.getLastRow() > 1 ? latest.getRange(2, HEADERS.length, latest.getLastRow() - 1, 1).getValues() : [];
    var at = -1;
    for (var i = 0; i < ids.length; i++) if (ids[i][0] === row[HEADERS.length - 1]) { at = i + 2; break; }
    if (at < 0) latest.appendRow(row); else latest.getRange(at, 1, 1, row.length).setValues([row]);
    return reply('ok');
  } catch (err) {
    return reply('error');
  } finally {
    lock.releaseLock();
  }
}

function sheet(ss, name) {
  var s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.appendRow(HEADERS);
    s.setFrozenRows(1);
    s.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return s;
}

function reply(text) {
  return ContentService.createTextOutput(text);
}
