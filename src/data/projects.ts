export type ProjectMilestone = {
  date: string;
  category: string;
  title: string;
  detail: string;
};

export type Project = {
  slug: string;
  number: string;
  name: string;
  shortName: string;
  summary: string;
  description: string;
  website: string;
  websiteLabel: string;
  stack: string[];
  timeline: ProjectMilestone[];
};

export const projects: Project[] = [
  {
    slug: "sportsopp",
    number: "01",
    name: "SportsOpp",
    shortName: "Sports",
    summary: "A place for athletes to be seen, and for the right people to find them.",
    description:
      "A multi-sport talent-discovery platform connecting athletes with schools, clubs, and agencies. Built for web and mobile, with athlete profiles at its centre.",
    website: "https://sportsopp.com/",
    websiteLabel: "sportsopp.com",
    stack: ["Flutter", "Firebase", "Zoho CRM", "PayFast"],
    timeline: [
      {
        date: "2026-06-02",
        category: "PRODUCT",
        title: "A multi-sport beginning",
        detail:
          "The product was repositioned around athlete discovery, starting with five launch sports and a focused first phase.",
      },
      {
        date: "2026-06-06",
        category: "SECURITY",
        title: "Trust boundaries made explicit",
        detail:
          "The security model established that clients cannot grant themselves privileged roles or paid-tier access, with hosting headers adding another layer of defence.",
      },
      {
        date: "2026-06-07",
        category: "ENGINEERING",
        title: "Athlete highlights go native",
        detail:
          "A Cloud Run and FFmpeg pipeline brought native highlight-video processing, with tiered limits and server-owned video lifecycle management.",
      },
      {
        date: "2026-07-12",
        category: "OPERATIONS",
        title: "Signup connected to CRM",
        detail:
          "Firebase signups began syncing to Zoho CRM, alongside marketing automation and separate role-based dashboards for athletes and organisations.",
      },
      {
        date: "2026-07-14",
        category: "DISCOVERY",
        title: "Finding athletes became a journey",
        detail:
          "The discovery experience grew with an organisation conversion funnel, a merged featured-athlete feed, and more expressive public profiles.",
      },
      {
        date: "2026-07-27",
        category: "PLATFORM",
        title: "Public profiles, built to scale",
        detail:
          "Guest profile previews and curated Explore feeds were paired with stricter Firestore owner-write rules and more resilient profile cards.",
      },
      {
        date: "2026-08-06",
        category: "RELIABILITY",
        title: "The edges got more forgiving",
        detail:
          "An authenticated-user bootstrap edge case was repaired and callable errors became clearer, making account setup and recovery easier to reason about.",
      },
    ],
  },
  {
    slug: "wakatime",
    number: "02",
    name: "WakaTime",
    shortName: "WakaTime",
    summary: "An alarm that asks you to get up and tap a physical NFC tag to turn it off.",
    description:
      "A mobile alarm experience built around a simple promise: the alarm is complete only when you get up and tap your WakaTag Capsule. One account, one phone, one Capsule.",
    website: "https://wakatime.co.za/",
    websiteLabel: "wakatime.co.za",
    stack: ["Expo", "React Native", "TypeScript", "Firebase", "NFC"],
    timeline: [
      {
        date: "2026-07-26",
        category: "FOUNDATION",
        title: "Alarms learned to travel with you",
        detail:
          "Cloud save and full alarm restore laid the groundwork for a dependable setup across sessions, with Capsule claims tied to the account.",
      },
      {
        date: "2026-07-28",
        category: "SECURITY",
        title: "Capsule claims moved server-side",
        detail:
          "A server-owned tag registry and callable-only claim and release flows replaced the mobile Firestore fallback. Bindings became append-only history.",
      },
      {
        date: "2026-08-16",
        category: "RELIABILITY",
        title: "The wake-up sound became WakaTime's",
        detail:
          "On iOS, AlarmKit began playing the branded alarm sound, while the handoff into the app was tightened to avoid a silent gap.",
      },
      {
        date: "2026-09-12",
        category: "PRODUCT",
        title: "One Capsule, one clear rule",
        detail:
          "The shipped ownership model settled on one account, one phone, and one Capsule. The Capsule tap remains the only way to confirm a wake-up.",
      },
      {
        date: "2026-09-13",
        category: "PLATFORM",
        title: "Sign-in and alarm state got stronger",
        detail:
          "Email verification codes joined Apple and Google sign-in; alarms gained a local-first mirror and tag pairing moved to regional HTTPS callables.",
      },
      {
        date: "2026-09-19",
        category: "EXPERIENCE",
        title: "The details started to feel finished",
        detail:
          "Branded onboarding, clearer NFC guidance, loop-safe alarm audio, and a more reliable emergency bypass brought more care to the wake-up flow.",
      },
      {
        date: "2026-09-20",
        category: "POLISH",
        title: "Morning setup became a little calmer",
        detail:
          "Alarm labels aligned with the home clock, sound and notification settings were simplified, and sheets adjusted around the keyboard.",
      },
    ],
  },
];