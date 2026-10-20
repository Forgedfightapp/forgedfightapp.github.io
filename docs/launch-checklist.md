# Forged launch checklist

Owner: Steve. Updated Oct 20, 2026 (release 3.7.0). Items marked ✅ are done in the repo; everything else needs Steve, money, or an account.

## 1. Legal pages: drafts ✅, review needed
- [x] `privacy.html` and `terms.html` are live as **drafts**. They're plain English and styled like the app, with a "Draft for review, not legal advice" banner.
- [x] They're linked from Profile → Your data, onboarding step 1 and the Pro screen.
- [ ] Fill in `[LEGAL NAME / LLC]`, `[CONTACT EMAIL]` and `[DATE]` once the LLC exists.
- [ ] Have them reviewed (a lawyer, or at least a termly/iubenda-style generator cross-check). Then remove the draft banner (`#draftNote`) and the `noindex` tag.
- [ ] Confirm the governing law (Texas) and the liability cap wording.

## 2. Forged Pro: UI ✅ (flagged), payments not started
- [x] Paywall at `#/pro`:
  - $4.99/month, $35.99/year, a 7-day free trial label, the feature list, and auto-renew terms.
  - PRO tags on programs, weight plans, training load and looks.
  - Hidden unless `config.js` `pro:true`. Preview on one phone with `?pro=1` (`?pro=0` turns it off).
- [x] `Payments` is a stub: nothing is charged and `isPro()` still returns true for everyone.
- [ ] Choose what's Pro vs free, then change `isPro()` to `proActive() || purchased`.
- [ ] **Stripe** account (web purchases): needs the LLC, EIN and bank account. Use Stripe Checkout and the customer portal, with a small Supabase Edge Function for webhooks.
- [ ] Native: StoreKit and Play Billing through RevenueCat (free under $2.5k MTR), with products `forged_pro_monthly` and `forged_pro_yearly` and a 7-day intro offer.
- [ ] App Store rule: the iOS app can't link to Stripe for digital purchases (outside the allowed US link-out flow). Keep Stripe for web only.

## 3. Store listings: drafts ✅
- [x] `store/listing.md`: name, subtitle, promo text, description, keywords, Play short/full text, categories, age rating and privacy/data-safety answers.
- [x] Screenshots in `store/screenshots/`:
  - App Store 6.7" (1290×2796) and 6.5" (1242×2688)
  - Play phone (1080×1920)
  - 5 of each
- [ ] Check name availability in App Store Connect and Play Console.
- [ ] Play feature graphic (1024×500).
- [ ] Final review of the copy.

## 4. Native apps (Capacitor): projects ✅, signing not started
- [x] `native/`: Capacitor 8, iOS and Android projects, `com.forgedfightapp.forged`, icons and splash from `brand/forged`. It builds from the web files.
- [x] Android debug APK built on the box. It isn't committed; a copy is at `/workspace/forged-3.7.0-debug.apk`.
- [ ] Sideload the APK on an Android phone and test.
- [ ] iOS build: pick Codemagic (free tier), GitHub Actions macOS, or a rented or borrowed Mac. See `native/README.md`.
- [ ] Android upload keystore, then upload an AAB to Play internal testing.
- [ ] TestFlight build.

## 5. Analytics: proposal ✅, not enabled
- [x] `docs/analytics.md` recommends a Supabase self-hosted counter and error counter with an opt-out, and GoatCounter as an alternative.
- [ ] Decide. If enabling: build it, add the opt-out toggle, and update the privacy policy (section 6) and store privacy labels first.

## 6. Steve's items
- [ ] **Real-iPhone test pass:** Safari plus Add to Home Screen, then the TestFlight build. Cover:
  - onboarding
  - logging every sport
  - food search and barcode
  - offline mode
  - export and import
  - marks, Perfect Week, medals and the recap
  - the paywall preview (`?pro=1`)
  - Friends (`?social=1`)
- [ ] **Texas LLC:** Certificate of Formation (Form 205) with the Texas Secretary of State, **$300** filing fee. Then get an EIN (free, IRS) and a business bank account.
- [ ] **D-U-N-S number** (free through Apple's D-U-N-S lookup or Dun & Bradstreet, takes days to 2 weeks). Apple requires it to enrol as an organisation.
- [ ] **Apple Developer Program:** **$99/year** (organisation enrolment with the D-U-N-S number).
- [ ] **Google Play Console:** **$25** one-time. Organisation account (D-U-N-S here too).
- [ ] **New Play personal accounts only:** 12 testers for 14 days before production. Organisation accounts avoid this.
- [ ] **Stripe:** see section 2.
- [ ] **Brevo for Friends:** a free plan (300 emails/day) as Supabase Auth's custom SMTP, so sign-in codes don't hit Supabase's built-in email rate limit. Verify the sender domain (SPF/DKIM), then follow `docs/social-setup.md` → turn on `social:true`.
- [ ] **Marketing via the Media agent:**
  - a launch post and short clips built from the store screenshots and share cards
  - BJJ/MMA subreddits, gym partnerships and creator outreach
- [ ] **TapIndex directory:** submit Forged (name, subtitle, icon, screenshots and the links above).
- [ ] Support email and inbox for `[CONTACT EMAIL]`.
- [ ] Custom domain (optional, for example forgedfight.app). If used, update `redirectTo` in `config.js` and the Supabase Auth URLs.

## Order of operations
1. LLC → EIN → bank → D-U-N-S
2. Fill in the legal placeholders → legal review
3. Apple and Google developer accounts → app records (names) → TestFlight and internal testing
4. Real-iPhone pass + Android sideload pass
5. Payments (RevenueCat + Stripe) → flip `pro:true`
6. Brevo SMTP → `social:true`
7. Submit for review → launch marketing → TapIndex
