/**
 * Bion Badminton Tournament - Google Apps Script Backend
 *
 * Setup:
 * 1. Create a new Google Sheet
 * 2. Rename the first sheet tab to "Data"
 * 3. Extensions > Apps Script
 * 4. Paste this entire file into the editor (delete any existing code)
 * 5. Save the project (Ctrl+S)
 * 6. Click "Deploy" > "New deployment"
 * 7. Type: Web app
 * 8. Execute as: Me
 * 9. Who has access: Anyone
 * 10. Click Deploy and copy the Web app URL
 * 11. Paste that URL into js/config.js as APPS_SCRIPT_URL
 */

function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Data');
    let jsonString = sheet.getRange(1, 1).getValue();

    if (!jsonString || jsonString.trim() === '') {
      return jsonResponse({
        teams: [],
        matches: [],
        config: {
          tournamentName: 'Bion Badminton Tournament',
          groupStagePoints: 15,
          knockoutPoints: 21,
          gamesPerMatch: 3,
          teamsToAdvance: 2
        }
      });
    }

    const data = JSON.parse(jsonString);
    return jsonResponse(data);
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Data');

    sheet.getRange(1, 1).setValue(JSON.stringify(data));

    return jsonResponse({ success: true, savedAt: new Date().toISOString() });
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
