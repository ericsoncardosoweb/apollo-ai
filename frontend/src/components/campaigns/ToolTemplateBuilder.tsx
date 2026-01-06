/**
 * ToolTemplateBuilder - Builder de Templates para Ferramentas/Gatilhos
 * 
 * Permite criar templates de mensagem para remarketing, gatilhos automáticos,
 * com suporte a blocos de texto, menus, botões de ação e variáveis.
 */

import { useState } from 'react'
import {
    Stack,
    Group,
    TextInput,
    Textarea,
    Button,
    Paper,
    Text,
    ActionIcon,
    Select,
    Badge,
    Code,
    Divider,
    ThemeIcon,
    Card,
    Tooltip,
    SimpleGrid,
    NumberInput,
} from '@mantine/core'
import {
    IconPlus,
    IconTrash,
    IconGripVertical,
    IconMessage,
    IconList,
    IconClick,
    IconSend,
    IconPhoto,
    IconFile,
    IconVariable,
    IconChevronUp,
    IconChevronDown,
} from '@tabler/icons-react'

// =============================================================================
// TYPES
// =============================================================================

export type BlockType = 'text' | 'image' | 'document' | 'menu' | 'buttons' | 'delay'

export interface MenuOption {
    id: string
    number: string  // 1, 2, 3...
    label: string
    action: 'reply' | 'url' | 'call' | 'tool'
    value: string   // Resposta, URL, telefone ou tool_id
}

export interface ButtonOption {
    id: string
    type: 'reply' | 'url' | 'call'
    label: string
    value: string
}

export interface TemplateBlock {
    id: string
    type: BlockType
    content?: string          // Para text, image_url, document_url
    caption?: string          // Para image/document
    menuOptions?: MenuOption[]
    buttons?: ButtonOption[]
    delaySeconds?: number
}

export interface ToolTemplate {
    blocks: TemplateBlock[]
    variables: string[]       // Lista de variáveis usadas: {{nome}}, {{produto}}
}

interface Props {
    value: ToolTemplate
    onChange: (template: ToolTemplate) => void
    readOnly?: boolean
}

// =============================================================================
// VARIABLES
// =============================================================================

const AVAILABLE_VARIABLES = [
    { value: '{{nome}}', label: 'Nome do Contato' },
    { value: '{{primeiro_nome}}', label: 'Primeiro Nome' },
    { value: '{{telefone}}', label: 'Telefone' },
    { value: '{{email}}', label: 'Email' },
    { value: '{{empresa}}', label: 'Empresa' },
    { value: '{{produto}}', label: 'Produto/Serviço' },
    { value: '{{valor}}', label: 'Valor' },
    { value: '{{data_hora}}', label: 'Data/Hora Atual' },
    { value: '{{vencimento}}', label: 'Data de Vencimento' },
    { value: '{{link_pagamento}}', label: 'Link de Pagamento' },
    { value: '{{link_proposta}}', label: 'Link da Proposta' },
]

const BLOCK_TYPES: { type: BlockType; label: string; icon: typeof IconMessage; color: string }[] = [
    { type: 'text', label: 'Texto', icon: IconMessage, color: 'blue' },
    { type: 'image', label: 'Imagem', icon: IconPhoto, color: 'green' },
    { type: 'document', label: 'Documento', icon: IconFile, color: 'orange' },
    { type: 'menu', label: 'Menu Lista', icon: IconList, color: 'violet' },
    { type: 'buttons', label: 'Botões', icon: IconClick, color: 'pink' },
    { type: 'delay', label: 'Aguardar', icon: IconSend, color: 'gray' },
]

// =============================================================================
// COMPONENT
// =============================================================================

export function ToolTemplateBuilder({ value, onChange, readOnly }: Props) {
    const [showVariables, setShowVariables] = useState(false)

    const generateId = () => Math.random().toString(36).slice(2, 11)

    const addBlock = (type: BlockType) => {
        const newBlock: TemplateBlock = {
            id: generateId(),
            type,
        }

        if (type === 'menu') {
            newBlock.content = 'Escolha uma opção:'
            newBlock.menuOptions = [
                { id: generateId(), number: '1', label: 'Opção 1', action: 'reply', value: 'opcao_1' },
            ]
        }

        if (type === 'buttons') {
            newBlock.buttons = [
                { id: generateId(), type: 'reply', label: 'Responder', value: 'resposta_1' },
            ]
        }

        if (type === 'delay') {
            newBlock.delaySeconds = 3
        }

        onChange({
            ...value,
            blocks: [...value.blocks, newBlock],
        })
    }

    const updateBlock = (blockId: string, updates: Partial<TemplateBlock>) => {
        onChange({
            ...value,
            blocks: value.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b),
        })
    }

    const removeBlock = (blockId: string) => {
        onChange({
            ...value,
            blocks: value.blocks.filter(b => b.id !== blockId),
        })
    }

    const moveBlock = (blockId: string, direction: 'up' | 'down') => {
        const index = value.blocks.findIndex(b => b.id === blockId)
        if (index < 0) return

        const newBlocks = [...value.blocks]
        const newIndex = direction === 'up' ? index - 1 : index + 1
        if (newIndex < 0 || newIndex >= newBlocks.length) return

            ;[newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]]
        onChange({ ...value, blocks: newBlocks })
    }

    const addMenuOption = (blockId: string) => {
        const block = value.blocks.find(b => b.id === blockId)
        if (!block || block.type !== 'menu') return

        const options = block.menuOptions || []
        const newOption: MenuOption = {
            id: generateId(),
            number: String(options.length + 1),
            label: `Opção ${options.length + 1}`,
            action: 'reply',
            value: `opcao_${options.length + 1}`,
        }

        updateBlock(blockId, { menuOptions: [...options, newOption] })
    }

    const updateMenuOption = (blockId: string, optionId: string, updates: Partial<MenuOption>) => {
        const block = value.blocks.find(b => b.id === blockId)
        if (!block || !block.menuOptions) return

        updateBlock(blockId, {
            menuOptions: block.menuOptions.map(o => o.id === optionId ? { ...o, ...updates } : o),
        })
    }

    const removeMenuOption = (blockId: string, optionId: string) => {
        const block = value.blocks.find(b => b.id === blockId)
        if (!block || !block.menuOptions) return

        const newOptions = block.menuOptions.filter(o => o.id !== optionId)
        // Renumber
        newOptions.forEach((o, i) => o.number = String(i + 1))
        updateBlock(blockId, { menuOptions: newOptions })
    }

    const addButton = (blockId: string) => {
        const block = value.blocks.find(b => b.id === blockId)
        if (!block || block.type !== 'buttons') return

        const buttons = block.buttons || []
        if (buttons.length >= 3) return // WhatsApp limit

        const newButton: ButtonOption = {
            id: generateId(),
            type: 'reply',
            label: `Botão ${buttons.length + 1}`,
            value: `botao_${buttons.length + 1}`,
        }

        updateBlock(blockId, { buttons: [...buttons, newButton] })
    }

    const updateButton = (blockId: string, buttonId: string, updates: Partial<ButtonOption>) => {
        const block = value.blocks.find(b => b.id === blockId)
        if (!block || !block.buttons) return

        updateBlock(blockId, {
            buttons: block.buttons.map(b => b.id === buttonId ? { ...b, ...updates } : b),
        })
    }

    const removeButton = (blockId: string, buttonId: string) => {
        const block = value.blocks.find(b => b.id === blockId)
        if (!block || !block.buttons) return

        updateBlock(blockId, { buttons: block.buttons.filter(b => b.id !== buttonId) })
    }

    const insertVariable = (variable: string) => {
        // This would need a ref to the focused textarea, simplified for now
        navigator.clipboard.writeText(variable)
    }

    return (
        <Stack gap="md">
            {/* Block Type Selector */}
            {!readOnly && (
                <Card withBorder padding="sm" radius="md" bg="dark.7">
                    <Group gap="xs" wrap="wrap">
                        <Text size="xs" c="dimmed">Adicionar bloco:</Text>
                        {BLOCK_TYPES.map(bt => (
                            <Tooltip key={bt.type} label={bt.label}>
                                <ActionIcon
                                    variant="light"
                                    color={bt.color}
                                    onClick={() => addBlock(bt.type)}
                                >
                                    <bt.icon size={16} />
                                </ActionIcon>
                            </Tooltip>
                        ))}
                        <Divider orientation="vertical" />
                        <Tooltip label="Inserir variável">
                            <ActionIcon
                                variant="light"
                                color="cyan"
                                onClick={() => setShowVariables(!showVariables)}
                            >
                                <IconVariable size={16} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>

                    {showVariables && (
                        <Group gap="xs" mt="xs" wrap="wrap">
                            {AVAILABLE_VARIABLES.map(v => (
                                <Badge
                                    key={v.value}
                                    size="sm"
                                    variant="outline"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => insertVariable(v.value)}
                                >
                                    {v.value}
                                </Badge>
                            ))}
                        </Group>
                    )}
                </Card>
            )}

            {/* Blocks */}
            {value.blocks.length === 0 ? (
                <Paper p="xl" ta="center" bg="dark.6" radius="md">
                    <Text c="dimmed" size="sm">
                        Adicione blocos para criar o template do gatilho
                    </Text>
                </Paper>
            ) : (
                <Stack gap="sm">
                    {value.blocks.map((block, index) => {
                        const blockConfig = BLOCK_TYPES.find(bt => bt.type === block.type)
                        const BlockIcon = blockConfig?.icon || IconMessage

                        return (
                            <Paper key={block.id} p="md" withBorder radius="md" bg="dark.7">
                                <Group justify="space-between" mb="sm">
                                    <Group gap="xs">
                                        <ThemeIcon size="sm" variant="light" color={blockConfig?.color}>
                                            <BlockIcon size={14} />
                                        </ThemeIcon>
                                        <Text size="sm" fw={500}>{blockConfig?.label}</Text>
                                        <Badge size="xs" variant="light">{index + 1}</Badge>
                                    </Group>
                                    {!readOnly && (
                                        <Group gap={4}>
                                            <ActionIcon
                                                size="xs"
                                                variant="subtle"
                                                disabled={index === 0}
                                                onClick={() => moveBlock(block.id, 'up')}
                                            >
                                                <IconChevronUp size={12} />
                                            </ActionIcon>
                                            <ActionIcon
                                                size="xs"
                                                variant="subtle"
                                                disabled={index === value.blocks.length - 1}
                                                onClick={() => moveBlock(block.id, 'down')}
                                            >
                                                <IconChevronDown size={12} />
                                            </ActionIcon>
                                            <ActionIcon
                                                size="xs"
                                                variant="subtle"
                                                color="red"
                                                onClick={() => removeBlock(block.id)}
                                            >
                                                <IconTrash size={12} />
                                            </ActionIcon>
                                        </Group>
                                    )}
                                </Group>

                                {/* Text Block */}
                                {block.type === 'text' && (
                                    <Textarea
                                        placeholder="Digite a mensagem... Use {{variavel}} para personalizar"
                                        value={block.content || ''}
                                        onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                                        autosize
                                        minRows={2}
                                        maxRows={6}
                                        readOnly={readOnly}
                                    />
                                )}

                                {/* Image Block */}
                                {block.type === 'image' && (
                                    <Stack gap="xs">
                                        <TextInput
                                            placeholder="URL da imagem"
                                            value={block.content || ''}
                                            onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                                            readOnly={readOnly}
                                        />
                                        <TextInput
                                            placeholder="Legenda (opcional)"
                                            value={block.caption || ''}
                                            onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                                            readOnly={readOnly}
                                        />
                                    </Stack>
                                )}

                                {/* Document Block */}
                                {block.type === 'document' && (
                                    <Stack gap="xs">
                                        <TextInput
                                            placeholder="URL do documento (PDF, etc)"
                                            value={block.content || ''}
                                            onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                                            readOnly={readOnly}
                                        />
                                        <TextInput
                                            placeholder="Nome do arquivo"
                                            value={block.caption || ''}
                                            onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                                            readOnly={readOnly}
                                        />
                                    </Stack>
                                )}

                                {/* Menu Block */}
                                {block.type === 'menu' && (
                                    <Stack gap="xs">
                                        <Textarea
                                            placeholder="Texto antes do menu..."
                                            value={block.content || ''}
                                            onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                                            autosize
                                            minRows={2}
                                            readOnly={readOnly}
                                        />
                                        <Divider label="Opções do Menu" labelPosition="left" />
                                        {block.menuOptions?.map((option) => (
                                            <Group key={option.id} gap="xs">
                                                <Badge size="lg" variant="filled" color="blue" w={30}>
                                                    {option.number}
                                                </Badge>
                                                <TextInput
                                                    placeholder="Texto da opção"
                                                    value={option.label}
                                                    onChange={(e) => updateMenuOption(block.id, option.id, { label: e.target.value })}
                                                    style={{ flex: 1 }}
                                                    readOnly={readOnly}
                                                />
                                                <Select
                                                    size="xs"
                                                    w={100}
                                                    data={[
                                                        { value: 'reply', label: 'Resposta' },
                                                        { value: 'url', label: 'Link' },
                                                        { value: 'tool', label: 'Ação' },
                                                    ]}
                                                    value={option.action}
                                                    onChange={(val) => updateMenuOption(block.id, option.id, { action: val as 'reply' | 'url' | 'tool' })}
                                                    disabled={readOnly}
                                                />
                                                <TextInput
                                                    placeholder="Valor/ID"
                                                    value={option.value}
                                                    onChange={(e) => updateMenuOption(block.id, option.id, { value: e.target.value })}
                                                    w={120}
                                                    readOnly={readOnly}
                                                />
                                                {!readOnly && (
                                                    <ActionIcon
                                                        variant="subtle"
                                                        color="red"
                                                        size="sm"
                                                        onClick={() => removeMenuOption(block.id, option.id)}
                                                    >
                                                        <IconTrash size={14} />
                                                    </ActionIcon>
                                                )}
                                            </Group>
                                        ))}
                                        {!readOnly && (
                                            <Button
                                                size="xs"
                                                variant="light"
                                                leftSection={<IconPlus size={14} />}
                                                onClick={() => addMenuOption(block.id)}
                                            >
                                                Adicionar Opção
                                            </Button>
                                        )}
                                    </Stack>
                                )}

                                {/* Buttons Block */}
                                {block.type === 'buttons' && (
                                    <Stack gap="xs">
                                        <Text size="xs" c="dimmed">Botões de ação rápida (máx 3)</Text>
                                        {block.buttons?.map((button) => (
                                            <Group key={button.id} gap="xs">
                                                <Select
                                                    size="xs"
                                                    w={100}
                                                    data={[
                                                        { value: 'reply', label: 'Resposta' },
                                                        { value: 'url', label: 'Link' },
                                                        { value: 'call', label: 'Ligar' },
                                                    ]}
                                                    value={button.type}
                                                    onChange={(val) => updateButton(block.id, button.id, { type: val as 'reply' | 'url' | 'call' })}
                                                    disabled={readOnly}
                                                />
                                                <TextInput
                                                    placeholder="Texto do botão"
                                                    value={button.label}
                                                    onChange={(e) => updateButton(block.id, button.id, { label: e.target.value })}
                                                    style={{ flex: 1 }}
                                                    readOnly={readOnly}
                                                />
                                                <TextInput
                                                    placeholder={button.type === 'url' ? 'https://...' : button.type === 'call' ? '+5511...' : 'ID'}
                                                    value={button.value}
                                                    onChange={(e) => updateButton(block.id, button.id, { value: e.target.value })}
                                                    w={150}
                                                    readOnly={readOnly}
                                                />
                                                {!readOnly && (
                                                    <ActionIcon
                                                        variant="subtle"
                                                        color="red"
                                                        size="sm"
                                                        onClick={() => removeButton(block.id, button.id)}
                                                    >
                                                        <IconTrash size={14} />
                                                    </ActionIcon>
                                                )}
                                            </Group>
                                        ))}
                                        {!readOnly && (block.buttons?.length || 0) < 3 && (
                                            <Button
                                                size="xs"
                                                variant="light"
                                                leftSection={<IconPlus size={14} />}
                                                onClick={() => addButton(block.id)}
                                            >
                                                Adicionar Botão
                                            </Button>
                                        )}
                                    </Stack>
                                )}

                                {/* Delay Block */}
                                {block.type === 'delay' && (
                                    <Group gap="xs">
                                        <Text size="sm">Aguardar</Text>
                                        <NumberInput
                                            value={block.delaySeconds || 3}
                                            onChange={(val) => updateBlock(block.id, { delaySeconds: typeof val === 'number' ? val : 3 })}
                                            min={1}
                                            max={60}
                                            w={80}
                                            size="xs"
                                            readOnly={readOnly}
                                        />
                                        <Text size="sm">segundos antes de continuar</Text>
                                    </Group>
                                )}
                            </Paper>
                        )
                    })}
                </Stack>
            )}

            {/* Preview */}
            {value.blocks.length > 0 && (
                <Card withBorder padding="sm" radius="md">
                    <Text size="xs" fw={600} mb="xs">Pré-visualização:</Text>
                    <Stack gap="xs">
                        {value.blocks.map((block, i) => (
                            <Paper key={block.id} p="xs" bg="dark.6" radius="sm">
                                {block.type === 'text' && (
                                    <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
                                        {block.content || '(texto vazio)'}
                                    </Text>
                                )}
                                {block.type === 'image' && <Text size="xs" c="dimmed">[📷 Imagem]</Text>}
                                {block.type === 'document' && <Text size="xs" c="dimmed">[📄 Documento]</Text>}
                                {block.type === 'menu' && (
                                    <>
                                        <Text size="xs">{block.content}</Text>
                                        {block.menuOptions?.map(o => (
                                            <Text key={o.id} size="xs">{o.number}. {o.label}</Text>
                                        ))}
                                    </>
                                )}
                                {block.type === 'buttons' && (
                                    <Group gap="xs">
                                        {block.buttons?.map(b => (
                                            <Badge key={b.id} size="xs" variant="outline">{b.label}</Badge>
                                        ))}
                                    </Group>
                                )}
                                {block.type === 'delay' && (
                                    <Text size="xs" c="dimmed">⏱️ Aguardar {block.delaySeconds}s</Text>
                                )}
                            </Paper>
                        ))}
                    </Stack>
                </Card>
            )}
        </Stack>
    )
}

export default ToolTemplateBuilder
