import { useState } from 'react'

interface Props {
  onComplete: () => void
}

const STEPS = [
  {
    icon: '👋',
    title: 'Welcome to Nova',
    body: 'Your AI coding assistant lives right inside your workspace. It can read, write, and edit files, search your project, and run commands.\n\nNothing happens without your say-so.',
    points: ['Chat naturally', 'Watch every action it takes', 'Approve before it changes anything']
  },
  {
    icon: '🚀',
    title: 'Quick start',
    body: 'Type your request in the chat box and hit Enter.',
    points: ['"Show me my project"', '"Fix the error in App.tsx"', '"Create a login page"', '"Run the tests"']
  },
  {
    icon: '🎮',
    title: 'Key controls',
    body: 'Everything is designed to be beginner friendly.',
    points: [
      'Plan Mode — Nova explains first, changes nothing',
      'Action cards — approve or deny each change',
      'Files tab — browse your project, click to preview',
      'Auto-Approve — skip the prompts (not recommended for beginners)'
    ]
  }
]

export default function OnboardingModal({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const s = STEPS[step]

  return (
    <div className="modal-backdrop">
      <div className="modal onboard">
        <div className="onboard-body">
          <div className="onboard-icon">{s.icon}</div>
          <h2>{s.title}</h2>
          <p className="onboard-text">{s.body}</p>
          <ul className="onboard-points">
            {s.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="dots">
            {STEPS.map((_, i) => (
              <span key={i} className={`dot ${i === step ? 'on' : ''}`} onClick={() => setStep(i)} />
            ))}
          </div>
        </div>
        <div className="modal-foot onboard-foot">
          {step === 0 && <button className="btn-ghost" onClick={onComplete}>Skip onboarding</button>}
          <div style={{ flex: 1 }} />
          {step < STEPS.length - 1 ? (
            <button className="btn-primary" onClick={() => setStep(step + 1)}>Next →</button>
          ) : (
            <button className="btn-primary" onClick={onComplete}>🚀 Start building</button>
          )}
        </div>
      </div>
    </div>
  )
}
