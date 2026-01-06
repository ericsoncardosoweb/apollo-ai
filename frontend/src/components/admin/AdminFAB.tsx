/**
 * AdminFAB - Floating Action Button for quick admin actions
 * Shows expandable menu with: Add Agent, Add Service, Add RAG
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ActionIcon,
    Affix,
    Transition,
    Stack,
    Tooltip,
    Modal,
    TextInput,
    Textarea,
    Button,
    Group,
    Select,
    NumberInput,
    Switch,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
    IconPlus,
    IconRobot,
    IconPackage,
    IconBook2,
    IconX,
} from '@tabler/icons-react'
import { useCreateAgent } from '@/hooks/useAgents'
import { useCreateClientService } from '@/hooks/useClientServices'

export default function AdminFAB() {
    const navigate = useNavigate()
    const [expanded, setExpanded] = useState(false)

    // Agent modal
    const [agentModalOpened, { open: openAgentModal, close: closeAgentModal }] = useDisclosure()
    const [agentName, setAgentName] = useState('')
    const [agentPrompt, setAgentPrompt] = useState('')

    // Service modal
    const [serviceModalOpened, { open: openServiceModal, close: closeServiceModal }] = useDisclosure()
    const [serviceName, setServiceName] = useState('')
    const [serviceDesc, setServiceDesc] = useState('')
    const [servicePrice, setServicePrice] = useState<number | ''>(0)

    // Mutations
    const createAgent = useCreateAgent()
    const createService = useCreateClientService()

    const handleAddAgent = async () => {
        if (!agentName.trim()) return
        await createAgent.mutateAsync({
            name: agentName,
            system_prompt: agentPrompt || 'Você é um assistente útil.',
            description: 'Criado via FAB',
        })
        setAgentName('')
        setAgentPrompt('')
        closeAgentModal()
    }

    const handleAddService = async () => {
        if (!serviceName.trim()) return
        await createService.mutateAsync({
            name: serviceName,
            description: serviceDesc,
            price: typeof servicePrice === 'number' ? servicePrice : 0,
        })
        setServiceName('')
        setServiceDesc('')
        setServicePrice(0)
        closeServiceModal()
    }

    const handleAddRAG = () => {
        setExpanded(false)
        navigate('/admin/knowledge')
    }

    return (
        <>
            <Affix position={{ bottom: 20, right: 20 }}>
                <Stack gap="sm" align="flex-end">
                    {/* Sub-buttons */}
                    <Transition
                        mounted={expanded}
                        transition="slide-up"
                        duration={200}
                        timingFunction="ease"
                    >
                        {(styles) => (
                            <Stack gap="xs" style={styles}>
                                <Tooltip label="Adicionar Agente IA" position="left">
                                    <ActionIcon
                                        size="lg"
                                        variant="filled"
                                        color="violet"
                                        radius="xl"
                                        onClick={() => { setExpanded(false); openAgentModal() }}
                                    >
                                        <IconRobot size={20} />
                                    </ActionIcon>
                                </Tooltip>

                                <Tooltip label="Adicionar Serviço" position="left">
                                    <ActionIcon
                                        size="lg"
                                        variant="filled"
                                        color="teal"
                                        radius="xl"
                                        onClick={() => { setExpanded(false); openServiceModal() }}
                                    >
                                        <IconPackage size={20} />
                                    </ActionIcon>
                                </Tooltip>

                                <Tooltip label="Adicionar RAG (Base de Conhecimento)" position="left">
                                    <ActionIcon
                                        size="lg"
                                        variant="filled"
                                        color="orange"
                                        radius="xl"
                                        onClick={handleAddRAG}
                                    >
                                        <IconBook2 size={20} />
                                    </ActionIcon>
                                </Tooltip>
                            </Stack>
                        )}
                    </Transition>

                    {/* Main FAB */}
                    <ActionIcon
                        size={56}
                        variant="filled"
                        color="blue"
                        radius="xl"
                        onClick={() => setExpanded(!expanded)}
                        style={{
                            transition: 'transform 0.2s ease',
                            transform: expanded ? 'rotate(45deg)' : 'rotate(0deg)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        }}
                    >
                        {expanded ? <IconX size={24} /> : <IconPlus size={24} />}
                    </ActionIcon>
                </Stack>
            </Affix>

            {/* Agent Modal */}
            <Modal
                opened={agentModalOpened}
                onClose={closeAgentModal}
                title="Novo Agente IA"
                size="md"
            >
                <Stack gap="md">
                    <TextInput
                        label="Nome do Agente"
                        placeholder="Ex: Assistente de Vendas"
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        required
                    />
                    <Textarea
                        label="Prompt do Sistema"
                        placeholder="Instruções para o comportamento do agente..."
                        value={agentPrompt}
                        onChange={(e) => setAgentPrompt(e.target.value)}
                        rows={4}
                    />
                    <Group justify="flex-end">
                        <Button variant="subtle" onClick={closeAgentModal}>Cancelar</Button>
                        <Button
                            onClick={handleAddAgent}
                            loading={createAgent.isPending}
                            disabled={!agentName.trim()}
                        >
                            Criar Agente
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            {/* Service Modal */}
            <Modal
                opened={serviceModalOpened}
                onClose={closeServiceModal}
                title="Novo Serviço"
                size="md"
            >
                <Stack gap="md">
                    <TextInput
                        label="Nome do Serviço"
                        placeholder="Ex: Consulta Inicial"
                        value={serviceName}
                        onChange={(e) => setServiceName(e.target.value)}
                        required
                    />
                    <Textarea
                        label="Descrição"
                        placeholder="Descrição do serviço..."
                        value={serviceDesc}
                        onChange={(e) => setServiceDesc(e.target.value)}
                        rows={3}
                    />
                    <NumberInput
                        label="Preço"
                        placeholder="0,00"
                        prefix="R$ "
                        decimalScale={2}
                        decimalSeparator=","
                        thousandSeparator="."
                        value={servicePrice}
                        onChange={(val) => setServicePrice(typeof val === 'number' ? val : 0)}
                    />
                    <Group justify="flex-end">
                        <Button variant="subtle" onClick={closeServiceModal}>Cancelar</Button>
                        <Button
                            onClick={handleAddService}
                            loading={createService.isPending}
                            disabled={!serviceName.trim()}
                        >
                            Criar Serviço
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </>
    )
}
