import { Bot, Plus } from 'lucide-react'

export default function Agents() {
    const agents = [
        { id: 1, name: 'Vendedor IA', model: 'gpt-4o-mini', status: 'active', conversations: 156, isDefault: true },
        { id: 2, name: 'Suporte IA', model: 'gpt-4o-mini', status: 'active', conversations: 89, isDefault: false },
        { id: 3, name: 'Qualificador', model: 'gpt-4o-mini', status: 'draft', conversations: 0, isDefault: false },
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Agentes de IA</h1>
                    <p className="text-muted-foreground">Configure seus agentes conversacionais</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground">
                    <Plus className="h-4 w-4" />
                    Novo Agente
                </button>
            </div>

            {/* Agents grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {agents.map((agent) => (
                    <div key={agent.id} className="bg-card border rounded-xl p-6 hover:shadow-md transition-shadow cursor-pointer">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 rounded-xl bg-primary/10">
                                <Bot className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex items-center gap-2">
                                {agent.isDefault && (
                                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">Padrão</span>
                                )}
                                <span className={`text-xs px-2 py-0.5 rounded-full ${agent.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                    }`}>
                                    {agent.status === 'active' ? 'Ativo' : 'Rascunho'}
                                </span>
                            </div>
                        </div>
                        <h3 className="font-semibold mb-1">{agent.name}</h3>
                        <p className="text-sm text-muted-foreground mb-4">Modelo: {agent.model}</p>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Conversas</span>
                            <span className="font-medium">{agent.conversations}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
