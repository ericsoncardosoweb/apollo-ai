/**
 * MigrationAlert - Alert banner for database migrations
 * Shows which clients need updates and allows migration execution
 * Only visible to master/admin users
 */

import { useState } from 'react'
import {
    Alert,
    Badge,
    Button,
    Group,
    Modal,
    Stack,
    Text,
    Table,
    ActionIcon,
    Tooltip,
    Paper,
    CopyButton,
    Code,
    Anchor,
    Stepper,
    Loader,
} from '@mantine/core'
import {
    IconAlertTriangle,
    IconDatabase,
    IconRefresh,
    IconCopy,
    IconCheck,
    IconChevronDown,
    IconChevronUp,
    IconExternalLink,
    IconCode,
    IconRocket,
} from '@tabler/icons-react'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { supabase } from '@/lib/supabase'
import {
    useTenantMigrationStatus,
    CURRENT_MIGRATION_VERSION,
} from '@/hooks/useMigrationStatus'

// Bootstrap SQL - creates exec_sql function for automatic migrations
const BOOTSTRAP_SQL = `-- BOOTSTRAP: Run this ONCE to enable automatic migrations
CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    EXECUTE sql_query;
    RETURN jsonb_build_object('success', true, 'message', 'SQL executed successfully');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'code', SQLSTATE);
END;
$$;

REVOKE ALL ON FUNCTION exec_sql(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;`

// CRM Migration SQL
const CRM_MIGRATION_SQL = `-- CRM ENGINE V2: Tables for pipeline and deals
CREATE TABLE IF NOT EXISTS crm_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    stages JSONB NOT NULL DEFAULT '[]',
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO crm_pipelines (name, description, is_default, stages) 
SELECT 'Funil de Vendas', 'Pipeline padrão', true,
    '[{"id":"lead","name":"Lead","color":"#868e96","position":0},{"id":"qualificacao","name":"Qualificação","color":"#fab005","position":1},{"id":"proposta","name":"Proposta","color":"#228be6","position":2},{"id":"negociacao","name":"Negociação","color":"#7950f2","position":3},{"id":"fechamento","name":"Fechamento","color":"#40c057","position":4,"is_conversion_point":true}]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM crm_pipelines WHERE is_default = true);

CREATE TABLE IF NOT EXISTS crm_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID,
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    pipeline_id UUID,
    current_stage_id VARCHAR(100) NOT NULL DEFAULT 'lead',
    value DECIMAL(12,2) DEFAULT 0,
    cycle_number INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
    assigned_user_id UUID,
    assigned_user_name VARCHAR(255),
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    conversation_id UUID
);

CREATE TABLE IF NOT EXISTS crm_deal_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL,
    from_stage VARCHAR(100),
    to_stage VARCHAR(100) NOT NULL,
    duration_in_stage INT,
    triggered_by VARCHAR(50) DEFAULT 'user',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deal_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_pipelines_all" ON crm_pipelines;
DROP POLICY IF EXISTS "crm_deals_all" ON crm_deals;
DROP POLICY IF EXISTS "crm_deal_history_all" ON crm_deal_history;

CREATE POLICY "crm_pipelines_all" ON crm_pipelines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "crm_deals_all" ON crm_deals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "crm_deal_history_all" ON crm_deal_history FOR ALL USING (true) WITH CHECK (true);`

type TenantInfo = {
    tenant_id: string
    tenant_name: string
    supabase_url: string
    migrations_version: number
    needs_update: boolean
}

export function MigrationAlert() {
    const {
        tenantsNeedingUpdate,
        allUpToDate,
        isLoading,
        refetch,
        isMasterOrAdmin,
        currentVersion
    } = useTenantMigrationStatus()

    const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false)
    const [setupModalOpened, { open: openSetupModal, close: closeSetupModal }] = useDisclosure(false)
    const [collapsed, setCollapsed] = useState(false)
    const [selectedTenant, setSelectedTenant] = useState<TenantInfo | null>(null)
    const [activeStep, setActiveStep] = useState(0)
    const [migrating, setMigrating] = useState<Set<string>>(new Set())

    if (!isMasterOrAdmin) return null
    if (isLoading || allUpToDate) return null

    const getSupabaseUrl = (tenant: TenantInfo) => {
        const match = tenant.supabase_url.match(/https:\/\/([^.]+)\.supabase\.co/)
        return match ? `https://supabase.com/dashboard/project/${match[1]}/sql/new` : tenant.supabase_url
    }

    const handleSetup = (tenant: TenantInfo) => {
        setSelectedTenant(tenant)
        setActiveStep(0)
        openSetupModal()
    }

    const handleRunMigration = async (tenant: TenantInfo) => {
        setMigrating(prev => new Set(prev).add(tenant.tenant_id))

        try {
            const session = await supabase.auth.getSession()
            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/api/v1/tenants/${tenant.tenant_id}/run-migration`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.data.session?.access_token}`
                    },
                    body: JSON.stringify({ target_version: CURRENT_MIGRATION_VERSION })
                }
            )

            const data = await response.json()

            if (response.ok && data.success) {
                notifications.show({
                    title: 'Migração concluída!',
                    message: `${tenant.tenant_name} atualizado para v${data.new_version}`,
                    color: 'green',
                    icon: <IconCheck />
                })
                refetch()
            } else if (response.status === 424) {
                // Needs bootstrap
                handleSetup(tenant)
            } else {
                throw new Error(data.detail || data.message || 'Erro desconhecido')
            }
        } catch (error) {
            notifications.show({
                title: 'Erro na migração',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                color: 'red'
            })
            // Show setup modal as fallback
            handleSetup(tenant)
        } finally {
            setMigrating(prev => {
                const next = new Set(prev)
                next.delete(tenant.tenant_id)
                return next
            })
        }
    }

    const handleMarkComplete = async () => {
        if (!selectedTenant) return

        await supabase
            .from('tenant_database_config')
            .update({ migrations_version: CURRENT_MIGRATION_VERSION })
            .eq('tenant_id', selectedTenant.tenant_id)

        notifications.show({
            title: 'Configuração concluída!',
            message: `${selectedTenant.tenant_name} está pronto para usar o CRM`,
            color: 'green'
        })

        closeSetupModal()
        refetch()
    }

    return (
        <>
            <Alert
                color="orange"
                variant="light"
                icon={<IconAlertTriangle size={20} />}
                title={
                    <Group justify="space-between" style={{ width: '100%' }}>
                        <Group gap="xs">
                            <Text fw={600}>Atualização de Banco de Dados</Text>
                            <Badge color="orange" size="sm">{tenantsNeedingUpdate.length}</Badge>
                        </Group>
                        <ActionIcon variant="subtle" color="orange" size="sm" onClick={() => setCollapsed(!collapsed)}>
                            {collapsed ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
                        </ActionIcon>
                    </Group>
                }
                withCloseButton={false}
                mb="md"
            >
                {!collapsed && (
                    <Stack gap="xs">
                        <Text size="sm">
                            {tenantsNeedingUpdate.length} cliente(s) precisam de atualização no banco de dados.
                        </Text>
                        <Button size="xs" color="orange" leftSection={<IconDatabase size={14} />} onClick={openModal}>
                            Gerenciar Atualizações
                        </Button>
                    </Stack>
                )}
            </Alert>

            {/* Tenant List Modal */}
            <Modal opened={modalOpened} onClose={closeModal} title={<Text fw={600}>Atualizações de Banco</Text>} size="lg">
                <Stack gap="md">
                    <Paper withBorder p="sm">
                        <Group justify="space-between">
                            <Text size="sm">Versão atual: <b>v{currentVersion}</b></Text>
                            <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={() => refetch()}>
                                Atualizar
                            </Button>
                        </Group>
                    </Paper>

                    <Table striped>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Cliente</Table.Th>
                                <Table.Th>Versão</Table.Th>
                                <Table.Th>Ação</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {tenantsNeedingUpdate.map(tenant => (
                                <Table.Tr key={tenant.tenant_id}>
                                    <Table.Td><Text fw={500}>{tenant.tenant_name}</Text></Table.Td>
                                    <Table.Td>
                                        <Badge color={tenant.migrations_version === 0 ? 'red' : 'orange'} variant="light">
                                            v{tenant.migrations_version}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td>
                                        <Group gap="xs">
                                            <Button
                                                size="xs"
                                                color="green"
                                                loading={migrating.has(tenant.tenant_id)}
                                                onClick={() => handleRunMigration(tenant)}
                                            >
                                                {migrating.has(tenant.tenant_id) ? 'Atualizando...' : 'Atualizar'}
                                            </Button>
                                            <Button
                                                size="xs"
                                                variant="light"
                                                color="blue"
                                                onClick={() => handleSetup(tenant)}
                                            >
                                                Manual
                                            </Button>
                                        </Group>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </Stack>
            </Modal>

            {/* Setup Wizard Modal */}
            <Modal opened={setupModalOpened} onClose={closeSetupModal} title={<Text fw={600}>Configurar {selectedTenant?.tenant_name}</Text>} size="xl">
                <Stack gap="md">
                    <Stepper active={activeStep} onStepClick={setActiveStep}>
                        <Stepper.Step label="Bootstrap" description="Habilitar migrações">
                            <Stack gap="md" mt="md">
                                <Alert color="blue" variant="light">
                                    <Text size="sm">Execute este SQL <b>uma única vez</b> para habilitar migrações automáticas:</Text>
                                </Alert>

                                <Paper withBorder p="xs" style={{ maxHeight: 200, overflow: 'auto' }}>
                                    <Code block style={{ fontSize: 11 }}>{BOOTSTRAP_SQL}</Code>
                                </Paper>

                                <Group>
                                    <CopyButton value={BOOTSTRAP_SQL}>
                                        {({ copied, copy }) => (
                                            <Button color={copied ? 'green' : 'blue'} leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />} onClick={copy}>
                                                {copied ? 'Copiado!' : 'Copiar SQL'}
                                            </Button>
                                        )}
                                    </CopyButton>
                                    {selectedTenant && (
                                        <Button variant="light" leftSection={<IconExternalLink size={16} />} component="a" href={getSupabaseUrl(selectedTenant)} target="_blank">
                                            Abrir Supabase
                                        </Button>
                                    )}
                                </Group>

                                <Button onClick={() => setActiveStep(1)} rightSection={<IconRocket size={16} />}>
                                    Próximo: Criar Tabelas CRM
                                </Button>
                            </Stack>
                        </Stepper.Step>

                        <Stepper.Step label="Tabelas CRM" description="Criar estrutura">
                            <Stack gap="md" mt="md">
                                <Alert color="blue" variant="light">
                                    <Text size="sm">Execute este SQL para criar as tabelas do CRM:</Text>
                                </Alert>

                                <Paper withBorder p="xs" style={{ maxHeight: 200, overflow: 'auto' }}>
                                    <Code block style={{ fontSize: 11 }}>{CRM_MIGRATION_SQL}</Code>
                                </Paper>

                                <Group>
                                    <CopyButton value={CRM_MIGRATION_SQL}>
                                        {({ copied, copy }) => (
                                            <Button color={copied ? 'green' : 'blue'} leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />} onClick={copy}>
                                                {copied ? 'Copiado!' : 'Copiar SQL'}
                                            </Button>
                                        )}
                                    </CopyButton>
                                    {selectedTenant && (
                                        <Button variant="light" leftSection={<IconExternalLink size={16} />} component="a" href={getSupabaseUrl(selectedTenant)} target="_blank">
                                            Abrir Supabase
                                        </Button>
                                    )}
                                </Group>

                                <Button onClick={() => setActiveStep(2)} rightSection={<IconCheck size={16} />}>
                                    Próximo: Finalizar
                                </Button>
                            </Stack>
                        </Stepper.Step>

                        <Stepper.Step label="Finalizar" description="Marcar como atualizado">
                            <Stack gap="md" mt="md" align="center">
                                <IconCheck size={48} color="green" />
                                <Text ta="center">
                                    Após executar ambos SQLs no Supabase, clique abaixo para finalizar:
                                </Text>
                                <Button color="green" size="lg" onClick={handleMarkComplete}>
                                    Marcar como Atualizado (v{CURRENT_MIGRATION_VERSION})
                                </Button>
                            </Stack>
                        </Stepper.Step>
                    </Stepper>
                </Stack>
            </Modal>
        </>
    )
}
