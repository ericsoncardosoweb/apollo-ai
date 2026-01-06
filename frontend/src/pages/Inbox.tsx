export default function Inbox() {
    return (
        <div className="h-[calc(100vh-8rem)]">
            <div className="flex h-full border rounded-xl overflow-hidden bg-card">
                {/* Conversation list */}
                <div className="w-80 border-r flex flex-col">
                    <div className="p-4 border-b">
                        <input
                            type="search"
                            placeholder="Buscar conversas..."
                            className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div
                                key={i}
                                className={`p-4 border-b cursor-pointer hover:bg-muted/50 ${i === 1 ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <span className="text-sm font-medium text-primary">JD</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <p className="font-medium truncate">+55 11 99999-{i}000</p>
                                            <span className="text-xs text-muted-foreground">2min</span>
                                        </div>
                                        <p className="text-sm text-muted-foreground truncate">
                                            Última mensagem da conversa...
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Chat area */}
                <div className="flex-1 flex flex-col">
                    {/* Chat header */}
                    <div className="p-4 border-b flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-medium text-primary">JD</span>
                            </div>
                            <div>
                                <p className="font-medium">+55 11 99999-1000</p>
                                <p className="text-sm text-green-600">🤖 IA Ativa</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button className="px-3 py-1.5 text-sm rounded-lg border hover:bg-muted">
                                Assumir
                            </button>
                            <button className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground">
                                Ver Lead
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        <div className="flex justify-start">
                            <div className="max-w-[70%] bg-muted rounded-2xl rounded-bl-md px-4 py-2">
                                <p className="text-sm">Olá! Gostaria de saber mais sobre os seus serviços.</p>
                                <span className="text-xs text-muted-foreground">14:30</span>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <div className="max-w-[70%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2">
                                <p className="text-sm">Olá! 👋 Claro, ficarei feliz em ajudar! Sobre qual serviço você gostaria de saber mais?</p>
                                <span className="text-xs opacity-70">14:30 · IA</span>
                            </div>
                        </div>
                    </div>

                    {/* Input area */}
                    <div className="p-4 border-t">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Digite sua mensagem..."
                                className="flex-1 px-4 py-2 rounded-lg border bg-background"
                            />
                            <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground">
                                Enviar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
