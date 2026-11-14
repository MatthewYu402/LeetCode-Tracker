import { Link, Route, Routes } from 'react-router'
import Dashboard from './pages/Dashboard.tsx'
import ProblemDetail from './pages/ProblemDetail.tsx'
import ProblemForm from './pages/ProblemForm.tsx'

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="text-lg font-bold tracking-tight text-ink">
            LeetCode Tracker
          </Link>
          <Link to="/problems/new" className="btn btn-primary">
            Add problem
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
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
