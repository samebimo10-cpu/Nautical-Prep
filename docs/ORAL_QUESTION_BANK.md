# Oral examination question bank: sources, method and coverage

## What was searched
Searches (October 2026) looked for Chief Mate (STCW II/2) oral question banks and syllabi:

| Source | What it is | How it was used |
| --- | --- | --- |
| UK MCA, MSN 1856 and the Chief Mate oral examination syllabus (gov.uk) | Official topic list for UK orals | Topic headings only. The site was **blocked** from the build sandbox, so the full text couldn't be read. Expert mapping is pending (`CONTENT_TODO.md` §4) |
| AMSA, Appendix 1: syllabus for oral exam, Master/Chief Mate ≥ 3000 GT | Official Australian oral topic list | Same: identified, not readable from the sandbox. Its stated intent ("any question relevant to the topic areas… scenarios… simple calculations") shaped the examiner's style |
| MCA Orals Past Papers (mcaoralpapers.co.uk), Jahajee "most asked" oral questions, OfficerCadet.com orals reports, docsity / pdfcoffee Q&A collections | Candidate-reported or commercial question collections | **Not copied** (copyright and spec rule 6). Used only to see **which topics come up most often**: MARPOL annexes, crane SWL markings, negotiable B/Ls, joining a new ship, PSC, stability and drydocking, enclosed spaces, pilot ladders, MOB, IG systems, liquefaction, hours of rest |
| Macneil's Seamanship Examiner, Chief Mate/Master Orals Notes (2025, Witherby) | Commercial study book | Not used. Recommended to candidates as further reading |

## Method
1. Organised by STCW Table A-II/2 functions (navigation, cargo handling and stowage, controlling the operation of the ship and care for persons on board), mapped onto the app's competences NAV / STAB / CARGO / COLREG / LAW / MGMT / LOCAL.
2. The **most frequently reported topics** got original questions, written as a management-level examiner would ask them ("As Chief Mate, what would you do…").
3. Each item has a model answer, **key points** the examiner listens for (with synonym groups for offline marking), **follow-up** probes, and a **safety-critical** flag where one unsafe answer should fail the oral.
4. **Calibration test** (`scripts/content.test.ts`): every model answer must score ≥ 80% against its own key points, and a vague answer must score < 35%. All 69 pass.
5. All items are `draft` until a Master Mariner/examiner reviews them.

## How the bank is used in the app
- **Oral → Question bank:** browse and search every question. The model answer is hidden behind a tap (active recall).
- **Oral → Examiner:** an exam-mode or coach-mode simulated oral, offline or AI, with country examiner styles (UK MCA-style, PH, NG, GH, SG, AU, EG), push-to-talk voice, probes on weak answers, and a debrief listing every missed key point plus "add missed to review deck".
- Missed oral items feed spaced repetition. Readiness requires 3 orals averaging ≥ 80% with **no** critical failure.

## Coverage (69 questions, 18 safety-critical)
| Area | Question | Countries | Critical | Key points |
| --- | --- | --- | --- | --- |
| CARGO | You are to load nickel ore (a Group A cargo). What documents and checks would you require before and during loading? | * | ⚠️ | 6 |
| CARGO | How would you prepare the holds of a bulk carrier for a grain cargo? | * |  | 5 |
| CARGO | Explain how you would check that the ship complies with the Grain Code before sailing. | * |  | 6 |
| CARGO | Explain the purpose of an inert gas system on a tanker and the precautions if the IG system fails during discharge. | * | ⚠️ | 5 |
| CARGO | Dangerous goods containers are being loaded on your container ship. What are your duties as Chief Mate? | * |  | 6 |
| CARGO | How would you check that container stowage and lashing are safe before departure? | * |  | 5 |
| CARGO | What hazards does coal present and what precautions do you take during the voyage? | * |  | 5 |
| CARGO | Explain the dew point rule and the three-degree rule for ventilating cargo holds. | * |  | 4 |
| CARGO | A cargo tank needs to be entered for inspection after discharge. Describe the procedure. | * | ⚠️ | 6 |
| COLREG | You are the stand-on vessel in a crossing situation. Talk me through your actions as the situation develops under Rule 17. | * | ⚠️ | 6 |
| COLREG | Explain Rule 19 and describe your actions in restricted visibility when you detect a vessel by radar alone, fine on the starboard bow and closing. | * | ⚠️ | 6 |
| COLREG | Describe the lights and shapes of a dredger at work, and which side you would pass her. | * |  | 4 |
| COLREG | What factors determine a safe speed under Rule 6? | * |  | 7 |
| COLREG | At night you see three white masthead lights in a vertical line, a green sidelight and a yellow light above a white light right aft as she passes. What is it and what are your actions? | * |  | 5 |
| COLREG | Explain your obligations under Rule 9 when navigating a narrow channel. | * |  | 6 |
| COLREG | As Chief Mate on watch, when would you call the Master? | * |  | 7 |
| COLREG | What are the dangers of using VHF radio for collision avoidance? | * |  | 4 |
| LAW | What are the MARPOL Annex I requirements for discharging oily bilge water from the machinery space, and what records must be kept? | * | ⚠️ | 6 |
| LAW | Outline the MARPOL Annex V requirements for garbage management on board. | * |  | 6 |
| LAW | State the hours of rest requirements and how they are recorded and monitored on board. | * |  | 6 |
| LAW | What are the objectives of the ISM Code and the main elements of a Safety Management System? | * |  | 7 |
| LAW | A Port State Control officer is boarding. As Chief Mate, how do you prepare the ship, and what do you do if the ship is detained? | * |  | 6 |
| LAW | The receivers want to take delivery of cargo without producing the original bill of lading, offering a letter of indemnity. What do you advise? | * |  | 5 |
| LAW | What are the duties of the Ship Security Officer and the main contents of the Ship Security Plan? | * |  | 6 |
| LAW | When would the Master note a protest, and what is the procedure? | * |  | 5 |
| MGMT | A crew member collapses inside a ballast tank. What do you do as Chief Mate? | * | ⚠️ | 6 |
| MGMT | You are on watch and a crew member falls overboard. Describe your actions. | * | ⚠️ | 7 |
| MGMT | A fire is reported in the engine room and cannot be controlled with portable equipment. Describe the actions leading up to the use of the fixed CO2 system. | * | ⚠️ | 7 |
| MGMT | Your ship has been in collision. What are your immediate actions as Chief Mate? | * | ⚠️ | 7 |
| MGMT | Your ship runs aground. What are your actions, and what would you consider before trying to refloat? | * |  | 7 |
| MGMT | How would you check that the pilot boarding arrangement is safe? | * | ⚠️ | 7 |
| MGMT | Heavy weather is forecast. What preparations would you make as Chief Mate? | * |  | 6 |
| MGMT | What do you understand by Bridge Resource Management, and how would you run a bridge team briefing before entering port? | * |  | 6 |
| MGMT | How do you manage deck maintenance as Chief Mate? | * |  | 5 |
| MGMT | During bunkering an oil spill occurs on deck and some oil goes overboard. What do you do? | * | ⚠️ | 6 |
| MGMT | The Master orders abandon ship. Describe the actions and your responsibilities as Chief Mate. | * |  | 5 |
| NAV | You are Chief Mate and the Master asks you to check the Second Officer's passage plan for an ocean passage followed by a port approach. What would you check in the appraisal and planning? | * |  | 8 |
| NAV | How would you set up the safety parameters on ECDIS before departure, and what are the dangers of over-reliance on ECDIS? | * |  | 7 |
| NAV | Your ship uses ECDIS as the primary means of navigation and the main ECDIS fails during a coastal passage. What do you do? | * |  | 6 |
| NAV | How would you know you are approaching a tropical revolving storm, and how would you determine which semicircle you are in and avoid it in the Northern Hemisphere? | * |  | 6 |
| NAV | Explain how you would calculate the under-keel clearance for a port approach. What factors reduce it? | * |  | 7 |
| NAV | What information is exchanged between the Master and Pilot when the pilot boards, and what are your duties as OOW while the pilot has the con? | * | ⚠️ | 5 |
| NAV | During a coastal passage the GPS position starts to jump and AIS targets appear in impossible positions. What do you suspect and what action do you take? | * |  | 5 |
| NAV | How do you determine compass error at sea and in coastal waters, and how often should it be done? | * |  | 5 |
| NAV | How would you plan an anchorage and what would you check to make sure the vessel is not dragging? | * |  | 6 |
| NAV | Your vessel is routed through an area where ice may be encountered. What precautions would you take? | * |  | 5 |
| NAV | As Chief Mate on watch, visibility suddenly drops to less than 1 mile in a traffic area. What do you do? | * | ⚠️ | 6 |
| NAV | What ship routeing measures might you find on a chart, and what are the rules for using a traffic separation scheme? | * |  | 5 |
| STAB | What is free surface effect, what does it depend on, and how do you minimise it on board? | * |  | 6 |
| STAB | Your ship develops a list during the voyage. How do you determine whether it is a list or an angle of loll, and how would you correct an angle of loll? | * | ⚠️ | 6 |
| STAB | As Chief Mate, how do you prepare the ship for drydocking from a stability point of view, and what is the critical period? | * |  | 6 |
| STAB | State the general intact stability criteria from the IMO 2008 IS Code. | * |  | 7 |
| STAB | What are the dangers of a ship being too stiff or too tender, and how would you recognise each condition at sea? | * |  | 5 |
| STAB | How do you ensure the ship's longitudinal strength is not exceeded during loading and discharging? | * |  | 6 |
| STAB | Your ship is holed and a compartment is flooding. What are the immediate stability considerations and actions? | * | ⚠️ | 6 |
| STAB | Describe the load line marks and explain the conditions of assignment checked at an annual load line survey. | * |  | 5 |
| STAB | Why and when is an inclining experiment carried out, and what preparations are needed? | * |  | 6 |
| STAB | You're Chief Mate of a large container ship in heavy head seas and the ship suddenly starts rolling heavily. What could be happening and what would you advise the Master? | * |  | 5 |
| LOCAL | You are arriving at Tema. What information and preparations would you make for arrival, pilotage and berthing? | gh |  | 6 |
| LOCAL | Your ship is bound for Lagos anchorage, and the area has a recent history of piracy and armed robbery. What security measures would you implement as Ship Security Officer? | ng |  | 6 |
| LOCAL | Describe the role of NIMASA as it affects you as a Chief Mate on Nigerian ships. | ng |  | 6 |
| LOCAL | Armed robbers have boarded your ship at anchor off Lagos at night. What actions do you take? | ng | ⚠️ | 6 |
| LOCAL | Your ship is at anchor in Manila Bay when a typhoon warning is issued and the storm is forecast to pass close. What actions would you take as Chief Mate? | ph |  | 6 |
| LOCAL | What is MARINA's role for Filipino seafarers, and why must you keep your STCW certificates valid? | ph |  | 5 |
| LOCAL | An oil spill occurs from your ship while at berth in a Philippine port. To whom do you report and what do you do? | ph | ⚠️ | 5 |
| LOCAL | Brief your bridge team for a laden VLCC transit of the Singapore Strait. | sg |  | 6 |
| LOCAL | Your UK-flagged ship has had a serious injury on board. What are the reporting requirements and what would you preserve? | uk |  | 5 |
| LOCAL | What is the Code of Safe Working Practices for Merchant Seafarers, and how is it used on UK ships? | uk |  | 5 |
| LOCAL | Talk me through how you would take over as Chief Mate when joining a UK-flagged ship mid-voyage. | uk |  | 5 |
