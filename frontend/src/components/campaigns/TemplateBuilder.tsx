/**
 * TemplateBuilder - Visual editor for message templates
 * Based on reference UI with drag-and-drop content blocks
 */

import { useState, useCallback, useEffect } from 'react'
import {
    Modal,
    Stack,
    Group,
    Button,
    Text,
    TextInput,
    Textarea,
    Paper,
    ActionIcon,
    ThemeIcon,
    SimpleGrid,
    Menu,
    Divider,
    Badge,
    NumberInput,
    FileButton,
    Checkbox,
    ScrollArea,
    Tooltip,
    Select,
} from '@mantine/core'
import {
    IconMessage,
    IconPhoto,
    IconVideo,
    IconMicrophone,
    IconFile,
    IconClock,
    IconUser,
    IconMapPin,
    IconSticker,
    IconGripVertical,
    IconTrash,
    IconChevronUp,
    IconChevronDown,
    IconPlus,
    IconVariable,
    IconBold,
    IconItalic,
    IconStrikethrough,
    IconMoodSmile,
    IconCode,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import {
    MessageTemplate,
    TemplateContent,
    ContentType,
    useCreateMessageTemplate,
    useUpdateMessageTemplate,
    useTemplateContents,
    useCreateTemplateContent,
    useUpdateTemplateContent,
    useDeleteTemplateContent,
    useReorderTemplateContents,
    CreateContentInput,
} from '@/hooks/useCampaigns'

// Content type config
const CONTENT_TYPES: Array<{
    type: ContentType
    label: string
    icon: React.ReactNode
    color: string
    description: string
}> = [
        { type: 'text', label: 'Texto', icon: <IconMessage size={20} />, color: 'blue', description: 'Mensagem de texto com formatação' },
        { type: 'image', label: 'Imagem', icon: <IconPhoto size={20} />, color: 'green', description: 'Enviar uma imagem' },
        { type: 'video', label: 'Vídeo', icon: <IconVideo size={20} />, color: 'red', description: 'Enviar um vídeo' },
        { type: 'audio', label: 'Áudio', icon: <IconMicrophone size={20} />, color: 'orange', description: 'Enviar áudio ou PTT' },
        { type: 'interval', label: 'Intervalo', icon: <IconClock size={20} />, color: 'gray', description: 'Aguardar antes do próximo bloco' },
        { type: 'contact', label: 'Contato', icon: <IconUser size={20} />, color: 'pink', description: 'Enviar cartão de contato' },
        { type: 'document', label: 'Arquivo', icon: <IconFile size={20} />, color: 'yellow', description: 'Enviar documento/arquivo' },
        { type: 'sticker', label: 'Sticker', icon: <IconSticker size={20} />, color: 'grape', description: 'Enviar um sticker' },
    ]

// System variables
const SYSTEM_VARIABLES = [
    { variable: '{first_name}', label: 'Primeiro Nome' },
    { variable: '{full_name}', label: 'Nome Completo' },
    { variable: '{phone_number}', label: 'Telefone' },
    { variable: '{email}', label: 'Email' },
    { variable: '{company}', label: 'Empresa' },
    { variable: '{city}', label: 'Cidade' },
]

interface ContentBlockProps {
    content: TemplateContent
    index: number
    total: number
    onUpdate: (id: string, data: Partial<CreateContentInput>) => void
    onDelete: (id: string) => void
    onMoveUp: (index: number) => void
    onMoveDown: (index: number) => void
}

function ContentBlock({ content, index, total, onUpdate, onDelete, onMoveUp, onMoveDown }: ContentBlockProps) {
    const typeConfig = CONTENT_TYPES.find(t => t.type === content.content_type)
    const [showVariables, setShowVariables] = useState(false)

    const insertVariable = (variable: string) => {
        if (content.content_type === 'text') {
            const newContent = (content.content || '') + variable
            onUpdate(content.id, { content: newContent })
        }
        setShowVariables(false)
    }

    // Format text with WhatsApp formatting
    const applyFormat = (format: 'bold' | 'italic' | 'strike' | 'code') => {
        const textarea = document.querySelector(`textarea[data-content-id="${content.id}"]`) as HTMLTextAreaElement
        if (!textarea) return

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const text = content.content || ''
        const selected = text.substring(start, end)

        if (!selected) return

        const formats: Record<string, string> = {
            bold: `*${selected}*`,
            italic: `_${selected}_`,
            strike: `~${selected}~`,
            code: `\`\`\`${selected}\`\`\``,
        }

        const newText = text.substring(0, start) + formats[format] + text.substring(end)
        onUpdate(content.id, { content: newText })
    }

    return (
        <Paper withBorder p="md" pos="relative">
            <Group justify="space-between" mb="sm">
                <Group gap="sm">
                    <ActionIcon variant="subtle" color="gray" style={{ cursor: 'grab' }}>
                        <IconGripVertical size={16} />
                    </ActionIcon>
                    <ThemeIcon variant="light" color={typeConfig?.color || 'gray'}>
                        {typeConfig?.icon}
                    </ThemeIcon>
                    <Text fw={500}>{typeConfig?.label}</Text>
                </Group>
                <Group gap="xs">
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={() => onMoveUp(index)}
                        disabled={index === 0}
                    >
                        <IconChevronUp size={16} />
                    </ActionIcon>
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={() => onMoveDown(index)}
                        disabled={index === total - 1}
                    >
                        <IconChevronDown size={16} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="red" onClick={() => onDelete(content.id)}>
                        <IconTrash size={16} />
                    </ActionIcon>
                </Group>
            </Group>

            {/* Text Content */}
            {content.content_type === 'text' && (
                <Stack gap="xs">
                    <Text size="sm" c="dimmed">Conteúdo da Mensagem *</Text>
                    <Textarea
                        data-content-id={content.id}
                        value={content.content || ''}
                        onChange={(e) => onUpdate(content.id, { content: e.target.value })}
                        placeholder="Oi {first_name}!\n\nSeja bem vindo!"
                        minRows={4}
                        autosize
                        styles={{
                            input: {
                                fontFamily: 'monospace',
                            }
                        }}
                    />
                    <Group gap="xs">
                        <Tooltip label="Negrito">
                            <ActionIcon variant="subtle" onClick={() => applyFormat('bold')}>
                                <IconBold size={16} />
                            </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Itálico">
                            <ActionIcon variant="subtle" onClick={() => applyFormat('italic')}>
                                <IconItalic size={16} />
                            </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Riscado">
                            <ActionIcon variant="subtle" onClick={() => applyFormat('strike')}>
                                <IconStrikethrough size={16} />
                            </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Código">
                            <ActionIcon variant="subtle" onClick={() => applyFormat('code')}>
                                <IconCode size={16} />
                            </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Emoji">
                            <ActionIcon variant="subtle">
                                <IconMoodSmile size={16} />
                            </ActionIcon>
                        </Tooltip>
                        <Divider orientation="vertical" />
                        <Menu opened={showVariables} onChange={setShowVariables} shadow="md" width={200}>
                            <Menu.Target>
                                <Tooltip label="Inserir variável">
                                    <ActionIcon variant="subtle">
                                        <IconVariable size={16} />
                                    </ActionIcon>
                                </Tooltip>
                            </Menu.Target>
                            <Menu.Dropdown>
                                <Menu.Label>Variáveis do Sistema</Menu.Label>
                                {SYSTEM_VARIABLES.map(v => (
                                    <Menu.Item
                                        key={v.variable}
                                        onClick={() => insertVariable(v.variable)}
                                    >
                                        <Group justify="space-between">
                                            <Text size="sm" ff="monospace">{v.variable}</Text>
                                            <Text size="xs" c="dimmed">{v.label}</Text>
                                        </Group>
                                    </Menu.Item>
                                ))}
                                <Menu.Divider />
                                <Menu.Label>Campos Customizados</Menu.Label>
                                <Menu.Item onClick={() => insertVariable('{custom_field}')}>
                                    <Text size="sm" c="dimmed">+ Adicionar campo...</Text>
                                </Menu.Item>
                            </Menu.Dropdown>
                        </Menu>
                    </Group>
                </Stack>
            )}

            {/* Audio Content */}
            {content.content_type === 'audio' && (
                <Stack gap="sm">
                    <Group>
                        <FileButton
                            onChange={(file) => {
                                if (file) {
                                    // In a real app, upload file and get URL
                                    onUpdate(content.id, {
                                        media_filename: file.name,
                                        media_mimetype: file.type,
                                    })
                                }
                            }}
                            accept="audio/*"
                        >
                            {(props) => (
                                <Button {...props} variant="outline" size="sm">
                                    Selecionar Áudio
                                </Button>
                            )}
                        </FileButton>
                        {content.media_filename && (
                            <Badge>{content.media_filename}</Badge>
                        )}
                    </Group>
                    <Checkbox
                        label="Enviar como gravado (PTT/voz)"
                        checked={content.send_as_voice || false}
                        onChange={(e) => onUpdate(content.id, { send_as_voice: e.currentTarget.checked })}
                    />
                </Stack>
            )}

            {/* Image/Video/Document Content */}
            {['image', 'video', 'document', 'sticker'].includes(content.content_type) && (
                <Stack gap="sm">
                    <TextInput
                        label="URL da mídia"
                        placeholder="https://..."
                        value={content.media_url || ''}
                        onChange={(e) => onUpdate(content.id, { media_url: e.target.value })}
                    />
                    <Group>
                        <FileButton
                            onChange={(file) => {
                                if (file) {
                                    // In a real app, upload file and get URL
                                    onUpdate(content.id, {
                                        media_filename: file.name,
                                        media_mimetype: file.type,
                                    })
                                }
                            }}
                            accept={
                                content.content_type === 'image' ? 'image/*' :
                                    content.content_type === 'video' ? 'video/*' :
                                        '*/*'
                            }
                        >
                            {(props) => (
                                <Button {...props} variant="outline" size="sm">
                                    Ou Upload de Arquivo
                                </Button>
                            )}
                        </FileButton>
                        {content.media_filename && (
                            <Badge>{content.media_filename}</Badge>
                        )}
                    </Group>
                </Stack>
            )}

            {/* Interval Content */}
            {content.content_type === 'interval' && (
                <NumberInput
                    label="Aguardar (segundos)"
                    description="Tempo de espera antes de enviar o próximo bloco"
                    value={content.interval_seconds || 0}
                    onChange={(val) => onUpdate(content.id, { interval_seconds: typeof val === 'number' ? val : 0 })}
                    min={1}
                    max={300}
                    suffix=" s"
                />
            )}

            {/* Contact Content */}
            {content.content_type === 'contact' && (
                <Stack gap="sm">
                    <TextInput
                        label="Nome do contato"
                        placeholder="João Silva"
                        value={(content.contact_data as any)?.name || ''}
                        onChange={(e) => onUpdate(content.id, {
                            contact_data: { ...(content.contact_data || {}), name: e.target.value }
                        })}
                    />
                    <TextInput
                        label="Telefone"
                        placeholder="+55 11 99999-9999"
                        value={(content.contact_data as any)?.phone || ''}
                        onChange={(e) => onUpdate(content.id, {
                            contact_data: { ...(content.contact_data || {}), phone: e.target.value }
                        })}
                    />
                </Stack>
            )}
        </Paper>
    )
}

interface TemplateBuilderProps {
    opened: boolean
    onClose: () => void
    template?: MessageTemplate | null
    onSaved?: () => void
}

export function TemplateBuilder({ opened, onClose, template, onSaved }: TemplateBuilderProps) {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [category, setCategory] = useState('general')
    const [localContents, setLocalContents] = useState<TemplateContent[]>([])

    const { data: existingContents } = useTemplateContents(template?.id || null)
    const createTemplate = useCreateMessageTemplate()
    const updateTemplate = useUpdateMessageTemplate()
    const createContent = useCreateTemplateContent()
    const updateContent = useUpdateTemplateContent()
    const deleteContent = useDeleteTemplateContent()
    const reorderContents = useReorderTemplateContents()

    // Reset form when modal opens/closes
    useEffect(() => {
        if (opened && template) {
            setName(template.name)
            setDescription(template.description || '')
            setCategory(template.category)
        } else if (opened) {
            setName('')
            setDescription('')
            setCategory('general')
            setLocalContents([])
        }
    }, [opened, template])

    // Sync existing contents
    useEffect(() => {
        if (existingContents) {
            setLocalContents(existingContents)
        }
    }, [existingContents])

    const handleAddContent = async (type: ContentType) => {
        if (!template?.id) {
            // For new template, add to local state
            const newContent: TemplateContent = {
                id: `temp-${Date.now()}`,
                template_id: '',
                content_type: type,
                content: type === 'text' ? '' : null,
                media_url: null,
                media_filename: null,
                media_mimetype: null,
                send_as_voice: false,
                interval_seconds: type === 'interval' ? 5 : null,
                contact_data: type === 'contact' ? {} : null,
                latitude: null,
                longitude: null,
                location_name: null,
                location_address: null,
                position: localContents.length,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }
            setLocalContents([...localContents, newContent])
        } else {
            // For existing template, create in DB
            try {
                await createContent.mutateAsync({
                    template_id: template.id,
                    content_type: type,
                    content: type === 'text' ? '' : undefined,
                    interval_seconds: type === 'interval' ? 5 : undefined,
                    position: localContents.length,
                })
            } catch (e) {
                // Error handled by hook
            }
        }
    }

    const handleUpdateContent = async (id: string, data: Partial<CreateContentInput>) => {
        if (id.startsWith('temp-')) {
            // Update local
            setLocalContents(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
        } else {
            // Update in DB
            await updateContent.mutateAsync({ id, ...data })
        }
    }

    const handleDeleteContent = async (id: string) => {
        if (id.startsWith('temp-')) {
            setLocalContents(prev => prev.filter(c => c.id !== id))
        } else if (template?.id) {
            await deleteContent.mutateAsync({ id, templateId: template.id })
        }
    }

    const handleMoveUp = (index: number) => {
        if (index === 0) return
        const newContents = [...localContents]
        const temp = newContents[index]
        newContents[index] = newContents[index - 1]
        newContents[index - 1] = temp
        // Update positions
        newContents.forEach((c, i) => c.position = i)
        setLocalContents(newContents)
    }

    const handleMoveDown = (index: number) => {
        if (index === localContents.length - 1) return
        const newContents = [...localContents]
        const temp = newContents[index]
        newContents[index] = newContents[index + 1]
        newContents[index + 1] = temp
        // Update positions
        newContents.forEach((c, i) => c.position = i)
        setLocalContents(newContents)
    }

    const handleSave = async () => {
        if (!name.trim()) {
            notifications.show({ title: 'Nome obrigatório', message: 'Digite um nome para o template', color: 'yellow' })
            return
        }

        try {
            let savedTemplate: MessageTemplate

            if (template) {
                // Update existing
                savedTemplate = await updateTemplate.mutateAsync({
                    id: template.id,
                    name,
                    description: description || undefined,
                    category,
                })
            } else {
                // Create new
                savedTemplate = await createTemplate.mutateAsync({
                    name,
                    description: description || undefined,
                    category,
                })
            }

            // Save contents for new template
            if (!template && localContents.length > 0) {
                for (const content of localContents) {
                    await createContent.mutateAsync({
                        template_id: savedTemplate.id,
                        content_type: content.content_type,
                        content: content.content || undefined,
                        media_url: content.media_url || undefined,
                        media_filename: content.media_filename || undefined,
                        send_as_voice: content.send_as_voice,
                        interval_seconds: content.interval_seconds || undefined,
                        contact_data: content.contact_data || undefined,
                        position: content.position,
                    })
                }
            }

            // Reorder if needed
            if (template && localContents.some((c, i) => !c.id.startsWith('temp-') && c.position !== i)) {
                await reorderContents.mutateAsync({
                    templateId: template.id,
                    items: localContents.filter(c => !c.id.startsWith('temp-')).map((c, i) => ({ id: c.id, position: i })),
                })
            }

            onSaved?.()
            onClose()
        } catch (e) {
            // Error handled by hooks
        }
    }

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={template ? 'Editar Template' : 'Novo Template'}
            size="xl"
        >
            <Stack gap="md">
                {/* Header fields */}
                <Group grow>
                    <TextInput
                        label="Nome do Template"
                        placeholder="Ex: Boas Vindas"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                    <Select
                        label="Categoria"
                        data={[
                            { value: 'general', label: 'Geral' },
                            { value: 'onboarding', label: 'Onboarding' },
                            { value: 'nurturing', label: 'Nutrição' },
                            { value: 'promotional', label: 'Promocional' },
                            { value: 'transactional', label: 'Transacional' },
                        ]}
                        value={category}
                        onChange={(v) => setCategory(v || 'general')}
                    />
                </Group>
                <TextInput
                    label="Descrição (opcional)"
                    placeholder="Descreva o propósito deste template"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />

                <Divider label="Conteúdo da Mensagem" labelPosition="center" />

                {/* Content blocks */}
                <ScrollArea h={350}>
                    <Stack gap="sm">
                        {localContents.map((content, index) => (
                            <ContentBlock
                                key={content.id}
                                content={content}
                                index={index}
                                total={localContents.length}
                                onUpdate={handleUpdateContent}
                                onDelete={handleDeleteContent}
                                onMoveUp={handleMoveUp}
                                onMoveDown={handleMoveDown}
                            />
                        ))}

                        {localContents.length === 0 && (
                            <Paper withBorder p="xl" ta="center">
                                <Text c="dimmed">Nenhum conteúdo adicionado</Text>
                                <Text size="sm" c="dimmed">Clique em um tipo abaixo para adicionar</Text>
                            </Paper>
                        )}
                    </Stack>
                </ScrollArea>

                {/* Add Content buttons */}
                <div>
                    <Text size="sm" fw={500} mb="xs">Adicionar Conteúdo</Text>
                    <SimpleGrid cols={4} spacing="xs">
                        {CONTENT_TYPES.map(type => (
                            <Paper
                                key={type.type}
                                withBorder
                                p="sm"
                                ta="center"
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleAddContent(type.type)}
                            >
                                <ThemeIcon
                                    variant="light"
                                    color={type.color}
                                    size="lg"
                                    mx="auto"
                                    mb="xs"
                                >
                                    {type.icon}
                                </ThemeIcon>
                                <Text size="xs">{type.label}</Text>
                            </Paper>
                        ))}
                    </SimpleGrid>
                </div>

                {/* Actions */}
                <Group justify="flex-end">
                    <Button variant="default" onClick={onClose}>Cancelar</Button>
                    <Button
                        onClick={handleSave}
                        loading={createTemplate.isPending || updateTemplate.isPending}
                    >
                        Salvar
                    </Button>
                </Group>
            </Stack>
        </Modal>
    )
}

export default TemplateBuilder
