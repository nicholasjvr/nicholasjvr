export type AboutPillar = {
  number: string;
  label: string;
  title: string;
  detail: string;
};

export type StackGroup = {
  category: string;
  items: string[];
};

export const about = {
  name: "Nicholas Jansen van Rensburg",
  shortName: "Nic",
  handle: "nicholasjvr",
  location: "South Africa",
  role: "Full-Stack & Mobile Product Builder",
  githubAvatar: "https://github.com/nicholasjvr.png",
  githubBio: "the users are my QA",
  headline: "I like building products that cross the line between software and real life.",
  bio: [
    "I'm a developer based in South Africa building full-stack web apps, native mobile experiences, and business automations. Outside of day-to-day engineering, this site is my working notebook—a place where I document the products I'm shipping from scratch.",
    "Whether it's a multi-sport discovery platform with cloud video pipelines or an alarm clock that only stops when you walk across the room and tap a physical NFC capsule, I care most about clear trust boundaries, tactile details, and shipping things people actually use.",
  ],
  pillars: [
    {
      number: "01",
      label: "CRAFT",
      title: "End-to-end ownership",
      detail:
        "From data models, server-side security rules, and Cloud Run pipelines to the final mobile gesture and onboarding flow.",
    },
    {
      number: "02",
      label: "REALITY",
      title: "Shaped around real habits",
      detail:
        "Software works best when it respects how people actually behave—early in the morning, on the field, or inside a busy operations team.",
    },
    {
      number: "03",
      label: "RECORD",
      title: "Documented as it happens",
      detail:
        "Every project here keeps a dated changelog of architecture shifts, security hardening, and product lessons rather than a static pitch.",
    },
  ] satisfies AboutPillar[],
  stackGroups: [
    {
      category: "Mobile & Web",
      items: ["TypeScript", "React & Next.js", "React Native & Expo", "Flutter", "Astro"],
    },
    {
      category: "Backend & Cloud",
      items: ["Node.js", "Firebase", "Cloud Run", "SQL", "FFmpeg", "REST APIs"],
    },
    {
      category: "Hardware & Ops",
      items: ["NFC / AlarmKit", "Zoho CRM & Creator", "PayFast", "Business Automation"],
    },
  ] satisfies StackGroup[],
  socials: {
    instagram: {
      label: "Instagram",
      handle: "@nicholasjvr",
      url: "https://www.instagram.com/nicholasjvr/",
    },
    github: {
      label: "GitHub",
      handle: "@nicholasjvr",
      url: "https://github.com/nicholasjvr",
    },
    email: {
      label: "Email",
      handle: "nicholas241cut@gmail.com",
      url: "mailto:nicholas241cut@gmail.com",
    },
  },
};
