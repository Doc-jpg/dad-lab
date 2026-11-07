import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTour } from '../components/Tour';
import { useProfile } from '../hooks';
import { APP_NAME } from '../version';

const FAQ: Array<[string, string]> = [
  ['What do the colors mean?', 'Green: fresh, do the planned day, usually the next band day if one is owed this week, otherwise Happy Body. Yellow: short sleep, low energy, fried, fifteen minutes, or sore after bands; the stretch or Happy Body, bands allowed at one set each with no band up. Orange: wiped out, very sore, or five minutes; the floor. Red: sick or something hurts; still the floor, nothing that loads it. There is always something. Training guidance for a healthy adult, not a doctor\'s opinion.'],
  ['What is "the floor"?', 'Five minutes that still count: cat-cow, twenty squats, four minutes of slow breathing. It exists because a zero day is what breaks the habit, and a five-minute day does not. A walk counts the same.'],
  ['How do push and pull days work?', 'They alternate: push (chest press, overhead press, triceps, front squat), then pull (deadlift, seated row, curls, rear delt pull-aparts, calf raises). One or two working sets of 15 to 40 slow reps per move, the last few hard. The app remembers which band you used for each move. Forty clean reps twice in a row and it suggests the next band; under fifteen and it offers the one below. It never changes the band itself.'],
  ['How many band days a week?', 'Whatever you set (default four). The app never offers more than that in a week unless you pick one yourself from the alternatives on a great day. The other days get Happy Body, the stretch, a walk or the floor.'],
  ['How does the Happy Body fit in?', 'Its sequence comes from your book; the app does not copy it. The Happy Body day gives you a one-minute warm-up, a 25-minute clock for one slow pass through your sequence at your level (log the level and dumbbell weight in the note), and five minutes flat on your back afterward, which the book treats as part of the session. Its other pieces live elsewhere in the app: meals on the clock and relaxation under Habits, a weekly weigh-in on Today, a flexibility check every six weeks or so under Days, and its progression order (level up, then faster, then heavier; two weeks without soreness before any step) on the exercise page.'],
  ['I missed a few days. Did I lose anything?', 'The chain restarts, that is all. No badge goes away, no message scolds you, nothing is made up. Check in and do today.'],
  ['Can I do a different day than the one it suggests?', 'Yes, always. The alternatives that fit today are listed under Start, and Days lists all of them. Sore joints you tapped in the check-in stay swapped out even then.'],
  ['What if something hurts?', 'Tap Stop, pick "Something hurts". The day still counts. The check-in asks about pain each morning, and nothing loads a joint you mark. Pain that shows up a few days running gets a note suggesting you have it looked at; the app does not decide that for you.'],
  ['Does it work offline?', 'Yes, all of it. Open it once online after installing, then it runs with no signal. Linked devices catch up the next time one opens with a signal.'],
  ['How do my phone, iPad and laptop stay in step?', 'Settings, Linked devices: send yourself the link (or type the code) on each device. From then on they sync whenever one opens the app with a signal, after every change, and every two minutes while open. The newer copy of anything wins; nothing is overwritten by an older one.'],
  ['How do I install it on the home screen?', 'iPhone and iPad: open the address in Safari, tap Share, then Add to Home Screen. Android: open it in Chrome, menu, Install app. Open it once while online so it can store itself for offline use.'],
  ['How do I back up?', 'Settings, Back up everything, then share the file to Files, iCloud Drive, or a computer. Linked devices are a copy too, but not a backup against a mistake made on both.'],
  ['Is this related to Athletic Lab?', 'Same bones, different person. Athletic Lab is Eli\'s; this is yours. Separate apps, separate data, same cloud project with different codes so the rows never meet.']
];

export function HelpPage() {
  const tour = useTour();
  const nav = useNavigate();
  const athlete = useProfile();
  const [q, setQ] = useState('');
  const shown = FAQ.filter(([a, b]) => !q || (a + ' ' + b).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="col">
      <div className="row between"><h1>Help</h1>{athlete && <Link className="btn sm" to="/settings">Settings</Link>}</div>
      <div className="card">
        <p className="small">{APP_NAME} is your daily training guide: bands when you are fresh, the Happy Body or a stretch when you are not, the floor when there is nothing left, and a check-in that picks which. It says why, and it never punishes a missed day. It is not medical advice.</p>
        {athlete && <button className="btn primary block" onClick={() => { nav('/today'); setTimeout(tour.start, 150); }}>Take the one-minute tour</button>}
      </div>
      <input className="input" placeholder="Search the questions" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card">
        {shown.map(([a, b]) => <details key={a} className="faq"><summary>{a}</summary><p className="small">{b}</p></details>)}
        {shown.length === 0 && <div className="small muted">Nothing matches.</div>}
      </div>
    </div>
  );
}
