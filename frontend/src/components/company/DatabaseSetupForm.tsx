/**
 * Database Setup Form - Configuração do Supabase do tenant
 */

import { useState, useEffect } from 'react'
import {
    Stack,
    TextInput,
    Textarea,
    Button,
    Group,
    Paper,
    Text,
    Title,
    Badge,
    Alert,
    Stepper,
    ThemeIcon,
    Progress,
    Divider,
    PasswordInput,
    CopyButton,
    ActionIcon,
    Tooltip,
    Code,
} from '@mantine/core'
import {
    IconDatabase,
    IconCheck,
    IconX,
    IconRefresh,
    IconCopy,
    IconExternalLink,
    IconRocket,
    IconAlertCircle,
    IconLoader,
    IconSettings,
} from '@tabler/icons-react'
import {
    useConfigureDatabase,
    useTestDatabaseConnection,
    useRunMigrations,
    useTenantDatabaseConfig,
    DatabaseStatus,
} from '@/hooks/useTenantDatabase'
import { CLIENT_MIGRATIONS_V1 } from '@/lib/clientMigrations'

interface DatabaseSetupFormProps {
    tenantId: string
    tenantName: string
    onComplete?: () => void
}

const STATUS_CONFIG: Record<DatabaseStatus | 'not_configured', { color: string; label: string; icon: React.ReactNode }> = {
    not_configured: { color: 'gray', label: 'Não configurado', icon: <IconDatabase size={16} /> },
    pending: { color: 'yellow', label: 'Pendente', icon: <IconLoader size={16} /> },
    configured: { color: 'blue', label: 'Configurado', icon: <IconSettings size={16} /> },
    testing: { color: 'cyan', label: 'Testando...', icon: <IconLoader size={16} className="animate-spin" /> },
    active: { color: 'green', label: 'Ativo', icon: <IconCheck size={16} /> },
    error: { color: 'red', label: 'Erro', icon: <IconX size={16} /> },
    suspended: { color: 'orange', label: 'Suspenso', icon: <IconAlertCircle size={16} /> },
}

// Edge Function code for copying
const EDGE_FUNCTION_CODE = `// run-client-migrations/index.ts
// Edge Function para executar migrações no Supabase do cliente

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { tenant_id } = await req.json()

    // Conectar ao Supabase Master
    const masterSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar credenciais do tenant
    const { data: config, error: configError } = await masterSupabase
      .from('tenant_database_config')
      .select('supabase_url, supabase_service_key, migrations_version')
      .eq('tenant_id', tenant_id)
      .single()

    if (configError || !config?.supabase_service_key) {
      throw new Error('Credenciais não encontradas')
    }

    // Conectar ao Supabase do cliente
    const clientSupabase = createClient(
      config.supabase_url,
      config.supabase_service_key
    )

    // Verificar se tabelas existem
    const { error: testError } = await clientSupabase
      .from('services_catalog')
      .select('id')
      .limit(1)

    const newVersion = (config.migrations_version || 0) + 1

    // Atualizar versão
    await masterSupabase
      .from('tenant_database_config')
      .update({
        migrations_version: newVersion,
        last_migration_at: new Date().toISOString(),
        status: 'active',
        status_message: 'Migrações v' + newVersion + ' aplicadas',
      })
      .eq('tenant_id', tenant_id)

    return new Response(
      JSON.stringify({ success: true, message: 'Versão atualizada para v' + newVersion }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})`

export default function DatabaseSetupForm({ tenantId, tenantName, onComplete }: DatabaseSetupFormProps) {
    const [activeStep, setActiveStep] = useState(0)
    const [supabaseUrl, setSupabaseUrl] = useState('')
    const [anonKey, setAnonKey] = useState('')
    const [serviceKey, setServiceKey] = useState('')

    const { data: config, isLoading, isError } = useTenantDatabaseConfig(tenantId)
    const configureDatabase = useConfigureDatabase()
    const testConnection = useTestDatabaseConnection()
    const runMigrations = useRunMigrations()

    // Pre-fill form ONLY if config exists with actual data
    useEffect(() => {
        if (isLoading) return // Wait for data to load

        if (config && config.supabase_url) {
            setSupabaseUrl(config.supabase_url || '')
            setAnonKey(config.supabase_anon_key || '')
            setServiceKey(config.supabase_service_key || '')

            // Set step based on ACTUAL saved status
            if (config.status === 'active' && config.migrations_version > 0) {
                setActiveStep(3)
            } else if (config.status === 'active') {
                setActiveStep(2)
            } else if (config.status === 'configured' || config.status === 'error') {
                setActiveStep(1)
            } else {
                setActiveStep(0)
            }
        } else {
            // No config found - start fresh
            setActiveStep(0)
        }
    }, [config, isLoading])

    // Show "não configurado" if no config or loading
    const currentStatus = (config && config.supabase_url) ? config.status : 'not_configured'
    const statusConfig = STATUS_CONFIG[currentStatus || 'not_configured']

    const handleSaveCredentials = async () => {
        await configureDatabase.mutateAsync({
            tenant_id: tenantId,
            supabase_url: supabaseUrl,
            supabase_anon_key: anonKey,
            supabase_service_key: serviceKey,
        })
        setActiveStep(1)
    }

    const handleTestConnection = async () => {
        const result = await testConnection.mutateAsync(tenantId)
        if (result.success) {
            setActiveStep(2)
        }
    }

    const handleRunMigrations = async () => {
        await runMigrations.mutateAsync(tenantId)
        setActiveStep(3)
        onComplete?.()
    }

    const isUrlValid = supabaseUrl.match(/^https:\/\/[a-z0-9]+\.supabase\.co$/)

    return (
        <Stack gap="lg">
            {/* Header */}
            <Group justify="space-between">
                <div>
                    <Title order={4}>Configuração do Banco de Dados</Title>
                    <Text size="sm" c="dimmed">
                        Conecte o Supabase de {tenantName}
                    </Text>
                </div>
                <Badge
                    size="lg"
                    color={statusConfig.color}
                    leftSection={statusConfig.icon}
                >
                    {statusConfig.label}
                </Badge>
            </Group>

            {/* Stepper */}
            <Stepper active={activeStep} color="blue" size="sm">
                <Stepper.Step label="Credenciais" description="Configure o Supabase">
                    <Paper withBorder p="md" mt="md" radius="md">
                        <Stack gap="md">
                            <Alert icon={<IconDatabase size={16} />} color="blue">
                                <Text size="sm">
                                    Acesse o painel do Supabase do cliente em{' '}
                                    <Text component="a" href="https://supabase.com/dashboard" target="_blank" c="blue">
                                        supabase.com/dashboard <IconExternalLink size={12} style={{ display: 'inline' }} />
                                    </Text>
                                    {' '}e copie as credenciais de Settings → API.
                                </Text>
                            </Alert>

                            <TextInput
                                label="Supabase URL"
                                description="URL do projeto (ex: https://xyzcompany.supabase.co)"
                                placeholder="https://seu-projeto.supabase.co"
                                value={supabaseUrl}
                                onChange={(e) => setSupabaseUrl(e.target.value)}
                                error={supabaseUrl && !isUrlValid ? 'URL inválida' : undefined}
                                rightSection={
                                    isUrlValid && (
                                        <ThemeIcon color="green" variant="light" size="sm" radius="xl">
                                            <IconCheck size={12} />
                                        </ThemeIcon>
                                    )
                                }
                            />

                            <PasswordInput
                                label="Anon Key (pública)"
                                description="Chave anônima para acesso público"
                                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                value={anonKey}
                                onChange={(e) => setAnonKey(e.target.value)}
                            />

                            <PasswordInput
                                label="Service Role Key (privada)"
                                description="Chave de serviço para operações administrativas (opcional)"
                                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                value={serviceKey}
                                onChange={(e) => setServiceKey(e.target.value)}
                            />

                            <Button
                                onClick={handleSaveCredentials}
                                loading={configureDatabase.isPending}
                                disabled={!supabaseUrl || !anonKey || !isUrlValid}
                            >
                                Salvar Credenciais
                            </Button>
                        </Stack>
                    </Paper>
                </Stepper.Step>

                <Stepper.Step label="Conexão" description="Teste a conexão">
                    <Paper withBorder p="md" mt="md" radius="md">
                        <Stack gap="md">
                            <Text size="sm" c="dimmed">
                                Vamos verificar se as credenciais estão funcionando corretamente.
                            </Text>

                            {currentStatus === 'error' && (
                                <Alert color="red" icon={<IconX size={16} />}>
                                    <Text size="sm" fw={500}>Erro na conexão</Text>
                                    <Text size="xs">{config?.status_message}</Text>
                                </Alert>
                            )}

                            {currentStatus === 'active' && (
                                <Alert color="green" icon={<IconCheck size={16} />}>
                                    <Text size="sm" fw={500}>Conexão estabelecida!</Text>
                                    <Text size="xs">Testado em: {new Date(config?.last_tested_at || '').toLocaleString()}</Text>
                                </Alert>
                            )}

                            <Group>
                                <Button
                                    onClick={handleTestConnection}
                                    loading={testConnection.isPending}
                                    leftSection={<IconRefresh size={16} />}
                                >
                                    {currentStatus === 'active' ? 'Testar Novamente' : 'Testar Conexão'}
                                </Button>

                                {currentStatus === 'active' && (
                                    <Button variant="light" onClick={() => setActiveStep(2)}>
                                        Próximo Passo
                                    </Button>
                                )}
                            </Group>
                        </Stack>
                    </Paper>
                </Stepper.Step>

                <Stepper.Step label="Migrações" description="Crie as tabelas">
                    <Paper withBorder p="md" mt="md" radius="md">
                        <Stack gap="md">
                            <Text size="sm" c="dimmed">
                                Agora vamos criar as tabelas necessárias no banco do cliente.
                            </Text>

                            <Alert color="blue" icon={<IconDatabase size={16} />}>
                                <Text size="sm" fw={500}>Migrações que serão aplicadas:</Text>
                                <Text size="xs" component="ul" mt="xs">
                                    <li>Catálogo de Serviços (services_catalog)</li>
                                    <li>Base de Conhecimento (knowledge_base)</li>
                                    <li>Leads e Pipeline CRM</li>
                                    <li>Conversas e Mensagens</li>
                                </Text>
                            </Alert>

                            {config?.migrations_version && config.migrations_version > 0 ? (
                                <Stack gap="sm">
                                    <Alert color="green" icon={<IconCheck size={16} />}>
                                        <Text size="sm">
                                            Versão atual das migrações: <strong>v{config.migrations_version}</strong>
                                        </Text>
                                        <Text size="xs" c="dimmed">
                                            Última atualização: {new Date(config.last_migration_at || '').toLocaleString()}
                                        </Text>
                                    </Alert>
                                    <Group>
                                        <Button
                                            onClick={handleRunMigrations}
                                            loading={runMigrations.isPending}
                                            leftSection={<IconRefresh size={16} />}
                                            variant="light"
                                        >
                                            Atualizar para v2
                                        </Button>
                                        <CopyButton value={CLIENT_MIGRATIONS_V1}>
                                            {({ copied, copy }) => (
                                                <Button
                                                    variant="subtle"
                                                    color={copied ? 'green' : 'gray'}
                                                    leftSection={<IconCopy size={16} />}
                                                    onClick={copy}
                                                >
                                                    {copied ? 'SQL Copiado!' : 'Copiar SQL'}
                                                </Button>
                                            )}
                                        </CopyButton>
                                    </Group>
                                </Stack>
                            ) : (
                                <Stack gap="sm">
                                    <Group>
                                        <Button
                                            onClick={handleRunMigrations}
                                            loading={runMigrations.isPending}
                                            leftSection={<IconRocket size={16} />}
                                        >
                                            Verificar Tabelas
                                        </Button>
                                        <CopyButton value={CLIENT_MIGRATIONS_V1}>
                                            {({ copied, copy }) => (
                                                <Button
                                                    variant="light"
                                                    color={copied ? 'green' : 'blue'}
                                                    leftSection={<IconCopy size={16} />}
                                                    onClick={copy}
                                                >
                                                    {copied ? 'SQL Copiado!' : 'Copiar SQL'}
                                                </Button>
                                            )}
                                        </CopyButton>
                                    </Group>
                                    <Text size="xs" c="dimmed">
                                        Cole o SQL no SQL Editor do Supabase do cliente para criar as tabelas.
                                    </Text>
                                </Stack>
                            )}

                            {config?.migrations_version && config.migrations_version > 0 && (
                                <Button variant="light" onClick={() => setActiveStep(3)}>
                                    Próximo: Configurar Edge Function
                                </Button>
                            )}
                        </Stack>
                    </Paper>
                </Stepper.Step>

                <Stepper.Step label="Edge Function" description="Automação (opcional)">
                    <Paper withBorder p="md" mt="md" radius="md">
                        <Stack gap="md">
                            <Alert color="cyan" icon={<IconRocket size={16} />}>
                                <Text size="sm" fw={500}>Configuração Opcional</Text>
                                <Text size="xs">
                                    A Edge Function permite executar migrações automaticamente.
                                    Sem ela, você pode usar o botão "Copiar SQL" e executar manualmente.
                                </Text>
                            </Alert>

                            <Text size="sm" fw={500}>Passos para configurar:</Text>

                            <Stack gap="xs">
                                <Text size="sm">
                                    <strong>1.</strong> Acesse{' '}
                                    <Text
                                        component="a"
                                        href="https://supabase.com/dashboard/project/_/functions"
                                        target="_blank"
                                        c="blue"
                                    >
                                        Supabase → Edge Functions <IconExternalLink size={12} style={{ display: 'inline' }} />
                                    </Text>
                                </Text>

                                <Text size="sm">
                                    <strong>2.</strong> Clique em "Create a new function"
                                </Text>

                                <Text size="sm">
                                    <strong>3.</strong> Nome da função: <Code>run-client-migrations</Code>
                                </Text>

                                <Text size="sm">
                                    <strong>4.</strong> Cole o código abaixo:
                                </Text>
                            </Stack>

                            <CopyButton value={EDGE_FUNCTION_CODE}>
                                {({ copied, copy }) => (
                                    <Button
                                        variant="filled"
                                        color={copied ? 'green' : 'blue'}
                                        leftSection={<IconCopy size={16} />}
                                        onClick={copy}
                                        fullWidth
                                    >
                                        {copied ? 'Código Copiado!' : 'Copiar Código da Edge Function'}
                                    </Button>
                                )}
                            </CopyButton>

                            <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
                                <Text size="xs">
                                    Depois de criar a Edge Function, as próximas migrações serão executadas automaticamente!
                                </Text>
                            </Alert>

                            <Group>
                                <Button variant="light" onClick={() => setActiveStep(4)}>
                                    Concluir Setup
                                </Button>
                                <Button variant="subtle" color="gray" onClick={() => setActiveStep(4)}>
                                    Pular (fazer depois)
                                </Button>
                            </Group>
                        </Stack>
                    </Paper>
                </Stepper.Step>

                <Stepper.Completed>
                    <Paper withBorder p="xl" mt="md" radius="md" ta="center">
                        <ThemeIcon size={60} radius="xl" color="green" mb="md">
                            <IconCheck size={30} />
                        </ThemeIcon>
                        <Title order={3}>Banco Configurado!</Title>
                        <Text c="dimmed" mb="md">
                            O Supabase de {tenantName} está pronto para uso.
                        </Text>
                        <Badge size="lg" color="green" mb="lg">Ativo</Badge>

                        <Group justify="center" mt="md">
                            <Button
                                variant="light"
                                leftSection={<IconRefresh size={16} />}
                                onClick={() => setActiveStep(2)}
                            >
                                Atualizar Migrações
                            </Button>
                            <CopyButton value={supabaseUrl}>
                                {({ copied, copy }) => (
                                    <Button
                                        variant="subtle"
                                        color={copied ? 'green' : 'gray'}
                                        leftSection={<IconCopy size={16} />}
                                        onClick={copy}
                                    >
                                        {copied ? 'Copiado!' : 'Copiar URL'}
                                    </Button>
                                )}
                            </CopyButton>
                        </Group>
                    </Paper>
                </Stepper.Completed>
            </Stepper>
        </Stack>
    )
}
