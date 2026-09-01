// ============================================================
//  RentalFlow  |  Viva preparation guide — authored content
//  Every explanation below is written twice: `en` (simple English) and
//  `bn` (Bangla). build.mjs merges this with the real source files.
// ============================================================

export const meta = {
  project: 'RentalFlow',
  subtitle: 'Peer-to-Peer Equipment Rental Marketplace',
  course: 'CSE470 — Software Engineering',
  university: 'BRAC University',
  stack: 'React (Vite) · Node.js + Express · PostgreSQL (raw SQL, no ORM) · JWT',
};

// ---------------------------------------------------------------------------
// TEAM
// ---------------------------------------------------------------------------
export const members = [
  {
    id: 'M1',
    name: 'Md. Safinuzzaman',
    nick: 'Shafin',
    studentId: '22301419',
    github: 'shaafin01',
    area: 'Inventory & Analytics',
    features: ['F1', 'F2', 'F3', 'F4', 'F19'],
    owns: [
      'server/src/schema.sql',
      'server/src/routes/items.js',
      'server/src/routes/uploads.js',
      'server/src/routes/analytics.js',
      'server/src/analyticsUtils.js',
      'server/src/analyticsUtils.test.js',
      'client/src/pages/ItemForm.jsx',
      'client/src/pages/Analytics.jsx',
      'client/src/components/Charts.jsx',
    ],
    pitchEn:
      'I own the "what do we have and how well is it earning" half of the system. I designed the database schema, built the item catalog (create, edit, multi-image upload, tags, categories, status), generated the unique QR token that every item carries, and built the analytics layer that turns bookings into revenue and utilization numbers with hand-drawn SVG charts.',
    pitchBn:
      'সিস্টেমের "আমাদের কাছে কী কী আছে এবং সেগুলো কত আয় করছে" — এই অংশটা আমার। আমি ডেটাবেজ স্কিমা ডিজাইন করেছি, আইটেম ক্যাটালগ বানিয়েছি (তৈরি, এডিট, একাধিক ছবি আপলোড, ট্যাগ, ক্যাটাগরি, স্ট্যাটাস), প্রতিটি আইটেমের জন্য ইউনিক QR টোকেন তৈরি করেছি, এবং অ্যানালিটিক্স লেয়ার বানিয়েছি যা বুকিং থেকে রেভিনিউ ও ইউটিলাইজেশন হিসাব করে নিজের হাতে লেখা SVG চার্টে দেখায়।',
  },
  {
    id: 'M2',
    name: 'Tawheed Bin Hamid',
    nick: 'Pritom',
    studentId: '22301476',
    github: 'pritom702',
    area: 'Booking & Customers',
    features: ['F6', 'F7', 'F8', 'F16', 'F17'],
    owns: [
      'server/src/db.js',
      'server/src/app.js',
      'server/src/index.js',
      'server/src/initDb.js',
      'server/src/routes/categories.js',
      'server/src/routes/customers.js',
      'server/src/routes/notifications.js',
      'server/src/customerUtils.js',
      'server/src/customerUtils.test.js',
      'server/src/notificationUtils.js',
      'server/src/notificationUtils.test.js',
      'client/src/pages/PublicBooking.jsx',
      'client/src/pages/Customers.jsx',
      'client/src/components/NotificationBell.jsx',
      'client/src/money.js',
      'api/index.js',
    ],
    pitchEn:
      'I own the booking engine and the customer side. I set up the project foundation (Express app, the PostgreSQL pool, Docker, the raw-SQL query helper), then built the public marketplace page, the availability calendar, the conflict detection that stops double bookings, the booking lifecycle with owner-only approval, in-app notifications, and the customer CRM that scores each renter by spend and reliability.',
    pitchBn:
      'বুকিং ইঞ্জিন এবং কাস্টমার সাইড আমার দায়িত্ব। আমি প্রজেক্টের ভিত্তি তৈরি করেছি (Express অ্যাপ, PostgreSQL পুল, Docker, raw-SQL কোয়েরি হেল্পার), তারপর পাবলিক মার্কেটপ্লেস পেজ, অ্যাভেইলেবিলিটি ক্যালেন্ডার, ডাবল বুকিং ঠেকানোর কনফ্লিক্ট ডিটেকশন, শুধু মালিক অনুমোদন করতে পারবে এমন বুকিং লাইফসাইকেল, ইন-অ্যাপ নোটিফিকেশন, এবং কাস্টমার CRM বানিয়েছি যা প্রতিটি ভাড়াটিয়াকে খরচ ও নির্ভরযোগ্যতা দিয়ে স্কোর করে।',
  },
  {
    id: 'M3',
    name: 'Promit Ghosh Turjo',
    nick: 'Promit',
    studentId: '22301425',
    github: '—',
    area: 'Money & Documents',
    features: ['F9', 'F10', 'F11', 'F12', 'F15'],
    owns: [
      'server/src/middleware/auth.js',
      'server/src/routes/auth.js',
      'server/src/routes/scan.js',
      'server/src/seed.js',
      'server/src/documentUtils.js',
      'server/src/documentUtils.test.js',
      'client/src/api.js',
      'client/src/auth.jsx',
      'client/src/pages/Login.jsx',
      'client/src/pages/Scan.jsx',
      'client/src/pages/Documents.jsx',
      'client/src/pdf.js',
    ],
    pitchEn:
      'I own authentication and everything involving money and paperwork. I built JWT login/signup with bcrypt password hashing and the role guard middleware, then the deposit and late-fee calculations, the QR scan check-out/check-in flow, the digital rental agreement with its permanent document number, and the client-side PDF export for agreements, return summaries and customer statements.',
    pitchBn:
      'অথেন্টিকেশন এবং টাকা ও কাগজপত্র সংক্রান্ত সবকিছু আমার। আমি bcrypt পাসওয়ার্ড হ্যাশিং সহ JWT লগইন/সাইনআপ ও রোল গার্ড মিডলওয়্যার বানিয়েছি, তারপর ডিপোজিট ও লেট ফি হিসাব, QR স্ক্যান করে চেক-আউট/চেক-ইন, স্থায়ী ডকুমেন্ট নম্বর সহ ডিজিটাল ভাড়া চুক্তি, এবং চুক্তি, রিটার্ন সামারি ও কাস্টমার স্টেটমেন্টের জন্য ক্লায়েন্ট-সাইড PDF এক্সপোর্ট বানিয়েছি।',
  },
  {
    id: 'M4',
    name: 'Radowanul Haque',
    nick: 'Radowan',
    studentId: '24101686',
    github: '—',
    area: 'Condition, Maintenance & Admin',
    features: ['F5', 'F13', 'F14', 'F18', 'F20', 'F21', 'F22', 'F23'],
    owns: [
      'server/src/schema_sprint4.sql',
      'server/src/seedSprint4.js',
      'server/src/routes/maintenance.js',
      'server/src/routes/admin.js',
      'server/src/maintenanceUtils.js',
      'server/src/maintenanceUtils.test.js',
      'server/src/middleware/audit.js',
      'server/src/middleware/accountStatus.js',
      'client/src/App.jsx',
      'client/src/styles.css',
      'client/src/icons.jsx',
      'client/src/components.jsx',
      'client/src/pages/Landing.jsx',
      'client/src/pages/Dashboard.jsx',
      'client/src/pages/Maintenance.jsx',
      'client/src/pages/Admin.jsx',
      'server/src/schema_profile.sql',
      'server/src/profileUtils.js',
      'server/src/profileUtils.test.js',
      'server/src/routes/profile.js',
      'server/src/seedProfile.js',
      'client/src/pages/Profile.jsx',
      'client/src/components/NidForm.jsx',
      'client/src/components/PaymentMethods.jsx',
      'client/src/components/RenterModal.jsx',
    ],
    pitchEn:
      'I own the physical condition of items and the platform governance side, plus the whole design system. I built accessory tracking, the condition report captured at both check-out and check-in, the damage penalty engine that compares those two reports, the maintenance and repair log that automatically pulls an item out of the rental pool, and the admin console with staff accounts and a full audit trail.',
    pitchBn:
      'আইটেমের ভৌত অবস্থা, প্ল্যাটফর্ম গভর্ন্যান্স এবং পুরো ডিজাইন সিস্টেম আমার দায়িত্ব। আমি অ্যাকসেসরি ট্র্যাকিং, চেক-আউট ও চেক-ইন দুই সময়েই নেওয়া কন্ডিশন রিপোর্ট, সেই দুই রিপোর্ট তুলনা করে ক্ষতিপূরণ নির্ধারণের পেনাল্টি ইঞ্জিন, আইটেমকে স্বয়ংক্রিয়ভাবে ভাড়ার পুল থেকে সরিয়ে দেওয়া মেইনটেন্যান্স লগ, এবং স্টাফ অ্যাকাউন্ট ও সম্পূর্ণ অডিট ট্রেইল সহ অ্যাডমিন কনসোল বানিয়েছি।',
  },
];

// ---------------------------------------------------------------------------
// SOFTWARE ENGINEERING PROCESS MODEL & METHODOLOGY
// ---------------------------------------------------------------------------
export const seModel = {
  modelName: 'Iterative & Incremental development, run as Agile / Scrum-style sprints',
  answerEn: `We used an **Iterative and Incremental** process model, organised as **Agile sprints** (a Scrum-like workflow).

**Why not Waterfall?** Waterfall needs every requirement frozen before design starts, and delivers working software only at the very end. We had 20 features and four people, and we needed something demonstrable after every sprint. So we split the 20 features across **four sprints**, and each sprint produced a *working, demonstrable increment* of the product — not just a document.

**Why incremental?** Sprint 1 shipped a usable catalog and marketplace. Sprint 2 added booking on top of it. Sprint 3 added checkout and documents. Sprint 4 added analytics and admin. Every sprint's output was a complete, runnable system — just with fewer features than the next one.

**Why iterative?** We also went *back* and improved things already built. The booking module written in Sprint 2 was extended in Sprint 3 with approval and check-out, and refined again in Sprint 4. That revisiting is the "iterative" half.

**Our Scrum practices:**
- **Sprint planning** — \`SPRINT_PLAN.md\` fixes, before each sprint, who builds what.
- **Fixed sprint length** — 7–14 days, and a deadline that cannot be moved once set.
- **Product backlog** — the 20 numbered features (F1–F20).
- **Sprint backlog** — the 4–5 features pulled into the current sprint.
- **Definition of Done** — works end-to-end against the real API, uses raw SQL, is original code, and is shown in the demo video by its owner.
- **Sprint review** — one combined demo video per sprint.
- **Code review** — every member opens a Pull Request; a teammate reviews and merges.

**What we did NOT use:** we did not use the Spiral model (no formal risk analysis round per cycle), the V-model (our testing was not mirrored to a specification phase), RAD, or pure XP (no pair programming or strict TDD across the board — though we do have unit tests for the pure business logic).`,
  answerBn: `আমরা **Iterative and Incremental** প্রসেস মডেল ব্যবহার করেছি, যা **Agile sprint** (Scrum-এর মতো) হিসেবে চালানো হয়েছে।

**Waterfall কেন নয়?** Waterfall-এ ডিজাইন শুরুর আগেই সব রিকোয়ারমেন্ট চূড়ান্ত করতে হয়, আর কাজ করা সফটওয়্যার পাওয়া যায় একদম শেষে। আমাদের ছিল ২০টি ফিচার আর চারজন সদস্য, এবং প্রতি স্প্রিন্ট শেষে ডেমো দেখানোর মতো কিছু দরকার ছিল। তাই আমরা ২০টি ফিচার **চারটি স্প্রিন্টে** ভাগ করেছি, এবং প্রতিটি স্প্রিন্ট একটি *চলমান, ডেমোযোগ্য increment* তৈরি করেছে — শুধু ডকুমেন্ট নয়।

**Incremental কেন?** Sprint 1-এ ব্যবহারযোগ্য ক্যাটালগ ও মার্কেটপ্লেস দিয়েছি। Sprint 2-তে তার উপর বুকিং যোগ হয়েছে। Sprint 3-এ চেকআউট ও ডকুমেন্ট। Sprint 4-এ অ্যানালিটিক্স ও অ্যাডমিন। প্রতিটি স্প্রিন্টের আউটপুট ছিল সম্পূর্ণ চালানোর মতো সিস্টেম — শুধু পরেরটির চেয়ে কম ফিচার নিয়ে।

**Iterative কেন?** আমরা আগে বানানো জিনিস আবার *ফিরে গিয়ে* উন্নত করেছি। Sprint 2-এ লেখা বুকিং মডিউল Sprint 3-এ অনুমোদন ও চেক-আউট দিয়ে বাড়ানো হয়েছে, আবার Sprint 4-এ ঘষামাজা করা হয়েছে। এই বারবার ফিরে যাওয়াই "iterative" অংশ।

**আমাদের Scrum চর্চা:**
- **Sprint planning** — \`SPRINT_PLAN.md\`-এ প্রতি স্প্রিন্টের আগে কে কী বানাবে তা ঠিক করা।
- **নির্দিষ্ট স্প্রিন্ট দৈর্ঘ্য** — ৭–১৪ দিন, একবার ঠিক হলে ডেডলাইন আর বদলানো যাবে না।
- **Product backlog** — ২০টি নম্বরযুক্ত ফিচার (F1–F20)।
- **Sprint backlog** — চলতি স্প্রিন্টে নেওয়া ৪–৫টি ফিচার।
- **Definition of Done** — আসল API-র সাথে শুরু থেকে শেষ পর্যন্ত কাজ করে, raw SQL ব্যবহার করে, মৌলিক কোড, এবং মালিক নিজে ডেমো ভিডিওতে দেখায়।
- **Sprint review** — প্রতি স্প্রিন্টে একটি সম্মিলিত ডেমো ভিডিও।
- **Code review** — প্রত্যেকে Pull Request খোলে; একজন সতীর্থ রিভিউ করে merge করে।

**যা ব্যবহার করিনি:** Spiral মডেল (প্রতি চক্রে আনুষ্ঠানিক ঝুঁকি বিশ্লেষণ নেই), V-model (আমাদের টেস্টিং স্পেসিফিকেশন ফেজের সাথে মিরর করা নয়), RAD, বা বিশুদ্ধ XP (সব জায়গায় pair programming বা কঠোর TDD নেই — যদিও pure business logic-এর ইউনিট টেস্ট আছে)।`,
};

// ---------------------------------------------------------------------------
// ARCHITECTURE
// ---------------------------------------------------------------------------
export const architecture = {
  headlineEn:
    'Three-tier client–server architecture, with a layered REST API on the server and a component-based Single Page Application on the client.',
  headlineBn:
    'তিন-স্তরের ক্লায়েন্ট–সার্ভার আর্কিটেকচার — সার্ভারে স্তরভিত্তিক (layered) REST API, ক্লায়েন্টে কম্পোনেন্ট-ভিত্তিক Single Page Application।',

  layersEn: `**Tier 1 — Presentation (client/)**
A React SPA. It holds no business rules; it renders state and calls the API. React Router maps URLs to pages, \`auth.jsx\` holds the session in a Context, and \`api.js\` is the single place that talks HTTP.

**Tier 2 — Application / Logic (server/)**
An Express REST API, itself split into three layers:
1. **Middleware layer** — \`blockSuspended\`, \`auditLogger\`, \`authRequired\`, \`requireRole\`, \`requireOwnerOrAdmin\`. Cross-cutting concerns that run before any route.
2. **Route (controller) layer** — \`routes/*.js\`. Reads the request, validates input, calls the logic, writes SQL, returns JSON.
3. **Domain logic layer** — \`*Utils.js\`. Pure functions with no database and no HTTP: deposit, late fee, penalty, bill, utilization, CRM scoring, document numbering. This is why they are unit-testable.

**Tier 3 — Data (PostgreSQL)**
\`db.js\` owns a single connection pool and exposes one \`query()\` helper. Every statement is hand-written, parameterised SQL. There is no ORM anywhere — a hard course requirement.`,

  layersBn: `**স্তর ১ — Presentation (client/)**
একটি React SPA। এখানে কোনো ব্যবসায়িক নিয়ম নেই; এটি শুধু state দেখায় আর API কল করে। React Router URL-কে পেজে ম্যাপ করে, \`auth.jsx\` Context-এ সেশন রাখে, আর \`api.js\` একমাত্র জায়গা যেখানে HTTP কথা বলে।

**স্তর ২ — Application / Logic (server/)**
একটি Express REST API, যা নিজেই তিন ভাগে বিভক্ত:
1. **Middleware স্তর** — \`blockSuspended\`, \`auditLogger\`, \`authRequired\`, \`requireRole\`, \`requireOwnerOrAdmin\`। যেকোনো রুটের আগে চলা সাধারণ কাজ।
2. **Route (controller) স্তর** — \`routes/*.js\`। রিকোয়েস্ট পড়ে, ইনপুট যাচাই করে, লজিক ডাকে, SQL লেখে, JSON ফেরত দেয়।
3. **Domain logic স্তর** — \`*Utils.js\`। ডেটাবেজ ও HTTP ছাড়া বিশুদ্ধ ফাংশন: ডিপোজিট, লেট ফি, পেনাল্টি, বিল, ইউটিলাইজেশন, CRM স্কোরিং, ডকুমেন্ট নম্বর। এজন্যই এগুলো ইউনিট-টেস্ট করা যায়।

**স্তর ৩ — Data (PostgreSQL)**
\`db.js\` একটিমাত্র connection pool রাখে এবং একটি \`query()\` হেল্পার দেয়। প্রতিটি স্টেটমেন্ট হাতে লেখা, parameterised SQL। কোথাও ORM নেই — এটি কোর্সের কঠোর শর্ত।`,

  mvcEn: `**"Are you using MVC?" — the honest, full answer.**

The backend maps onto MVC cleanly:

| MVC role | In RentalFlow | Why |
|---|---|---|
| **Model** | \`schema.sql\` + \`db.js\` + the \`*Utils.js\` domain functions | Holds the data structure and the business rules |
| **View** | The JSON responses (for the API) and the React pages (for the user) | What the consumer actually sees |
| **Controller** | \`routes/*.js\` | Receives the request, decides what to do, picks the response |

But we should be precise, because a good examiner will push on this:

1. **Classic MVC** assumes the View observes the Model directly and the Model pushes changes to it. That does not happen here — our client and server are separate processes talking over HTTP. So what we really have is the web variant, often called **Model–View–Controller over a REST boundary**, or more accurately a **layered (N-tier) architecture**.

2. **React is not MVC.** React is component-based with *unidirectional data flow*: state flows down as props, events flow up as callbacks. It is closer to the **Flux/Observer** idea than to MVC. Calling our React app "the View" is a fair simplification, but the internal pattern is component composition, not MVC.

3. **The most accurate single answer:** *"Three-tier client–server, with a layered REST API on the backend. The backend layers map onto MVC — routes are controllers, the SQL and the Utils modules are the model, and JSON/React is the view — but architecturally the defining pattern is layering, not MVC."*`,

  mvcBn: `**"তোমরা কি MVC ব্যবহার করছ?" — সৎ ও পূর্ণ উত্তর।**

ব্যাকএন্ড MVC-তে পরিষ্কারভাবে মেলে:

| MVC ভূমিকা | RentalFlow-এ | কেন |
|---|---|---|
| **Model** | \`schema.sql\` + \`db.js\` + \`*Utils.js\` ডোমেইন ফাংশন | ডেটার গঠন ও ব্যবসায়িক নিয়ম ধারণ করে |
| **View** | JSON রেসপন্স (API-র জন্য) ও React পেজ (ব্যবহারকারীর জন্য) | যা আসলে দেখা যায় |
| **Controller** | \`routes/*.js\` | রিকোয়েস্ট নেয়, কী করতে হবে ঠিক করে, রেসপন্স বাছে |

তবে নিখুঁত হওয়া দরকার, কারণ ভালো পরীক্ষক এখানে চাপ দেবেন:

1. **ক্লাসিক MVC**-তে View সরাসরি Model পর্যবেক্ষণ করে এবং Model তাকে পরিবর্তন পাঠায়। এখানে তা হয় না — আমাদের ক্লায়েন্ট ও সার্ভার আলাদা প্রসেস, HTTP দিয়ে কথা বলে। তাই আমাদেরটা আসলে ওয়েব সংস্করণ, যাকে বলে **REST সীমানার উপর Model–View–Controller**, বা আরও সঠিকভাবে **layered (N-tier) আর্কিটেকচার**।

2. **React MVC নয়।** React কম্পোনেন্ট-ভিত্তিক, *একমুখী ডেটা প্রবাহ* সহ: state props হয়ে নিচে নামে, ইভেন্ট callback হয়ে উপরে ওঠে। এটি MVC-র চেয়ে **Flux/Observer** ধারণার কাছাকাছি। আমাদের React অ্যাপকে "View" বলা যুক্তিসঙ্গত সরলীকরণ, কিন্তু ভেতরের প্যাটার্ন কম্পোনেন্ট কম্পোজিশন, MVC নয়।

3. **সবচেয়ে সঠিক এক-লাইন উত্তর:** *"তিন-স্তরের ক্লায়েন্ট–সার্ভার, ব্যাকএন্ডে layered REST API। ব্যাকএন্ডের স্তরগুলো MVC-তে ম্যাপ করে — routes হলো controller, SQL ও Utils হলো model, JSON/React হলো view — কিন্তু আর্কিটেকচারের মূল বৈশিষ্ট্য layering, MVC নয়।"*`,

  patterns: [
    {
      name: 'Layered architecture',
      whereEn: 'routes → utils → db.js → PostgreSQL',
      whereBn: 'routes → utils → db.js → PostgreSQL',
      whyEn: 'Each layer only talks to the one directly below it, so business rules can be tested without a database and the database can change without touching the routes.',
      whyBn: 'প্রতিটি স্তর কেবল ঠিক নিচের স্তরের সাথে কথা বলে, তাই ডেটাবেজ ছাড়াই ব্যবসায়িক নিয়ম টেস্ট করা যায় এবং routes না ছুঁয়ে ডেটাবেজ বদলানো যায়।',
    },
    {
      name: 'Chain of Responsibility (middleware)',
      whereEn: 'app.use(blockSuspended) → app.use(auditLogger) → route → error handler',
      whereBn: 'app.use(blockSuspended) → app.use(auditLogger) → route → error handler',
      whyEn: 'Every request passes through a chain of handlers. Each one either handles it, changes it, or calls next(). Adding a new cross-cutting rule means adding one link, not editing 11 route files.',
      whyBn: 'প্রতিটি রিকোয়েস্ট হ্যান্ডলারের একটি শৃঙ্খলের মধ্য দিয়ে যায়। প্রতিটি হয় কাজ সারে, বদলায়, নয়তো next() ডাকে। নতুন সাধারণ নিয়ম যোগ করতে ১১টি রুট ফাইল নয়, একটি লিংক যোগ করলেই হয়।',
    },
    {
      name: 'Singleton',
      whereEn: 'the pg connection Pool in db.js',
      whereBn: 'db.js-এর pg connection Pool',
      whyEn: 'One pool is created once and shared by every route. Opening a new connection per request would exhaust the database.',
      whyBn: 'একটি পুল একবার তৈরি হয় এবং সব রুট শেয়ার করে। প্রতি রিকোয়েস্টে নতুন কানেকশন খুললে ডেটাবেজ শেষ হয়ে যাবে।',
    },
    {
      name: 'Provider / Context (Dependency Injection)',
      whereEn: 'AuthProvider in client/src/auth.jsx',
      whereBn: 'client/src/auth.jsx-এর AuthProvider',
      whyEn: 'The logged-in user is provided once at the top of the tree and any component reads it with useAuth(), instead of passing it down through every component as props.',
      whyBn: 'লগইন করা ব্যবহারকারীকে ট্রি-র উপরে একবার দেওয়া হয় এবং যেকোনো কম্পোনেন্ট useAuth() দিয়ে পড়ে — প্রতিটি কম্পোনেন্টের ভেতর দিয়ে props হিসেবে পাঠাতে হয় না।',
    },
    {
      name: 'Guard / Decorator',
      whereEn: 'authRequired, requireRole(...), requireOwnerOrAdmin, RequireAuth, RequireAdmin',
      whereBn: 'authRequired, requireRole(...), requireOwnerOrAdmin, RequireAuth, RequireAdmin',
      whyEn: 'A route or a page is wrapped in a guard that decides whether the request may proceed. The protected thing itself does not know it is protected.',
      whyBn: 'একটি রুট বা পেজকে গার্ড দিয়ে মুড়ে দেওয়া হয়, যা ঠিক করে রিকোয়েস্ট এগোবে কিনা। সুরক্ষিত জিনিসটি নিজে জানে না যে সে সুরক্ষিত।',
    },
    {
      name: 'Strategy (lookup table)',
      whereEn: 'the SEVERITY map in bookingUtils.js',
      whereBn: 'bookingUtils.js-এর SEVERITY ম্যাপ',
      whyEn: 'Each return condition maps to a penalty percentage. Changing the policy means editing one object, not rewriting an if/else chain.',
      whyBn: 'প্রতিটি ফেরত অবস্থা একটি পেনাল্টি শতাংশে ম্যাপ করে। নীতি বদলাতে if/else শৃঙ্খল নয়, একটি অবজেক্ট এডিট করলেই হয়।',
    },
    {
      name: 'Facade',
      whereEn: 'client/src/api.js',
      whereBn: 'client/src/api.js',
      whyEn: 'One small object hides fetch, the base URL, the JWT header, JSON parsing and 401 handling. Pages call api.get(...) and know nothing about HTTP.',
      whyBn: 'একটি ছোট অবজেক্ট fetch, base URL, JWT হেডার, JSON পার্সিং ও 401 হ্যান্ডলিং লুকিয়ে রাখে। পেজগুলো api.get(...) ডাকে, HTTP সম্পর্কে কিছু জানে না।',
    },
  ],

  // Request lifecycle, used to draw the sequence diagram
  lifecycle: [
    { step: 1, actor: 'User', doEn: 'Clicks "Request Booking" on the Browse page', doBn: 'Browse পেজে "Request Booking"-এ ক্লিক করে' },
    { step: 2, actor: 'React page', doEn: 'PublicBooking.jsx opens the modal, collects dates, calls api.post("/bookings", …)', doBn: 'PublicBooking.jsx মোডাল খোলে, তারিখ নেয়, api.post("/bookings", …) ডাকে' },
    { step: 3, actor: 'api.js', doEn: 'Attaches the JWT as an Authorization header and sends fetch POST /api/bookings', doBn: 'JWT-কে Authorization হেডারে যোগ করে fetch POST /api/bookings পাঠায়' },
    { step: 4, actor: 'Express middleware', doEn: 'blockSuspended checks the account is active; auditLogger records the attempt', doBn: 'blockSuspended অ্যাকাউন্ট সক্রিয় কিনা দেখে; auditLogger চেষ্টাটি রেকর্ড করে' },
    { step: 5, actor: 'routes/bookings.js', doEn: 'Validates the dates, runs the overlap SQL, calls calculateDeposit(), INSERTs the booking', doBn: 'তারিখ যাচাই করে, ওভারল্যাপ SQL চালায়, calculateDeposit() ডাকে, বুকিং INSERT করে' },
    { step: 6, actor: 'db.js → PostgreSQL', doEn: 'Runs the parameterised SQL and returns the new row', doBn: 'parameterised SQL চালায় এবং নতুন সারি ফেরত দেয়' },
    { step: 7, actor: 'notificationUtils', doEn: 'Builds the "new booking request" notification for the item owner', doBn: 'আইটেমের মালিকের জন্য "নতুন বুকিং অনুরোধ" নোটিফিকেশন তৈরি করে' },
    { step: 8, actor: 'React', doEn: 'Receives the JSON, closes the modal, shows the success banner; the owner sees the bell count rise within 20s', doBn: 'JSON পায়, মোডাল বন্ধ করে, সফলতার বার্তা দেখায়; মালিক ২০ সেকেন্ডের মধ্যে বেল-এ সংখ্যা বাড়তে দেখে' },
  ],
};

// ---------------------------------------------------------------------------
// FEATURE CATALOG — F1..F20
// ---------------------------------------------------------------------------
export const features = [
  {
    id: 'F1', title: 'Item catalog', owner: 'M1', sprint: 1,
    files: ['server/src/routes/items.js', 'client/src/pages/ItemForm.jsx', 'server/src/routes/uploads.js'],
    en: 'A member creates a listing with a name, description, unique serial number, day rate, replacement cost, category, tags, accessories and multiple photos uploaded from their device. The write is done as several SQL statements against items, item_images, item_tags and accessories; the images are uploaded first to /api/uploads, which returns URLs, and only those URLs are stored in the database.',
    bn: 'একজন সদস্য নাম, বিবরণ, ইউনিক সিরিয়াল নম্বর, দৈনিক ভাড়া, প্রতিস্থাপন মূল্য, ক্যাটাগরি, ট্যাগ, অ্যাকসেসরি ও নিজের ডিভাইস থেকে একাধিক ছবি দিয়ে একটি লিস্টিং তৈরি করে। লেখাটি items, item_images, item_tags ও accessories টেবিলে কয়েকটি SQL স্টেটমেন্ট দিয়ে হয়; ছবিগুলো আগে /api/uploads-এ যায়, সেখান থেকে URL আসে, আর শুধু সেই URL ডেটাবেজে রাখা হয়।',
  },
  {
    id: 'F2', title: 'Categorization & tagging', owner: 'M1', sprint: 1,
    files: ['server/src/routes/categories.js', 'server/src/routes/items.js'],
    en: 'Categories are a one-to-many relation (an item has one category). Tags are many-to-many through the item_tags join table, so one item can carry several tags and one tag can be reused across items. Search matches the item name, description and its tags in a single SQL query with ILIKE.',
    bn: 'ক্যাটাগরি এক-থেকে-বহু সম্পর্ক (একটি আইটেমের একটি ক্যাটাগরি)। ট্যাগ বহু-থেকে-বহু, item_tags জয়েন টেবিলের মাধ্যমে — তাই একটি আইটেমে অনেক ট্যাগ থাকতে পারে এবং একটি ট্যাগ অনেক আইটেমে ব্যবহার হতে পারে। সার্চ একটি SQL কোয়েরিতে ILIKE দিয়ে নাম, বিবরণ ও ট্যাগ মেলায়।',
  },
  {
    id: 'F3', title: 'Item status tracking', owner: 'M1', sprint: 1,
    files: ['server/src/routes/items.js', 'server/src/schema.sql'],
    en: 'Every item is in exactly one of five states: Available, Rented, Damaged, Under Maintenance, Retired. The list is enforced by a CHECK constraint in the database, so an invalid status cannot be written even by a buggy route. Status changes come from three places: the owner changing it manually, the booking lifecycle (check-out sets Rented), and the maintenance log (an open job forces Under Maintenance).',
    bn: 'প্রতিটি আইটেম ঠিক পাঁচটি অবস্থার একটিতে থাকে: Available, Rented, Damaged, Under Maintenance, Retired। তালিকাটি ডেটাবেজে CHECK constraint দিয়ে বাধ্যতামূলক, তাই ভুল রুট থাকলেও অবৈধ স্ট্যাটাস লেখা যাবে না। স্ট্যাটাস বদলায় তিন জায়গা থেকে: মালিক নিজে, বুকিং লাইফসাইকেল (চেক-আউট Rented করে), আর মেইনটেন্যান্স লগ (খোলা কাজ Under Maintenance করে দেয়)।',
  },
  {
    id: 'F4', title: 'Barcode / QR generation', owner: 'M1', sprint: 2,
    files: ['server/src/routes/items.js', 'client/src/components/QrModal.jsx', 'server/src/routes/scan.js'],
    en: 'When an item is created the server generates a random UUID and stores it in the qr_token column, which is UNIQUE. The browser turns that token into a QR image encoding the URL <origin>/scan/<token>. Because the QR holds a URL, a normal phone camera opens the scan page directly — we did not need to build an in-app scanner.',
    bn: 'আইটেম তৈরি হলে সার্ভার একটি র‍্যান্ডম UUID বানিয়ে qr_token কলামে রাখে, যা UNIQUE। ব্রাউজার সেই টোকেন থেকে একটি QR ছবি বানায় যাতে <origin>/scan/<token> URL এনকোড করা থাকে। QR-এ URL থাকায় সাধারণ ফোন ক্যামেরাই স্ক্যান পেজ খুলে দেয় — আলাদা স্ক্যানার বানাতে হয়নি।',
  },
  {
    id: 'F5', title: 'Accessory tracking', owner: 'M4', sprint: 1,
    files: ['server/src/schema.sql', 'client/src/pages/ItemForm.jsx'],
    en: 'Accessories (a charger, a lens cap) belong to a parent item through parent_item_id with ON DELETE CASCADE, so deleting the item cleans up its accessories automatically. At check-in the staff member records which accessories are missing, and that feeds the penalty calculation.',
    bn: 'অ্যাকসেসরি (চার্জার, লেন্স ক্যাপ) parent_item_id দিয়ে মূল আইটেমের সাথে যুক্ত, ON DELETE CASCADE সহ — তাই আইটেম মুছলে অ্যাকসেসরিও মুছে যায়। চেক-ইনের সময় কর্মী লিখে রাখে কোন অ্যাকসেসরি নেই, আর সেটি পেনাল্টি হিসাবে যুক্ত হয়।',
  },
  {
    id: 'F6', title: 'Availability calendar', owner: 'M2', sprint: 2,
    files: ['client/src/pages/PublicBooking.jsx', 'server/src/routes/items.js'],
    en: 'The booking modal draws a month grid. It asks GET /items/:id/bookings for that item\'s bookings, then marks a day as blocked if it falls inside any booking whose status is Pending, Approved or Completed. Cancelled and Rejected bookings deliberately do not block, because those dates are free again.',
    bn: 'বুকিং মোডাল একটি মাসের গ্রিড আঁকে। এটি GET /items/:id/bookings দিয়ে ঐ আইটেমের বুকিং আনে, তারপর কোনো দিন যদি Pending, Approved বা Completed স্ট্যাটাসের বুকিং-এর ভেতরে পড়ে তবে সেটিকে বন্ধ দেখায়। Cancelled ও Rejected বুকিং ইচ্ছাকৃতভাবে দিন আটকায় না, কারণ সেই তারিখগুলো আবার খালি।',
  },
  {
    id: 'F7', title: 'Booking conflict detection', owner: 'M2', sprint: 2,
    files: ['server/src/bookingUtils.js', 'server/src/routes/bookings.js'],
    en: 'The core rule is one line: two ranges overlap when newStart < existingEnd AND newEnd > existingStart. Note the strict < and >, not <=: that is what lets one rental end on the same day another begins. The check runs as SQL on the server, not only in the browser — a user could otherwise bypass the UI and POST directly.',
    bn: 'মূল নিয়মটি এক লাইনের: দুটি সময়সীমা ওভারল্যাপ করে যখন newStart < existingEnd এবং newEnd > existingStart। খেয়াল করুন < এবং > কঠোর, <= নয়: এর ফলেই একটি ভাড়া যেদিন শেষ হয় সেদিনই আরেকটি শুরু হতে পারে। যাচাইটি সার্ভারে SQL হিসেবে চলে, শুধু ব্রাউজারে নয় — নইলে ব্যবহারকারী UI এড়িয়ে সরাসরি POST করতে পারত।',
  },
  {
    id: 'F8', title: 'Booking create / modify / approve', owner: 'M2', sprint: 3,
    files: ['server/src/routes/bookings.js'],
    en: 'A booking moves Pending → Approved → (checked out) → (checked in) → Completed, or is Cancelled/Rejected. Only the item\'s owner, an admin or staff may approve or reject; the customer may cancel their own request but cannot approve it. That rule is enforced on the server, and it is unit tested.',
    bn: 'একটি বুকিং Pending → Approved → (চেক-আউট) → (চেক-ইন) → Completed পথে চলে, অথবা Cancelled/Rejected হয়। কেবল আইটেমের মালিক, অ্যাডমিন বা স্টাফ অনুমোদন বা বাতিল করতে পারে; কাস্টমার নিজের অনুরোধ বাতিল করতে পারে কিন্তু অনুমোদন করতে পারে না। নিয়মটি সার্ভারে প্রয়োগ হয় এবং ইউনিট টেস্ট করা।',
  },
  {
    id: 'F9', title: 'Deposit calculation', owner: 'M3', sprint: 2,
    files: ['server/src/bookingUtils.js'],
    en: 'deposit = 20% of the item\'s replacement cost. It is calculated at booking time and stored on the booking row, so later editing the item\'s price does not retroactively change an existing deposit. A deposit is a refundable hold, not income — which is why the analytics module deliberately excludes it from revenue.',
    bn: 'ডিপোজিট = আইটেমের প্রতিস্থাপন মূল্যের ২০%। এটি বুকিংয়ের সময় হিসাব হয়ে বুকিং সারিতে জমা থাকে, তাই পরে আইটেমের দাম বদলালে পুরনো ডিপোজিট বদলায় না। ডিপোজিট ফেরতযোগ্য জামানত, আয় নয় — এজন্যই অ্যানালিটিক্স একে রেভিনিউ থেকে বাদ রাখে।',
  },
  {
    id: 'F10', title: 'Late fee calculation', owner: 'M3', sprint: 2,
    files: ['server/src/bookingUtils.js', 'server/src/routes/bookings.js'],
    en: 'lateFee = 10% of the day rate × number of overdue days. The overdue count is derived by the server from the end date and today, so a staff member never types it in — that removes a whole class of human error and dispute. If the booking is not overdue the function returns 0 rather than a negative number.',
    bn: 'লেট ফি = দৈনিক ভাড়ার ১০% × বিলম্বের দিন সংখ্যা। বিলম্বের দিন সার্ভার নিজেই শেষ তারিখ ও আজকের তারিখ থেকে বের করে, কর্মীকে টাইপ করতে হয় না — এতে মানুষের ভুল ও বিতর্ক দুটোই কমে। বুকিং বিলম্বিত না হলে ফাংশন ঋণাত্মক নয়, ০ ফেরত দেয়।',
  },
  {
    id: 'F11', title: 'Digital rental agreement', owner: 'M3', sprint: 3,
    files: ['server/src/documentUtils.js', 'server/src/routes/bookings.js'],
    en: 'The agreement number has the form RF-<bookingId>-<YYYYMMDD>. It is generated once and then stored on the booking, so reprinting the same agreement always produces the same number — a document that changed its own number every time it was printed would be worthless as a record.',
    bn: 'চুক্তি নম্বরের রূপ RF-<bookingId>-<YYYYMMDD>। এটি একবার তৈরি হয়ে বুকিংয়ে জমা থাকে, তাই একই চুক্তি আবার প্রিন্ট করলেও নম্বর একই থাকে — যে দলিল প্রতিবার প্রিন্টে নিজের নম্বর বদলায় তা রেকর্ড হিসেবে মূল্যহীন।',
  },
  {
    id: 'F12', title: 'QR check-out / check-in', owner: 'M3', sprint: 3,
    files: ['server/src/routes/scan.js', 'client/src/pages/Scan.jsx', 'client/src/pages/Checkout.jsx'],
    en: 'Scanning the QR opens /scan/<token>. The server looks the token up, finds the item and its current active booking, and sends the user to the right screen — check-out if the item has not gone out yet, check-in if it is already out. The person scanning does not have to know which action is due.',
    bn: 'QR স্ক্যান করলে /scan/<token> খোলে। সার্ভার টোকেন খুঁজে আইটেম ও তার চলতি সক্রিয় বুকিং বের করে, এবং ব্যবহারকারীকে সঠিক পর্দায় পাঠায় — আইটেম এখনো বের না হলে চেক-আউট, বেরিয়ে গেলে চেক-ইন। স্ক্যানকারীকে জানতে হয় না কোন কাজটি বাকি।',
  },
  {
    id: 'F13', title: 'Condition report', owner: 'M4', sprint: 2,
    files: ['server/src/schema.sql', 'client/src/pages/Checkout.jsx'],
    en: 'The same form is filled twice for one booking — once at check-out, once at check-in — recording condition, notes, scratches, missing accessories and photos. A UNIQUE (booking_id, phase) constraint guarantees there can only ever be one report per phase, so the comparison at check-in is always between exactly two records.',
    bn: 'একই ফর্ম একটি বুকিংয়ের জন্য দুবার পূরণ হয় — একবার চেক-আউটে, একবার চেক-ইনে — অবস্থা, নোট, দাগ, হারানো অ্যাকসেসরি ও ছবি সহ। UNIQUE (booking_id, phase) constraint নিশ্চিত করে প্রতি পর্যায়ে একটিই রিপোর্ট থাকবে, তাই চেক-ইনে তুলনা সবসময় ঠিক দুটি রেকর্ডের মধ্যে হয়।',
  },
  {
    id: 'F14', title: 'Damage control & penalty', owner: 'M4', sprint: 3,
    files: ['server/src/bookingUtils.js'],
    en: 'penalty = severity% of replacement cost + repair cost + missing-accessory charge, capped at the replacement cost. Severity comes from the return condition: New and Good are 0%, Fair 5%, Poor 15%, Damaged 30%. The cap matters — you can never be charged more than the item is worth, however the numbers are entered.',
    bn: 'পেনাল্টি = প্রতিস্থাপন মূল্যের severity% + মেরামত খরচ + হারানো অ্যাকসেসরির চার্জ, সর্বোচ্চ প্রতিস্থাপন মূল্য পর্যন্ত। Severity আসে ফেরতের অবস্থা থেকে: New ও Good ০%, Fair ৫%, Poor ১৫%, Damaged ৩০%। সীমাটি গুরুত্বপূর্ণ — যেভাবেই সংখ্যা দেওয়া হোক, আইটেমের মূল্যের বেশি চার্জ করা যাবে না।',
  },
  {
    id: 'F15', title: 'PDF contract export', owner: 'M3', sprint: 4,
    files: ['client/src/pdf.js', 'client/src/pages/Documents.jsx', 'server/src/documentUtils.js'],
    en: 'Three documents are produced with jsPDF in the browser: the rental agreement, the return summary with the condition comparison and final bill, and the customer statement. Generating them client-side means no PDF library or file storage is needed on the server.',
    bn: 'ব্রাউজারে jsPDF দিয়ে তিনটি দলিল তৈরি হয়: ভাড়া চুক্তি, অবস্থার তুলনা ও চূড়ান্ত বিল সহ রিটার্ন সামারি, এবং কাস্টমার স্টেটমেন্ট। ক্লায়েন্ট-সাইডে তৈরি করায় সার্ভারে কোনো PDF লাইব্রেরি বা ফাইল স্টোরেজ লাগে না।',
  },
  {
    id: 'F16', title: 'Public booking page', owner: 'M2', sprint: 1,
    files: ['client/src/pages/PublicBooking.jsx'],
    en: 'The marketplace anyone can browse: search by text, filter by category, see price, owner and live availability, then request a booking. Search and category filters are kept in the URL query string, so a filtered view can be shared or bookmarked and the landing page can link straight into a category.',
    bn: 'যে কেউ ঘুরে দেখতে পারে এমন মার্কেটপ্লেস: লেখা দিয়ে সার্চ, ক্যাটাগরি দিয়ে ফিল্টার, দাম, মালিক ও চলতি প্রাপ্যতা দেখা, তারপর বুকিং অনুরোধ। সার্চ ও ক্যাটাগরি ফিল্টার URL-এর query string-এ থাকে, তাই ফিল্টার করা ভিউ শেয়ার বা বুকমার্ক করা যায় এবং ল্যান্ডিং পেজ সরাসরি কোনো ক্যাটাগরিতে লিংক করতে পারে।',
  },
  {
    id: 'F17', title: 'Customer CRM & rental history', owner: 'M2', sprint: 4,
    files: ['server/src/customerUtils.js', 'server/src/routes/customers.js', 'client/src/pages/Customers.jsx'],
    en: 'Customers are identified by email, because the public booking form lets the same person spell their name differently each time. Each customer gets a tier (VIP / Regular / New) from lifetime spend and rental count, and a reliability score — the share of completed rentals returned with no late fee and no penalty.',
    bn: 'কাস্টমার চেনা হয় ইমেইল দিয়ে, কারণ পাবলিক বুকিং ফর্মে একই ব্যক্তি প্রতিবার নাম ভিন্নভাবে লিখতে পারে। প্রত্যেক কাস্টমার আজীবন খরচ ও ভাড়ার সংখ্যা থেকে একটি স্তর পায় (VIP / Regular / New), আর একটি নির্ভরযোগ্যতা স্কোর — সম্পন্ন ভাড়ার কত অংশ লেট ফি ও পেনাল্টি ছাড়া ফেরত এসেছে।',
  },
  {
    id: 'F18', title: 'Maintenance & repair log', owner: 'M4', sprint: 4,
    files: ['server/src/maintenanceUtils.js', 'server/src/routes/maintenance.js', 'client/src/pages/Maintenance.jsx'],
    en: 'A repair job records parts cost, labour cost and status. While any job on an item is Open or In Progress the item is forced to Under Maintenance so it cannot be rented; when the last job closes it returns to Available — unless it is currently Rented, in which case the booking lifecycle owns the status and maintenance leaves it alone.',
    bn: 'একটি মেরামত কাজে যন্ত্রাংশের খরচ, শ্রম খরচ ও স্ট্যাটাস থাকে। কোনো আইটেমের কোনো কাজ Open বা In Progress থাকলে আইটেমটি বাধ্যতামূলকভাবে Under Maintenance হয়ে যায় যাতে ভাড়া দেওয়া না যায়; শেষ কাজটি বন্ধ হলে আবার Available হয় — তবে যদি সেটি তখন Rented থাকে, তাহলে বুকিং লাইফসাইকেলই স্ট্যাটাসের মালিক এবং মেইনটেন্যান্স হাত দেয় না।',
  },
  {
    id: 'F19', title: 'Revenue & utilization analytics', owner: 'M1', sprint: 4,
    files: ['server/src/analyticsUtils.js', 'server/src/routes/analytics.js', 'client/src/components/Charts.jsx'],
    en: 'Revenue for a booking = day rate × days + late fee + penalty; the deposit is excluded because it is refundable. Utilization = booked days ÷ available days, with bookings clipped to the reporting window so a rental that started before the period is only counted for its overlapping part. The charts are hand-written SVG, not a chart library.',
    bn: 'একটি বুকিংয়ের রেভিনিউ = দৈনিক ভাড়া × দিন + লেট ফি + পেনাল্টি; ডিপোজিট বাদ, কারণ তা ফেরতযোগ্য। ইউটিলাইজেশন = ভাড়ায় থাকা দিন ÷ পাওয়া যেত এমন দিন, এবং বুকিংগুলো রিপোর্টের সময়সীমায় কেটে নেওয়া হয় যাতে আগে শুরু হওয়া ভাড়া কেবল তার ওভারল্যাপ করা অংশটুকুই গোনা হয়। চার্টগুলো হাতে লেখা SVG, কোনো চার্ট লাইব্রেরি নয়।',
  },
  {
    id: 'F21', title: 'NID verification for damage control', owner: 'M4', sprint: 4,
    files: ['server/src/schema_profile.sql', 'server/src/profileUtils.js', 'server/src/routes/profile.js', 'client/src/components/NidForm.jsx'],
    en: 'Before a member can request their first booking they must put a National ID on file: the name on the card, a 10/13/17-digit NID number, and a photo of the card. Without a verified identity a damage penalty is unenforceable, so this is the foundation of damage control. It is collected exactly once — the API refuses to overwrite it, a database trigger blocks the UPDATE, and the UI stops showing the form. The number is stored in full but only ever sent back masked to the last four digits, and a partial unique index stops the same NID backing two accounts.',
    bn: 'কোনো সদস্য প্রথম বুকিং অনুরোধ করার আগে অবশ্যই একটি জাতীয় পরিচয়পত্র জমা দিতে হবে: কার্ডে লেখা নাম, ১০/১৩/১৭ সংখ্যার NID নম্বর, এবং কার্ডের ছবি। যাচাই করা পরিচয় ছাড়া ক্ষতিপূরণ আদায় করা যায় না, তাই এটিই damage control-এর ভিত্তি। এটি ঠিক একবারই নেওয়া হয় — API পরিবর্তন করতে দেয় না, ডেটাবেজ ট্রিগার UPDATE আটকায়, আর UI ফর্মটি আর দেখায় না। নম্বরটি সম্পূর্ণ জমা থাকে কিন্তু ব্রাউজারে সবসময় শেষ চার সংখ্যা ছাড়া ঢেকে পাঠানো হয়, এবং একটি partial unique index একই NID দুই অ্যাকাউন্টে ব্যবহার হওয়া ঠেকায়।',
  },
  {
    id: 'F22', title: 'User profile & permanent payment methods', owner: 'M4', sprint: 4,
    files: ['client/src/pages/Profile.jsx', 'client/src/components/PaymentMethods.jsx', 'server/src/routes/profile.js'],
    en: 'Every account — member, staff or admin — has a profile showing account details, the verified NID, payment methods and an activity summary (listings owned, rentals taken, requests received, fees paid). Payment methods are append-only and permanent: there is no DELETE endpoint, the route that would delete returns 405, and a database trigger raises an exception on DELETE. A second trigger freezes the money details so a method cannot be "removed" by blanking what it points at; only is_default and is_active may change. The account number is masked before it is stored, so RentalFlow never holds a full card or wallet number.',
    bn: 'প্রতিটি অ্যাকাউন্টের — সদস্য, স্টাফ বা অ্যাডমিন — একটি প্রোফাইল আছে যেখানে অ্যাকাউন্টের তথ্য, যাচাইকৃত NID, পেমেন্ট মেথড এবং কার্যকলাপের সারসংক্ষেপ (নিজের লিস্টিং, নেওয়া ভাড়া, পাওয়া অনুরোধ, দেওয়া ফি) দেখা যায়। পেমেন্ট মেথড কেবল যোগ করা যায় এবং স্থায়ী: কোনো DELETE এন্ডপয়েন্ট নেই, যে রুটটি মুছত সেটি 405 ফেরত দেয়, এবং একটি ডেটাবেজ ট্রিগার DELETE-এ exception ছোঁড়ে। দ্বিতীয় একটি ট্রিগার টাকার তথ্য জমাট করে রাখে যাতে ফাঁকা করে দিয়ে "মুছে ফেলা" না যায়; কেবল is_default ও is_active বদলানো যায়। অ্যাকাউন্ট নম্বর জমা রাখার আগেই ঢেকে দেওয়া হয়, তাই RentalFlow কখনো সম্পূর্ণ কার্ড বা ওয়ালেট নম্বর রাখে না।',
  },
  {
    id: 'F23', title: 'Renter identity check before approval', owner: 'M4', sprint: 4,
    files: ['server/src/routes/bookings.js', 'client/src/components/RenterModal.jsx'],
    en: 'Before approving or rejecting a request, the item owner (and an admin or staff) can open the renter and see who is actually behind it: the verified National ID with its card photos, whether the booking email belongs to a real account, and the renter’s track record — rentals taken, reliability, and any late fees or penalties they have been charged. It also flags a mismatch between the name they booked under and the name on the NID. Authorisation reuses the exact same rule as making the decision (canDecide), so a member cannot look up the identity of someone who booked a different member’s item. Because reading an identity is sensitive, this GET is written to the audit log — unusual, since the audit middleware normally only records state-changing calls.',
    bn: 'কোনো অনুরোধ অনুমোদন বা প্রত্যাখ্যান করার আগে আইটেমের মালিক (এবং অ্যাডমিন বা স্টাফ) ভাড়াটিয়াকে খুলে দেখতে পারেন আসলে কে আছে: কার্ডের ছবি সহ যাচাইকৃত জাতীয় পরিচয়পত্র, বুকিংয়ের ইমেইলটি সত্যিকারের অ্যাকাউন্টের কিনা, এবং ভাড়াটিয়ার অতীত রেকর্ড — কতবার ভাড়া নিয়েছে, কতটা নির্ভরযোগ্য, এবং কোনো লেট ফি বা জরিমানা হয়েছে কিনা। যে নামে বুকিং করা হয়েছে আর NID-তে লেখা নাম আলাদা হলে সেটিও সতর্ক করে দেয়। অনুমতির নিয়ম হুবহু সিদ্ধান্ত নেওয়ার নিয়মই (canDecide), তাই কোনো সদস্য অন্য সদস্যের আইটেম বুক করা ব্যক্তির পরিচয় দেখতে পারে না। পরিচয় পড়া সংবেদনশীল বলে এই GET-টি অডিট লগে লেখা হয় — যা অস্বাভাবিক, কারণ অডিট মিডলওয়্যার সাধারণত কেবল অবস্থা-পরিবর্তনকারী কল রেকর্ড করে।',
  },
  {
    id: 'F20', title: 'Staff accounts & audit logs', owner: 'M4', sprint: 4,
    files: ['server/src/routes/admin.js', 'server/src/middleware/audit.js', 'server/src/middleware/accountStatus.js'],
    en: 'The admin can create staff accounts, change roles and suspend users. Every state-changing API call is written to an audit_logs row by middleware — who did it, what path, what status code — so the log cannot be forgotten by an individual route author. A suspended account is refused before it reaches any route.',
    bn: 'অ্যাডমিন স্টাফ অ্যাকাউন্ট তৈরি করতে, রোল বদলাতে ও ব্যবহারকারী স্থগিত করতে পারে। অবস্থা-পরিবর্তনকারী প্রতিটি API কল মিডলওয়্যার দিয়ে audit_logs সারিতে লেখা হয় — কে করেছে, কোন পথ, কোন স্ট্যাটাস কোড — তাই কোনো রুট লেখক ভুলে গেলেও লগ বাদ পড়ে না। স্থগিত অ্যাকাউন্ট কোনো রুটে পৌঁছানোর আগেই আটকে যায়।',
  },
];

// ---------------------------------------------------------------------------
// PER-FILE EXPLANATIONS (the important ones; others fall back to the header)
// ---------------------------------------------------------------------------
export const fileNotes = {
  'server/src/db.js': {
    en: 'The single door to the database. It creates ONE connection pool shared by the whole app (Singleton), and exposes query(text, params). Two details worth knowing: it forces DATE columns to come back as plain "YYYY-MM-DD" strings — the default driver builds a JS Date in the server timezone, which shifts booking dates by a day and breaks the calendar; and it turns SSL on automatically for a non-localhost database so the same code works on Docker and on a hosted server.',
    bn: 'ডেটাবেজে যাওয়ার একমাত্র দরজা। এটি পুরো অ্যাপের জন্য একটিমাত্র connection pool বানায় (Singleton), আর query(text, params) দেয়। দুটি বিষয় জানা দরকার: এটি DATE কলামকে সাধারণ "YYYY-MM-DD" স্ট্রিং হিসেবে ফেরত আনতে বাধ্য করে — ডিফল্ট ড্রাইভার সার্ভারের টাইমজোনে JS Date বানায়, যা বুকিংয়ের তারিখ একদিন সরিয়ে দেয় ও ক্যালেন্ডার ভাঙে; আর localhost না হলে স্বয়ংক্রিয়ভাবে SSL চালু করে যাতে একই কোড Docker ও হোস্টেড সার্ভার দুই জায়গায় চলে।',
  },
  'server/src/bookingUtils.js': {
    en: 'The money and rules brain of the project, and the file most likely to be asked about. It is pure — no database, no HTTP — which is exactly why it can be unit tested. It holds: calculateDeposit (20% of replacement cost), calculateLateFee (10% of day rate per overdue day), overdueDays (derived from the end date, never typed in), calculatePenalty (severity% + repair + missing, capped at replacement cost), buildBill (the final settlement) and hasDateOverlap (the one-line conflict rule).',
    bn: 'প্রজেক্টের টাকা ও নিয়মের মস্তিষ্ক, এবং সবচেয়ে বেশি জিজ্ঞাসিত হওয়ার সম্ভাবনা যে ফাইলের। এটি বিশুদ্ধ — ডেটাবেজ নেই, HTTP নেই — ঠিক এজন্যই ইউনিট টেস্ট করা যায়। এতে আছে: calculateDeposit (প্রতিস্থাপন মূল্যের ২০%), calculateLateFee (প্রতি বিলম্বিত দিনে দৈনিক ভাড়ার ১০%), overdueDays (শেষ তারিখ থেকে বের করা, টাইপ করা নয়), calculatePenalty (severity% + মেরামত + হারানো, প্রতিস্থাপন মূল্যে সীমাবদ্ধ), buildBill (চূড়ান্ত হিসাব) এবং hasDateOverlap (এক লাইনের কনফ্লিক্ট নিয়ম)।',
  },
  'server/src/middleware/auth.js': {
    en: 'Two guards. authRequired reads the "Bearer <token>" header, verifies the JWT signature with JWT_SECRET, and hangs the decoded user on req.user for later handlers. requireRole("admin") is a higher-order function: you call it with roles and it RETURNS a middleware, which is how one function serves every role check in the app.',
    bn: 'দুটি গার্ড। authRequired "Bearer <token>" হেডার পড়ে, JWT_SECRET দিয়ে স্বাক্ষর যাচাই করে, এবং ডিকোড করা ব্যবহারকারীকে req.user-এ বসিয়ে দেয় পরের হ্যান্ডলারদের জন্য। requireRole("admin") একটি higher-order ফাংশন: আপনি রোল দিয়ে ডাকেন আর এটি একটি middleware ফেরত দেয় — এভাবেই একটি ফাংশন পুরো অ্যাপের সব রোল যাচাই সামলায়।',
  },
  'client/src/api.js': {
    en: 'A small facade over fetch. It reads the JWT from localStorage, attaches it as an Authorization header, parses JSON and throws a real Error on failure so pages can just try/catch. One subtle behaviour: on a 401 it only logs you out if you HAD a token — otherwise a wrong password on the login page would bounce you around instead of showing the error.',
    bn: 'fetch-এর উপর একটি ছোট facade। এটি localStorage থেকে JWT পড়ে, Authorization হেডারে যোগ করে, JSON পার্স করে এবং ব্যর্থ হলে সত্যিকারের Error ছুঁড়ে দেয় যাতে পেজগুলো শুধু try/catch করতে পারে। একটি সূক্ষ্ম আচরণ: 401 পেলে এটি কেবল তখনই লগআউট করে যখন আপনার টোকেন ছিল — নইলে লগইন পেজে ভুল পাসওয়ার্ড দিলে এরর না দেখিয়ে ঘোরাঘুরি করাত।',
  },
  'client/src/auth.jsx': {
    en: 'The session, held in a React Context so any page can read it without prop drilling. decodeUser() reads the user straight out of the JWT payload (the middle base64 segment) instead of making an extra API call on every page load. Note this is only for DISPLAY — the server never trusts it and always re-verifies the signature.',
    bn: 'সেশন, React Context-এ রাখা যাতে যেকোনো পেজ prop drilling ছাড়াই পড়তে পারে। decodeUser() প্রতিবার পেজ লোডে বাড়তি API কল না করে সরাসরি JWT payload (মাঝের base64 অংশ) থেকে ব্যবহারকারী পড়ে। খেয়াল রাখবেন এটি কেবল দেখানোর জন্য — সার্ভার কখনো এটিকে বিশ্বাস করে না, সবসময় স্বাক্ষর আবার যাচাই করে।',
  },
  'server/src/middleware/audit.js': {
    en: 'F20\'s audit trail. It hooks the response instead of the request, so it can record the final status code — that is how a REJECTED action (403, 400) still gets logged. Because it is registered once with app.use("/api", …), no individual route author can forget to log.',
    bn: 'F20-এর অডিট ট্রেইল। এটি রিকোয়েস্ট নয়, রেসপন্সে হুক করে, যাতে চূড়ান্ত স্ট্যাটাস কোড রেকর্ড করতে পারে — এভাবেই প্রত্যাখ্যাত কাজও (403, 400) লগ হয়। যেহেতু এটি একবারই app.use("/api", …) দিয়ে যোগ করা, কোনো রুট লেখক লগ করতে ভুলতে পারে না।',
  },
  'client/src/money.js': {
    en: 'One place that formats Taka. It uses the en-IN locale to get Bangladeshi/Indian digit grouping (1,67,120 rather than 167,120). moneyAscii() exists because jsPDF\'s built-in Helvetica has no glyph for ৳ — printing it would produce an empty box — so PDFs use "BDT" instead.',
    bn: 'টাকা ফরম্যাট করার একমাত্র জায়গা। এটি en-IN লোকেল ব্যবহার করে বাংলাদেশি/ভারতীয় অঙ্ক বিভাজন পেতে (167,120 নয়, 1,67,120)। moneyAscii() আছে কারণ jsPDF-এর অন্তর্নির্মিত Helvetica ফন্টে ৳ চিহ্নের গ্লিফ নেই — ছাপলে খালি বাক্স আসত — তাই PDF-এ "BDT" ব্যবহার হয়।',
  },
  'server/src/app.js': {
    en: 'Builds the Express app but deliberately does NOT call listen(). That one decision is what lets the same code run as a normal server locally (index.js calls listen) and as a Vercel serverless function (api/index.js just exports it). It also registers the middleware chain in order and ends with a JSON 404 and a catch-all error handler.',
    bn: 'Express অ্যাপ তৈরি করে কিন্তু ইচ্ছাকৃতভাবে listen() ডাকে না। এই একটি সিদ্ধান্তের কারণেই একই কোড লোকালি সাধারণ সার্ভার হিসেবে (index.js listen ডাকে) এবং Vercel serverless ফাংশন হিসেবে (api/index.js শুধু export করে) চলে। এটি middleware শৃঙ্খলও ক্রমানুসারে যোগ করে এবং JSON 404 ও সর্বশেষ error handler দিয়ে শেষ হয়।',
  },
  'client/src/App.jsx': {
    en: 'Routing and the two navigation shells. PublicShell is the slim header for marketing pages; AppShell is the sidebar workspace for signed-in users. RequireAuth and RequireAdmin are route guards — they redirect instead of rendering, so a member who types /admin lands on the dashboard rather than seeing a blank page.',
    bn: 'রাউটিং এবং দুটি নেভিগেশন শেল। PublicShell হলো মার্কেটিং পেজের সরু হেডার; AppShell হলো লগইন করা ব্যবহারকারীর সাইডবার ওয়ার্কস্পেস। RequireAuth ও RequireAdmin হলো route guard — এরা render না করে redirect করে, তাই কোনো সদস্য /admin লিখলে ফাঁকা পেজ না দেখে ড্যাশবোর্ডে চলে যায়।',
  },
  'server/src/schema.sql': {
    en: 'The whole data model in one file, with the constraints that protect it: CHECK constraints pin status values to a legal list, UNIQUE stops duplicate serial numbers and QR tokens, ON DELETE CASCADE cleans up children, and UNIQUE (booking_id, phase) guarantees exactly one condition report per phase. Constraints in the database mean a bug in a route still cannot corrupt the data.',
    bn: 'পুরো ডেটা মডেল এক ফাইলে, সাথে তা রক্ষাকারী constraint: CHECK constraint স্ট্যাটাসকে বৈধ তালিকায় বেঁধে রাখে, UNIQUE একই সিরিয়াল নম্বর ও QR টোকেন আটকায়, ON DELETE CASCADE সন্তান সারি মুছে দেয়, আর UNIQUE (booking_id, phase) প্রতি পর্যায়ে ঠিক একটি কন্ডিশন রিপোর্ট নিশ্চিত করে। ডেটাবেজে constraint থাকার মানে রুটে বাগ থাকলেও ডেটা নষ্ট হবে না।',
  },
};

// ---------------------------------------------------------------------------
// CO-AUTHORED FILES
// Some files carry features from more than one member. If the examiner points at
// one of these and asks "who wrote this?", the answer is per FUNCTION, not per
// file. Know your own rows here — this is the easiest place to get caught out.
// ---------------------------------------------------------------------------
export const sharedFiles = {
  'server/src/bookingUtils.js': {
    en: 'The shared rules module. Four of the twenty features land in this one file, so three of us contributed to it.',
    bn: 'ভাগ করা নিয়মের মডিউল। বিশটি ফিচারের চারটি এই এক ফাইলে পড়ে, তাই আমরা তিনজন এতে অবদান রেখেছি।',
    parts: [
      { who: 'M2', what: 'hasDateOverlap()', feat: 'F7', en: 'The booking conflict rule.', bn: 'বুকিং কনফ্লিক্টের নিয়ম।' },
      { who: 'M3', what: 'calculateDeposit()', feat: 'F9', en: '20% of replacement cost.', bn: 'প্রতিস্থাপন মূল্যের ২০%।' },
      { who: 'M3', what: 'calculateLateFee(), overdueDays()', feat: 'F10', en: '10% of the day rate per overdue day, with the overdue count derived by the server.', bn: 'প্রতি বিলম্বিত দিনে দৈনিক ভাড়ার ১০%, বিলম্বের দিন সার্ভার নিজেই বের করে।' },
      { who: 'M4', what: 'SEVERITY, severityPct(), calculatePenalty()', feat: 'F14', en: 'Damage penalty from the return condition, capped at the replacement cost.', bn: 'ফেরতের অবস্থা থেকে ক্ষতিপূরণ, প্রতিস্থাপন মূল্যে সীমাবদ্ধ।' },
      { who: 'M3', what: 'buildBill(), daysBetween()', feat: 'F9/F10', en: 'The final settlement: deposit reconciled against late fee and penalty.', bn: 'চূড়ান্ত হিসাব: লেট ফি ও পেনাল্টির সাথে ডিপোজিট মেলানো।' },
    ],
  },
  'server/src/routes/bookings.js': {
    en: 'The largest route file, because the whole booking lifecycle passes through it. Split by endpoint.',
    bn: 'সবচেয়ে বড় রুট ফাইল, কারণ পুরো বুকিং লাইফসাইকেল এর মধ্য দিয়ে যায়। এন্ডপয়েন্ট অনুযায়ী ভাগ করা।',
    parts: [
      { who: 'M2', what: 'POST /, GET /, PATCH /:id, PATCH /:id/status', feat: 'F6/F7/F8', en: 'Create a booking with overlap checking, list and filter, modify, and the approve/reject/cancel permission rules.', bn: 'ওভারল্যাপ যাচাই সহ বুকিং তৈরি, তালিকা ও ফিল্টার, পরিবর্তন, এবং অনুমোদন/প্রত্যাখ্যান/বাতিলের অনুমতির নিয়ম।' },
      { who: 'M3', what: 'POST /:id/late-fee, POST+GET /:id/agreement, GET /:id/bill', feat: 'F10/F11', en: 'Auto-calculated late fee, agreement generation and numbering, and the bill endpoint.', bn: 'স্বয়ংক্রিয় লেট ফি, চুক্তি তৈরি ও নম্বর প্রদান, এবং বিল এন্ডপয়েন্ট।' },
      { who: 'M3', what: 'POST /:id/checkout, POST /:id/checkin', feat: 'F12', en: 'The check-out and check-in transitions.', bn: 'চেক-আউট ও চেক-ইন পরিবর্তন।' },
      { who: 'M4', what: 'condition-report writes, penalty application', feat: 'F13/F14', en: 'Storing the two condition reports and applying the resulting penalty to the booking.', bn: 'দুটি কন্ডিশন রিপোর্ট জমা রাখা এবং তার ফলে আসা পেনাল্টি বুকিংয়ে প্রয়োগ করা।' },
    ],
  },
  'client/src/pages/Bookings.jsx': {
    en: 'The bookings management screen, showing every stage of the lifecycle in one card.',
    bn: 'বুকিং ব্যবস্থাপনার পর্দা, একটি কার্ডে লাইফসাইকেলের প্রতিটি ধাপ দেখায়।',
    parts: [
      { who: 'M2', what: 'list, filters, status dropdown', feat: 'F8', en: 'Loading bookings and driving the status transitions.', bn: 'বুকিং লোড করা ও স্ট্যাটাস পরিবর্তন চালানো।' },
      { who: 'M3', what: 'Agreement PDF, Return summary PDF, Auto-calc late fee buttons', feat: 'F10/F11/F15', en: 'The document and money actions.', bn: 'দলিল ও টাকা সংক্রান্ত কাজ।' },
    ],
  },
  'client/src/pages/Checkout.jsx': {
    en: 'One form serves both check-out and check-in; the `mode` prop switches it.',
    bn: 'একটি ফর্মই চেক-আউট ও চেক-ইন দুটোতেই কাজ করে; `mode` prop দিয়ে বদলায়।',
    parts: [
      { who: 'M4', what: 'the condition report fields + photo upload', feat: 'F13', en: 'Condition, notes, scratches, missing accessories, photos.', bn: 'অবস্থা, নোট, দাগ, হারানো অ্যাকসেসরি, ছবি।' },
      { who: 'M4', what: 'repair cost + missing charge inputs', feat: 'F14', en: 'The two numbers that feed the penalty calculation at check-in.', bn: 'চেক-ইনে পেনাল্টি হিসাবে যাওয়া দুটি সংখ্যা।' },
      { who: 'M3', what: 'the settlement table + return summary PDF', feat: 'F15', en: 'Showing the final bill and offering the PDF.', bn: 'চূড়ান্ত বিল দেখানো ও PDF দেওয়া।' },
    ],
  },
  'client/src/components/QrModal.jsx': {
    en: 'Renders an item\'s QR code for printing.',
    bn: 'প্রিন্ট করার জন্য আইটেমের QR কোড দেখায়।',
    parts: [
      { who: 'M1', what: 'the qr_token fetch and QR image generation', feat: 'F4', en: 'Turns the item token into a scannable image.', bn: 'আইটেম টোকেনকে স্ক্যানযোগ্য ছবিতে রূপান্তর করে।' },
      { who: 'M3', what: 'the scan URL that the QR encodes', feat: 'F12', en: 'The /scan/<token> link the camera opens.', bn: 'ক্যামেরা যে /scan/<token> লিংক খোলে।' },
    ],
  },
  'server/src/schema_notifications.sql': {
    en: 'The notifications table added in Sprint 4.',
    bn: 'Sprint 4-এ যোগ হওয়া notifications টেবিল।',
    parts: [{ who: 'M2', what: 'whole file', feat: 'F8', en: 'Supports the in-app booking notifications.', bn: 'ইন-অ্যাপ বুকিং নোটিফিকেশনকে সমর্থন করে।' }],
  },
  'server/src/bookingUtils.test.js': {
    en: 'Unit tests for the shared rules module — each member tested their own functions.',
    bn: 'ভাগ করা নিয়মের মডিউলের ইউনিট টেস্ট — প্রত্যেকে নিজের ফাংশন টেস্ট করেছে।',
    parts: [
      { who: 'M2', what: 'overlap tests', feat: 'F7', en: 'Including the touching-endpoints case.', bn: 'প্রান্ত স্পর্শ করার ক্ষেত্রটি সহ।' },
      { who: 'M3', what: 'deposit, late fee, overdue and bill tests', feat: 'F9/F10', en: '', bn: '' },
      { who: 'M4', what: 'penalty and severity tests', feat: 'F14', en: '', bn: '' },
    ],
  },
  'client/src/main.jsx': {
    en: 'The React entry point — mounts the app inside the Router and the AuthProvider. Written once during setup.',
    bn: 'React-এর প্রবেশপথ — Router ও AuthProvider-এর ভেতরে অ্যাপ বসায়। সেটআপের সময় একবারই লেখা।',
    parts: [{ who: 'M2', what: 'whole file', feat: '—', en: 'Part of the initial project scaffold.', bn: 'প্রাথমিক প্রজেক্ট কাঠামোর অংশ।' }],
  },
};

// ---------------------------------------------------------------------------
// VIVA QUESTION BANK
// ---------------------------------------------------------------------------
export const qa = [
  {
    cat: 'Process & methodology',
    q: 'Which software process model did you use, and why?',
    en: 'Iterative and Incremental, run as Agile sprints. We had 20 features and a hard need to demo working software every sprint, which Waterfall cannot give you — it delivers only at the end. We ran four sprints; each one produced a complete runnable increment, and we also went back and extended earlier modules (booking was built in Sprint 2 and extended in Sprints 3 and 4), which is the iterative part.',
    bn: 'Iterative and Incremental, Agile sprint হিসেবে চালানো। আমাদের ২০টি ফিচার ছিল এবং প্রতি স্প্রিন্টে চলমান সফটওয়্যার ডেমো দেওয়া বাধ্যতামূলক ছিল, যা Waterfall দিতে পারে না — সেটি কেবল শেষে ডেলিভার করে। আমরা চারটি স্প্রিন্ট চালিয়েছি; প্রতিটি একটি সম্পূর্ণ চলমান increment দিয়েছে, এবং আমরা আগের মডিউলেও ফিরে গিয়ে বাড়িয়েছি (বুকিং Sprint 2-এ বানিয়ে Sprint 3 ও 4-এ বাড়ানো হয়েছে), সেটাই iterative অংশ।',
  },
  {
    cat: 'Process & methodology',
    q: 'What is the difference between iterative and incremental? Give an example from your project.',
    en: 'Incremental means adding new pieces: Sprint 1 gave the catalog, Sprint 2 added booking on top. Iterative means improving a piece you already built: the booking module from Sprint 2 was revisited in Sprint 3 to add owner approval and check-out, and again in Sprint 4. We did both, which is normal for Agile.',
    bn: 'Incremental মানে নতুন অংশ যোগ করা: Sprint 1 ক্যাটালগ দিয়েছে, Sprint 2 তার উপর বুকিং যোগ করেছে। Iterative মানে আগে বানানো অংশ উন্নত করা: Sprint 2-এর বুকিং মডিউলে Sprint 3-এ মালিকের অনুমোদন ও চেক-আউট যোগ হয়েছে, আবার Sprint 4-এ। আমরা দুটোই করেছি, যা Agile-এ স্বাভাবিক।',
  },
  {
    cat: 'Architecture',
    q: 'Describe your software architecture.',
    en: 'Three-tier client–server. Tier 1 is a React SPA that holds no business rules. Tier 2 is an Express REST API, internally layered into middleware, routes (controllers) and pure domain-logic modules. Tier 3 is PostgreSQL, reached only through db.js using hand-written parameterised SQL — no ORM. Each layer only calls the layer directly below it.',
    bn: 'তিন-স্তরের ক্লায়েন্ট–সার্ভার। স্তর ১ একটি React SPA যাতে কোনো ব্যবসায়িক নিয়ম নেই। স্তর ২ একটি Express REST API, ভেতরে middleware, routes (controller) ও বিশুদ্ধ domain-logic মডিউলে স্তরায়িত। স্তর ৩ PostgreSQL, কেবল db.js দিয়ে হাতে লেখা parameterised SQL-এ পৌঁছানো যায় — ORM নেই। প্রতিটি স্তর কেবল ঠিক নিচের স্তরকে ডাকে।',
  },
  {
    cat: 'Architecture',
    q: 'Is this MVC?',
    en: 'The backend maps onto MVC — routes are the Controller, schema.sql plus db.js plus the Utils modules are the Model, and the JSON response plus the React pages are the View. But strictly, classic MVC has the View observing the Model directly, and ours are separate processes talking over HTTP. And React itself is component-based with unidirectional data flow, not MVC. So the precise answer is: layered three-tier architecture whose backend layers map onto MVC.',
    bn: 'ব্যাকএন্ড MVC-তে মেলে — routes হলো Controller, schema.sql + db.js + Utils হলো Model, আর JSON রেসপন্স ও React পেজ হলো View। তবে কঠোরভাবে বললে ক্লাসিক MVC-তে View সরাসরি Model পর্যবেক্ষণ করে, আর আমাদের দুটি আলাদা প্রসেস HTTP-তে কথা বলে। এছাড়া React নিজে কম্পোনেন্ট-ভিত্তিক, একমুখী ডেটা প্রবাহ সহ, MVC নয়। তাই সঠিক উত্তর: স্তরভিত্তিক তিন-স্তর আর্কিটেকচার, যার ব্যাকএন্ড স্তরগুলো MVC-তে ম্যাপ করে।',
  },
  {
    cat: 'Architecture',
    q: 'Why did you separate the *Utils.js files from the routes?',
    en: 'So the business rules can be tested without a database or a running server. calculateDeposit, calculatePenalty, utilizationRate and the CRM scoring are pure functions — same input, same output, no side effects — which is why we have 35 unit tests that run in about 130 milliseconds. If that logic lived inside the route handlers we would need a live database and HTTP requests to test any of it.',
    bn: 'যাতে ডেটাবেজ বা চলমান সার্ভার ছাড়াই ব্যবসায়িক নিয়ম টেস্ট করা যায়। calculateDeposit, calculatePenalty, utilizationRate ও CRM স্কোরিং বিশুদ্ধ ফাংশন — একই ইনপুটে একই আউটপুট, কোনো পার্শ্বপ্রতিক্রিয়া নেই — এজন্যই আমাদের ৩৫টি ইউনিট টেস্ট প্রায় ১৩০ মিলিসেকেন্ডে চলে। ঐ লজিক রুটের ভেতরে থাকলে যেকোনো টেস্টের জন্য চালু ডেটাবেজ ও HTTP রিকোয়েস্ট লাগত।',
  },
  {
    cat: 'Logic',
    q: 'How do you detect a booking conflict? Why strict < and > instead of <= and >=?',
    en: 'Two ranges overlap when newStart < existingEnd AND newEnd > existingStart. We use strict comparisons on purpose: with <= and >=, a booking ending on the 10th would block a new booking starting on the 10th. In equipment rental the item is returned and re-rented the same day, so touching endpoints must be allowed. The check runs as SQL on the server, not only in the browser, because a user could bypass the UI and POST directly.',
    bn: 'দুটি সময়সীমা ওভারল্যাপ করে যখন newStart < existingEnd এবং newEnd > existingStart। আমরা ইচ্ছাকৃতভাবে কঠোর তুলনা ব্যবহার করি: <= ও >= হলে ১০ তারিখে শেষ হওয়া বুকিং ১০ তারিখে শুরু হওয়া নতুন বুকিং আটকে দিত। যন্ত্রপাতি ভাড়ায় একই দিনে ফেরত এসে আবার ভাড়া যায়, তাই স্পর্শকারী প্রান্ত অনুমোদিত হতে হবে। যাচাইটি সার্ভারে SQL হিসেবে চলে, শুধু ব্রাউজারে নয়, কারণ ব্যবহারকারী UI এড়িয়ে সরাসরি POST করতে পারে।',
  },
  {
    cat: 'Logic',
    q: 'Walk me through the penalty calculation.',
    en: 'penalty = severity% × replacement cost + repair cost + missing-accessory charge, then capped at the replacement cost and floored at zero. Severity is a lookup table on the return condition: New 0%, Good 0%, Fair 5%, Poor 15%, Damaged 30%. The cap is the important design decision — no matter what numbers a staff member types, a customer can never be charged more than the item is worth.',
    bn: 'পেনাল্টি = severity% × প্রতিস্থাপন মূল্য + মেরামত খরচ + হারানো অ্যাকসেসরির চার্জ, তারপর সর্বোচ্চ প্রতিস্থাপন মূল্যে সীমাবদ্ধ এবং সর্বনিম্ন শূন্য। Severity হলো ফেরতের অবস্থার একটি lookup table: New ০%, Good ০%, Fair ৫%, Poor ১৫%, Damaged ৩০%। সীমাটিই গুরুত্বপূর্ণ ডিজাইন সিদ্ধান্ত — কর্মী যত সংখ্যাই লিখুক, কাস্টমারকে আইটেমের মূল্যের বেশি চার্জ করা যাবে না।',
  },
  {
    cat: 'Logic',
    q: 'Why is the deposit not counted as revenue?',
    en: 'A deposit is a refundable hold, not income — it is returned to the customer minus any late fee or penalty. Counting it as revenue would inflate the earnings figures and then have to be reversed on every return. So bookingRevenue() sums the rental plus late fee plus penalty and deliberately excludes the deposit, and the analytics page shows deposits held as a separate tile labelled "not counted as revenue".',
    bn: 'ডিপোজিট একটি ফেরতযোগ্য জামানত, আয় নয় — লেট ফি বা পেনাল্টি বাদ দিয়ে কাস্টমারকে ফেরত দেওয়া হয়। একে রেভিনিউ ধরলে আয়ের হিসাব ফুলে যেত এবং প্রতিটি ফেরতে তা উল্টাতে হতো। তাই bookingRevenue() ভাড়া + লেট ফি + পেনাল্টি যোগ করে এবং ইচ্ছাকৃতভাবে ডিপোজিট বাদ দেয়, আর অ্যানালিটিক্স পেজে ধরে রাখা ডিপোজিট আলাদা টাইলে "রেভিনিউ হিসেবে গোনা হয়নি" লেখা সহ দেখায়।',
  },
  {
    cat: 'Logic',
    q: 'How is utilization calculated, and what is the tricky part?',
    en: 'Utilization = booked days ÷ available days × 100. The tricky part is clipping: a rental that started before the reporting window or ends after it must only count for the overlapping portion, otherwise a long booking could push utilization above 100%. We clip each booking to the window before summing, and also cap the result at 100. For the whole fleet, capacity is window length × number of items.',
    bn: 'ইউটিলাইজেশন = ভাড়ায় থাকা দিন ÷ পাওয়া যেত এমন দিন × ১০০। কঠিন অংশ হলো clipping: রিপোর্টের সময়সীমার আগে শুরু বা পরে শেষ হওয়া ভাড়া কেবল ওভারল্যাপ করা অংশটুকুই গুনতে হবে, নইলে দীর্ঘ বুকিং ইউটিলাইজেশন ১০০%-এর উপরে নিয়ে যেত। আমরা যোগ করার আগে প্রতিটি বুকিং সময়সীমায় কেটে নিই, এবং ফলাফলও ১০০-তে সীমাবদ্ধ করি। পুরো ফ্লিটের জন্য ক্ষমতা = সময়সীমার দৈর্ঘ্য × আইটেম সংখ্যা।',
  },
  {
    cat: 'Database',
    q: 'Why raw SQL instead of an ORM?',
    en: 'It is a hard course requirement, and it also means we understand exactly what query runs. We protect against SQL injection with parameterised queries — values go in as $1, $2 placeholders and the driver sends them separately from the statement, so a value can never be parsed as SQL. We never build a query by concatenating strings.',
    bn: 'এটি কোর্সের কঠোর শর্ত, এবং এতে আমরা ঠিক কোন কোয়েরি চলছে তা জানি। আমরা parameterised query দিয়ে SQL injection ঠেকাই — মান $1, $2 placeholder হিসেবে যায় এবং ড্রাইভার সেগুলো স্টেটমেন্ট থেকে আলাদা করে পাঠায়, তাই কোনো মান কখনো SQL হিসেবে পড়া হয় না। আমরা কখনো স্ট্রিং জোড়া দিয়ে কোয়েরি বানাই না।',
  },
  {
    cat: 'Database',
    q: 'What database constraints did you use and why?',
    en: 'CHECK constraints pin item status and booking status to a legal list. UNIQUE stops duplicate emails, serial numbers and QR tokens. Foreign keys with ON DELETE CASCADE clean up children when a parent is deleted. And UNIQUE (booking_id, phase) on condition_reports guarantees exactly one report per phase. The point is that these live in the database, so even a buggy route cannot write invalid data.',
    bn: 'CHECK constraint আইটেম ও বুকিং স্ট্যাটাসকে বৈধ তালিকায় বাঁধে। UNIQUE একই ইমেইল, সিরিয়াল নম্বর ও QR টোকেন আটকায়। ON DELETE CASCADE সহ foreign key মূল সারি মুছলে সন্তান সারি পরিষ্কার করে। আর condition_reports-এ UNIQUE (booking_id, phase) প্রতি পর্যায়ে ঠিক একটি রিপোর্ট নিশ্চিত করে। মূল কথা হলো এগুলো ডেটাবেজে থাকে, তাই বাগযুক্ত রুটও অবৈধ ডেটা লিখতে পারে না।',
  },
  {
    cat: 'Database',
    q: 'Explain the relationships in your schema.',
    en: 'users 1—N items (a member owns many listings). categories 1—N items. items N—M tags through item_tags. items 1—N item_images, 1—N accessories, 1—N bookings. bookings 1—N condition_reports, but limited to two by the UNIQUE (booking_id, phase) constraint — one at check-out, one at check-in.',
    bn: 'users 1—N items (একজন সদস্যের অনেক লিস্টিং)। categories 1—N items। items N—M tags, item_tags-এর মাধ্যমে। items 1—N item_images, 1—N accessories, 1—N bookings। bookings 1—N condition_reports, তবে UNIQUE (booking_id, phase) constraint দিয়ে দুইটিতে সীমাবদ্ধ — একটি চেক-আউটে, একটি চেক-ইনে।',
  },
  {
    cat: 'Security',
    q: 'How does authentication work?',
    en: 'On signup the password is hashed with bcrypt (a slow, salted hash) and only the hash is stored — we can never read a user\'s password. On login we compare the submitted password against the hash and, if it matches, sign a JWT containing the user id, name, email and role. The client stores that token and sends it as an Authorization: Bearer header. The server verifies the signature on every protected request.',
    bn: 'সাইনআপে পাসওয়ার্ড bcrypt দিয়ে হ্যাশ হয় (ধীর, salted হ্যাশ) এবং কেবল হ্যাশটি জমা থাকে — আমরা কখনো ব্যবহারকারীর পাসওয়ার্ড পড়তে পারি না। লগইনে জমা দেওয়া পাসওয়ার্ড হ্যাশের সাথে মেলানো হয় এবং মিললে ব্যবহারকারীর id, নাম, ইমেইল ও রোল সহ একটি JWT স্বাক্ষর করা হয়। ক্লায়েন্ট সেই টোকেন রেখে Authorization: Bearer হেডারে পাঠায়। সার্ভার প্রতিটি সুরক্ষিত রিকোয়েস্টে স্বাক্ষর যাচাই করে।',
  },
  {
    cat: 'Security',
    q: 'The client decodes the JWT to show the user\'s name. Isn\'t that insecure?',
    en: 'Good question — it would be if we trusted it for authorisation, but we do not. The client decodes the payload only to display a name and decide which menu items to show. Every actual permission decision happens on the server, which re-verifies the signature with the secret. A user can edit their local token to say "admin" and the UI would show the admin link, but the API would reject the request with 403.',
    bn: 'ভালো প্রশ্ন — অনুমোদনের জন্য বিশ্বাস করলে অনিরাপদ হতো, কিন্তু আমরা করি না। ক্লায়েন্ট payload ডিকোড করে শুধু নাম দেখাতে ও কোন মেনু দেখাবে তা ঠিক করতে। প্রকৃত অনুমতির সিদ্ধান্ত সবসময় সার্ভারে হয়, যা secret দিয়ে স্বাক্ষর আবার যাচাই করে। কেউ নিজের টোকেন এডিট করে "admin" লিখলে UI-তে অ্যাডমিন লিংক দেখা যাবে, কিন্তু API 403 দিয়ে রিকোয়েস্ট ফিরিয়ে দেবে।',
  },
  {
    cat: 'Security',
    q: 'How do you stop one member editing another member\'s listing?',
    en: 'A requireOwnerOrAdmin middleware runs before the edit and delete routes. It loads the item, compares its owner_id with req.user.id from the verified token, and allows the request only if they match or the caller is an admin. It is server-side, so hiding the Edit button in the UI is a convenience, not the security boundary.',
    bn: 'edit ও delete রুটের আগে requireOwnerOrAdmin middleware চলে। এটি আইটেম লোড করে, যাচাইকৃত টোকেন থেকে পাওয়া req.user.id-র সাথে owner_id মেলায়, এবং কেবল মিললে বা কলার অ্যাডমিন হলে অনুমতি দেয়। এটি সার্ভার-সাইড, তাই UI-তে Edit বোতাম লুকানো কেবল সুবিধা, নিরাপত্তার সীমানা নয়।',
  },
  {
    cat: 'Testing',
    q: 'How did you test the project?',
    en: 'We have 35 unit tests on the pure business logic, run with the built-in Node test runner (npm test in server/). They cover deposits, late fees, overdue days, penalties, the final bill, date overlap, utilization, revenue, CRM tiers and reliability, maintenance status transitions, document numbering and the booking permission rules. We chose the pure functions to unit test because they hold the rules most likely to be wrong and they need no database.',
    bn: 'আমাদের বিশুদ্ধ ব্যবসায়িক লজিকের উপর ৩৫টি ইউনিট টেস্ট আছে, Node-এর অন্তর্নির্মিত test runner দিয়ে চালানো (server/-এ npm test)। এগুলো ডিপোজিট, লেট ফি, বিলম্বের দিন, পেনাল্টি, চূড়ান্ত বিল, তারিখ ওভারল্যাপ, ইউটিলাইজেশন, রেভিনিউ, CRM স্তর ও নির্ভরযোগ্যতা, মেইনটেন্যান্স স্ট্যাটাস পরিবর্তন, ডকুমেন্ট নম্বর ও বুকিং অনুমতির নিয়ম কভার করে। বিশুদ্ধ ফাংশন বেছেছি কারণ সেখানেই ভুল হওয়ার সম্ভাবনা বেশি এবং ডেটাবেজ লাগে না।',
  },
  {
    cat: 'Testing',
    q: 'What kind of testing is that — unit, integration or system?',
    en: 'Those 35 are unit tests: one function at a time, no database, no network. We did integration and system testing manually — running the full stack and walking each feature end to end through the UI, which is what the sprint demo videos show. We do not have automated integration tests; that would be the honest next step.',
    bn: 'ঐ ৩৫টি হলো unit test: একবারে একটি ফাংশন, ডেটাবেজ নেই, নেটওয়ার্ক নেই। Integration ও system testing আমরা হাতে করেছি — পুরো stack চালিয়ে প্রতিটি ফিচার UI দিয়ে শুরু থেকে শেষ পর্যন্ত পরীক্ষা করে, যা স্প্রিন্ট ডেমো ভিডিওতে দেখা যায়। আমাদের স্বয়ংক্রিয় integration test নেই; সেটাই হবে সৎ পরবর্তী ধাপ।',
  },
  {
    cat: 'Design',
    q: 'Name some design patterns in your code.',
    en: 'Middleware is Chain of Responsibility. The pg Pool is a Singleton. AuthProvider is the Provider/Context pattern, which is dependency injection for React. authRequired and requireOwnerOrAdmin are Guards. The SEVERITY map is a Strategy expressed as a lookup table. api.js is a Facade over fetch. requireRole is a higher-order function that returns a middleware.',
    bn: 'Middleware হলো Chain of Responsibility। pg Pool একটি Singleton। AuthProvider হলো Provider/Context প্যাটার্ন, যা React-এর dependency injection। authRequired ও requireOwnerOrAdmin হলো Guard। SEVERITY ম্যাপ হলো lookup table হিসেবে প্রকাশিত Strategy। api.js হলো fetch-এর উপর Facade। requireRole একটি higher-order ফাংশন যা middleware ফেরত দেয়।',
  },
  {
    cat: 'Design',
    q: 'What are the functional and non-functional requirements?',
    en: 'Functional: the 20 numbered features — catalog, categories, status, QR, accessories, calendar, conflict detection, booking lifecycle, deposits, late fees, agreements, check-out/in, condition reports, penalties, PDF export, public booking, CRM, maintenance, analytics, admin and audit. Non-functional: security (bcrypt, JWT, parameterised SQL, role and ownership checks), usability (responsive from 375px, light and dark themes, keyboard-reachable), reliability (database constraints, unit tests, graceful API errors), maintainability (layered code, one design system, per-member file ownership) and portability (Docker for the database, one config for local and hosted).',
    bn: 'Functional: ২০টি নম্বরযুক্ত ফিচার — ক্যাটালগ, ক্যাটাগরি, স্ট্যাটাস, QR, অ্যাকসেসরি, ক্যালেন্ডার, কনফ্লিক্ট ডিটেকশন, বুকিং লাইফসাইকেল, ডিপোজিট, লেট ফি, চুক্তি, চেক-আউট/ইন, কন্ডিশন রিপোর্ট, পেনাল্টি, PDF এক্সপোর্ট, পাবলিক বুকিং, CRM, মেইনটেন্যান্স, অ্যানালিটিক্স, অ্যাডমিন ও অডিট। Non-functional: নিরাপত্তা (bcrypt, JWT, parameterised SQL, রোল ও মালিকানা যাচাই), ব্যবহারযোগ্যতা (৩৭৫px থেকে responsive, আলো ও অন্ধকার থিম, কীবোর্ডে পৌঁছানো যায়), নির্ভরযোগ্যতা (ডেটাবেজ constraint, ইউনিট টেস্ট, ভদ্র API এরর), রক্ষণাবেক্ষণযোগ্যতা (স্তরভিত্তিক কোড, একটি ডিজাইন সিস্টেম, সদস্যপ্রতি ফাইল মালিকানা) ও বহনযোগ্যতা (ডেটাবেজের জন্য Docker, লোকাল ও হোস্টেডের জন্য এক কনফিগ)।',
  },
  {
    cat: 'Design',
    q: 'How is coupling and cohesion handled in your design?',
    en: 'High cohesion: each module does one thing — customerUtils only scores customers, maintenanceUtils only handles repair jobs, db.js only talks to Postgres. Low coupling: routes depend on the Utils functions but the Utils know nothing about Express or SQL, so they can be reused or replaced. The client depends only on the REST contract, not on how the server stores anything.',
    bn: 'উচ্চ cohesion: প্রতিটি মডিউল একটি কাজ করে — customerUtils কেবল কাস্টমার স্কোর করে, maintenanceUtils কেবল মেরামতের কাজ সামলায়, db.js কেবল Postgres-এর সাথে কথা বলে। নিম্ন coupling: routes ঐ Utils ফাংশনের উপর নির্ভর করে কিন্তু Utils Express বা SQL সম্পর্কে কিছু জানে না, তাই সেগুলো পুনঃব্যবহার বা প্রতিস্থাপন করা যায়। ক্লায়েন্ট কেবল REST চুক্তির উপর নির্ভর করে, সার্ভার কীভাবে জমা রাখে তার উপর নয়।',
  },
  {
    cat: 'Deployment',
    q: 'How is the project deployed, and what did you have to change?',
    en: 'It deploys to Vercel. The React app builds to static files; the Express app is exported from api/index.js and runs as a serverless function. The key change was splitting app.js (which builds the app) from index.js (which calls listen) — a serverless platform invokes the handler itself and must never call listen. We also added SPA rewrites so refreshing /dashboard does not 404, and made the database layer switch SSL on automatically for a hosted database.',
    bn: 'এটি Vercel-এ ডেপ্লয় হয়। React অ্যাপ static ফাইলে build হয়; Express অ্যাপ api/index.js থেকে export হয়ে serverless function হিসেবে চলে। মূল পরিবর্তন ছিল app.js (যা অ্যাপ বানায়) থেকে index.js (যা listen ডাকে) আলাদা করা — serverless প্ল্যাটফর্ম নিজেই handler ডাকে, listen ডাকা যাবে না। আমরা SPA rewrite-ও যোগ করেছি যাতে /dashboard রিফ্রেশ করলে 404 না আসে, এবং ডেটা স্তরকে হোস্টেড ডেটাবেজের জন্য স্বয়ংক্রিয়ভাবে SSL চালু করতে বলেছি।',
  },
  {
    cat: 'Logic',
    q: 'Why do you collect the NID at booking time rather than at signup?',
    en: 'Because it is only needed by someone who actually takes an item. A person can sign up, browse and list their own equipment without ever renting anything, and demanding a national ID just to look around would cost us users for no benefit. The obligation appears exactly when the risk appears — the moment someone asks to take custody of somebody else\'s property. After that first time the ID lives on the account and the member is never asked again.',
    bn: 'কারণ এটি কেবল তারই দরকার যে আসলে কোনো জিনিস নেয়। একজন সাইন আপ করে, ঘুরে দেখে, নিজের যন্ত্রপাতি তালিকাভুক্ত করতে পারে কখনো ভাড়া না নিয়েই — শুধু দেখার জন্য জাতীয় পরিচয়পত্র চাইলে বিনা লাভে ব্যবহারকারী হারাতাম। ঝুঁকি যেখানে তৈরি হয় বাধ্যবাধকতা ঠিক সেখানেই আসে — যে মুহূর্তে কেউ অন্যের সম্পত্তি নিজের জিম্মায় নিতে চায়। ঐ প্রথমবারের পর পরিচয়পত্রটি অ্যাকাউন্টে থেকে যায় এবং সদস্যকে আর কখনো জিজ্ঞেস করা হয় না।',
  },
  {
    cat: 'Design',
    q: 'How do you guarantee a payment method can never be removed?',
    en: 'In three independent layers, so no single mistake can break the rule. The UI simply never renders a Remove button. The API has no delete handler, and the route that would be one returns 405 with an explanation rather than falling through to a 404. And the database has a BEFORE DELETE trigger that raises an exception, so even a direct DELETE in psql is refused. A second trigger freezes user_id, kind, account_ref and created_at, so the method cannot be neutralised by blanking what it points at — only is_default and is_active may ever change. Deactivating is the intended escape hatch: the method stops being used but the row, and any payment history referencing it, survives.',
    bn: 'তিনটি স্বাধীন স্তরে, যাতে একটি ভুলেও নিয়মটি ভাঙতে না পারে। UI কখনো Remove বোতামই দেখায় না। API-তে কোনো delete হ্যান্ডলার নেই, এবং যে রুটটি হতো সেটি 404-এ না গিয়ে ব্যাখ্যা সহ 405 ফেরত দেয়। আর ডেটাবেজে একটি BEFORE DELETE ট্রিগার exception ছোঁড়ে, তাই psql-এ সরাসরি DELETE দিলেও তা প্রত্যাখ্যাত হয়। দ্বিতীয় একটি ট্রিগার user_id, kind, account_ref ও created_at জমাট করে রাখে, যাতে যা নির্দেশ করছে তা ফাঁকা করে দিয়ে মেথডটি অকেজো করা না যায় — কেবল is_default ও is_active বদলানো যায়। Deactivate করাই উদ্দিষ্ট উপায়: মেথডটি আর ব্যবহার হয় না, কিন্তু সারিটি এবং তার সাথে যুক্ত পেমেন্ট ইতিহাস টিকে থাকে।',
  },
  {
    cat: 'Security',
    q: 'You store the NID number. Isn\'t that a privacy risk?',
    en: 'It is sensitive data, so we treat it that way. The full number is stored because damage control needs it, but it never leaves the server intact — GET /profile returns it masked to the last four digits, so even a stolen session or an open browser console cannot read the whole ID. Every profile route takes the identity from the verified JWT and there is no :userId anywhere in the path, so one member simply cannot address another member\'s record. Payment numbers are handled more strictly still: they are masked before the INSERT, so the full card or wallet number never reaches our database at all.',
    bn: 'এটি সংবেদনশীল তথ্য, তাই সেভাবেই সামলানো হয়। damage control-এর প্রয়োজনে পূর্ণ নম্বরটি জমা থাকে, কিন্তু তা কখনো অক্ষত অবস্থায় সার্ভার ছাড়ে না — GET /profile শেষ চার সংখ্যা ছাড়া ঢেকে ফেরত দেয়, তাই সেশন চুরি গেলে বা ব্রাউজার কনসোল খোলা থাকলেও পুরো পরিচয়পত্র পড়া যায় না। প্রতিটি profile রুট যাচাইকৃত JWT থেকে পরিচয় নেয় এবং পথে কোথাও :userId নেই, তাই এক সদস্য অন্য সদস্যের রেকর্ড ঠিকানা দিয়ে ডাকতেই পারে না। পেমেন্ট নম্বর আরও কড়াভাবে সামলানো হয়: INSERT-এর আগেই ঢেকে দেওয়া হয়, তাই সম্পূর্ণ কার্ড বা ওয়ালেট নম্বর আমাদের ডেটাবেজে কখনো পৌঁছায়ই না।',
  },
  {
    cat: 'Reflection',
    q: 'What would you improve if you had more time?',
    en: 'Three things, honestly. First, image uploads write to local disk, which does not survive on a serverless host — they should go to object storage. Second, we have unit tests but no automated integration tests; the API is verified by hand. Third, notifications are polled every 20 seconds rather than pushed over WebSockets, which is simple but not instant. We would also add pagination — the item and booking lists currently load everything.',
    bn: 'সৎভাবে তিনটি। প্রথমত, ছবি আপলোড লোকাল ডিস্কে লেখে, যা serverless হোস্টে টেকে না — object storage-এ যাওয়া উচিত। দ্বিতীয়ত, আমাদের ইউনিট টেস্ট আছে কিন্তু স্বয়ংক্রিয় integration test নেই; API হাতে যাচাই করা হয়। তৃতীয়ত, নোটিফিকেশন WebSocket দিয়ে push না হয়ে প্রতি ২০ সেকেন্ডে poll হয়, যা সহজ কিন্তু তাৎক্ষণিক নয়। আমরা pagination-ও যোগ করতাম — আইটেম ও বুকিং তালিকা এখন সবকিছু একসাথে লোড করে।',
  },
];

// Files shown in the "read the whole project" browser, in a sensible reading order.
export const readingOrder = [
  { group: 'Database', files: ['server/src/schema.sql', 'server/src/schema_notifications.sql', 'server/src/schema_sprint4.sql', 'server/src/schema_profile.sql', 'server/src/db.js', 'server/src/initDb.js', 'server/src/seed.js', 'server/src/seedSprint4.js', 'server/src/seedProfile.js'] },
  { group: 'Server — app & middleware', files: ['server/src/app.js', 'server/src/index.js', 'api/index.js', 'server/src/middleware/auth.js', 'server/src/middleware/audit.js', 'server/src/middleware/accountStatus.js'] },
  { group: 'Server — business logic (pure, unit tested)', files: ['server/src/bookingUtils.js', 'server/src/analyticsUtils.js', 'server/src/customerUtils.js', 'server/src/documentUtils.js', 'server/src/maintenanceUtils.js', 'server/src/notificationUtils.js', 'server/src/profileUtils.js'] },
  { group: 'Server — routes (controllers)', files: ['server/src/routes/auth.js', 'server/src/routes/items.js', 'server/src/routes/categories.js', 'server/src/routes/uploads.js', 'server/src/routes/bookings.js', 'server/src/routes/scan.js', 'server/src/routes/customers.js', 'server/src/routes/analytics.js', 'server/src/routes/maintenance.js', 'server/src/routes/admin.js', 'server/src/routes/notifications.js', 'server/src/routes/profile.js'] },
  { group: 'Server — tests', files: ['server/src/bookingUtils.test.js', 'server/src/analyticsUtils.test.js', 'server/src/customerUtils.test.js', 'server/src/documentUtils.test.js', 'server/src/maintenanceUtils.test.js', 'server/src/notificationUtils.test.js', 'server/src/profileUtils.test.js'] },
  { group: 'Client — core', files: ['client/src/main.jsx', 'client/src/App.jsx', 'client/src/api.js', 'client/src/auth.jsx', 'client/src/money.js', 'client/src/pdf.js'] },
  { group: 'Client — shared UI', files: ['client/src/components.jsx', 'client/src/icons.jsx', 'client/src/components/Charts.jsx', 'client/src/components/NotificationBell.jsx', 'client/src/components/QrModal.jsx', 'client/src/components/NidForm.jsx', 'client/src/components/PaymentMethods.jsx', 'client/src/components/RenterModal.jsx', 'client/src/styles.css'] },
  { group: 'Client — pages', files: ['client/src/pages/Landing.jsx', 'client/src/pages/Login.jsx', 'client/src/pages/PublicBooking.jsx', 'client/src/pages/Dashboard.jsx', 'client/src/pages/ItemForm.jsx', 'client/src/pages/Bookings.jsx', 'client/src/pages/Checkout.jsx', 'client/src/pages/Scan.jsx', 'client/src/pages/Customers.jsx', 'client/src/pages/Analytics.jsx', 'client/src/pages/Documents.jsx', 'client/src/pages/Maintenance.jsx', 'client/src/pages/Admin.jsx', 'client/src/pages/Profile.jsx'] },
];
