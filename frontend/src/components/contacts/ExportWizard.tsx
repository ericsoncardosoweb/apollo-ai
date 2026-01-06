/**
 * Export Wizard - Advanced contact export with field selection and filters
 */

import { useState, useCallback } from 'react'
import {
    Modal,
    Group,
    Button,
    Text,
    Stack,
    Paper,
    Checkbox,
    Select,
    MultiSelect,
    Radio,
    Alert,
    ThemeIcon,
    Divider,
} from '@mantine/core'
import {
    IconDownload,
    IconFileSpreadsheet,
    IconCheck,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { Contact } from '@/hooks/useContacts'
import { formatPhone, formatCPF, formatCNPJ } from '@/utils/validation'

// Exportable fields configuration
const EXPORT_FIELDS = [
    { value: 'name', label: 'Nome', group: 'Dados Básicos', default: true },
    { value: 'email', label: 'Email', group: 'Dados Básicos', default: true },
    { value: 'phone', label: 'Telefone', group: 'Dados Básicos', default: true },
    { value: 'whatsapp', label: 'WhatsApp', group: 'Dados Básicos', default: true },
    { value: 'cpf', label: 'CPF', group: 'Documentos', default: false },
    { value: 'cnpj', label: 'CNPJ', group: 'Documentos', default: false },
    { value: 'type', label: 'Tipo', group: 'Classificação', default: true },
    { value: 'status', label: 'Status', group: 'Classificação', default: true },
    { value: 'tags', label: 'Etiquetas', group: 'Classificação', default: true },
    { value: 'source', label: 'Origem', group: 'Classificação', default: false },
    { value: 'company_name', label: 'Empresa', group: 'Empresa', default: false },
    { value: 'company_role', label: 'Cargo', group: 'Empresa', default: false },
    { value: 'address_city', label: 'Cidade', group: 'Endereço', default: false },
    { value: 'address_state', label: 'Estado', group: 'Endereço', default: false },
    { value: 'notes', label: 'Observações', group: 'Outros', default: false },
    { value: 'created_at', label: 'Data Criação', group: 'Outros', default: true },
]

const TYPE_LABELS: Record<string, string> = {
    lead: 'Lead',
    customer: 'Cliente',
    supplier: 'Fornecedor',
    partner: 'Parceiro',
    other: 'Outro',
}

const STATUS_LABELS: Record<string, string> = {
    active: 'Ativo',
    inactive: 'Inativo',
    blocked: 'Bloqueado',
}

interface ExportWizardProps {
    opened: boolean
    onClose: () => void
    contacts: Contact[]
    selectedIds?: Set<string>
    companyName?: string
}

export function ExportWizard({ opened, onClose, contacts, selectedIds, companyName = 'export' }: ExportWizardProps) {
    const [selectedFields, setSelectedFields] = useState<string[]>(
        EXPORT_FIELDS.filter(f => f.default).map(f => f.value)
    )
    const [exportScope, setExportScope] = useState<'all' | 'selected' | 'filtered'>('all')
    const [format, setFormat] = useState<'csv' | 'xlsx'>('csv')
    const [encoding, setEncoding] = useState<'utf8' | 'latin1'>('utf8')
    const [separator, setSeparator] = useState<',' | ';'>(';')
    const [exporting, setExporting] = useState(false)

    // Determine which contacts to export
    const contactsToExport = exportScope === 'selected' && selectedIds?.size
        ? contacts.filter(c => selectedIds.has(c.id))
        : contacts

    // Format value for export
    const formatValue = useCallback((contact: Contact, field: string): string => {
        const value = contact[field as keyof Contact]

        if (value === null || value === undefined) return ''

        switch (field) {
            case 'phone':
            case 'whatsapp':
                return value ? formatPhone(value as string) : ''
            case 'cpf':
                return value ? formatCPF(value as string) : ''
            case 'cnpj':
                return value ? formatCNPJ(value as string) : ''
            case 'tags':
                return Array.isArray(value) ? value.join(', ') : ''
            case 'type':
                return TYPE_LABELS[value as string] || value as string
            case 'status':
                return STATUS_LABELS[value as string] || value as string
            case 'created_at':
            case 'updated_at':
                return new Date(value as string).toLocaleDateString('pt-BR')
            default:
                return String(value)
        }
    }, [])

    // Escape CSV value
    const escapeCSV = useCallback((value: string, sep: string): string => {
        if (value.includes(sep) || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`
        }
        return value
    }, [])

    // Generate and download CSV
    const handleExport = useCallback(() => {
        if (selectedFields.length === 0) {
            notifications.show({ title: 'Selecione campos', message: 'Selecione pelo menos um campo para exportar', color: 'yellow' })
            return
        }

        setExporting(true)

        try {
            // Build headers
            const headers = selectedFields.map(field => {
                const fieldConfig = EXPORT_FIELDS.find(f => f.value === field)
                return fieldConfig?.label || field
            })

            // Build rows
            const rows = contactsToExport.map(contact => {
                return selectedFields.map(field => {
                    const value = formatValue(contact, field)
                    return escapeCSV(value, separator)
                })
            })

            // Build CSV content
            const csvContent = [
                headers.map(h => escapeCSV(h, separator)).join(separator),
                ...rows.map(row => row.join(separator))
            ].join('\n')

            // Add BOM for Excel compatibility
            const bom = encoding === 'utf8' ? '\ufeff' : ''
            const blob = new Blob([bom + csvContent], {
                type: `text/csv;charset=${encoding === 'utf8' ? 'utf-8' : 'iso-8859-1'}`
            })

            // Download
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `contatos_${companyName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
            a.click()
            URL.revokeObjectURL(url)

            notifications.show({
                title: 'Exportação concluída!',
                message: `${contactsToExport.length} contato(s) exportado(s)`,
                color: 'green'
            })

            onClose()
        } catch (error) {
            notifications.show({
                title: 'Erro na exportação',
                message: 'Não foi possível exportar os contatos',
                color: 'red'
            })
        } finally {
            setExporting(false)
        }
    }, [selectedFields, contactsToExport, separator, encoding, formatValue, escapeCSV, companyName, onClose])

    // Group fields by category
    const fieldGroups = EXPORT_FIELDS.reduce((acc, field) => {
        if (!acc[field.group]) acc[field.group] = []
        acc[field.group].push(field)
        return acc
    }, {} as Record<string, typeof EXPORT_FIELDS>)

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Exportar Contatos"
            size="lg"
        >
            <Stack gap="lg">
                {/* Scope Selection */}
                <Paper withBorder p="md">
                    <Text fw={500} mb="sm">O que exportar?</Text>
                    <Radio.Group value={exportScope} onChange={(v) => setExportScope(v as typeof exportScope)}>
                        <Stack gap="xs">
                            <Radio
                                value="all"
                                label={`Todos os contatos (${contacts.length})`}
                            />
                            {selectedIds && selectedIds.size > 0 && (
                                <Radio
                                    value="selected"
                                    label={`Contatos selecionados (${selectedIds.size})`}
                                />
                            )}
                        </Stack>
                    </Radio.Group>
                </Paper>

                {/* Field Selection */}
                <Paper withBorder p="md">
                    <Group justify="space-between" mb="sm">
                        <Text fw={500}>Campos a exportar</Text>
                        <Group gap="xs">
                            <Button
                                size="xs"
                                variant="subtle"
                                onClick={() => setSelectedFields(EXPORT_FIELDS.map(f => f.value))}
                            >
                                Selecionar todos
                            </Button>
                            <Button
                                size="xs"
                                variant="subtle"
                                onClick={() => setSelectedFields(EXPORT_FIELDS.filter(f => f.default).map(f => f.value))}
                            >
                                Padrão
                            </Button>
                        </Group>
                    </Group>

                    <Stack gap="md">
                        {Object.entries(fieldGroups).map(([group, fields]) => (
                            <div key={group}>
                                <Text size="xs" c="dimmed" tt="uppercase" mb="xs">{group}</Text>
                                <Group gap="xs">
                                    {fields.map(field => (
                                        <Checkbox
                                            key={field.value}
                                            label={field.label}
                                            checked={selectedFields.includes(field.value)}
                                            onChange={(e) => {
                                                if (e.currentTarget.checked) {
                                                    setSelectedFields([...selectedFields, field.value])
                                                } else {
                                                    setSelectedFields(selectedFields.filter(f => f !== field.value))
                                                }
                                            }}
                                            size="sm"
                                        />
                                    ))}
                                </Group>
                            </div>
                        ))}
                    </Stack>
                </Paper>

                {/* Format Options */}
                <Paper withBorder p="md">
                    <Text fw={500} mb="sm">Opções de formato</Text>
                    <Group gap="lg">
                        <Select
                            label="Separador"
                            data={[
                                { value: ';', label: 'Ponto-e-vírgula (;) - Recomendado para Excel' },
                                { value: ',', label: 'Vírgula (,)' },
                            ]}
                            value={separator}
                            onChange={(v) => setSeparator(v as typeof separator || ';')}
                            w={300}
                        />
                        <Select
                            label="Codificação"
                            data={[
                                { value: 'utf8', label: 'UTF-8 (Universal)' },
                                { value: 'latin1', label: 'Latin1 (Windows)' },
                            ]}
                            value={encoding}
                            onChange={(v) => setEncoding(v as typeof encoding || 'utf8')}
                            w={200}
                        />
                    </Group>
                </Paper>

                {/* Summary */}
                <Alert color="blue" variant="light">
                    <Group gap="md">
                        <ThemeIcon variant="light" color="blue">
                            <IconFileSpreadsheet size={16} />
                        </ThemeIcon>
                        <Text size="sm">
                            Serão exportados <strong>{contactsToExport.length}</strong> contato(s)
                            com <strong>{selectedFields.length}</strong> campo(s)
                        </Text>
                    </Group>
                </Alert>

                {/* Actions */}
                <Group justify="flex-end">
                    <Button variant="default" onClick={onClose}>Cancelar</Button>
                    <Button
                        leftSection={<IconDownload size={16} />}
                        onClick={handleExport}
                        loading={exporting}
                        disabled={selectedFields.length === 0}
                    >
                        Exportar CSV
                    </Button>
                </Group>
            </Stack>
        </Modal>
    )
}

export default ExportWizard
