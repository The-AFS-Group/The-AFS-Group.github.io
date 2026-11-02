// Made-up responses and summary, loaded only by dash.html?demo to show how the dashboard looks.
// Nothing here is real data. Safe to delete if you don't want a demo.
window.BFCM_DEMO = (function () {
  var E = 'BFCM 2026';
  function r(id, at, name, department, team, brands, worked, didntWork, nextTime, voice) {
    return { id: 'demo-' + id, submittedAt: at, event: E, name: name, department: department, team: team, brands: brands,
      worked: worked, didntWork: didntWork, nextTime: nextTime, voiceUsed: !!voice };
  }
  var rows = [
    r(14, '2026-12-03T16:42:00', 'Demo Person N', 'Finance', 'AFS Group', ['Whole group'],
      'Daily cash and margin snapshot each morning meant we could see the discount mix early.',
      'Afterpay and Zip settlements did not reconcile to orders for three days so the margin view lagged.',
      'Agree a margin floor per category before the sale and flag any promo below it automatically.'),
    r(13, '2026-12-03T15:10:00', 'Demo Person M', 'Warehouse & Logistics', 'AFS Group', ['Gym and Fitness', 'Force USA'],
      'Pre-picking the top 20 SKUs on Thursday night saved us a full day on Monday.',
      'Bulky items like the power racks blew out the courier cut off and we had pallets sitting until Wednesday. Labels for multi-box orders were printing out of order',
      'Book extra linehaul for the Monday and Tuesday after, and get the multi box label fix done before next year.', true),
    r(12, '2026-12-03T11:25:00', 'Demo Person L', 'Customer Service', 'GAF', ['Gym and Fitness'],
      'The macro for where is my order cut handling time a lot.',
      'so the biggest thing was delivery questions we had no ETA to give for the big items, customers rang three or four times. Also chat went down for an hour on Friday morning and nobody told us',
      'Send a proactive delivery update email for bulky orders and give the service team a heads up channel when anything is down.', true),
    r(11, '2026-12-02T17:05:00', 'Demo Person K', 'Customer Service', 'Revel', ['Revel Saunas'],
      'Sauna enquiries converted well when we could book a showroom visit on the spot.',
      'Did not know which sauna models were in stock in real time, had to put people on hold to check.',
      'A live stock view for the phone team, even just a shared sheet updated twice a day.'),
    r(10, '2026-12-02T14:30:00', 'Demo Person J', 'Marketing', 'GAF', ['Gym and Fitness'],
      'Launching early access on the Monday before gave us a cheaper ramp, CPCs were well under the Friday peak.',
      'We kept spending on two hero products after they sold out because the feed took hours to update.',
      'Hourly stock sync to the shopping feed and auto pause rules for anything under 5 units.'),
    r(9, '2026-12-02T12:48:00', 'Demo Person I', 'Marketing', 'AFS Group', ['Gym and Fitness', 'Revel Saunas'],
      'The VIP early access SMS was our best send of the year.',
      'Briefs for the emails came through late so we were building the Cyber Monday send on the Sunday night.',
      'Lock the full email and SMS calendar four weeks out with offers signed off.'),
    r(8, '2026-12-02T10:02:00', 'Demo Person H', 'Ecommerce', 'GAF', ['Gym and Fitness', 'Force USA'],
      'Site held up, no downtime, and the countdown banner lifted add to cart.',
      'Promo codes stacked with the sitewide discount on some bundles for about four hours on Friday.',
      'Test every promo combination on staging the week before and have one person own the discount setup.'),
    r(7, '2026-12-01T16:20:00', 'Demo Person G', 'Retail & Showrooms', 'GAF', ['Gym and Fitness', 'NordicTrack + iFIT'],
      'Walk-ins were strong on Saturday and the treadmill demos closed sales on the floor.',
      'Online and in store prices did not match for half the day, customers showed us the website on their phones.',
      'One price file that updates web and POS together, and a printed price list for staff on the morning.', true),
    r(6, '2026-12-01T13:40:00', 'Demo Person F', 'Sales', 'GAF', ['Gym and Fitness'],
      'Commercial quote requests came in early so we used the quiet Thursday to get ahead.',
      'Too many people on leave on the Monday after, we were short when Cyber Monday calls peaked.',
      'Leave freeze for the Friday to the Tuesday after, and a roster drafted in October.'),
    r(5, '2026-12-01T11:05:00', 'Demo Person E', 'Buying & Product', 'GAF', ['Gym and Fitness', 'Force USA'],
      'Bringing the container forward meant we had depth on the hero racks.',
      'Ran out of the 20kg plate sets by Saturday lunchtime, we underestimated attach rate with the racks.',
      'Plan accessories as an attach rate off the hero product forecast, not on their own.'),
    r(4, '2026-11-30T17:30:00', 'Demo Person D', 'Marketing', 'Revel', ['Revel Saunas'],
      'The behind the scenes reels from the warehouse got more saves than the product posts.',
      '',
      'Line up creator content earlier, we were chasing posts on the Thursday.'),
    r(3, '2026-11-30T15:15:00', 'Demo Person C', 'Ecommerce', 'AFS Group', ['Whole group'],
      '',
      'Checkout was slow on mobile around 8pm Friday when the email and SMS went out at the same time.',
      'Stagger the email and SMS sends by 30 minutes and load test checkout before the event.'),
    r(2, '2026-11-30T10:45:00', 'Demo Person B', 'Leadership', 'AFS Group', ['Whole group'],
      'Daily stand-up at 8:30 kept everyone on the same page.',
      'Decisions on extending the sale were made late on Sunday and not everyone heard.',
      'Decide the extension plan in advance with triggers, and post every decision in one channel.'),
    r(1, '2026-11-30T09:20:00', 'Demo Person A', 'Customer Service', 'GAF', ['Gym and Fitness'],
      'Having the FAQ page live before the sale cut a lot of the basic questions.',
      'Returns policy for sale items was not clear so we had different answers going out.',
      'Write the sale terms and returns rules once, share with every team before launch.')
  ];
  var summary = {
    headline: 'Demand and site stability were strong, and early access plus VIP SMS gave the cheapest, best-converting traffic. The pain came after the click: stock, pricing and delivery information did not flow fast enough between systems and teams, which drove repeat customer contacts and wasted ad spend.',
    worked: [
      { point: 'Early access and the VIP SMS delivered cheaper traffic and the best send of the year.', departments: ['Marketing'], mentions: 2 },
      { point: 'Getting ahead early (container brought forward, pre-picking top SKUs, using quiet Thursday) protected stock depth and dispatch speed.', departments: ['Buying & Product', 'Warehouse & Logistics', 'Sales'], mentions: 3 },
      { point: 'Self-serve help (FAQ page, where-is-my-order macro) reduced basic contacts.', departments: ['Customer Service'], mentions: 2 },
      { point: 'Daily 8:30 stand-up and morning margin snapshot kept leaders aligned.', departments: ['Leadership', 'Finance'], mentions: 2 },
      { point: 'Showroom demos and on-the-spot visit bookings converted well.', departments: ['Retail & Showrooms', 'Customer Service'], mentions: 2 }
    ],
    didnt_work: [
      { point: 'Stock information lagged: ads kept running on sold-out products and phone staff could not see live stock.', departments: ['Marketing', 'Customer Service', 'Buying & Product'], mentions: 3 },
      { point: 'Bulky-item delivery missed courier cut-offs, with no ETA to give customers, causing repeat calls.', departments: ['Warehouse & Logistics', 'Customer Service'], mentions: 2 },
      { point: 'Pricing and promo set-up errors: web and POS prices differed, and codes stacked on bundles for four hours.', departments: ['Retail & Showrooms', 'Ecommerce'], mentions: 2 },
      { point: 'Late briefs and decisions (email content, sale extension, returns terms) left teams improvising.', departments: ['Marketing', 'Leadership', 'Customer Service'], mentions: 3 },
      { point: 'Mobile checkout slowed when email and SMS went out together on Friday night.', departments: ['Ecommerce'], mentions: 1 }
    ],
    themes: [
      { title: 'One source of truth for stock', summary: 'Three teams were working from different or stale stock numbers. Faster feed sync and a simple live view would fix wasted spend and hold times together.', departments: ['Marketing', 'Customer Service', 'Buying & Product'], mentions: 3 },
      { title: 'Bulky delivery is the customer pain point', summary: 'Racks and other bulky items hit courier limits and created the largest share of repeat contacts.', departments: ['Warehouse & Logistics', 'Customer Service'], mentions: 2 },
      { title: 'Lock decisions earlier', summary: 'Offers, comms, extension triggers and returns rules all landed late. A sign-off deadline would remove most of the scramble.', departments: ['Marketing', 'Leadership', 'Customer Service'], mentions: 3 },
      { title: 'Promo and price QA', summary: 'Two separate pricing errors reached customers. One owner and a pre-launch test would catch both.', departments: ['Ecommerce', 'Retail & Showrooms'], mentions: 2 }
    ],
    actions: [
      { action: 'Write up the bulky-delivery backlog and contact the affected customers with ETAs.', owner: 'Customer Service', when: 'Now', type: 'Quick win', why: 'Bulky orders without an ETA drove repeat calls.' },
      { action: 'Reconcile BNPL settlements to orders and close out the event margin report.', owner: 'Finance', when: 'Now', type: 'Quick win', why: 'Settlements lagged three days, delaying the margin view.' },
      { action: 'Move the shopping feed to hourly stock sync with auto-pause under 5 units.', owner: 'Marketing', when: 'Before the next sale', type: 'Systems & tools', why: 'Spend continued on sold-out hero products.' },
      { action: 'Give phone and chat staff a live stock view.', owner: 'Buying & Product', when: 'Before the next sale', type: 'Systems & tools', why: 'Staff put customers on hold to check stock.' },
      { action: 'Make one owner responsible for promo set-up and test every code combination on staging.', owner: 'Ecommerce', when: 'Before the next sale', type: 'Process change', why: 'Codes stacked with sitewide discounts for four hours.' },
      { action: 'Lock the offer, email and SMS calendar, sale terms and returns rules four weeks out.', owner: 'Marketing', when: 'Before next year', type: 'Process change', why: 'Late briefs and unclear terms left teams improvising.' },
      { action: 'Book extra linehaul and fix multi-box label order for bulky items.', owner: 'Warehouse & Logistics', when: 'Before next year', type: 'Bigger project', why: 'Bulky orders missed courier cut-offs.' },
      { action: 'Set a leave freeze and draft the event roster in October.', owner: 'Leadership', when: 'Before next year', type: 'People & training', why: 'Sales was short-staffed when Cyber Monday calls peaked.' }
    ],
    by_department: [
      { department: 'Marketing', takeaway: 'Early access and SMS worked; stock-aware ads and earlier sign-off are the fixes.' },
      { department: 'Customer Service', takeaway: 'Self-serve help worked; delivery ETAs, live stock and one set of sale terms would cut repeat contacts.' },
      { department: 'Ecommerce', takeaway: 'Site held up; promo QA and staggered sends to protect mobile checkout.' },
      { department: 'Warehouse & Logistics', takeaway: 'Pre-picking paid off; bulky linehaul and multi-box labels need fixing.' },
      { department: 'Buying & Product', takeaway: 'Bringing stock forward worked; plan accessories off hero attach rates.' },
      { department: 'Retail & Showrooms', takeaway: 'Demos sold; prices must match across web and POS.' },
      { department: 'Sales', takeaway: 'Used the quiet days well; staffing for Cyber Monday fell short.' },
      { department: 'Finance', takeaway: 'Daily snapshot helped; BNPL reconciliation lagged.' },
      { department: 'Leadership', takeaway: 'Stand-ups worked; extension decisions need triggers set in advance.' }
    ],
    open_questions: [
      'How much ad spend went to sold-out products? Check against the feed logs.',
      'What share of repeat contacts were bulky-delivery related?',
      'Did the checkout slowdown cost orders, or only time? Compare Friday 8 to 9pm conversion with the hours either side.'
    ]
  };
  return {
    ok: true, ai: true, events: [E], rows: rows,
    summaries: { 'BFCM 2026': { generatedAt: '2026-12-03T17:00:00', responseCount: rows.length, model: 'claude-opus-5-5', summary: summary } }
  };
})();
