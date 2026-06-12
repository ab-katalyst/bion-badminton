/**
 * Bion Badminton Tournament - Configuration
 *
 * 1. Deploy the Google Apps Script (see code.gs instructions)
 * 2. Paste the Web app URL below
 * 3. Change the admin password if desired
 * 4. Deploy this static site to Cloudflare Pages
 */

const CONFIG = {
  // REQUIRED: Paste your Google Apps Script Web app URL here
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxXTYbGGaG1sL-4bB58vuKeHb9lg_c8ueLl6ijHJxN5K4-z52Phgnb8_8Ofbf6Xr1B5/exec',

  // Admin login password
  ADMIN_PASSWORD: 'bion@123',

  // Tournament settings (can also be changed from admin panel)
  DEFAULTS: {
    tournamentName: 'Bion Badminton Tournament',
    groupStagePoints: 15,
    knockoutPoints: 21,
    gamesPerMatch: 3,
    teamsToAdvance: 2
  }
};
