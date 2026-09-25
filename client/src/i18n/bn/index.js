// Bangla dictionary: English phrase → Bangla. Loaded only when a member
// switches the site to বাংলা (see ../../i18n.js).
import shell from './shell.js';
import pages from './pages.js';
import social from './social.js';
import server from './server.js';

const dict = { ...shell, ...pages, ...social, ...server };
export default dict;

// Same lookup, ignoring capitals ("cameras" → "Cameras"), for names the
// server lower-cases inside a sentence.
let lower = null;
const anyCase = (s) => {
  lower ??= Object.fromEntries(Object.entries(dict).map(([k, v]) => [k.toLowerCase(), v]));
  return lower[s.toLowerCase()] ?? s;
};

// English digits → Bangla digits, for numbers inside translated sentences.
const DIGITS = '০১২৩৪৫৬৭৮৯';
export const bnNum = (s) => String(s).replace(/\d/g, (d) => DIGITS[d]);

const plural = (w) => `${w}s?`;

// Text that has a number or a name inside it, e.g. "3h ago" or "Welcome to Cameras!".
export const patterns = [
  [/^(\d+)m ago$/, (m) => `${bnNum(m[1])} মিনিট আগে`],
  [/^(\d+)h ago$/, (m) => `${bnNum(m[1])} ঘণ্টা আগে`],
  [/^(\d+)m$/, (m) => `${bnNum(m[1])} মি.`],
  [/^(\d+)h$/, (m) => `${bnNum(m[1])} ঘ.`],
  [/^(\d+)d$/, (m) => `${bnNum(m[1])} দিন`],
  [/^now$/, () => 'এখন'],
  [/^(\d+) unread notifications$/, (m) => `${bnNum(m[1])}টি না-পড়া নোটিফিকেশন`],
  [/^Saved on the account since (.+)\.$/, (m) => `${m[1]} থেকে অ্যাকাউন্টে সংরক্ষিত।`],
  [/^Their National ID and a live selfie were checked by RentalFlow on (.+)\. For privacy, only admins can see the details\.$/,
    (m) => `তাদের জাতীয় পরিচয়পত্র ও লাইভ সেলফি RentalFlow ${m[1]} তারিখে যাচাই করেছে। গোপনীয়তার জন্য বিস্তারিত শুধু অ্যাডমিনরা দেখতে পারেন।`],
  [/^A National ID has been on file since (.+)\.$/, (m) => `${m[1]} থেকে জাতীয় পরিচয়পত্র জমা আছে।`],
  [/^(.+) added as (member|staff|admin)\.$/, (m) => `${m[1]} যুক্ত হয়েছেন (${{ member: 'সদস্য', staff: 'স্টাফ', admin: 'অ্যাডমিন' }[m[2]]})।`],
  [/^(\d+) in the last 24 hours$/, (m) => `গত ২৪ ঘণ্টায় ${bnNum(m[1])}টি`],
  [/^([▲▼]) ([\d.]+)% vs\. previous period$/, (m) => `${m[1]} আগের সময়ের তুলনায় ${bnNum(m[2])}%`],
  [/^(.+) average per rental$/, (m) => `প্রতি ভাড়ায় গড় ${m[1]}`],
  [/^(\d+) items in the fleet$/, (m) => `মোট ${bnNum(m[1])}টি জিনিস`],
  [/^Booking marked as (\w+)$/, (m) => `বুকিং ${STATUS[m[1]] || m[1]} হিসেবে চিহ্নিত`],
  [/^Late fee applied for (\d+) day\(s\) overdue$/, (m) => `${bnNum(m[1])} দিন দেরির জন্য বিলম্ব ফি ধার্য হয়েছে`],
  [/^(\d+) bookings in total$/, (m) => `মোট ${bnNum(m[1])}টি বুকিং`],
  [/^(\d+)% book more than once$/, (m) => `${bnNum(m[1])}% একাধিকবার বুক করেন`],
  [/^Welcome to (.+)!$/, (m) => `${m[1]}-এ স্বাগতম!`],
  [/^What's on your mind, (.+)\?$/, (m) => `কী ভাবছেন, ${m[1]}?`],
  [/^Joined (\d+) communit(?:y|ies) — your feed is ready$/, (m) => `${bnNum(m[1])}টি কমিউনিটিতে যোগ দিয়েছেন — আপনার ফিড তৈরি`],
  [/^Join (\d+) and build my feed$/, (m) => `${bnNum(m[1])}টিতে যোগ দিয়ে আমার ফিড তৈরি করুন`],
  [/^Checked (\d+) rental\(s\) out with renters; (\d+) moved to a new stage$/, (m) => `ভাড়াটিয়াদের কাছে থাকা ${bnNum(m[1])}টি ভাড়া দেখা হয়েছে; ${bnNum(m[2])}টি নতুন ধাপে গেছে`],
  [/^Job closed — (.+) is back in the rental pool\.$/, (m) => `কাজ শেষ — ${m[1]} আবার ভাড়ার তালিকায় ফিরেছে।`],
  [/^Job marked (.+)\.$/, (m) => `কাজটি ${STATUS[m[1]] || m[1]} হিসেবে চিহ্নিত।`],
  [/^Parts cost for "(.+)"$/, (m) => `"${m[1]}"-এর যন্ত্রাংশের খরচ`],
  [/^(\d+) jobs logged in total$/, (m) => `মোট ${bnNum(m[1])}টি কাজ যুক্ত হয়েছে`],
  [/^(.+) average per job$/, (m) => `প্রতি কাজে গড় ${m[1]}`],
  [/^Report (.+) for asking to deal or pay outside RentalFlow\?$/, (m) => `RentalFlow-এর বাইরে লেনদেন বা টাকা দিতে বলার জন্য ${m[1]}-কে রিপোর্ট করবেন?`],
  [/^Thanks — reported\. \+(\d+) Limes for keeping RentalFlow safe$/, (m) => `ধন্যবাদ — রিপোর্ট করা হয়েছে। RentalFlow নিরাপদ রাখার জন্য +${bnNum(m[1])} লাইমস`],
  [/^(.+) opened a chat about your listing\.$/, (m) => `${m[1]} আপনার লিস্টিং নিয়ে চ্যাট শুরু করেছেন।`],
  [/^Ask (.+) anything about this listing — condition, pickup, dates\.$/, (m) => `এই লিস্টিং নিয়ে ${m[1]}-কে যা খুশি জিজ্ঞেস করুন — অবস্থা, নেওয়ার জায়গা, তারিখ।`],
  [/^Fees on (\d+) bookings not finished yet$/, (m) => `এখনও শেষ না হওয়া ${bnNum(m[1])}টি বুকিংয়ের ফি`],
  [/^(.+) rented through RentalFlow$/, (m) => `RentalFlow-এর মাধ্যমে ${m[1]} ভাড়া হয়েছে`],
  [/^≈ (.+) of paid attention$/, (m) => `≈ ${m[1]} মূল্যের প্রচার`],
  [/^Trained on (\d+) admin decisions? \((\d+) cases in total\)\.$/, (m) => `অ্যাডমিনের ${bnNum(m[1])}টি সিদ্ধান্তে প্রশিক্ষিত (মোট ${bnNum(m[2])}টি ঘটনা)।`],
  [/^Agrees with admins (.+) of the time on cases it was not trained on\.$/, (m) => `যেসব ঘটনায় প্রশিক্ষণ হয়নি, সেগুলোর ${m[1]} ক্ষেত্রে অ্যাডমিনদের সাথে একমত।`],
  [/^Send a new code in (\d+)s$/, (m) => `${bnNum(m[1])} সেকেন্ড পর নতুন কোড পাঠান`],
  [/^Your ad is live — about (\d+) views$/, (m) => `আপনার বিজ্ঞাপন চালু — প্রায় ${bnNum(m[1])} ভিউ`],
  [/^Promote for (\d+) Limes$/, (m) => `${bnNum(m[1])} লাইমসে প্রচার করুন`],
  [/^(\d+) Limes returned$/, (m) => `${bnNum(m[1])} লাইমস ফেরত দেওয়া হয়েছে`],
  [/^Videos can be up to (\d+) MB\.$/, (m) => `ভিডিও সর্বোচ্চ ${bnNum(m[1])} MB হতে পারে।`],
  [/^Videos can be up to (\d+) minutes long\.$/, (m) => `ভিডিও সর্বোচ্চ ${bnNum(m[1])} মিনিট লম্বা হতে পারে।`],
  [/^Boosted for 24 hours · (\d+) Limes$/, (m) => `২৪ ঘণ্টার জন্য বুস্ট করা হয়েছে · ${bnNum(m[1])} লাইমস`],
  [/^You follow (.+)$/, (m) => `আপনি ${m[1]}-কে ফলো করেন`],
  [/^(\d+)-day streak!?$/, (m) => `${bnNum(m[1])} দিনের স্ট্রিক${m[0].endsWith('!') ? '!' : ''}`],
  [/^\+(\d+) Limes welcome bonus$/, (m) => `+${bnNum(m[1])} লাইমস স্বাগতম বোনাস`],
  [/^Level (\d+), (\d+) XP, (\d+) day streak$/, (m) => `লেভেল ${bnNum(m[1])}, ${bnNum(m[2])} XP, ${bnNum(m[3])} দিনের স্ট্রিক`],
  [/^Moment from (.+)$/, (m) => `${m[1]}-এর মোমেন্ট`],
  [/^(.+) — tap to undo$/, (m) => `${m[1]} — ফেরাতে ট্যাপ করুন`],
  [/^(.+) — open details$/, (m) => `${m[1]} — বিস্তারিত খুলুন`],
  [/^Request failed \((\d+)\)$/, (m) => `অনুরোধ ব্যর্থ হয়েছে (${m[1]})`],
  [/^Upload failed \((\d+)\)$/, (m) => `আপলোড ব্যর্থ হয়েছে (${m[1]})`],
  [/^Please wait (\d+) seconds before asking for another code\.$/, (m) => `আরেকটি কোড চাওয়ার আগে ${bnNum(m[1])} সেকেন্ড অপেক্ষা করুন।`],
  [/^Messages can be at most (\d+) characters\.$/, (m) => `মেসেজ সর্বোচ্চ ${bnNum(m[1])} অক্ষরের হতে পারে।`],
  [/^Everything (.+): show what you shot or built, ask before you rent, and find what you need\.$/,
    (m) => `${anyCase(m[1])} নিয়ে সবকিছু: যা তুলেছেন বা বানিয়েছেন দেখান, ভাড়ার আগে জিজ্ঞেস করুন, আর দরকারি জিনিস খুঁজে নিন।`],
  [/^You're into (.+)$/, (m) => `আপনার আগ্রহ: ${anyCase(m[1])}`],
  [/^closes (.+)$/, (m) => `শেষ হবে ${m[1]}`],
  [/^Revenue · last (\d+) days$/, (m) => `আয় · গত ${bnNum(m[1])} দিন`],
  [/^(.+) late · (.+) damage$/, (m) => `${m[1]} বিলম্ব · ${m[2]} ক্ষতি`],
  [/^\/ ?day · replace (.+)$/, (m) => `/ দিন · প্রতিস্থাপন ${m[1]}`],
  [/^(৳[\d,.]+)\/day$/, (m) => `${m[1]}/দিন`],
  [/^\/day ·$/, () => '/দিন ·'],
  [/^\/day · (.+)$/, (m) => `/দিন · ${m[1]}`],
  [/^For rent \((\d+)\)$/, (m) => `ভাড়ার জন্য (${bnNum(m[1])})`],
  [/^(\d+) new$/, (m) => `${bnNum(m[1])}টি নতুন`],
  [/^Warning to (.+) — what should they fix\?$/, (m) => `${m[1]}-কে সতর্কবার্তা — কী ঠিক করতে হবে?`],
  [/^Ban (.+)\? They will be signed out and blocked\. Reason:$/, (m) => `${m[1]}-কে নিষিদ্ধ করবেন? তাকে সাইন আউট ও ব্লক করা হবে। কারণ:`],
  [/^Delete this post by (.+)\? They will be told it broke the rules\.$/, (m) => `${m[1]}-এর এই পোস্টটি মুছবেন? তাকে জানানো হবে যে এটি নিয়ম ভেঙেছে।`],
  [/^Lift the ban on (.+)\?$/, (m) => `${m[1]}-এর নিষেধাজ্ঞা তুলবেন?`],
  [/^(.+) was warned$/, (m) => `${m[1]}-কে সতর্ক করা হয়েছে`],
  [/^(.+) was banned$/, (m) => `${m[1]}-কে নিষিদ্ধ করা হয়েছে`],
  [/^(.+) can use RentalFlow again$/, (m) => `${m[1]} আবার RentalFlow ব্যবহার করতে পারবেন`],
  [/^(.+) is live$/, (m) => `${m[1]} চালু হয়েছে`],
  [/^Last (\d+) days$/, (m) => `গত ${bnNum(m[1])} দিন`],
  [/^Flagged (.+)$/, (m) => `চিহ্নিত ${m[1]}`],
  [/^(\d+)\/500$/, (m) => `${bnNum(m[1])}/৫০০`],
  [/^Level (\d+)$/, (m) => `লেভেল ${bnNum(m[1])}`],
  [/^Lv (\d+)$/, (m) => `লেভেল ${bnNum(m[1])}`],
  [new RegExp(`^(\\d+) ${plural('member')}$`), (m) => `${bnNum(m[1])} জন সদস্য`],
  [new RegExp(`^(\\d+) ${plural('follower')}$`), (m) => `${bnNum(m[1])} জন ফলোয়ার`],
  [new RegExp(`^(\\d+) ${plural('post')}$`), (m) => `${bnNum(m[1])}টি পোস্ট`],
  [new RegExp(`^(\\d+) ${plural('comment')}$`), (m) => `${bnNum(m[1])}টি কমেন্ট`],
  [new RegExp(`^(\\d+) ${plural('vote')}$`), (m) => `${bnNum(m[1])}টি ভোট`],
  [new RegExp(`^(\\d+) ${plural('view')}$`), (m) => `${bnNum(m[1])} ভিউ`],
  [/^(\d+) (?:reply|replies)$/, (m) => `${bnNum(m[1])}টি উত্তর`],
  [new RegExp(`^(\\d+) ${plural('day')}$`), (m) => `${bnNum(m[1])} দিন`],
];

const STATUS = {
  Pending: 'অপেক্ষমাণ', Approved: 'অনুমোদিত', Rejected: 'বাতিল', Cancelled: 'বাতিল',
  Completed: 'সম্পন্ন', Open: 'খোলা', 'In Progress': 'চলছে',
};
