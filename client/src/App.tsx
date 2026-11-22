import { Link, NavLink, Route, Routes } from 'react-router'
import Checklists from './pages/Checklists.tsx'
import Dashboard from './pages/Dashboard.tsx'
import ProblemDetail from './pages/ProblemDetail.tsx'
import ProblemForm from './pages/ProblemForm.tsx'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `font-medium hover:text-accent ${isActive ? 'text-accent underline decoration-2 underline-offset-[6px]' : 'text-muted'}`

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <Link to="/" className="text-lg font-bold tracking-tight text-ink">
              LeetCode Tracker
            </Link>
            <nav aria-label="Main" className="flex gap-4">
              <NavLink to="/" end className={navClass}>
                Problems
              </NavLink>
              <NavLink to="/checklists" className={navClass}>
                Checklists
              </NavLink>
            </nav>
          </div>
          <Link to="/problems/new" className="btn btn-primary">
            Add problem
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/checklists" element={<Checklists />} />
          <Route path="/problems/new" element={<ProblemForm />} />
          <Route path="/problems/:id" element={<ProblemDetail />} />
          <Route path="/problems/:id/edit" element={<ProblemForm />} />
          <Route
            path="*"
            element={
              <p>
                That page does not exist. <Link to="/" className="text-accent underline">Go to your problems</Link>
              </p>
            }
          />
        </Routes>
      </main>
    </div>
  )
}
