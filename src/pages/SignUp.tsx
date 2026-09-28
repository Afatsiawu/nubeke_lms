import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, Lock, Mail, User, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/Logo';

export function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const { error: signUpError } = await signUp(email, password, fullName);
    setLoading(false);
    if (signUpError) {
      setError(signUpError);
    } else {
      navigate('/staff/login');
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-forest-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 20% 30%, #dab133 0%, transparent 40%), radial-gradient(circle at 80% 70%, #dd8c3a 0%, transparent 40%)',
        }} />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-400 text-forest-900">
              <BookOpen className="h-6 w-6" strokeWidth={2} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-serif text-lg font-semibold">Nubuke Foundation</span>
              <span className="text-xs uppercase tracking-wider text-gold-300">Library Management System</span>
            </div>
          </div>
        </div>
        <div className="relative space-y-4">
          <h1 className="font-serif text-3xl font-medium leading-tight">
            Join the library team.
          </h1>
          <p className="text-forest-200 text-sm leading-relaxed max-w-sm">
            Create a staff account to manage the catalog, check out books, and track members.
          </p>
        </div>
        <div className="relative text-xs text-forest-300">
          Nubuke Foundation · Ghana
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-semibold text-ink-900">Create staff account</h2>
            <p className="mt-1 text-sm text-ink-500">Register as a library staff member.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="label">Full name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                <input
                  id="name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input pl-10"
                  placeholder="Kofi Mensah"
                  autoComplete="name"
                />
              </div>
            </div>
            <div>
              <label htmlFor="email" className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="you@nubuke.org"
                  autoComplete="email"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10"
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-rust-50 px-3 py-2.5 text-sm text-rust-700">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div className="pt-4 border-t border-ink-100">
            <Link to="/staff/login" className="flex items-center justify-center gap-1.5 text-sm font-medium text-forest-600 hover:text-forest-700">
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
