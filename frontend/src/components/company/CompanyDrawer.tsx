/**
 * Company Drawer - Advanced CRUD with tabs
 * Tabs: Geral | Financeiro | Estágio | Responsável
 */

import { useState, useEffect } from 'react'
import {
    Drawer,
    Tabs,
    TextInput,
    Select,
    NumberInput,
    Switch,
    Button,
    Stack,
    Group,
    Text,
    Avatar,
    ThemeIcon,
    Badge,
    Divider,
    FileInput,
} from '@mantine/core'
import {
    IconBuilding,
    IconCurrencyDollar,
    IconProgress,
    IconUser,
    IconUpload,
    IconCheck,
    IconX,
} from '@tabler/icons-react'
import { useUpdateCompany, Company } from '@/hooks/useCompanies'
import { usePlans } from '@/hooks/usePlans'
import RichTextEditor from '@/components/editor/RichTextEditor'

interface CompanyDrawerProps {
    company: Company | null
    opened: boolean
    onClose: () => void
}

const STAGE_OPTIONS = [
    { value: 'onboarding', label: '🔄 Onboarding', color: 'blue' },
    { value: 'implementation', label: '🛠️ Implantação', color: 'orange' },
    { value: 'published', label: '✅ Publicada', color: 'green' },
    { value: 'cancelled', label: '❌ Cancelada', color: 'red' },
    { value: 'archived', label: '📁 Arquivada', color: 'gray' },
]

export default function CompanyDrawer({ company, opened, onClose }: CompanyDrawerProps) {
    const [activeTab, setActiveTab] = useState<string | null>('geral')

    // Form state
    const [name, setName] = useState('')
    const [status, setStatus] = useState<string>('active')
    const [planId, setPlanId] = useState<string | null>(null)
    const [customPrice, setCustomPrice] = useState<number | null>(null)
    const [stage, setStage] = useState<string | null>('onboarding')
    const [internalNotes, setInternalNotes] = useState('')
    const [responsibleName, setResponsibleName] = useState('')
    const [responsibleEmail, setResponsibleEmail] = useState('')
    const [responsibleWhatsapp, setResponsibleWhatsapp] = useState('')

    // Queries
    const { data: plans } = usePlans()
    const updateCompany = useUpdateCompany()

    // Initialize form when company changes
    useEffect(() => {
        if (company) {
            setName(company.name || '')
            setStatus(company.status || 'active')
            setPlanId((company as any).plan_id || null)
            setCustomPrice((company as any).custom_price || null)
            setStage((company as any).stage || 'onboarding')
            setInternalNotes((company as any).internal_notes || '')
        }
    }, [company])

    const handleSave = () => {
        if (!company) return

        updateCompany.mutate({
            id: company.id,
            name,
            status: status as 'active' | 'inactive' | 'suspended',
            // These would need to be added to the mutation
            // plan_id: planId,
            // custom_price: customPrice,
            // stage,
            // internal_notes: internalNotes,
        }, {
            onSuccess: () => {
                onClose()
            }
        })
    }

    if (!company) return null

    return (
        <Drawer
            opened={opened}
            onClose={onClose}
            title={
                <Group gap="sm">
                    <Avatar color="teal" radius="xl" size="md">
                        {company.name.charAt(0)}
                    </Avatar>
                    <div>
                        <Text fw={600}>{company.name}</Text>
                        <Text size="xs" c="dimmed">{company.slug}</Text>
                    </div>
                </Group>
            }
            position="right"
            size="lg"
            padding="lg"
        >
            <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List grow>
                    <Tabs.Tab value="geral" leftSection={<IconBuilding size={14} />}>
                        Geral
                    </Tabs.Tab>
                    <Tabs.Tab value="financeiro" leftSection={<IconCurrencyDollar size={14} />}>
                        Financeiro
                    </Tabs.Tab>
                    <Tabs.Tab value="estagio" leftSection={<IconProgress size={14} />}>
                        Estágio
                    </Tabs.Tab>
                    <Tabs.Tab value="responsavel" leftSection={<IconUser size={14} />}>
                        Responsável
                    </Tabs.Tab>
                </Tabs.List>

                {/* Tab: Geral */}
                <Tabs.Panel value="geral" pt="md">
                    <Stack gap="md">
                        <TextInput
                            label="Nome da Empresa"
                            placeholder="Minha Empresa Ltda"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />

                        <FileInput
                            label="Logo"
                            placeholder="Upload do logo"
                            leftSection={<IconUpload size={14} />}
                            accept="image/*"
                        />

                        <Group gap="md">
                            <Text size="sm" fw={500}>Status</Text>
                            <Switch
                                checked={status === 'active'}
                                onChange={(e) => setStatus(e.currentTarget.checked ? 'active' : 'inactive')}
                                label={status === 'active' ? 'Ativa' : 'Inativa'}
                                color="green"
                                thumbIcon={
                                    status === 'active' ? (
                                        <IconCheck size={12} color="var(--mantine-color-green-6)" />
                                    ) : (
                                        <IconX size={12} color="var(--mantine-color-red-6)" />
                                    )
                                }
                            />
                        </Group>

                        <Divider my="sm" />

                        <div>
                            <Text size="sm" fw={500} mb="xs">Notas Internas</Text>
                            <RichTextEditor
                                content={internalNotes}
                                onChange={setInternalNotes}
                                placeholder="Anotações sobre esta empresa..."
                                minHeight={150}
                            />
                        </div>
                    </Stack>
                </Tabs.Panel>

                {/* Tab: Financeiro */}
                <Tabs.Panel value="financeiro" pt="md">
                    <Stack gap="md">
                        <Select
                            label="Plano"
                            placeholder="Selecione o plano"
                            data={plans?.map(p => ({
                                value: p.id,
                                label: `${p.name} - ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.price)}/mês`,
                            })) || []}
                            value={planId}
                            onChange={setPlanId}
                        />

                        <NumberInput
                            label="Valor Personalizado (Override)"
                            description="Se preenchido, este valor substitui o preço do plano"
                            placeholder="0.00"
                            prefix="R$ "
                            decimalScale={2}
                            fixedDecimalScale
                            thousandSeparator="."
                            decimalSeparator=","
                            value={customPrice || undefined}
                            onChange={(val) => setCustomPrice(val as number | null)}
                            min={0}
                        />

                        {customPrice && (
                            <Badge color="yellow" variant="light" size="lg">
                                💰 Valor personalizado ativo: R$ {customPrice.toFixed(2)}
                            </Badge>
                        )}

                        <Divider my="sm" label="Informações do Plano" labelPosition="center" />

                        {planId && plans && (
                            <Stack gap="xs">
                                {plans.find(p => p.id === planId)?.features.map((feature, i) => (
                                    <Group key={i} gap="xs">
                                        <ThemeIcon size="xs" color="green" variant="light">
                                            <IconCheck size={10} />
                                        </ThemeIcon>
                                        <Text size="sm">{feature}</Text>
                                    </Group>
                                ))}
                            </Stack>
                        )}
                    </Stack>
                </Tabs.Panel>

                {/* Tab: Estágio */}
                <Tabs.Panel value="estagio" pt="md">
                    <Stack gap="md">
                        <Select
                            label="Estágio do Pipeline"
                            description="Estado atual no processo de onboarding"
                            data={STAGE_OPTIONS}
                            value={stage}
                            onChange={setStage}
                        />

                        <Divider my="sm" label="Visualização do Pipeline" labelPosition="center" />

                        <Group gap="xs" wrap="wrap">
                            {STAGE_OPTIONS.filter(s => !['cancelled', 'archived'].includes(s.value)).map((s) => (
                                <Badge
                                    key={s.value}
                                    color={s.color}
                                    variant={stage === s.value ? 'filled' : 'light'}
                                    size="lg"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setStage(s.value)}
                                >
                                    {s.label}
                                </Badge>
                            ))}
                        </Group>

                        <Text size="xs" c="dimmed" mt="md">
                            Clique em um estágio para alterar rapidamente
                        </Text>
                    </Stack>
                </Tabs.Panel>

                {/* Tab: Responsável */}
                <Tabs.Panel value="responsavel" pt="md">
                    <Stack gap="md">
                        <Text size="sm" c="dimmed">
                            Convide o usuário responsável por esta empresa. Ele receberá um email para definir a senha.
                        </Text>

                        <TextInput
                            label="Nome Completo"
                            placeholder="João da Silva"
                            value={responsibleName}
                            onChange={(e) => setResponsibleName(e.target.value)}
                        />

                        <TextInput
                            label="Email"
                            placeholder="joao@empresa.com"
                            type="email"
                            value={responsibleEmail}
                            onChange={(e) => setResponsibleEmail(e.target.value)}
                        />

                        <TextInput
                            label="WhatsApp"
                            placeholder="+55 11 99999-9999"
                            value={responsibleWhatsapp}
                            onChange={(e) => setResponsibleWhatsapp(e.target.value)}
                        />

                        <Button
                            variant="light"
                            color="blue"
                            disabled={!responsibleEmail}
                        >
                            Enviar Convite
                        </Button>
                    </Stack>
                </Tabs.Panel>
            </Tabs>

            {/* Save Button */}
            <Divider my="lg" />
            <Group justify="flex-end">
                <Button variant="subtle" onClick={onClose}>
                    Cancelar
                </Button>
                <Button
                    onClick={handleSave}
                    loading={updateCompany.isPending}
                    color="teal"
                >
                    Salvar Alterações
                </Button>
            </Group>
        </Drawer>
    )
}
