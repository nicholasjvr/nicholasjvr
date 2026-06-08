export type TerminalFrame = {
  file: string;
  art: string;
};

export const TERMINAL_ART: TerminalFrame[] = [
  {
    file: 'uniquely_yours.txt',
    art: String.raw`
  ┌─────────────────────────────────────┐
  │  not a template. not a clone.       │
  │  built for how *you* actually work. │
  └─────────────────────────────────────┘
         \\   ^__^
          \\  (oo)\\_______
              (__)\\       )\\/\\
                  ||----w |
                  ||     ||
`.trim(),
  },
  {
    file: 'airtificial_labourers.sh',
    art: String.raw`
       ___________________________
      |  CURSOR  CLINE  CONTINUE  |
      |  KILO    COPILOT  WINDSURF  |
      |___________________________|
            \\   ____
             \\  |  |
                 |  |  non-sentient
                 |__|  very helpful
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
    file: 'idea_to_software.gif',
    art: String.raw`
      ( idea )
         |
         v
    [========]  <- you
         |
         v
    { software }  <- also you, but faster
`.trim(),
  },
  {
    file: '404_sleep.notfound',
    art: String.raw`
        Z   Z
       (-.-)
      __|_|__   // humans still required
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
    file: 'vaporwave.sys',
    art: String.raw`
  ░▒▓█ AI LABOUR DEVELOPMENT █▓▒░
  ═══════════════════════════════
   SENTIENCE .......... 0.00%
   REGRET ............. NONE
   ERA STATUS ......... LOVED
  ═══════════════════════════════
`.trim(),
  },
  {
    file: 'build_loop.sh',
    art: String.raw`
   while (possible) {
     scaffold();   // agents
     architect();  // human
     ship();       // always
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
       |  contact   |
       |____________|
`.trim(),
  },
  {
    file: 'agent_swarm.map',
    art: String.raw`
          .---.
         /     \\
        | O   O |   IDE agents
         \\___/    orbiting the
      .---' '---.  human layer
     /           \\
    |  ( YOU )    |
     \\___________/
`.trim(),
  },
];

export const TERMINAL_PROMPT = 'nicholasjvr@portfolio:~$';
