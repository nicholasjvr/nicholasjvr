export type TerminalFrame = {
  file: string;
  art: string;
};

export const TERMINAL_ART: TerminalFrame[] = [
  {
    file: 'side_projects.txt',
    art: String.raw`
  ┌─────────────────────────────────────┐
  │  built after hours                  │
  │  shipped anyway                     │
  │  documented here                    │
  └─────────────────────────────────────┘
         \\   ^__^
          \\  (oo)\\_______
              (__)\\       )\\/\\
                  ||----w |
                  ||     ||
`.trim(),
  },
  {
    file: 'ship_it.ascii',
    art: String.raw`
                    .
                   / \\
              \\  /   \\  //
           ___  \\/     \\/
          /   \\===========>  shipped
         /     \\
        /_______\\
`.trim(),
  },
  {
    file: 'stack_dump.log',
    art: String.raw`
   .---------------------------.
   |  JS  TS  REACT  NEXT.JS   |
   |  NODE  SQL  ZOHO  PYTHON   |
   |  AZURE  FIREBASE  PRISMA   |
   '---------------------------'
        \\  \\  \\  \\
         \\  \\  \\  \\
          \\__\\__\\__\\
`.trim(),
  },
  {
    file: 'idea_to_build.gif',
    art: String.raw`
      ( idea )
         |
         v
    [========]  <- late night
         |
         v
    { project }  <- side quest
`.trim(),
  },
  {
    file: '404_sleep.notfound',
    art: String.raw`
        Z   Z
       (-.-)
      __|_|__   // still shipping
     |       |
     |  zzz  |
     |_______|
`.trim(),
  },
  {
    file: 'zoho_hacks.exe',
    art: String.raw`
   .___________________________.
   |  WARNING: ZOHO OVERCLOCK  |
   |  doing things it was not  |
   |  designed to do...        |
   '---------------------------'
        \\  (\\_/)
         \\ (='.'=)
          (")_(")
`.trim(),
  },
  {
    file: 'build_loop.sh',
    art: String.raw`
   while (curious) {
     prototype();
     break_things();
     ship();
   }
`.trim(),
  },
  {
    file: 'coffee_driver.ko',
    art: String.raw`
        ( (
         ) )
      .________.
     |  ______  |
     | |      | |
     | |  ~~  | |   fuel for
     | |______| |   iteration
     '----------'
`.trim(),
  },
  {
    file: 'portfolio.exe',
    art: String.raw`
     _______________________
    |  nicholasjvr@github   |
    |_______________________|
       |  projects  |
       |  stack     |
       |  github    |
       |____________|
`.trim(),
  },
  {
    file: 'orb_render.glsl',
    art: String.raw`
          .---.
         /     \\
        | O   O |   three.js
         \\___/    smiley orb
      .---' '---.  because why not
     /           \\
    |  ( orb )    |
     \\___________/
`.trim(),
  },
  {
    file: 'case_study.md',
    art: String.raw`
   # objective
   # approach
   # outcome
   -----------------
   status: documented
   audience: future me
`.trim(),
  },
  {
    file: 'weekend_deploy.sh',
    art: String.raw`
   git commit -m "probably fine"
   npm run build
   fingers crossed...
   ==================> live
`.trim(),
  },
];

export const TERMINAL_PROMPT = 'nicholasjvr@portfolio:~$';
