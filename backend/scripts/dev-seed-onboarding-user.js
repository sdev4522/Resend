/**
 * DEV ONLY — creates (or resets) a local test account in the exact state a fresh signup
 * leaves it in: verified email, 14-day trial running, no timezone yet (so onboarding opens).
 *
 *   node scripts/dev-seed-onboarding-user.js
 *
 * Test credentials (local database only, never use in production):
 *   email:    onboarding.test@example.test
 *   password: Resend-Dev-Onboarding-2026
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const bcrypt = require("bcrypt");
const randomstring = require("randomstring");
const { prisma } = require("../database/prisma");
const { updateUserPlan } = require("../functions/function");

const EMAIL = "onboarding.test@example.test";
const PASSWORD = "Resend-Dev-Onboarding-2026";

(async () => {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed a test user with NODE_ENV=production");
    process.exit(1);
  }

  const password = await bcrypt.hash(PASSWORD, 10);
  let user = await prisma.user.findFirst({ where: { email: EMAIL } });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password,
        timezone: null,
        is_blocked: false,
        email_verified_at: new Date(),
        tokenVersion: (user.tokenVersion || 0) + 1,
      },
    });
  } else {
    user = await prisma.user.create({
      data: {
        uid: randomstring.generate(),
        role: "user",
        name: "Onboarding Tester",
        email: EMAIL,
        password,
        mobile_with_country_code: "+919800000000",
        email_verified_at: new Date(),
        terms_accepted_at: new Date(),
        tokenVersion: 0,
      },
    });
  }

  // Same as signup: assign the trial plan (writes the FREE_TRIAL marker order too)
  const trialPlan = await prisma.plan.findFirst({ where: { is_trial: 1 }, orderBy: { id: "asc" } });
  if (trialPlan) {
    await updateUserPlan({ ...trialPlan, price: Number(trialPlan.price || 0) }, user.uid, 14);
  }

  console.log(`Seeded ${EMAIL} (uid ${user.uid}); trial plan: ${trialPlan ? trialPlan.title : "none configured"}`);
  await prisma.$disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
