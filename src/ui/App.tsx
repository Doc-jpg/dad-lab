import React, { useEffect } from 'react';
import { NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { TodayPage } from './pages/TodayPage';
import { WorkoutsPage } from './pages/WorkoutsPage';
import { WorkoutPage } from './pages/WorkoutPage';
import { ExercisePage } from './pages/ExercisePage';
import { ProgressPage } from './pages/ProgressPage';
import { HabitsPage } from './pages/HabitsPage';
import { JournalPage } from './pages/JournalPage';
import { SettingsPage } from './pages/SettingsPage';
import { HelpPage } from './pages/HelpPage';
import { SetupPage } from './pages/SetupPage';
import { SessionPage } from './pages/SessionPage';
import { JoinPage } from './pages/JoinPage';
import { startSyncLoop } from '../io/sync';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TourProvider } from './components/Tour';
import { requestPersistence, seedLibrary } from '../db/db';
import { useProfile } from './hooks';

const Icon = {
  today: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  workouts: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 10v4M20 10v4M7 8v8M17 8v8M7 12h10" /></svg>,
  progress: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19l5-6 4 3 7-9M4 21h16" /></svg>,
  habits: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l4 4L19 6" /><circle cx="12" cy="12" r="10" /></svg>,
  journal: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 4h11l3 3v13H5z" /><path d="M8 10h8M8 14h6" /></svg>
};

function Shell() {
  const me = useProfile();
  const loc = useLocation();
  useEffect(() => {
    requestPersistence();
    seedLibrary().catch(() => undefined);
    return startSyncLoop();
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (me?.theme) root.setAttribute('data-theme', me.theme);
  }, [me?.theme]);
  if (me === null) return <div className="empty">Opening…</div>;
  if (!me && loc.pathname !== '/setup' && loc.pathname !== '/help' && loc.pathname !== '/join') return <Navigate to="/setup" replace />;
  const inWorkout = /^\/workout\//.test(loc.pathname);
  return (
    <div className="app">
      {!inWorkout && me && (
        <nav className="tabbar" aria-label="Main">
          <NavLink to="/today">{Icon.today}<span>Today</span></NavLink>
          <NavLink to="/workouts">{Icon.workouts}<span>Days</span></NavLink>
          <NavLink to="/progress">{Icon.progress}<span>Progress</span></NavLink>
          <NavLink to="/habits">{Icon.habits}<span>Habits</span></NavLink>
          <NavLink to="/journal">{Icon.journal}<span>Journal</span></NavLink>
        </nav>
      )}
      <main className="app-main">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/join" element={<JoinPage />} />
            <Route path="/today" element={<TodayPage />} />
            <Route path="/workouts" element={<WorkoutsPage />} />
            <Route path="/workout/:sessionId" element={<WorkoutPage />} />
            <Route path="/sessions/:sessionId" element={<SessionPage />} />
            <Route path="/exercises/:exerciseId" element={<ExercisePage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/habits" element={<HabitsPage />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}

export function App() {
  return (
    <TourProvider>
      <Shell />
    </TourProvider>
  );
}
