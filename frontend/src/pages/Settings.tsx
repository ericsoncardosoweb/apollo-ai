import { useTenant } from '@/contexts/TenantContext'

export default function Settings() {
    const { tenant } = useTenant()

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold">Configurações</h1>
                <p className="text-muted-foreground">Gerencie as configurações da sua conta</p>
            </div>

            {/* General settings */}
            <div className="bg-card border rounded-xl divide-y">
                <div className="p-6">
                    <h2 className="text-lg font-semibold mb-4">Informações da Empresa</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="text-sm font-medium">Nome da Empresa</label>
                            <input
                                type="text"
                                defaultValue={tenant?.name}
                                className="mt-1 w-full px-3 py-2 rounded-lg border bg-background"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Plano Atual</label>
                            <input
                                type="text"
                                value={tenant?.plan || 'Starter'}
                                disabled
                                className="mt-1 w-full px-3 py-2 rounded-lg border bg-muted text-muted-foreground capitalize"
                            />
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <h2 className="text-lg font-semibold mb-4">Integração WhatsApp</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Gateway</label>
                            <select className="mt-1 w-full px-3 py-2 rounded-lg border bg-background">
                                <option value="evolution">Evolution API</option>
                                <option value="zapi">Z-API</option>
                                <option value="uazapi">UAZAPI</option>
                                <option value="meta">Meta Cloud API</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Instance ID</label>
                            <input
                                type="text"
                                placeholder="Seu ID da instância"
                                className="mt-1 w-full px-3 py-2 rounded-lg border bg-background"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">API Key</label>
                            <input
                                type="password"
                                placeholder="••••••••••••"
                                className="mt-1 w-full px-3 py-2 rounded-lg border bg-background"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground">
                    Salvar Alterações
                </button>
            </div>
        </div>
    )
}
