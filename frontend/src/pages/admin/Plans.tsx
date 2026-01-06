/**
 * Plans Management Page
 * CRUD for subscription plans
 */

import { useState } from 'react'
import {
    Title,
    Text,
    Card,
    Stack,
    Group,
    Button,
    TextInput,
    NumberInput,
    Textarea,
    Modal,
    Table,
    Badge,
    ActionIcon,
    ThemeIcon,
    Skeleton,
    Paper,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
    IconPlus,
    IconEdit,
    IconTrash,
    IconCrown,
    IconCheck,
} from '@tabler/icons-react'
import {
    usePlans,
    useCreatePlan,
    useUpdatePlan,
    useDeletePlan,
    Plan,
    CreatePlanInput,
} from '@/hooks/usePlans'
import RichTextEditor from '@/components/editor/RichTextEditor'

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value)
}

export default function PlansPage() {
    const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure()
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null)

    // Form state
    const [name, setName] = useState('')
    const [slug, setSlug] = useState('')
    const [description, setDescription] = useState('')
    const [price, setPrice] = useState<number>(0)
    const [featuresText, setFeaturesText] = useState('')
    const [maxAgents, setMaxAgents] = useState<number>(1)

    // Queries & Mutations
    const { data: plans, isLoading } = usePlans()
    const createPlan = useCreatePlan()
    const updatePlan = useUpdatePlan()
    const deletePlan = useDeletePlan()

    const resetForm = () => {
        setName('')
        setSlug('')
        setDescription('')
        setPrice(0)
        setFeaturesText('')
        setMaxAgents(1)
        setEditingPlan(null)
    }

    const handleOpenCreate = () => {
        resetForm()
        openModal()
    }

    const handleOpenEdit = (plan: Plan) => {
        setEditingPlan(plan)
        setName(plan.name)
        setSlug(plan.slug)
        setDescription(plan.description || '')
        setPrice(plan.price)
        setFeaturesText(plan.features?.join('\n') || '')
        setMaxAgents(plan.max_agents)
        openModal()
    }

    const handleSubmit = async () => {
        const features = featuresText.split('\n').filter(f => f.trim())

        if (editingPlan) {
            await updatePlan.mutateAsync({
                id: editingPlan.id,
                name,
                slug,
                description,
                price,
                features,
                max_agents: maxAgents,
            })
        } else {
            await createPlan.mutateAsync({
                name,
                slug,
                description,
                price,
                features,
                max_agents: maxAgents,
            } as CreatePlanInput)
        }
        closeModal()
        resetForm()
    }

    const handleDelete = (id: string) => {
        if (confirm('Tem certeza que deseja desativar este plano?')) {
            deletePlan.mutate(id)
        }
    }

    return (
        <>
            <Stack gap="lg">
                <Group justify="space-between">
                    <div>
                        <Title order={2}>Planos</Title>
                        <Text c="dimmed" size="sm">
                            Gerencie os planos de assinatura da plataforma
                        </Text>
                    </div>
                    <Button
                        leftSection={<IconPlus size={16} />}
                        onClick={handleOpenCreate}
                    >
                        Novo Plano
                    </Button>
                </Group>

                {/* Plans Grid */}
                {isLoading ? (
                    <Group>
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} height={200} width={300} />
                        ))}
                    </Group>
                ) : (
                    <Group align="stretch">
                        {plans?.map((plan) => (
                            <Card key={plan.id} withBorder padding="lg" radius="md" w={320}>
                                <Group justify="space-between" mb="md">
                                    <Group gap="xs">
                                        <ThemeIcon color="yellow" variant="light">
                                            <IconCrown size={18} />
                                        </ThemeIcon>
                                        <Text fw={600}>{plan.name}</Text>
                                    </Group>
                                    <Group gap={4}>
                                        <ActionIcon
                                            variant="subtle"
                                            onClick={() => handleOpenEdit(plan)}
                                        >
                                            <IconEdit size={16} />
                                        </ActionIcon>
                                        <ActionIcon
                                            variant="subtle"
                                            color="red"
                                            onClick={() => handleDelete(plan.id)}
                                        >
                                            <IconTrash size={16} />
                                        </ActionIcon>
                                    </Group>
                                </Group>

                                <Text size="xl" fw={700} c="teal" mb="xs">
                                    {formatCurrency(plan.price)}
                                    <Text span size="sm" c="dimmed">/mês</Text>
                                </Text>

                                <Text size="sm" c="dimmed" mb="md">
                                    {plan.description || 'Sem descrição'}
                                </Text>

                                <Stack gap={4}>
                                    {plan.features?.slice(0, 4).map((feature, i) => (
                                        <Group key={i} gap="xs">
                                            <ThemeIcon size="xs" color="green" variant="light">
                                                <IconCheck size={10} />
                                            </ThemeIcon>
                                            <Text size="xs">{feature}</Text>
                                        </Group>
                                    ))}
                                    {plan.features && plan.features.length > 4 && (
                                        <Text size="xs" c="dimmed">
                                            +{plan.features.length - 4} recursos
                                        </Text>
                                    )}
                                </Stack>

                                <Badge mt="md" variant="light">
                                    {plan.max_agents} agente(s)
                                </Badge>
                            </Card>
                        ))}

                        {(!plans || plans.length === 0) && (
                            <Paper p="xl" ta="center" bg="dark.6" radius="md" w="100%">
                                <ThemeIcon size={60} radius="xl" variant="light" color="gray" mb="md">
                                    <IconCrown size={30} />
                                </ThemeIcon>
                                <Text c="dimmed">Nenhum plano cadastrado</Text>
                                <Button variant="light" mt="md" onClick={handleOpenCreate}>
                                    Criar primeiro plano
                                </Button>
                            </Paper>
                        )}
                    </Group>
                )}

                {/* Plans Table (Desktop) */}
                {plans && plans.length > 0 && (
                    <Card withBorder padding="lg" radius="md">
                        <Text fw={600} mb="md">Visão Geral</Text>
                        <Table.ScrollContainer minWidth={500}>
                            <Table verticalSpacing="sm" highlightOnHover>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>Plano</Table.Th>
                                        <Table.Th>Preço</Table.Th>
                                        <Table.Th>Agentes</Table.Th>
                                        <Table.Th>Conversas/mês</Table.Th>
                                        <Table.Th>Mensagens/mês</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {plans.map((plan) => (
                                        <Table.Tr key={plan.id}>
                                            <Table.Td>
                                                <Group gap="xs">
                                                    <IconCrown size={16} color="var(--mantine-color-yellow-6)" />
                                                    <Text fw={500}>{plan.name}</Text>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text fw={600} c="teal">{formatCurrency(plan.price)}</Text>
                                            </Table.Td>
                                            <Table.Td>{plan.max_agents}</Table.Td>
                                            <Table.Td>{plan.max_conversations_month.toLocaleString()}</Table.Td>
                                            <Table.Td>{plan.max_messages_month.toLocaleString()}</Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Table.ScrollContainer>
                    </Card>
                )}
            </Stack>

            {/* Create/Edit Modal */}
            <Modal
                opened={modalOpened}
                onClose={closeModal}
                title={editingPlan ? 'Editar Plano' : 'Novo Plano'}
                size="lg"
            >
                <Stack gap="md">
                    <TextInput
                        label="Nome do Plano"
                        placeholder="Ex: Pro"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />

                    <TextInput
                        label="Slug (identificador único)"
                        placeholder="Ex: pro"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        required
                    />

                    <div>
                        <Text size="sm" fw={500} mb={4}>Descrição</Text>
                        <RichTextEditor
                            content={description}
                            onChange={setDescription}
                            placeholder="Plano profissional para empresas..."
                            minHeight={100}
                            maxHeight={200}
                        />
                    </div>

                    <NumberInput
                        label="Preço (R$/mês)"
                        placeholder="0.00"
                        prefix="R$ "
                        decimalScale={2}
                        value={price}
                        onChange={(val) => setPrice(val as number)}
                        min={0}
                    />

                    <NumberInput
                        label="Máximo de Agentes"
                        value={maxAgents}
                        onChange={(val) => setMaxAgents(val as number)}
                        min={1}
                    />

                    <Textarea
                        label="Recursos (um por linha)"
                        placeholder="1 Agente IA&#10;500 conversas/mês&#10;Suporte por email"
                        value={featuresText}
                        onChange={(e) => setFeaturesText(e.target.value)}
                        minRows={4}
                    />

                    <Group justify="flex-end">
                        <Button variant="subtle" onClick={closeModal}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            loading={createPlan.isPending || updatePlan.isPending}
                            disabled={!name || !slug || price <= 0}
                        >
                            {editingPlan ? 'Salvar' : 'Criar Plano'}
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </>
    )
}
