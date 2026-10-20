# Forged store listings (draft for Steve)

Status: draft, written Oct 20, 2026 for release 3.7.0. Character limits were checked with a script (counts shown). Prices match the paywall (still a stub): $4.99 a month, $35.99 a year, 7-day free trial.

---

## Apple App Store

**App name** (30 max): `Forged: Fight Training Log` (26)
- "Forged" on its own is very likely taken on the App Store, and the name has to be unique. Check availability when creating the app in App Store Connect. Fallbacks: `Forged – BJJ & MMA Log` (22), `Forged Fight Log` (16).

**Subtitle** (30 max): `BJJ, MMA & Lifting Tracker` (26)

**Promotional text** (170 max, can change without review):
> New: daily Train, Recover and Fuel marks, Perfect Week streaks and monthly medals. Log every round, lift and meal, and see the work add up. For the fight. (154)

**Description** (4,000 max):
```
Forged is the training log built for fighters. BJJ, grappling, striking, MMA, weights, cardio and mobility, all in one place, so you can see how your whole week of training fits together.

LOG A SESSION IN SECONDS
• Gi, no-gi, wrestling, Muay Thai, boxing, kickboxing, MMA, lifting, runs and mobility
• Rounds, rolls, partners, techniques, effort and how you felt
• One-tap repeat of your usual classes

TRAIN, RECOVER, FUEL
• Daily marks for training minutes, mobility and nutrition
• Set goals for each weekday. Rest days count as rest
• Pause while you're injured. Your streak waits for you

SEE THE WORK ADD UP
• Hours on the mat, rounds, sessions per week and training load
• Weights PRs, estimated 1RM, strength goals and benchmarks
• Belt and stripe history, competitions and records

EARN IT
• Ranks and levels from your real training history
• Daily, weekly and monthly challenges, mostly quick bodyweight workouts
• Perfect Weeks, monthly medals and limited fight-camp medals
• Share cards for PRs, rank-ups and medals

FUEL FOR THE FIGHT
• Calories, protein and water, with a macro calculator for losing, maintaining or gaining weight
• Food search and barcode lookup (Open Food Facts)
• Weight goals with weekly averages, not daily noise

PRIVATE BY DESIGN
• Your log stays on your phone. No account needed
• Friends is optional and only shares your name, rank and simple counts
• No ads. We never sell your data

FORGED PRO
Programs and weight plans, lifting templates, advanced stats and extra looks. 7-day free trial, then $4.99/month or $35.99/year. The subscription renews automatically unless cancelled at least 24 hours before the end of the period. Manage it in your App Store account settings.

Terms: https://forgedfightapp.github.io/terms.html
Privacy: https://forgedfightapp.github.io/privacy.html

Forged gives general training information, not medical advice.
```

**Keywords** (100 max, comma-separated, no spaces, don't repeat words already in the name or subtitle):
`jiu jitsu,grappling,boxing,muay thai,kickboxing,wrestling,judo,workout,gym,macro,protein,belt` (93)

**Category:** Primary **Health & Fitness**. Secondary **Sports**.

**Support URL:** https://forgedfightapp.github.io/ (or a support page) · **Marketing URL:** https://forgedfightapp.github.io/ · **Privacy Policy URL:** https://forgedfightapp.github.io/privacy.html

**Age rating questionnaire (Apple, 2025+ form)**, expected result **4+** if Friends isn't in the build, otherwise **13+** (set by us because of the Terms):
| Question | Answer |
|---|---|
| Parental controls / age assurance | No |
| Unrestricted web access | No |
| User-generated content / messaging & chat | No (display names only if Friends is on; there's no free text shared) |
| Advertising | No |
| Cartoon/realistic violence | None (it's a sports log; no violent imagery) |
| Mature/suggestive themes, sexual content, nudity, profanity, horror | None |
| Alcohol, tobacco, drugs | None |
| Simulated gambling, contests, loot boxes | No |
| Medical or treatment information | Infrequent/mild (general training and nutrition tips, with a "not medical advice" disclaimer) |
| Health or wellness topics | Yes |

**App Privacy ("nutrition label"):**
- Data Not Collected, while Friends is off in the build.
- When Friends ships, declare these, all **linked to the user** and **not used for tracking**: Contact Info → Email (App Functionality), Identifiers → User ID (App Functionality), Other User Content → display name (App Functionality), Fitness → counts (App Functionality).

---

## Google Play

**App name** (30 max): `Forged: Fight Training Log` (26)

**Short description** (80 max):
`Training log for BJJ, MMA, striking & lifting. Marks, streaks, medals, macros.` (78)

**Full description** (4,000 max): use the App Store description above. Replace "Manage it in your App Store account settings" with "Manage or cancel it in Google Play › Payments & subscriptions".

**Category:** **Health & Fitness**. Tags: Fitness tracking, Workout log, Martial arts, Nutrition.

**Content rating (IARC questionnaire):** category "Reference, News, or Educational" isn't right, so pick **"All Other App Types"**.
- Violence, fear, sexuality, language, controlled substances, gambling: **No**.
- Users can interact or exchange content: **No** while Friends is off. If Friends is on: **Yes**, users share display names and counts only, with no chat.
- Shares user location: **No**. Digital purchases: **Yes** (Pro subscription).
- Expected: **Everyone** / PEGI 3. Set **target audience 13+** in Play Console → Target audience (not designed for children).

**Data safety form:**
- Without Friends: no data collected or shared. Data is encrypted in transit (HTTPS). Deletion: data stays on the device; Clear all data removes it.
- With Friends, collected: Email address, User IDs, App activity (counts), Name (display name). Purpose: App functionality / account management. Not shared with third parties (Supabase is a processor). Users can request deletion in the app (Delete account) and by email.

**Health apps declaration (Play, 2025+):** Fitness / Nutrition tracking. Not a medical device.

---

## Screenshots
Generated from the app with sample data by `store/make-screenshots.mjs` (Playwright; run it from a folder with `playwright` installed, server on :8787), with captions on brand backgrounds (#0B0B0C, ember glow, Barlow Condensed, #F58A45).

| Set | Size | Files |
|---|---|---|
| App Store 6.7" (iPhone Pro Max) | 1290 × 2796 | `screenshots/ios-6.7-01-home.png` … `-05-food.png` |
| App Store 6.5" | 1242 × 2688 | `screenshots/ios-6.5-01-home.png` … `-05-food.png` |
| Google Play phone | 1080 × 1920 | `screenshots/play-phone-01-home.png` … `-05-food.png` |

Captions:
1. YOUR TRAINING / AT A GLANCE
2. LOG A SESSION / IN SECONDS
3. SEE THE WORK / ADD UP
4. EARN MEDALS / KEEP THE STREAK
5. FUEL / FOR THE FIGHT

Still needed:
- Play feature graphic (1024 × 500)
- Play icon (512 × 512, use `brand/forged/icon-512.png`)
- iPad screenshots, only if iPad support is kept on. The Capacitor iOS project is universal by default; set it to iPhone-only in Xcode to skip them.
