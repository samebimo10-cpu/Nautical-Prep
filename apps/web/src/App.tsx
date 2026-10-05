import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useProfile } from "./lib/hooks";
import { startSync } from "./lib/sync";
import { ensureBundle } from "./lib/bundle";
import { Onboarding } from "./features/onboarding/Onboarding";
import { Dashboard } from "./features/home/Dashboard";
const StudyHome = lazy(() => import("./features/study/StudyHome").then((m) => ({ default: m.StudyHome })));
const CompetencePage = lazy(() => import("./features/study/CompetencePage").then((m) => ({ default: m.CompetencePage })));
const LessonPage = lazy(() => import("./features/study/LessonPage").then((m) => ({ default: m.LessonPage })));
const PracticeHome = lazy(() => import("./features/practice/PracticeHome").then((m) => ({ default: m.PracticeHome })));
const QuizRun = lazy(() => import("./features/quiz/QuizRun").then((m) => ({ default: m.QuizRun })));
const Review = lazy(() => import("./features/review/Review").then((m) => ({ default: m.Review })));
const CalcHome = lazy(() => import("./features/calc/CalcHome").then((m) => ({ default: m.CalcHome })));
const CalcPractice = lazy(() => import("./features/calc/CalcPractice").then((m) => ({ default: m.CalcPractice })));
const MockHome = lazy(() => import("./features/mock/MockHome").then((m) => ({ default: m.MockHome })));
const MockRun = lazy(() => import("./features/mock/MockRun").then((m) => ({ default: m.MockRun })));
const MockResultPage = lazy(() => import("./features/mock/MockResult").then((m) => ({ default: m.MockResultPage })));
const OralHome = lazy(() => import("./features/oral/OralHome").then((m) => ({ default: m.OralHome })));
const OralSessionPage = lazy(() => import("./features/oral/OralSession").then((m) => ({ default: m.OralSessionPage })));
const ColregsHome = lazy(() => import("./features/colregs/ColregsHome").then((m) => ({ default: m.ColregsHome })));
const ScenarioPlayer = lazy(() => import("./features/colregs/ScenarioPlayer").then((m) => ({ default: m.ScenarioPlayer })));
const More = lazy(() => import("./features/more/More").then((m) => ({ default: m.More })));
const Tracker = lazy(() => import("./features/tracker/Tracker").then((m) => ({ default: m.Tracker })));
const Updates = lazy(() => import("./features/updates/Updates").then((m) => ({ default: m.Updates })));
const Booking = lazy(() => import("./features/booking/Booking").then((m) => ({ default: m.Booking })));
const ProfilePage = lazy(() => import("./features/account/Profile").then((m) => ({ default: m.ProfilePage })));
const Admin = lazy(() => import("./features/admin/Admin").then((m) => ({ default: m.Admin })));
const ProgressPage = lazy(() => import("./features/analytics/ProgressPage").then((m) => ({ default: m.ProgressPage })));
const Paywall = lazy(() => import("./features/paywall/Paywall").then((m) => ({ default: m.Paywall })));
const Techniques = lazy(() => import("./features/more/Techniques").then((m) => ({ default: m.Techniques })));

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
    <Suspense fallback={<div className="p-6 text-center text-slate-600">Loading…</div>}>
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
    </Suspense>
  );
}
