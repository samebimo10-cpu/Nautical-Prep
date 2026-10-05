import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useProfile } from "./lib/hooks";
import { startSync } from "./lib/sync";
import { ensureBundle } from "./lib/bundle";
import { Onboarding } from "./features/onboarding/Onboarding";
import { Dashboard } from "./features/home/Dashboard";
import { StudyHome } from "./features/study/StudyHome";
import { CompetencePage } from "./features/study/CompetencePage";
import { LessonPage } from "./features/study/LessonPage";
import { PracticeHome } from "./features/practice/PracticeHome";
import { QuizRun } from "./features/quiz/QuizRun";
import { Review } from "./features/review/Review";
import { CalcHome } from "./features/calc/CalcHome";
import { CalcPractice } from "./features/calc/CalcPractice";
import { MockHome } from "./features/mock/MockHome";
import { MockRun } from "./features/mock/MockRun";
import { MockResultPage } from "./features/mock/MockResult";
import { OralHome } from "./features/oral/OralHome";
import { OralSessionPage } from "./features/oral/OralSession";
import { ColregsHome } from "./features/colregs/ColregsHome";
import { ScenarioPlayer } from "./features/colregs/ScenarioPlayer";
import { More } from "./features/more/More";
import { Tracker } from "./features/tracker/Tracker";
import { Updates } from "./features/updates/Updates";
import { Booking } from "./features/booking/Booking";
import { ProfilePage } from "./features/account/Profile";
import { Admin } from "./features/admin/Admin";
import { ProgressPage } from "./features/analytics/ProgressPage";
import { Paywall } from "./features/paywall/Paywall";
import { Techniques } from "./features/more/Techniques";

function RequireProfile({ children }: { children: JSX.Element }) {
  const profile = useProfile();
  const loc = useLocation();
  if (profile === undefined) return <div className="p-6 text-center text-slate-600">Loading…</div>;
  if (profile === null) return <Navigate to="/onboarding" replace state={{ from: loc.pathname }} />;
  return children;
}

export function App() {
  const profile = useProfile();
  const [checked, setChecked] = useState(false);
  useEffect(() => startSync(), []);
  // refresh the content bundle in the background on start (no-op offline)
  useEffect(() => {
    if (profile && !checked) {
      setChecked(true);
      void ensureBundle(profile.country).catch(() => undefined);
    }
  }, [profile, checked]);

  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route
        element={
          <RequireProfile>
            <Layout />
          </RequireProfile>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="study" element={<StudyHome />} />
        <Route path="study/:competence" element={<CompetencePage />} />
        <Route path="lesson/:id" element={<LessonPage />} />
        <Route path="practice" element={<PracticeHome />} />
        <Route path="quiz" element={<QuizRun />} />
        <Route path="review" element={<Review />} />
        <Route path="calc" element={<CalcHome />} />
        <Route path="calc/:id" element={<CalcPractice />} />
        <Route path="mock" element={<MockHome />} />
        <Route path="mock/run/:id" element={<MockRun />} />
        <Route path="mock/result/:id" element={<MockResultPage />} />
        <Route path="oral" element={<OralHome />} />
        <Route path="oral/session/:id" element={<OralSessionPage />} />
        <Route path="colregs" element={<ColregsHome />} />
        <Route path="colregs/:id" element={<ScenarioPlayer />} />
        <Route path="more" element={<More />} />
        <Route path="tracker" element={<Tracker />} />
        <Route path="updates" element={<Updates />} />
        <Route path="booking" element={<Booking />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="admin" element={<Admin />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="upgrade" element={<Paywall />} />
        <Route path="techniques" element={<Techniques />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
