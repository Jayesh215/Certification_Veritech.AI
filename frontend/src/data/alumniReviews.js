const FIRST_NAMES = [
  "Aarav", "Ananya", "Rohan", "Isha", "Kabir", "Diya", "Vivaan", "Meera",
  "Arjun", "Sneha", "Aditya", "Priya", "Reyansh", "Nisha", "Krish", "Aisha",
  "Vihaan", "Pooja", "Shaurya", "Tanvi", "Yash", "Riya", "Dev", "Kavya",
  "Harsh", "Neha", "Siddharth", "Anvi", "Om", "Sara", "Atharv", "Ira",
  "Laksh", "Myra", "Rudra", "Zara", "Ishaan", "Anika", "Dhruv", "Kiara",
];

const LAST_INITIALS = "ABCDEFGHJKLMNPRSTVW".split("");

const COMPANIES = [
  "Amazon", "Google", "Microsoft", "Accenture", "TCS", "Infosys", "Wipro",
  "Cognizant", "IBM", "Capgemini", "Deloitte", "Oracle", "SAP", "Adobe",
  "Salesforce", "Flipkart", "Swiggy", "Zomato", "Paytm", "PhonePe",
  "Razorpay", "Freshworks", "Zoho", "HCLTech", "LTIMindtree", "Persistent",
  "Thoughtworks", "Publicis Sapient", "EY", "PwC", "KPMG", "Cisco",
  "Intel", "NVIDIA", "JPMorgan Chase", "Goldman Sachs", "Barclays", "Uber",
];

const ROLES = [
  "Software Engineer", "Frontend Developer", "Backend Developer", "Full Stack Developer",
  "QA Engineer", "Data Analyst", "Cloud Associate", "DevOps Intern",
  "Product Analyst", "UI Engineer", "SDE Intern", "Graduate Engineer Trainee",
];

const QUOTES = [
  "The Veritech.AI certificate helped my resume clear the first screening. Recruiters asked about the internship dates and the QR verification.",
  "I added the certificate to LinkedIn and got interview calls within two weeks. The company name on the letter made the experience feel official.",
  "Campus forms asked for an internship certificate. Having a verified Veritech.AI PDF ready made the application process much smoother.",
  "Hiring managers trusted the QR code more than a screenshot. That alone made the certificate worth completing properly.",
  "I used the certificate while applying to product companies. It gave me a clear internship story to talk about in screening rounds.",
  "The role and dates on the certificate matched what I put on my resume, so nothing looked inconsistent during background checks.",
  "After finishing the Veritech.AI internship, I shared the certificate with recruiters and it stood out next to coursework-only profiles.",
  "I got placed after several interviews where the certificate helped prove I had already worked on real software tasks.",
  "Freshers around me only had college projects. Showing a Veritech.AI internship certificate gave my profile more credibility.",
  "The certificate download was quick after payment, and I attached it to every fresher application that asked for internship proof.",
  "Recruiters scanned the QR during a virtual interview. Seeing a live verification page built trust instantly.",
  "I mention Veritech.AI in every intro call now. The certificate makes that experience easy to explain with dates and role.",
  "Getting into a larger company felt easier once my resume had an official internship certificate instead of only personal projects.",
  "The LinkedIn credential share helped. Alumni from Veritech.AI in my network also recognized the format.",
  "I was stuck on applications that required training proof. This certificate filled that gap and kept my process moving.",
  "Interviewers asked how long I interned. Having the duration printed on the certificate made my answers specific and confident.",
  "Compared with unsigned PDFs floating online, the Veritech.AI seal and verification ID felt far more professional.",
  "I completed the internship, got the certificate, and used it across Naukri, LinkedIn, and company career portals.",
  "The certificate helped me stand out in a pool of freshers applying for the same graduate role.",
  "Placement season moves fast. Having the Veritech.AI certificate ready meant I never delayed an application for paperwork.",
];

function hashSeed(n) {
  let x = (n + 1) * 2654435761;
  x ^= x >>> 16;
  return Math.abs(x);
}

/** More than 400 alumni reviews used for social proof on the landing page. */
export const ALUMNI_REVIEW_COUNT = 420;

export const alumniCompanies = COMPANIES;

export const alumniReviews = Array.from({ length: ALUMNI_REVIEW_COUNT }, (_, index) => {
  const seed = hashSeed(index);
  const rating = seed % 9 === 0 ? 4 : 5;
  const first = FIRST_NAMES[seed % FIRST_NAMES.length];
  const initial = LAST_INITIALS[(seed >> 3) % LAST_INITIALS.length];
  const company = COMPANIES[(seed >> 5) % COMPANIES.length];
  const role = ROLES[(seed >> 7) % ROLES.length];
  const quote = QUOTES[seed % QUOTES.length];
  return {
    id: `alumni-${index + 1}`,
    name: `${first} ${initial}.`,
    company,
    role,
    rating,
    text: quote,
  };
});

export const alumniAverageRating = Number(
  (
    alumniReviews.reduce((sum, review) => sum + review.rating, 0) / alumniReviews.length
  ).toFixed(1)
);
