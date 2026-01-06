/**
 * RichTextEditor - Editor com toolbar fixa e scroll interno
 * Usa contenteditable nativo para evitar conflitos de dependência
 */

import { useRef, useEffect, useCallback } from 'react'
import {
    Box,
    Group,
    ActionIcon,
    Tooltip,
    Paper,
    ScrollArea,
} from '@mantine/core'
import {
    IconBold,
    IconItalic,
    IconUnderline,
    IconStrikethrough,
    IconList,
    IconListNumbers,
    IconLink,
    IconCode,
    IconClearFormatting,
} from '@tabler/icons-react'

interface RichTextEditorProps {
    content: string
    onChange: (html: string) => void
    placeholder?: string
    minHeight?: number
    maxHeight?: number
    editable?: boolean
}

export default function RichTextEditor({
    content,
    onChange,
    placeholder = 'Escreva aqui...',
    minHeight = 150,
    maxHeight = 450,
    editable = true,
}: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null)

    // Sync content when prop changes externally
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== content) {
            editorRef.current.innerHTML = content || ''
        }
    }, [content])

    const handleInput = useCallback(() => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML)
        }
    }, [onChange])

    const execCommand = (command: string, value?: string) => {
        document.execCommand(command, false, value)
        editorRef.current?.focus()
        handleInput()
    }

    const handleLink = () => {
        const url = prompt('URL do link:')
        if (url) {
            execCommand('createLink', url)
        }
    }

    const ToolbarButton = ({
        icon: Icon,
        command,
        label,
        onClick,
    }: {
        icon: typeof IconBold
        command?: string
        label: string
        onClick?: () => void
    }) => (
        <Tooltip label={label}>
            <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => (onClick ? onClick() : command && execCommand(command))}
            >
                <Icon size={16} />
            </ActionIcon>
        </Tooltip>
    )

    return (
        <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
            {/* Fixed Toolbar */}
            <Box
                p="xs"
                bg="dark.7"
                style={{
                    borderBottom: '1px solid var(--mantine-color-dark-4)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                }}
            >
                <Group gap={4}>
                    <ToolbarButton icon={IconBold} command="bold" label="Negrito (Ctrl+B)" />
                    <ToolbarButton icon={IconItalic} command="italic" label="Itálico (Ctrl+I)" />
                    <ToolbarButton icon={IconUnderline} command="underline" label="Sublinhado (Ctrl+U)" />
                    <ToolbarButton icon={IconStrikethrough} command="strikeThrough" label="Riscado" />

                    <Box w={1} h={20} bg="dark.4" mx={4} />

                    <ToolbarButton icon={IconList} command="insertUnorderedList" label="Lista" />
                    <ToolbarButton icon={IconListNumbers} command="insertOrderedList" label="Lista numerada" />

                    <Box w={1} h={20} bg="dark.4" mx={4} />

                    <ToolbarButton icon={IconLink} label="Link" onClick={handleLink} />
                    <ToolbarButton icon={IconCode} command="formatBlock" label="Código" />
                    <ToolbarButton icon={IconClearFormatting} command="removeFormat" label="Limpar formatação" />
                </Group>
            </Box>

            {/* Editable Content with Scroll */}
            <ScrollArea.Autosize mah={maxHeight} scrollbarSize={6}>
                <Box
                    ref={editorRef}
                    contentEditable={editable}
                    onInput={handleInput}
                    p="sm"
                    style={{
                        minHeight,
                        outline: 'none',
                        fontFamily: 'inherit',
                        fontSize: 14,
                        lineHeight: 1.6,
                    }}
                    data-placeholder={placeholder}
                    suppressContentEditableWarning
                />
            </ScrollArea.Autosize>

            <style>{`
                [data-placeholder]:empty:before {
                    content: attr(data-placeholder);
                    color: var(--mantine-color-dimmed);
                    pointer-events: none;
                }
            `}</style>
        </Paper>
    )
}
