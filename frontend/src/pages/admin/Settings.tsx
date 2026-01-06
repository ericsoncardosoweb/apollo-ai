/**
 * Admin Settings - Configurações Dinâmicas da Empresa
 */

import { useState, useEffect } from 'react'
import {
    Title,
    Text,
    Card,
    Stack,
    Group,
    Button,
    TextInput,
    Switch,
    Divider,
    Tabs,
    ThemeIcon,
    SimpleGrid,
    Select,
    Textarea,
    NumberInput,
    Alert,
    Code,
    MultiSelect,
    Paper,
    ColorInput,
    Skeleton,
    PasswordInput,
} from '@mantine/core'
import {
    IconDeviceFloppy,
    IconSettings,
    IconBrandWhatsapp,
    IconClock,
    IconRobot,
    IconBell,
    IconPalette,
    IconDatabase,
    IconRefresh,
    IconShield,
    IconWebhook,
} from '@tabler/icons-react'
import {
    useTenantSettings,
    useBulkUpdateSettings,
} from '@/hooks/useConnections'
import { useClientDatabaseStatus } from '@/hooks/useClientSupabase'
import { useViewContext } from '@/contexts/ViewContext'
import DatabaseSetupForm from '@/components/company/DatabaseSetupForm'

const DAYS_OPTIONS = [
    { value: '0', label: 'Domingo' },
    { value: '1', label: 'Segunda' },
    { value: '2', label: 'Terça' },
    { value: '3', label: 'Quarta' },
    { value: '4', label: 'Quinta' },
    { value: '5', label: 'Sexta' },
    { value: '6', label: 'Sábado' },
]

const TIMEZONE_OPTIONS = [
    { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
    { value: 'America/Fortaleza', label: 'Fortaleza (GMT-3)' },
    { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
    { value: 'America/Rio_Branco', label: 'Rio Branco (GMT-5)' },
    { value: 'America/New_York', label: 'New York (GMT-5)' },
    { value: 'Europe/Lisbon', label: 'Lisboa (GMT+0)' },
]

const AI_MODEL_OPTIONS = [
    { value: 'gpt-4', label: 'GPT-4 (Mais inteligente)' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo (Rápido)' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Econômico)' },
    { value: 'claude-3-opus', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
]

export default function AdminSettings() {
    const { selectedCompany } = useViewContext()
    const { isConfigured } = useClientDatabaseStatus()
    const { data: settings, isLoading, refetch, error } = useTenantSettings()
    const bulkUpdate = useBulkUpdateSettings()

    // Form state with defaults
    const [companyName, setCompanyName] = useState('')
    const [timezone, setTimezone] = useState('America/Sao_Paulo')
    const [themeColor, setThemeColor] = useState('#228be6')

    // Chat settings
    const [welcomeMessage, setWelcomeMessage] = useState('')
    const [businessHoursEnabled, setBusinessHoursEnabled] = useState(false)
    const [businessHoursStart, setBusinessHoursStart] = useState('09:00')
    const [businessHoursEnd, setBusinessHoursEnd] = useState('18:00')
    const [businessDays, setBusinessDays] = useState<string[]>(['1', '2', '3', '4', '5'])
    const [outsideHoursReply, setOutsideHoursReply] = useState('')

    // AI settings
    const [aiEnabled, setAiEnabled] = useState(true)
    const [aiModel, setAiModel] = useState('gpt-4')
    const [aiTemperature, setAiTemperature] = useState<number | ''>(0.7)
    const [aiMaxTokens, setAiMaxTokens] = useState<number | ''>(500)

    // Notifications
    const [notifyEmail, setNotifyEmail] = useState(true)
    const [notifyPush, setNotifyPush] = useState(true)
    const [notifyNewConversation, setNotifyNewConversation] = useState(true)
    const [notifyNoResponse, setNotifyNoResponse] = useState(true)

    // Webhook settings
    const [webhookUrl, setWebhookUrl] = useState('')
    const [webhookSecret, setWebhookSecret] = useState('')

    // Detect table not found
    const tableNotFound = error && typeof error === 'object' && 'message' in error &&
        String((error as { message: string }).message).includes('tenant_settings')

    // Load settings into form
    useEffect(() => {
        if (settings) {
            setCompanyName(settings.company_name as string || selectedCompany?.name || '')
            setTimezone(settings.timezone as string || 'America/Sao_Paulo')
            setThemeColor(settings.theme_color as string || '#228be6')

            setWelcomeMessage(settings.welcome_message as string || '')
            const bh = settings.business_hours as { enabled?: boolean; start?: string; end?: string; days?: number[] } | undefined
            if (bh) {
                setBusinessHoursEnabled(bh.enabled || false)
                setBusinessHoursStart(bh.start || '09:00')
                setBusinessHoursEnd(bh.end || '18:00')
                setBusinessDays((bh.days || [1, 2, 3, 4, 5]).map(String))
            }
            setOutsideHoursReply(settings.auto_reply_outside_hours as string || '')

            setAiEnabled(settings.ai_enabled as boolean ?? true)
            setAiModel(settings.ai_model as string || 'gpt-4')
            setAiTemperature(settings.ai_temperature as number ?? 0.7)
            setAiMaxTokens(settings.ai_max_tokens as number ?? 500)

            setNotifyEmail(settings.notifications_email as boolean ?? true)
            setNotifyPush(settings.notifications_push as boolean ?? true)
            setNotifyNewConversation(settings.notify_new_conversation as boolean ?? true)
            setNotifyNoResponse(settings.notify_no_response as boolean ?? true)

            setWebhookUrl(settings.webhook_url as string || '')
            setWebhookSecret(settings.webhook_secret as string || '')
        }
    }, [settings, selectedCompany])

    const handleSave = async () => {
        const updates = [
            { key: 'company_name', value: companyName, category: 'general' },
            { key: 'timezone', value: timezone, category: 'general' },
            { key: 'theme_color', value: themeColor, category: 'general' },
            { key: 'welcome_message', value: welcomeMessage, category: 'chat' },
            {
                key: 'business_hours',
                value: {
                    enabled: businessHoursEnabled,
                    start: businessHoursStart,
                    end: businessHoursEnd,
                    days: businessDays.map(Number)
                },
                category: 'chat'
            },
            { key: 'auto_reply_outside_hours', value: outsideHoursReply, category: 'chat' },
            { key: 'ai_enabled', value: aiEnabled, category: 'ai' },
            { key: 'ai_model', value: aiModel, category: 'ai' },
            { key: 'ai_temperature', value: aiTemperature, category: 'ai' },
            { key: 'ai_max_tokens', value: aiMaxTokens, category: 'ai' },
            { key: 'notifications_email', value: notifyEmail, category: 'notifications' },
            { key: 'notifications_push', value: notifyPush, category: 'notifications' },
            { key: 'notify_new_conversation', value: notifyNewConversation, category: 'notifications' },
            { key: 'notify_no_response', value: notifyNoResponse, category: 'notifications' },
            { key: 'webhook_url', value: webhookUrl, category: 'integrations' },
            { key: 'webhook_secret', value: webhookSecret, category: 'integrations' },
        ]

        await bulkUpdate.mutateAsync(updates)
    }

    if (tableNotFound) {
        return (
            <Stack gap="lg">
                <Title order={2}>Configurações</Title>
                <Alert
                    icon={<IconDatabase size={16} />}
                    color="yellow"
                    title="Migração Necessária"
                >
                    <Text size="sm" mb="sm">
                        A tabela de configurações não foi encontrada. Execute a migração SQL.
                    </Text>
                    <Code block>
                        {`-- Execute no banco do tenant: connections_v2.sql`}
                    </Code>
                </Alert>
            </Stack>
        )
    }

    return (
        <Stack gap="lg">
            <Group justify="space-between">
                <div>
                    <Title order={2}>Configurações</Title>
                    <Text c="dimmed" size="sm">
                        Configurações de {selectedCompany?.name || 'empresa'}
                    </Text>
                </div>
                <Group>
                    <Button
                        variant="subtle"
                        leftSection={<IconRefresh size={16} />}
                        onClick={() => refetch()}
                    >
                        Recarregar
                    </Button>
                    <Button
                        leftSection={<IconDeviceFloppy size={16} />}
                        onClick={handleSave}
                        loading={bulkUpdate.isPending}
                        disabled={!isConfigured}
                    >
                        Salvar Configurações
                    </Button>
                </Group>
            </Group>

            {!isConfigured && (
                <Alert icon={<IconDatabase size={16} />} color="yellow" title="Banco não configurado">
                    Configure o banco de dados do cliente para gerenciar configurações.
                </Alert>
            )}

            {isLoading ? (
                <Stack gap="md">
                    <Skeleton height={200} />
                    <Skeleton height={200} />
                </Stack>
            ) : (
                <Tabs defaultValue="general">
                    <Tabs.List>
                        <Tabs.Tab value="general" leftSection={<IconSettings size={16} />}>
                            Geral
                        </Tabs.Tab>
                        <Tabs.Tab value="database" leftSection={<IconDatabase size={16} />}>
                            Banco de Dados
                        </Tabs.Tab>
                        <Tabs.Tab value="chat" leftSection={<IconBrandWhatsapp size={16} />}>
                            Chat
                        </Tabs.Tab>
                        <Tabs.Tab value="ai" leftSection={<IconRobot size={16} />}>
                            Inteligência Artificial
                        </Tabs.Tab>
                        <Tabs.Tab value="notifications" leftSection={<IconBell size={16} />}>
                            Notificações
                        </Tabs.Tab>
                        <Tabs.Tab value="integrations" leftSection={<IconWebhook size={16} />}>
                            Integrações
                        </Tabs.Tab>
                    </Tabs.List>

                    {/* Database Settings */}
                    <Tabs.Panel value="database" pt="md">
                        {selectedCompany ? (
                            <DatabaseSetupForm
                                tenantId={selectedCompany.id}
                                tenantName={selectedCompany.name}
                                onComplete={() => refetch()}
                            />
                        ) : (
                            <Alert color="yellow" title="Selecione uma empresa">
                                Selecione uma empresa para configurar o banco de dados.
                            </Alert>
                        )}
                    </Tabs.Panel>

                    {/* General Settings */}
                    <Tabs.Panel value="general" pt="md">
                        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                            <Card withBorder padding="lg" radius="md">
                                <Group gap="sm" mb="md">
                                    <ThemeIcon variant="light" color="blue">
                                        <IconSettings size={18} />
                                    </ThemeIcon>
                                    <Text fw={600}>Informações Gerais</Text>
                                </Group>
                                <Stack gap="md">
                                    <TextInput
                                        label="Nome da Empresa"
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                    />
                                    <Select
                                        label="Fuso Horário"
                                        data={TIMEZONE_OPTIONS}
                                        value={timezone}
                                        onChange={(val) => setTimezone(val || 'America/Sao_Paulo')}
                                    />
                                </Stack>
                            </Card>

                            <Card withBorder padding="lg" radius="md">
                                <Group gap="sm" mb="md">
                                    <ThemeIcon variant="light" color="violet">
                                        <IconPalette size={18} />
                                    </ThemeIcon>
                                    <Text fw={600}>Aparência</Text>
                                </Group>
                                <Stack gap="md">
                                    <ColorInput
                                        label="Cor do Tema"
                                        format="hex"
                                        value={themeColor}
                                        onChange={setThemeColor}
                                        swatches={['#228be6', '#15aabf', '#12b886', '#40c057', '#fab005', '#fa5252', '#7950f2', '#be4bdb']}
                                    />
                                </Stack>
                            </Card>
                        </SimpleGrid>
                    </Tabs.Panel>

                    {/* Chat Settings */}
                    <Tabs.Panel value="chat" pt="md">
                        <Stack gap="md">
                            <Card withBorder padding="lg" radius="md">
                                <Group gap="sm" mb="md">
                                    <ThemeIcon variant="light" color="green">
                                        <IconBrandWhatsapp size={18} />
                                    </ThemeIcon>
                                    <Text fw={600}>Mensagens Automáticas</Text>
                                </Group>
                                <Stack gap="md">
                                    <Textarea
                                        label="Mensagem de Boas-Vindas"
                                        description="Enviada automaticamente para novos contatos"
                                        placeholder="Olá! Como posso ajudar você hoje?"
                                        value={welcomeMessage}
                                        onChange={(e) => setWelcomeMessage(e.target.value)}
                                        rows={3}
                                    />
                                </Stack>
                            </Card>

                            <Card withBorder padding="lg" radius="md">
                                <Group gap="sm" mb="md">
                                    <ThemeIcon variant="light" color="orange">
                                        <IconClock size={18} />
                                    </ThemeIcon>
                                    <Text fw={600}>Horário de Atendimento</Text>
                                </Group>
                                <Stack gap="md">
                                    <Switch
                                        label="Habilitar horário de atendimento"
                                        description="Enviar respostas automáticas fora do expediente"
                                        checked={businessHoursEnabled}
                                        onChange={(e) => setBusinessHoursEnabled(e.target.checked)}
                                    />

                                    {businessHoursEnabled && (
                                        <>
                                            <SimpleGrid cols={2}>
                                                <TextInput
                                                    label="Início"
                                                    type="time"
                                                    value={businessHoursStart}
                                                    onChange={(e) => setBusinessHoursStart(e.target.value)}
                                                />
                                                <TextInput
                                                    label="Fim"
                                                    type="time"
                                                    value={businessHoursEnd}
                                                    onChange={(e) => setBusinessHoursEnd(e.target.value)}
                                                />
                                            </SimpleGrid>
                                            <MultiSelect
                                                label="Dias de Atendimento"
                                                data={DAYS_OPTIONS}
                                                value={businessDays}
                                                onChange={setBusinessDays}
                                            />
                                            <Textarea
                                                label="Resposta Fora do Horário"
                                                placeholder="Nosso atendimento funciona de segunda a sexta, das 9h às 18h."
                                                value={outsideHoursReply}
                                                onChange={(e) => setOutsideHoursReply(e.target.value)}
                                                rows={2}
                                            />
                                        </>
                                    )}
                                </Stack>
                            </Card>
                        </Stack>
                    </Tabs.Panel>

                    {/* AI Settings */}
                    <Tabs.Panel value="ai" pt="md">
                        <Card withBorder padding="lg" radius="md">
                            <Group gap="sm" mb="md">
                                <ThemeIcon variant="light" color="violet">
                                    <IconRobot size={18} />
                                </ThemeIcon>
                                <Text fw={600}>Configurações de IA</Text>
                            </Group>
                            <Stack gap="md">
                                <Switch
                                    label="Habilitar IA no atendimento"
                                    description="Permitir que a IA responda automaticamente"
                                    checked={aiEnabled}
                                    onChange={(e) => setAiEnabled(e.target.checked)}
                                />

                                {aiEnabled && (
                                    <>
                                        <Select
                                            label="Modelo de IA"
                                            data={AI_MODEL_OPTIONS}
                                            value={aiModel}
                                            onChange={(val) => setAiModel(val || 'gpt-4')}
                                        />
                                        <SimpleGrid cols={{ base: 1, sm: 2 }}>
                                            <NumberInput
                                                label="Temperatura"
                                                description="0 = Preciso, 1 = Criativo"
                                                value={aiTemperature}
                                                onChange={(val) => setAiTemperature(typeof val === 'number' ? val : 0.7)}
                                                min={0}
                                                max={1}
                                                step={0.1}
                                                decimalScale={1}
                                            />
                                            <NumberInput
                                                label="Máximo de Tokens"
                                                description="Limite de tamanho da resposta"
                                                value={aiMaxTokens}
                                                onChange={(val) => setAiMaxTokens(typeof val === 'number' ? val : 500)}
                                                min={100}
                                                max={4000}
                                                step={100}
                                            />
                                        </SimpleGrid>
                                    </>
                                )}
                            </Stack>
                        </Card>
                    </Tabs.Panel>

                    {/* Notifications */}
                    <Tabs.Panel value="notifications" pt="md">
                        <Card withBorder padding="lg" radius="md">
                            <Group gap="sm" mb="md">
                                <ThemeIcon variant="light" color="pink">
                                    <IconBell size={18} />
                                </ThemeIcon>
                                <Text fw={600}>Preferências de Notificação</Text>
                            </Group>
                            <Stack gap="md">
                                <Switch
                                    label="Notificações por email"
                                    checked={notifyEmail}
                                    onChange={(e) => setNotifyEmail(e.target.checked)}
                                />
                                <Switch
                                    label="Notificações push"
                                    checked={notifyPush}
                                    onChange={(e) => setNotifyPush(e.target.checked)}
                                />
                                <Divider />
                                <Text size="sm" fw={500}>Eventos</Text>
                                <Switch
                                    label="Nova conversa iniciada"
                                    description="Avisar quando um novo contato enviar mensagem"
                                    checked={notifyNewConversation}
                                    onChange={(e) => setNotifyNewConversation(e.target.checked)}
                                />
                                <Switch
                                    label="Conversa sem resposta"
                                    description="Avisar quando houver mensagens não respondidas há mais de 5 minutos"
                                    checked={notifyNoResponse}
                                    onChange={(e) => setNotifyNoResponse(e.target.checked)}
                                />
                            </Stack>
                        </Card>
                    </Tabs.Panel>

                    {/* Integrations */}
                    <Tabs.Panel value="integrations" pt="md">
                        <Card withBorder padding="lg" radius="md">
                            <Group gap="sm" mb="md">
                                <ThemeIcon variant="light" color="cyan">
                                    <IconWebhook size={18} />
                                </ThemeIcon>
                                <Text fw={600}>Webhook de Eventos</Text>
                            </Group>
                            <Text size="sm" c="dimmed" mb="md">
                                Receba notificações em tempo real sobre eventos do sistema
                            </Text>
                            <Stack gap="md">
                                <TextInput
                                    label="URL do Webhook"
                                    placeholder="https://seu-sistema.com/webhook"
                                    value={webhookUrl}
                                    onChange={(e) => setWebhookUrl(e.target.value)}
                                />
                                <PasswordInput
                                    label="Secret (para validação)"
                                    placeholder="Chave secreta para validar requisições"
                                    value={webhookSecret}
                                    onChange={(e) => setWebhookSecret(e.target.value)}
                                />
                                <Alert color="blue" title="Eventos enviados">
                                    <Text size="xs">
                                        • message.received - Nova mensagem recebida<br />
                                        • message.sent - Mensagem enviada<br />
                                        • conversation.started - Nova conversa iniciada<br />
                                        • conversation.closed - Conversa finalizada<br />
                                        • lead.created - Novo lead criado no CRM
                                    </Text>
                                </Alert>
                            </Stack>
                        </Card>
                    </Tabs.Panel>
                </Tabs>
            )}
        </Stack>
    )
}
