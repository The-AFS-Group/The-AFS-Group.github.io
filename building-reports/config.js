// Edit this file after deploying the Apps Script (see README.md).
window.BR_CONFIG = {
  // Apps Script web app URL (ends in /exec). Leave blank to test without sending.
  ENDPOINT: '',
  // Must match SUBMIT_TOKEN in the Apps Script project's Script Properties.
  // This token can only add reports and their photos, and check the status of reports
  // sent from the same phone. It can't read anyone else's reports.
  TOKEN: 'br-rXFtaIb5p1yK3ynBdDYcpcl996Dn6U08',

  // Sites staff can choose from. "Other" is added automatically, with a box to type the site.
  // Use the same names in the Landlords tab of the Sheet so each landlord sees their own sites.
  SITES: [
    'Head office',
    'Sydney warehouse',
    'Sydney showroom',
    'Melbourne showroom',
    'Brisbane warehouse',
    'Adelaide showroom',
    'Perth showroom'
  ],

  // What kind of report it is. Staff must pick one.
  CATEGORIES: [
    { name: 'Damage', hint: 'Something is broken or has been damaged' },
    { name: 'Maintenance', hint: 'Wear and tear, servicing, or something not working properly' },
    { name: 'Building requirement', hint: 'Something the site needs: a change, install or improvement' }
  ],

  // How urgent it is, most urgent first. The manager page sorts by this order.
  PRIORITIES: [
    { name: 'Urgent', hint: 'Safety or security risk, or we can’t trade' },
    { name: 'High', hint: 'Needs fixing this week' },
    { name: 'Normal', hint: 'Within the next few weeks' },
    { name: 'Low', hint: 'When convenient' }
  ],
  DEFAULT_PRIORITY: 'Normal',

  // Optional "what trade might it need?" list. "Not sure" is added automatically.
  TRADES: [
    'Electrical',
    'Plumbing',
    'Air-con & HVAC',
    'Carpentry & joinery',
    'Doors, locks & glazing',
    'Roller doors & dock',
    'Roofing & gutters',
    'Painting',
    'Flooring',
    'Signage',
    'Fire & safety',
    'Cleaning',
    'Pest control',
    'IT, data & security',
    'Racking & warehouse',
    'Landscaping & car park'
  ],

  // Most photos per report.
  MAX_PHOTOS: 8,

  // Shown next to every cost on the manager and landlord pages.
  COST_NOTE: 'ex GST'
};
