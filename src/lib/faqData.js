// lib/faqData.js
// In-app FAQ content for the Help screen, grouped by category and ordered
// so the highest-anxiety topics — sharing, sleep sync, safety — come first.
// Pure data, no rendering: HelpScreen owns how these read on screen.

export const FAQ_CATEGORIES = [
  {
    id: 'sharing',
    title: 'Household & Sharing',
    items: [
      {
        q: 'How do I create a household?',
        a: 'Sign in (or create an account), then go to Settings and tap "Set up sharing." You don\'t need a partner ready to join yet — you can set this up any time.',
      },
      {
        q: 'How do I invite my partner?',
        a: 'In Settings, generate an invite code and share it however\'s easiest — text, WhatsApp, in person. The code lasts 24 hours. They\'ll need their own Navaya account to enter it and join.',
      },
      {
        q: 'Can my partner see all the feeds, sleeps and nappy changes I log?',
        a: 'Yes — once you\'re both in the same household, everything logged by either of you appears in one shared logbook, with a small coloured dot showing who logged what.',
      },
      {
        q: 'My partner and I both have the app open at the same time — is that okay?',
        a: 'Yes, completely normal. Entries you each log will both appear fine. The only edge case is if you both happen to edit the exact same entry at the exact same moment — in that rare case, whichever save happens last is the one that\'s kept.',
      },
      {
        q: 'If I start the sleep timer, can my partner stop it from their phone?',
        a: 'Yes. Sleep timers sync live — your partner will see it running on their device too, and either of you can end it.',
      },
      {
        q: 'If I start a feed timer, can my partner see or stop it from their phone?',
        a: 'No — a feed timer only shows on the device that started it while it\'s running. Your partner will see the finished feed in the shared logbook as soon as you stop and save it.',
      },
      {
        q: 'Can I edit or delete something I logged by mistake?',
        a: 'Yes — tap the entry in your Logbook. You can edit or delete anything you logged yourself; if your partner logged it, ask them to make the change (sleep is the one exception — either of you can adjust a sleep, since that\'s what lets you stop each other\'s timers).',
      },
      {
        q: 'Can I remove someone from my household, or leave a household myself?',
        a: 'We\'ll help you with this directly — email support@navayababy.co.uk and we\'ll sort it out quickly, usually within a day.',
      },
      {
        q: 'I invited the wrong person by mistake — what do I do?',
        a: 'Email support@navayababy.co.uk and we\'ll help you fix it straight away.',
      },
      {
        q: 'Can I use the app on my own, without inviting anyone?',
        a: 'Yes — sharing is entirely optional. Sign in just to back up your own data, or stay fully local — nothing requires you to invite anyone.',
      },
      {
        q: 'Can grandparents or other caregivers join our household too?',
        a: 'Right now, Navaya supports you plus one partner sharing a household — we don\'t yet support a third caregiver on the same shared logbook.',
      },
    ],
  },
  {
    id: 'sleep',
    title: 'Sleep & Timers',
    items: [
      {
        q: 'What happens if I forget to stop the sleep timer?',
        a: 'Nothing bad — it keeps counting even if you close the app. When you stop it, you can adjust the exact start and end time before it saves.',
      },
      {
        q: 'Can I log a past sleep without using the timer?',
        a: 'Yes — tap "Log a sleep" and enter your own start and end times.',
      },
    ],
  },
  {
    id: 'feeding',
    title: 'Feeding',
    items: [
      {
        q: 'How does the feed timer work?',
        a: 'Tap Left or Right to start timing a breastfeed — switch sides mid-feed without losing your time — or tap Bottle to log a bottle feed. You can fine-tune the exact start/end time when you stop.',
      },
      {
        q: 'How do I log a bottle feed as expressed milk or formula?',
        a: 'Tap Bottle to start, and when you stop, you\'ll be asked how much and whether it was expressed milk or formula — both optional, and you can add details later.',
      },
      {
        q: 'If I close the app before finishing the mood or amount check-in, will I lose the feed?',
        a: 'No — the feed is saved the moment you stop the timer. Those questions just add extra detail afterwards.',
      },
      {
        q: 'Can I log pumping or expressing separately?',
        a: 'Not as its own log yet — record expressed milk as part of a bottle feed by choosing "Expressed."',
      },
    ],
  },
  {
    id: 'sage',
    title: 'Sage AI',
    items: [
      {
        q: 'What is Sage?',
        a: 'Sage is Navaya\'s built-in breastfeeding chat companion — ask it anything and it\'ll answer in plain language, drawing on NHS, WHO, NICE and IBCLC guidance.',
      },
      {
        q: 'How should I ask Sage a question?',
        a: 'Type naturally, like texting a friend — the more specific you are, the better the answer. Not sure where to start? Tap a suggested question.',
      },
      {
        q: 'Can Sage see my baby\'s logbook?',
        a: 'No — Sage only sees what you type in the conversation. It doesn\'t have access to your logged feeds, sleeps, nappies or medicines.',
      },
      {
        q: 'Is Sage medical advice, or a replacement for my GP/midwife?',
        a: 'No. Sage gives general, evidence-informed guidance, but it can\'t assess your baby. For anything medical or urgent, always follow up with your GP, midwife or health visitor.',
      },
      {
        q: 'What should I do if I\'m genuinely worried about my baby?',
        a: 'Contact your GP, midwife, health visitor, or emergency services if it feels urgent — Sage can help you think something through, but it can\'t replace a professional\'s judgement.',
      },
      {
        q: 'Will my Sage conversations be saved, or can my partner see them?',
        a: 'No — conversations aren\'t saved once you leave the app, and they\'re private to your own device.',
      },
      {
        q: 'Is what I type to Sage private?',
        a: 'Your message is sent to our AI provider to generate a reply, but never your name, email or health logs — only the words you type. It\'s not used to train the AI and we don\'t keep a permanent copy.',
      },
    ],
  },
  {
    id: 'getting-started',
    title: 'Getting Started',
    items: [
      {
        q: 'Do I need to create an account to use Navaya?',
        a: 'No. Everything works without one — your logs stay on your device. Sign in only if you want to back up your data or share it with a partner.',
      },
      {
        q: 'What\'s the difference between using Navaya without an account and signing in?',
        a: 'Without an account, your logs stay only on this device — if you lose your phone, they\'re gone. Signing in backs your data up and lets you optionally share it.',
      },
      {
        q: 'How do I install Navaya on my phone?',
        a: 'On iPhone: tap Share, then "Add to Home Screen." On Android: tap Install when prompted, or use your browser\'s menu. Installing gives you a home-screen icon and a full-screen app feel — you don\'t need an app store.',
      },
      {
        q: 'Does installing the app let me use it without internet, or get reminders?',
        a: 'Installing adds a home-screen icon and a full-screen view, but it doesn\'t add reminders or notifications, and it isn\'t required for offline logging — that already works either way.',
      },
    ],
  },
  {
    id: 'profile',
    title: 'Baby & Your Profile',
    items: [
      {
        q: 'Can I change my baby\'s name, or my own name?',
        a: 'Yes — Settings → Preferences. Right now these are saved per device, so if you\'re sharing with a partner, add them separately on each phone.',
      },
      {
        q: 'Can I add more than one baby?',
        a: 'Not at the moment — one baby per household.',
      },
      {
        q: 'Can I track my baby\'s weight or growth?',
        a: 'Not yet — growth tracking isn\'t part of Navaya today. We\'d recommend your Red Book or health visitor for that in the meantime.',
      },
    ],
  },
  {
    id: 'nappies',
    title: 'Nappies',
    items: [
      {
        q: 'What do the poo colours mean?',
        a: 'Tap whichever matches so you have a record over time. Green can suggest a foremilk/hindmilk imbalance — try longer feeds on one side. Dark or black poo in a baby over 5 days old should always be checked by your midwife or GP.',
      },
      {
        q: 'Can I change the time on a nappy entry if I logged it late?',
        a: 'Yes — tap "edit" next to the time when logging, or adjust it afterwards from the Logbook.',
      },
    ],
  },
  {
    id: 'medicines',
    title: 'Medicines',
    items: [
      {
        q: 'How do I log medicine given to my baby?',
        a: 'From the Logbook, tap Add and choose Medicine, or tap the Medicine option on the Home screen. Choose the medicine, the dose, and the time — plus any notes you want to keep.',
      },
      {
        q: 'Can I edit a medicine entry after I\'ve logged it?',
        a: 'Not currently — you can delete it and log it again with the right details.',
      },
      {
        q: 'Is the "usually every 4–6 hours" note medical advice from Navaya?',
        a: 'It\'s a general NHS quick-reference, not personal prescribing advice — always follow the bottle\'s label and your clinician\'s guidance.',
      },
    ],
  },
  {
    id: 'logbook',
    title: 'The Logbook',
    items: [
      {
        q: 'How does the Logbook work?',
        a: 'It\'s one timeline of everything logged — feeds, nappies, sleeps and medicines — grouped by day, most recent first.',
      },
      {
        q: 'What\'s the weekly summary panel, and how are the numbers worked out?',
        a: 'Tap to expand it for a 7-day view: total feeds, average feed length, average gap between feeds, bottle totals, average sleep per day, and nappy/medicine counts. Averages only count days you actually logged something, so a lighter-tracking day doesn\'t unfairly drag the numbers down.',
      },
      {
        q: 'Nothing shows in my Logbook — is something wrong?',
        a: 'If you haven\'t logged anything yet, that\'s expected. If you have and still see nothing, try Settings → Sync now.',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings & Preferences',
    items: [
      {
        q: 'How do I switch to dark mode?',
        a: 'Settings → Night/Day. Or leave it alone — it\'ll go dark automatically in the evening until you choose yourself, after which your choice sticks.',
      },
      {
        q: 'What does "Sync now" do?',
        a: 'Refreshes your household\'s latest entries and sends up anything logged offline. It happens automatically, but it\'s there if something looks out of date.',
      },
      {
        q: 'What happens if I log something with no signal?',
        a: 'If you\'re signed in, it\'s saved on your device and sent automatically once you\'re back online. If you\'re not signed in, everything always stays local, since it\'s never sent anywhere.',
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy & Your Data',
    items: [
      {
        q: 'Where is my data stored, and is it sold to anyone?',
        a: 'Stored securely, never sold or used for advertising. If you\'re signed in, only the app and your household (if you\'re sharing) can see it.',
      },
      {
        q: 'Can I delete my account and data?',
        a: 'Delete individual entries any time in the app. For full account deletion, email support@navayababy.co.uk — we\'ll action it within 30 days.',
      },
      {
        q: 'What happens to my data if I never sign in?',
        a: 'It stays only in this device\'s local storage and is never sent to us. If you later decide to sign in, you\'ll be offered the chance to bring that existing data into your account.',
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    items: [
      {
        q: 'The app still shows my partner\'s name at the top, but they say they\'re signed out — what\'s going on?',
        a: 'If a device that\'s previously synced to a household loses its sign-in, you\'ll see a "Sign in to sync" warning in the top-right of Home. Anything logged while that shows stays on that device until signing back in.',
      },
      {
        q: 'I started a timer and my phone died — is my log lost?',
        a: 'No — feed and sleep timers save continuously to your device, so reopening the app picks up right where you left off.',
      },
      {
        q: 'Why can\'t I see a history list on the Feed/Sleep/Nappy screen?',
        a: 'Those screens are just for logging — the Logbook tab shows everything, in one place.',
      },
      {
        q: 'Is there a paid or premium version of Navaya?',
        a: 'No — Navaya is completely free.',
      },
    ],
  },
]
