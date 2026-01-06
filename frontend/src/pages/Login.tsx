import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const { signIn } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            await signIn(email, password)
            navigate('/')
        } catch (err: any) {
            setError(err.message || 'Credenciais inválidas')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-primary mx-auto flex items-center justify-center mb-4">
                        <span className="text-3xl font-bold text-primary-foreground">A</span>
                    </div>
                    <h1 className="text-2xl font-bold">Apollo A.I. Advanced</h1>
                    <p className="text-muted-foreground mt-1">Faça login para continuar</p>
                </div>

                {/* Login form */}
                <div className="bg-card border rounded-xl p-6 shadow-lg">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium">
                                E-mail
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={cn(
                                    'w-full px-3 py-2 rounded-lg border bg-background',
                                    'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                                    'placeholder:text-muted-foreground'
                                )}
                                placeholder="seu@email.com"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="password" className="text-sm font-medium">
                                Senha
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={cn(
                                        'w-full px-3 py-2 pr-10 rounded-lg border bg-background',
                                        'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                                        'placeholder:text-muted-foreground'
                                    )}
                                    placeholder="••••••••"
                                    required
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={cn(
                                'w-full py-2.5 px-4 rounded-lg font-medium',
                                'bg-primary text-primary-foreground',
                                'hover:bg-primary/90 transition-colors',
                                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                                'disabled:opacity-50 disabled:cursor-not-allowed',
                                'flex items-center justify-center gap-2'
                            )}
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {loading ? 'Entrando...' : 'Entrar'}
                        </button>
                    </form>
                </div>

                <p className="text-center text-sm text-muted-foreground mt-6">
                    © 2026 Apollo A.I. Advanced. Todos os direitos reservados.
                </p>
            </div>
        </div>
    )
}
