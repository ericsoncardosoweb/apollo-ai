/**
 * Import Wizard - Multi-step contact import with field mapping
 */

import { useState, useCallback } from 'react'
import {
    Modal,
    Stepper,
    Group,
    Button,
    Text,
    Stack,
    Paper,
    FileButton,
    Table,
    Select,
    Badge,
    Alert,
    Progress,
    ThemeIcon,
    Code,
    Checkbox,
    ScrollArea,
    Loader,
    Center,
} from '@mantine/core'
import {
    IconUpload,
    IconFileSpreadsheet,
    IconArrowRight,
    IconCheck,
    IconX,
    IconAlertTriangle,
    IconDownload,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useCreateContact, Contact, CreateContactInput } from '@/hooks/useContacts'
import { validateCPF, validateCNPJ, validateEmail, validatePhone, normalizePhone } from '@/utils/validation'

// Field mapping options
const FIELD_OPTIONS = [
    { value: '', label: '-- Ignorar --' },
    { value: 'name', label: 'Nome *', required: true },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Telefone' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'cpf', label: 'CPF' },
    { value: 'cnpj', label: 'CNPJ' },
    { value: 'type', label: 'Tipo (lead/customer/etc)' },
    { value: 'tags', label: 'Etiquetas (separadas por vírgula)' },
    { value: 'company_name', label: 'Empresa' },
    { value: 'company_role', label: 'Cargo' },
    { value: 'notes', label: 'Observações' },
    { value: 'source', label: 'Origem' },
]

interface ImportRow {
    data: Record<string, string>
    errors: string[]
    warnings: string[]
    isValid: boolean
    isDuplicate?: boolean
}

interface ImportWizardProps {
    opened: boolean
    onClose: () => void
    onComplete: () => void
    existingEmails?: string[]
    existingPhones?: string[]
}

export function ImportWizard({ opened, onClose, onComplete, existingEmails = [], existingPhones = [] }: ImportWizardProps) {
    const [step, setStep] = useState(0)
    const [file, setFile] = useState<File | null>(null)
    const [rawData, setRawData] = useState<string[][]>([])
    const [headers, setHeaders] = useState<string[]>([])
    const [fieldMapping, setFieldMapping] = useState<Record<number, string>>({})
    const [hasHeaderRow, setHasHeaderRow] = useState(true)
    const [processedRows, setProcessedRows] = useState<ImportRow[]>([])
    const [importing, setImporting] = useState(false)
    const [importProgress, setImportProgress] = useState(0)
    const [importResults, setImportResults] = useState<{ success: number; failed: number; duplicates: number }>({ success: 0, failed: 0, duplicates: 0 })

    const createContact = useCreateContact()

    // Parse CSV file
    const parseCSV = useCallback((text: string): string[][] => {
        const lines = text.split(/\r?\n/).filter(line => line.trim())
        return lines.map(line => {
            const result: string[] = []
            let current = ''
            let inQuotes = false

            for (let i = 0; i < line.length; i++) {
                const char = line[i]
                if (char === '"') {
                    inQuotes = !inQuotes
                } else if ((char === ',' || char === ';') && !inQuotes) {
                    result.push(current.trim())
                    current = ''
                } else {
                    current += char
                }
            }
            result.push(current.trim())
            return result
        })
    }, [])

    // Handle file selection
    const handleFileSelect = useCallback(async (selectedFile: File | null) => {
        if (!selectedFile) return

        setFile(selectedFile)

        try {
            const text = await selectedFile.text()
            const parsed = parseCSV(text)

            if (parsed.length < 2) {
                notifications.show({ title: 'Arquivo inválido', message: 'O arquivo deve ter pelo menos 2 linhas', color: 'red' })
                return
            }

            setRawData(parsed)
            setHeaders(parsed[0])

            // Auto-detect field mappings based on header names
            const autoMapping: Record<number, string> = {}
            parsed[0].forEach((header, index) => {
                const lowerHeader = header.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

                if (lowerHeader.includes('nome') || lowerHeader === 'name') autoMapping[index] = 'name'
                else if (lowerHeader.includes('email') || lowerHeader.includes('e-mail')) autoMapping[index] = 'email'
                else if (lowerHeader.includes('whatsapp') || lowerHeader.includes('whats')) autoMapping[index] = 'whatsapp'
                else if (lowerHeader.includes('telefone') || lowerHeader.includes('phone') || lowerHeader.includes('celular')) autoMapping[index] = 'phone'
                else if (lowerHeader.includes('cpf')) autoMapping[index] = 'cpf'
                else if (lowerHeader.includes('cnpj')) autoMapping[index] = 'cnpj'
                else if (lowerHeader.includes('empresa') || lowerHeader.includes('company')) autoMapping[index] = 'company_name'
                else if (lowerHeader.includes('cargo') || lowerHeader.includes('funcao') || lowerHeader.includes('role')) autoMapping[index] = 'company_role'
                else if (lowerHeader.includes('etiqueta') || lowerHeader.includes('tag')) autoMapping[index] = 'tags'
                else if (lowerHeader.includes('observa') || lowerHeader.includes('nota') || lowerHeader.includes('note')) autoMapping[index] = 'notes'
                else if (lowerHeader.includes('origem') || lowerHeader.includes('source')) autoMapping[index] = 'source'
                else if (lowerHeader.includes('tipo') || lowerHeader.includes('type')) autoMapping[index] = 'type'
            })

            setFieldMapping(autoMapping)
            setStep(1)
        } catch (error) {
            notifications.show({ title: 'Erro ao ler arquivo', message: 'Não foi possível processar o arquivo', color: 'red' })
        }
    }, [parseCSV])

    // Validate and process rows
    const processRows = useCallback(() => {
        const dataRows = hasHeaderRow ? rawData.slice(1) : rawData
        const existingEmailSet = new Set(existingEmails.map(e => e?.toLowerCase()))
        const existingPhoneSet = new Set(existingPhones.map(p => normalizePhone(p) || ''))

        const processed: ImportRow[] = dataRows.map(row => {
            const data: Record<string, string> = {}
            const errors: string[] = []
            const warnings: string[] = []

            // Map fields
            Object.entries(fieldMapping).forEach(([indexStr, field]) => {
                const index = parseInt(indexStr)
                if (field && row[index]) {
                    data[field] = row[index].trim()
                }
            })

            // Validate required fields
            if (!data.name) {
                errors.push('Nome é obrigatório')
            }

            // Validate email
            if (data.email && !validateEmail(data.email)) {
                errors.push('Email inválido')
            }

            // Validate CPF
            if (data.cpf && !validateCPF(data.cpf)) {
                warnings.push('CPF inválido')
            }

            // Validate CNPJ
            if (data.cnpj && !validateCNPJ(data.cnpj)) {
                warnings.push('CNPJ inválido')
            }

            // Check for duplicates
            let isDuplicate = false
            if (data.email && existingEmailSet.has(data.email.toLowerCase())) {
                warnings.push('Email já existe no sistema')
                isDuplicate = true
            }
            if (data.whatsapp) {
                const normalizedWhatsapp = normalizePhone(data.whatsapp)
                if (normalizedWhatsapp && existingPhoneSet.has(normalizedWhatsapp)) {
                    warnings.push('WhatsApp já existe no sistema')
                    isDuplicate = true
                }
            }

            return {
                data,
                errors,
                warnings,
                isValid: errors.length === 0,
                isDuplicate,
            }
        })

        setProcessedRows(processed)
        setStep(2)
    }, [rawData, fieldMapping, hasHeaderRow, existingEmails, existingPhones])

    // Import contacts
    const handleImport = useCallback(async (skipDuplicates: boolean = true) => {
        setImporting(true)
        setImportProgress(0)

        const rowsToImport = processedRows.filter(row => row.isValid && (!skipDuplicates || !row.isDuplicate))
        let success = 0
        let failed = 0
        const duplicates = processedRows.filter(row => row.isDuplicate).length

        for (let i = 0; i < rowsToImport.length; i++) {
            const row = rowsToImport[i]
            try {
                const input: CreateContactInput = {
                    name: row.data.name,
                    email: row.data.email || undefined,
                    phone: row.data.phone || undefined,
                    whatsapp: row.data.whatsapp || undefined,
                    cpf: row.data.cpf || undefined,
                    cnpj: row.data.cnpj || undefined,
                    type: (row.data.type as Contact['type']) || 'lead',
                    tags: row.data.tags ? row.data.tags.split(',').map(t => t.trim()) : [],
                    company_name: row.data.company_name || undefined,
                    company_role: row.data.company_role || undefined,
                    notes: row.data.notes || undefined,
                    source: row.data.source || 'import',
                }

                await createContact.mutateAsync(input)
                success++
            } catch (error) {
                failed++
            }

            setImportProgress(Math.round(((i + 1) / rowsToImport.length) * 100))
        }

        setImportResults({ success, failed, duplicates: skipDuplicates ? duplicates : 0 })
        setImporting(false)
        setStep(3)
    }, [processedRows, createContact])

    // Reset wizard
    const handleClose = () => {
        setStep(0)
        setFile(null)
        setRawData([])
        setHeaders([])
        setFieldMapping({})
        setProcessedRows([])
        setImporting(false)
        setImportProgress(0)
        setImportResults({ success: 0, failed: 0, duplicates: 0 })
        onClose()
    }

    const handleComplete = () => {
        handleClose()
        onComplete()
    }

    // Stats
    const validCount = processedRows.filter(r => r.isValid).length
    const invalidCount = processedRows.filter(r => !r.isValid).length
    const duplicateCount = processedRows.filter(r => r.isDuplicate).length
    const warningCount = processedRows.filter(r => r.warnings.length > 0).length

    return (
        <Modal
            opened={opened}
            onClose={handleClose}
            title="Importar Contatos"
            size="xl"
            closeOnClickOutside={!importing}
            closeOnEscape={!importing}
        >
            <Stack gap="md">
                <Stepper active={step} size="sm">
                    <Stepper.Step label="Arquivo" description="Upload" />
                    <Stepper.Step label="Mapeamento" description="Campos" />
                    <Stepper.Step label="Validação" description="Revisar" />
                    <Stepper.Step label="Resultado" description="Concluído" />
                </Stepper>

                {/* Step 0: File Upload */}
                {step === 0 && (
                    <Paper withBorder p="xl" ta="center">
                        <Stack gap="md" align="center">
                            <ThemeIcon size={60} radius="xl" variant="light" color="blue">
                                <IconUpload size={30} />
                            </ThemeIcon>
                            <Text size="lg" fw={500}>Selecione um arquivo CSV</Text>
                            <Text size="sm" c="dimmed">Formatos aceitos: .csv (separado por vírgula ou ponto-e-vírgula)</Text>

                            <FileButton onChange={handleFileSelect} accept=".csv,.txt">
                                {(props) => (
                                    <Button {...props} size="lg" leftSection={<IconFileSpreadsheet size={20} />}>
                                        Selecionar Arquivo
                                    </Button>
                                )}
                            </FileButton>

                            <Alert color="blue" variant="light" title="Dica">
                                <Text size="sm">
                                    Exporte seus contatos do Excel ou Google Sheets como CSV.
                                    A primeira linha deve conter os cabeçalhos (nome das colunas).
                                </Text>
                            </Alert>
                        </Stack>
                    </Paper>
                )}

                {/* Step 1: Field Mapping */}
                {step === 1 && (
                    <Stack gap="md">
                        <Group justify="space-between">
                            <Text fw={500}>Arquivo: {file?.name}</Text>
                            <Text size="sm" c="dimmed">{rawData.length - (hasHeaderRow ? 1 : 0)} registros</Text>
                        </Group>

                        <Checkbox
                            label="Primeira linha contém cabeçalhos"
                            checked={hasHeaderRow}
                            onChange={(e) => setHasHeaderRow(e.currentTarget.checked)}
                        />

                        <Text size="sm" c="dimmed">Mapeie as colunas do arquivo para os campos do sistema:</Text>

                        <ScrollArea h={300}>
                            <Table>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>Coluna do Arquivo</Table.Th>
                                        <Table.Th>Exemplo</Table.Th>
                                        <Table.Th>Campo do Sistema</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {headers.map((header, index) => (
                                        <Table.Tr key={index}>
                                            <Table.Td>
                                                <Text size="sm" fw={500}>{header || `Coluna ${index + 1}`}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Code>{rawData[hasHeaderRow ? 1 : 0]?.[index] || '-'}</Code>
                                            </Table.Td>
                                            <Table.Td>
                                                <Select
                                                    size="xs"
                                                    data={FIELD_OPTIONS}
                                                    value={fieldMapping[index] || ''}
                                                    onChange={(value) => setFieldMapping(prev => ({ ...prev, [index]: value || '' }))}
                                                    placeholder="Selecionar..."
                                                    w={200}
                                                />
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </ScrollArea>

                        {!Object.values(fieldMapping).includes('name') && (
                            <Alert color="red" title="Campo obrigatório">
                                Mapeie pelo menos uma coluna para o campo "Nome"
                            </Alert>
                        )}

                        <Group justify="space-between">
                            <Button variant="default" onClick={() => setStep(0)}>Voltar</Button>
                            <Button
                                onClick={processRows}
                                rightSection={<IconArrowRight size={16} />}
                                disabled={!Object.values(fieldMapping).includes('name')}
                            >
                                Validar
                            </Button>
                        </Group>
                    </Stack>
                )}

                {/* Step 2: Validation Preview */}
                {step === 2 && (
                    <Stack gap="md">
                        <Group gap="md">
                            <Badge color="green" size="lg">{validCount} válidos</Badge>
                            <Badge color="red" size="lg">{invalidCount} inválidos</Badge>
                            <Badge color="yellow" size="lg">{duplicateCount} duplicados</Badge>
                            <Badge color="orange" size="lg">{warningCount} com avisos</Badge>
                        </Group>

                        <ScrollArea h={350}>
                            <Table striped>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th w={80}>Status</Table.Th>
                                        <Table.Th>Nome</Table.Th>
                                        <Table.Th>Email</Table.Th>
                                        <Table.Th>WhatsApp</Table.Th>
                                        <Table.Th>Problemas</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {processedRows.slice(0, 100).map((row, index) => (
                                        <Table.Tr key={index}>
                                            <Table.Td>
                                                {row.isValid ? (
                                                    row.isDuplicate ? (
                                                        <Badge color="yellow" size="sm">Dup</Badge>
                                                    ) : (
                                                        <Badge color="green" size="sm">OK</Badge>
                                                    )
                                                ) : (
                                                    <Badge color="red" size="sm">Erro</Badge>
                                                )}
                                            </Table.Td>
                                            <Table.Td>{row.data.name || '-'}</Table.Td>
                                            <Table.Td>{row.data.email || '-'}</Table.Td>
                                            <Table.Td>{row.data.whatsapp || '-'}</Table.Td>
                                            <Table.Td>
                                                {row.errors.length > 0 && (
                                                    <Text size="xs" c="red">{row.errors.join(', ')}</Text>
                                                )}
                                                {row.warnings.length > 0 && (
                                                    <Text size="xs" c="yellow">{row.warnings.join(', ')}</Text>
                                                )}
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                            {processedRows.length > 100 && (
                                <Text size="sm" c="dimmed" ta="center" mt="md">
                                    Mostrando 100 de {processedRows.length} registros
                                </Text>
                            )}
                        </ScrollArea>

                        {invalidCount > 0 && (
                            <Alert color="yellow" title="Atenção">
                                {invalidCount} registro(s) com erros serão ignorados na importação.
                            </Alert>
                        )}

                        <Group justify="space-between">
                            <Button variant="default" onClick={() => setStep(1)}>Voltar</Button>
                            <Group gap="xs">
                                {duplicateCount > 0 && (
                                    <Button
                                        variant="light"
                                        onClick={() => handleImport(false)}
                                        disabled={validCount === 0 || importing}
                                    >
                                        Importar Todos ({validCount})
                                    </Button>
                                )}
                                <Button
                                    onClick={() => handleImport(true)}
                                    disabled={validCount - duplicateCount === 0 || importing}
                                    loading={importing}
                                >
                                    {duplicateCount > 0
                                        ? `Importar Novos (${validCount - duplicateCount})`
                                        : `Importar (${validCount})`
                                    }
                                </Button>
                            </Group>
                        </Group>

                        {importing && (
                            <Progress value={importProgress} size="lg" animated />
                        )}
                    </Stack>
                )}

                {/* Step 3: Results */}
                {step === 3 && (
                    <Stack gap="md" align="center" py="xl">
                        <ThemeIcon size={80} radius="xl" variant="light" color={importResults.failed === 0 ? 'green' : 'yellow'}>
                            {importResults.failed === 0 ? <IconCheck size={40} /> : <IconAlertTriangle size={40} />}
                        </ThemeIcon>

                        <Text size="xl" fw={600}>Importação Concluída!</Text>

                        <Group gap="xl">
                            <Stack gap={4} align="center">
                                <Text size="2rem" fw={700} c="green">{importResults.success}</Text>
                                <Text size="sm" c="dimmed">Importados</Text>
                            </Stack>
                            {importResults.failed > 0 && (
                                <Stack gap={4} align="center">
                                    <Text size="2rem" fw={700} c="red">{importResults.failed}</Text>
                                    <Text size="sm" c="dimmed">Falharam</Text>
                                </Stack>
                            )}
                            {importResults.duplicates > 0 && (
                                <Stack gap={4} align="center">
                                    <Text size="2rem" fw={700} c="yellow">{importResults.duplicates}</Text>
                                    <Text size="sm" c="dimmed">Duplicados (ignorados)</Text>
                                </Stack>
                            )}
                        </Group>

                        <Button size="lg" onClick={handleComplete}>
                            Concluir
                        </Button>
                    </Stack>
                )}
            </Stack>
        </Modal>
    )
}

export default ImportWizard
