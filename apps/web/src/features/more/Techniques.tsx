import { PageHeader } from "../../components/ui";
import { Markdown } from "../../components/Markdown";

const BODY = `
Each feature in this app is built on a learning technique with strong research behind it.

| Technique | Where it lives in the app |
| --- | --- |
| **Retrieval practice** (testing beats re-reading) | Quizzes, "Test yourself" after every lesson, oral question bank with answers hidden |
| **Spaced repetition (SM-2)** | Every missed question joins your review deck and returns just before you'd forget it |
| **Confidence calibration and hypercorrection** | You rate Sure / Unsure / Guess. Confident mistakes come back within minutes and get their own drill |
| **Interleaving** | "Mixed" quizzes and the oral examiner jump between competences, like the real exam |
| **Worked examples, then fading** | Calculations reveal one step at a time. Revealing steps earns less credit, so you learn to solve unaided |
| **Variation** | Every calculation uses fresh random numbers, so you learn the method, not the answer |
| **Elaboration** | Every answer explains *why* and cites the regulation |
| **Exam simulation** | Timed mock papers, no feedback until you submit, auto-submit at time-up |
| **Speaking aloud (Feynman technique)** | Voice oral with push-to-talk. Examiner probes when your answer is thin |
| **Scenario-based learning** | COLREGs plots with lights, shapes and restricted visibility |
| **Desirable difficulty** | Unseen and previously missed items are served first |
| **Planning** | The daily plan adapts to your exam date: foundation, then consolidation, then exam simulation |

### Why the readiness bar is higher than the pass mark

The dashboard only shows **Exam-ready** when you have:

1. attempted at least 90% of the question bank,
2. scored at least 85% in **every** competence (latest attempt per question, so drilling one easy item doesn't count),
3. scored at least 85% on your last 20 calculations,
4. passed **three mocks in a row at 85% or more**, against a typical 70% pass mark,
5. averaged 80% or more over three orals with **no safety-critical failure**. Real examiners fail candidates on a single unsafe answer, and so does this app.

That margin is deliberate. Nerves, unfamiliar wording and examiner style cost marks on the day.

> **Honest limits:** this question bank is original and **awaiting review by maritime experts**. Authorities change formats and syllabi. Always check current requirements with your administration (MARINA, NIMASA, MCA, GMA, MPA, AMSA, EAMS) and current editions of the conventions.
`;

export function Techniques() {
  return (
    <div>
      <PageHeader title="Learning techniques" back="/more" />
      <div className="card">
        <Markdown>{BODY}</Markdown>
      </div>
    </div>
  );
}
