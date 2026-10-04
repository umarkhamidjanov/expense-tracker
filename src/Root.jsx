import { useMemo } from 'react'
import { configError, supabase } from './lib/supabase'
import { createSupabaseRepository } from './data/repository'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppProvider } from './context/AppContext'
import AuthScreen from './pages/Auth'
import App from './App'
import ImportPrompt from './components/ImportLocalData'
import { SetupRequired, Splash } from './components/states'

function Gate({ repo }) {
  const { status, user, recovery } = useAuth()
  if (status === 'loading') return <Splash />
  // Distinct keys so opening a reset link while the sign-in form is showing mounts a fresh screen.
  if (user && recovery) return <AuthScreen key="recovery" initialMode="update-password" />
  if (!user) return <AuthScreen key="auth" />
  return (
    // Keyed by user so signing in as someone else starts from a clean slate.
    <AppProvider key={user.id} user={user} repo={repo}>
      <App />
      <ImportPrompt />
    </AppProvider>
  )
}

// `client` and `repo` can be injected (tests); production uses the configured Supabase project.
export default function Root({ client = supabase, repo, setupError = configError }) {
  const repository = useMemo(() => repo ?? (client ? createSupabaseRepository(client) : null), [repo, client])
  return (
    <ThemeProvider>
      {!client || setupError ? (
        <SetupRequired reason={setupError || 'missing'} />
      ) : (
        <AuthProvider client={client}>
          <Gate repo={repository} />
        </AuthProvider>
      )}
    </ThemeProvider>
  )
}
