# Content & regulatory TODO (human / expert owned)

**Status:** 289 items + 20 COLREG scenarios, **all `draft` / `needs_review: true`**. Nothing may ship to paying users until reviewed (`pnpm content:gate`).

## 1. Expert review of the question bank (blocking paid launch)
- [ ] Master Mariner / examiner review of every item. Use the in-app **Reviewer mode** queue, export decisions, then `pnpm content:apply-reviews <file>`.
  - Core: NAV 57 · STAB 50 · CARGO 37 · COLREG 33 (+20 scenarios) · LAW 40 · MGMT 35
  - LOCAL: PH 10 · NG 10 · UK 10 · GH 3 · SG 4 · AU 0 · EG 0
- [ ] Verify regulation citations (paragraph-level references were avoided where uncertain). Priority checks:
  - [ ] SOLAS III/19.3.3 (lifeboat launch every 3 months) and 19.3.6 (enclosed space drills every 2 months)
  - [ ] STCW A-VIII/1 para 10 alcohol limits; MLC A2.3 hours of rest
  - [ ] VDR retention (MSC.333(90)); IMO Res. A.1155(32) PSC procedures
  - [ ] IMSBC test validity (TML ≤ 6 months, MC ≤ 7 days); coal 55 °C guidance
  - [ ] Grain Code criteria; IS Code 2008 Part A 2.2 values
  - [ ] MARPOL Annex I Reg. 15/34, Annex V discharge distances, Annex VI 0.50%/0.10%
  - [ ] Country LOCAL items: RA 10635 / RA 9993 (PH); NIMASA Act, Merchant Shipping Act 2007, Cabotage Act 2003 (NG); MAIB 2012 regs, CALDOVREP, M-Notices (UK); GMA Act 630 / Act 645 (GH); STRAITREP and 3.5 m UKC (SG)
- [ ] Grow the bank toward the spec target (~2,000 core + ~300 per country). Weakest areas: CARGO (tankers, ro-ro, containers), LAW (charter parties, insurance), and LOCAL packs for GH/SG/AU/EG.
- [ ] Arabic translation of UI strings (wave 3) and Filipino review.

## 2. Calculation test cases
All calc tests are hand-worked from the stated formula and cross-checked where possible (GC distance against haversine; meridional parts against Norie's/Bowditch at 30° and 60°). None were marked `NEEDS EXPERT CHECK`. Still, an expert should confirm:
- [ ] The drydock virtual loss of GM method used (P·KM/Δ) matches the syllabus taught in each country (some teach P·KG/(Δ−P))
- [ ] The grain heel approximation (actual/permissible × 12°) is acceptable for exam answers
- [ ] The SF/BM sign convention (+ hogging) matches local textbooks

## 3. Regulatory facts per country (all `null` in `content/countries/*/config.yaml`)
For each of MARINA (PH), NIMASA (NG), MCA (UK), GMA (GH), MPA (SG), AMSA (AU), EAMS (EG):
- [ ] Written exam: format, number of papers, duration, pass mark, number of questions
- [ ] Oral exam: format, duration, pass criteria
- [ ] Eligibility: qualifying sea-time months and capacity, required STCW courses (typical candidates: Medical Care, Advanced Fire Fighting, ECDIS, Leadership & Managerial Skills, GMDSS GOC, Ship Security Officer, HV)
- [ ] Fees, application steps and documents (`booking.md` is a generic draft)
- [ ] Whether sea service is counted as calendar months or 30-day months (D-011)

## 4. Oral syllabus mapping
- [ ] Map every oral item to the official oral syllabus headings (MCA MSN 1856 / Chief Mate syllabus; AMSA Appendix 1; MARINA/NIMASA equivalents). Those government sites were blocked from the build environment, so coverage was mapped from the STCW Table A-II/2 functions and public candidate reports (see `ORAL_QUESTION_BANK.md`).
