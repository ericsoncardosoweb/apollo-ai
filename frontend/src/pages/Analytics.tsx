export default function Analytics() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Analytics</h1>
                <p className="text-muted-foreground">Métricas e performance dos seus agentes</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Token usage */}
                <div className="bg-card border rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-4">Uso de Tokens (Mês)</h2>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span>Tokens utilizados</span>
                                <span className="font-medium">45.230 / 100.000</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: '45%' }} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                            <div>
                                <p className="text-2xl font-bold">32.4k</p>
                                <p className="text-sm text-muted-foreground">Input tokens</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold">12.8k</p>
                                <p className="text-sm text-muted-foreground">Output tokens</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Conversation stats */}
                <div className="bg-card border rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-4">Estatísticas de Conversas</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <p className="text-2xl font-bold">156</p>
                            <p className="text-sm text-muted-foreground">Total do mês</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <p className="text-2xl font-bold">2.3min</p>
                            <p className="text-sm text-muted-foreground">Tempo médio</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <p className="text-2xl font-bold">89%</p>
                            <p className="text-sm text-muted-foreground">IA resolveu</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                            <p className="text-2xl font-bold">4.8</p>
                            <p className="text-sm text-muted-foreground">Satisfação</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
