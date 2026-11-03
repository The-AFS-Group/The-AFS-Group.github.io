// Edit this file after deploying the Apps Script (see README.md).
window.BFCM_CONFIG = {
  // Apps Script web app URL (ends in /exec). Leave blank to test without sending.
  ENDPOINT: '',
  // Must match SUBMIT_TOKEN in the Apps Script project's Script Properties.
  // This token can only add learnings, never read them.
  TOKEN: 'bfcm-7WesRNekhymGg8UgJNaqIg22W3BQovZ_',

  // Saved against every response, so the same Sheet can hold next year's event too.
  // Change these three lines for the next event (e.g. 'BFCM 2027', 'Boxing Day 2026').
  EVENT: 'BFCM 2026',
  EVENT_LABEL: 'Black Friday / Cyber Monday 2026',
  HEADLINE: 'What did Black Friday and Cyber Monday teach us?',

  // Shown as a dropdown. "Other" is added automatically.
  DEPARTMENTS: [
    'Marketing',
    'Ecommerce',
    'Sales',
    'Retail & Showrooms',
    'Commercial',
    'Wholesale',
    'Customer Service',
    'Warehouse & Logistics',
    'Buying & Product',
    'Finance',
    'IT & Systems',
    'Leadership'
  ],

  // Shown as a dropdown, in this order. No "Other" option.
  TEAMS: [
    'GAF',
    'Revel',
    'AFS Group'
  ],

  // Optional "which brand does this relate to?" chips.
  // "Other" is added automatically, with a box to type the brand name.
  BRANDS: [
    'Gym and Fitness',
    'Revel Saunas',
    'Force USA',
    'WaterRower / Nohrd',
    'NordicTrack + iFIT',
    'Nike Strength',
    'Rep Fitness',
    'Whole group'
  ]
};
