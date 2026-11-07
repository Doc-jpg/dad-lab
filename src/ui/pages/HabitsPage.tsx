import React, { useEffect } from 'react';
import { useHabits, useToday, useAchievements, fmtDate } from '../hooks';
import { setHabit } from '../../db/db';
import { refreshRewards } from '../../engine/today';
import { addDays, type HabitKey } from '../../engine/types';

const HABITS: Array<{ key: HabitKey; title: string; text: string }> = [
  { key: 'water', title: 'Water', text: 'A glass before the coffee, one with every meal, a bottle in the operatory.' },
  { key: 'meals', title: 'Meals on the clock', text: 'The Happy Body way: two meals and three snacks, about three hours apart, same times each day. Protein, and about twice its weight in vegetables.' },
  { key: 'walk', title: 'A walk', text: 'Ten minutes or more, outside, phone in the pocket.' },
  { key: 'sleep', title: 'Seven hours', text: 'In bed at a time that gives seven. Screens off thirty minutes before.' },
  { key: 'relax', title: 'Five minutes flat', text: 'After the session, or on its own: lie down, same music, let everything get heavy.' },
  { key: 'nolate', title: 'Nothing heavy late', text: 'No big meal in the two hours before bed.' }
];

/** The everyday habits and the milestones. Tap what you did; nothing nags. */
export function HabitsPage() {
  const day = useToday();
  const habits = useHabits();
  const badges = useAchievements();
  useEffect(() => { refreshRewards(day).catch(() => undefined); }, [day]);
  const today = habits.filter((h) => h.day === day);
  const isOn = (k: HabitKey) => today.some((h) => h.habit === k && h.done);
  const week = Array.from({ length: 7 }, (_, i) => addDays(day, -6 + i));
  const countOn = (d: string) => habits.filter((h) => h.day === d && h.done).length;

  return (
    <div className="col">
      <h1>Habits</h1>
      <div className="card" data-tour="habits">
        <h3>Today</h3>
        <div className="list mt">
          {HABITS.map((h) => (
            <button key={h.key} className={`item tappable ${isOn(h.key) ? 'on' : ''}`} onClick={() => setHabit(day, h.key, !isOn(h.key))} style={{ textAlign: 'left' }}>
              <span className={`check ${isOn(h.key) ? 'on' : ''}`}>{isOn(h.key) ? '✓' : ''}</span>
              <div className="grow"><div className="title">{h.title}</div><div className="sub">{h.text}</div></div>
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <h3>Last seven days</h3>
        <div className="row mt" style={{ justifyContent: 'space-between' }}>
          {week.map((d) => <div key={d} className="center"><div className="small muted">{fmtDate(d).slice(0, 3)}</div><div className={`pill ${countOn(d) >= 4 ? 'green' : countOn(d) >= 2 ? 'yellow' : ''}`}>{countOn(d)}/{HABITS.length}</div></div>)}
        </div>
      </div>
      <div className="card">
        <h3>Milestones</h3>
        {badges.length === 0 ? <div className="small muted mt">None yet. The first one is a check-in.</div> : (
          <div className="list mt">{badges.map((b) => <div key={b.id} className="item"><div className="grow"><div className="title">{b.title}</div><div className="sub">{b.text} · {fmtDate(b.earnedAt.slice(0, 10))}</div></div></div>)}</div>
        )}
      </div>
    </div>
  );
}
