import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Bot, Eye, EyeOff, Lock } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore(s => s.login)

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      await login({ email, password })
      navigate('/clients')
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Erro ao conectar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen bg-slate-950 flex items-center justify-center p-4"
      style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(51 65 85 / 0.45) 1px, transparent 0)',
        backgroundSize: '28px 28px',
      }}
    >
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500 mb-5 shadow-xl shadow-green-500/30 ring-4 ring-green-500/20">
            <Bot size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">op-chatbot</h1>
          <p className="text-slate-400 text-sm mt-1.5">Painel de controle</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-300 text-sm">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                autoFocus
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-green-500 focus-visible:border-green-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-300 text-sm">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-green-500 focus-visible:border-green-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="border-red-800 bg-red-950/60 text-red-300">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold h-11 mt-1 shadow-lg shadow-green-500/20 transition-colors"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Entrando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Lock size={15} />
                  Entrar
                </span>
              )}
            </Button>

          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-700 text-xs mt-6">
          op-chatbot · Acesso restrito
        </p>

      </div>
    </div>
  )
}
