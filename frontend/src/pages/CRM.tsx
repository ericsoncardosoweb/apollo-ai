export default function CRM() {
    const stages = [
        { name: 'Novo Lead', color: '#94a3b8', count: 12 },
        { name: 'Primeiro Contato', color: '#3b82f6', count: 8 },
        { name: 'Qualificação', color: '#f59e0b', count: 5 },
        { name: 'Proposta Enviada', color: '#8b5cf6', count: 3 },
        { name: 'Negociação', color: '#ec4899', count: 2 },
        { name: 'Fechado Ganho', color: '#22c55e', count: 15 },
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">CRM</h1>
                    <p className="text-muted-foreground">Gerencie seus leads no pipeline</p>
                </div>
                <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground">
                    + Novo Lead
                </button>
            </div>

            {/* Kanban Board */}
            <div className="flex gap-4 overflow-x-auto pb-4">
                {stages.map((stage) => (
                    <div key={stage.name} className="flex-shrink-0 w-72">
                        <div className="bg-muted/50 rounded-xl p-3">
                            {/* Stage header */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                                    <span className="font-medium text-sm">{stage.name}</span>
                                </div>
                                <span className="text-xs bg-background px-2 py-0.5 rounded-full">{stage.count}</span>
                            </div>

                            {/* Lead cards */}
                            <div className="space-y-2">
                                {[1, 2].map((i) => (
                                    <div key={i} className="bg-card border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                <span className="text-xs font-medium text-primary">JD</span>
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">João da Silva</p>
                                                <p className="text-xs text-muted-foreground">+55 11 99999-0000</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">WhatsApp</span>
                                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">Quente</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
