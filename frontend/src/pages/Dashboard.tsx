import { useTenant } from '@/contexts/TenantContext'
import { MessageSquare, Users, Bot, TrendingUp } from 'lucide-react'

const stats = [
    { name: 'Conversas Ativas', value: '24', change: '+12%', icon: MessageSquare },
    { name: 'Leads do Mês', value: '156', change: '+8%', icon: Users },
    { name: 'Agentes Ativos', value: '3', change: '0%', icon: Bot },
    { name: 'Taxa de Conversão', value: '23%', change: '+5%', icon: TrendingUp },
]

export default function Dashboard() {
    const { tenant } = useTenant()

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground">
                    Bem-vindo ao {tenant?.name || 'Apollo A.I.'}
                </p>
            </div>

            {/* Stats grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <div
                        key={stat.name}
                        className="bg-card border rounded-xl p-6 hover:shadow-md transition-shadow"
                    >
                        <div className="flex items-center justify-between">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <stat.icon className="h-5 w-5 text-primary" />
                            </div>
                            <span className="text-sm font-medium text-green-600">{stat.change}</span>
                        </div>
                        <div className="mt-4">
                            <p className="text-2xl font-bold">{stat.value}</p>
                            <p className="text-sm text-muted-foreground">{stat.name}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Content sections */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Recent conversations */}
                <div className="bg-card border rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-4">Conversas Recentes</h2>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="text-sm font-medium text-primary">JD</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">João da Silva</p>
                                    <p className="text-sm text-muted-foreground truncate">
                                        Olá, gostaria de saber mais sobre...
                                    </p>
                                </div>
                                <span className="text-xs text-muted-foreground">2min</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Performance chart placeholder */}
                <div className="bg-card border rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-4">Performance do Mês</h2>
                    <div className="h-48 flex items-center justify-center bg-muted/50 rounded-lg">
                        <p className="text-muted-foreground">Gráfico em breve</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
