/**
 * Admin Contacts - Dynamic Contact Management with Import/Export
 * Connected to client database using contacts table
 */

import { useState, useMemo } from 'react'
import {
    Title,
    Text,
    Card,
    Stack,
    Group,
    Button,
    TextInput,
    Badge,
    Avatar,
    Table,
    ActionIcon,
    Menu,
    Modal,
    ThemeIcon,
    Paper,
    SimpleGrid,
    Skeleton,
    TagsInput,
    Alert,
    Select,
    Textarea,
    Checkbox,
    Tabs,
    FileButton,
    Code,
    CopyButton,
    Progress,
    Loader,
    Center,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
    IconSearch,
    IconPlus,
    IconDotsVertical,
    IconEdit,
    IconTrash,
    IconMessageCircle,
    IconDownload,
    IconUpload,
    IconUsers,
    IconFilter,
    IconRefresh,
    IconDatabase,
    IconPhone,
    IconMail,
    IconBuilding,
    IconTag,
    IconCheck,
    IconX,
    IconBrandWhatsapp,
    IconCopy,
    IconFileSpreadsheet,
    IconUserCheck,
    IconUserOff,
    IconArrowRight,
} from '@tabler/icons-react'
import { useClientDatabaseStatus } from '@/hooks/useClientSupabase'
import { useViewContext } from '@/contexts/ViewContext'
import {
    useContacts,
    useCreateContact,
    useUpdateContact,
    useDeleteContact,
    useContactTags,
    useContactsStats,
    useBulkDeleteContacts,
    useBulkTagContacts,
    useBulkUpdateContacts,
    Contact,
    CreateContactInput,
} from '@/hooks/useContacts'
import {
    validateCPF,
    validateCNPJ,
    validateEmail,
    validatePhone,
    formatPhone,
    formatCPF,
    formatCNPJ,
} from '@/utils/validation'
import { ImportWizard } from '@/components/contacts/ImportWizard'
import { ExportWizard } from '@/components/contacts/ExportWizard'

// Contact type options
const CONTACT_TYPES = [
    { value: 'lead', label: 'Lead' },
    { value: 'customer', label: 'Cliente' },
    { value: 'supplier', label: 'Fornecedor' },
    { value: 'partner', label: 'Parceiro' },
    { value: 'other', label: 'Outro' },
]

const CONTACT_STATUSES = [
    { value: 'active', label: 'Ativo' },
    { value: 'inactive', label: 'Inativo' },
    { value: 'blocked', label: 'Bloqueado' },
]

const CONTACT_SOURCES = [
    { value: 'manual', label: 'Manual' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'website', label: 'Website' },
    { value: 'import', label: 'Importação' },
    { value: 'api', label: 'API' },
]

// SQL for table creation
const CONTACTS_SQL = `-- Execute no Supabase do cliente para criar a tabela de contatos

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    whatsapp VARCHAR(50),
    cpf VARCHAR(14),
    cnpj VARCHAR(18),
    type VARCHAR(20) DEFAULT 'lead',
    status VARCHAR(20) DEFAULT 'active',
    tags TEXT[] DEFAULT '{}',
    source VARCHAR(100),
    avatar_url TEXT,
    notes TEXT,
    address_street VARCHAR(255),
    address_city VARCHAR(100),
    address_state VARCHAR(2),
    address_zipcode VARCHAR(10),
    company_name VARCHAR(255),
    company_role VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contacts_whatsapp ON contacts(whatsapp);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN(tags);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_all" ON contacts FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS contact_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#868e96',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contact_tags_all" ON contact_tags FOR ALL USING (true) WITH CHECK (true);

INSERT INTO contact_tags (name, color) VALUES
    ('lead', '#fab005'),
    ('cliente', '#40c057'),
    ('vip', '#7950f2'),
    ('interessado', '#228be6')
ON CONFLICT (name) DO NOTHING;`

export default function AdminContacts() {
    // State
    const [search, setSearch] = useState('')
    const [selectedType, setSelectedType] = useState<string | null>(null)
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())

    // Modals
    const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure()
    const [importModalOpened, { open: openImportModal, close: closeImportModal }] = useDisclosure()
    const [exportModalOpened, { open: openExportModal, close: closeExportModal }] = useDisclosure()
    const [setupModalOpened, { open: openSetupModal, close: closeSetupModal }] = useDisclosure()

    // Form state
    const [editingContact, setEditingContact] = useState<Contact | null>(null)
    const [form, setForm] = useState<Partial<CreateContactInput>>({})
    const [needsSetup, setNeedsSetup] = useState(false)

    // Context
    const { selectedCompany } = useViewContext()
    const { isConfigured } = useClientDatabaseStatus()

    // Data hooks
    const { data: contacts, isLoading, error, refetch } = useContacts({
        search: search || undefined,
        type: selectedType as Contact['type'] || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
    })
    const { data: tags } = useContactTags()
    const { data: stats } = useContactsStats()

    // Mutations
    const createContact = useCreateContact()
    const updateContact = useUpdateContact()
    const deleteContact = useDeleteContact()
    const bulkDelete = useBulkDeleteContacts()
    const bulkTag = useBulkTagContacts()
    const bulkUpdate = useBulkUpdateContacts()

    // Check for table not found error
    useMemo(() => {
        if (error && (error as any)?.code === 'PGRST205') {
            setNeedsSetup(true)
        }
    }, [error])

    // Handlers
    const resetForm = () => {
        setForm({})
        setEditingContact(null)
    }

    const handleOpenCreate = () => {
        resetForm()
        setForm({ type: 'lead', status: 'active', source: 'manual' })
        openModal()
    }

    const handleOpenEdit = (contact: Contact) => {
        setEditingContact(contact)
        setForm({
            name: contact.name,
            email: contact.email || '',
            phone: contact.phone || '',
            whatsapp: contact.whatsapp || '',
            cpf: contact.cpf || '',
            cnpj: contact.cnpj || '',
            type: contact.type,
            status: contact.status,
            tags: contact.tags || [],
            source: contact.source || '',
            notes: contact.notes || '',
            company_name: contact.company_name || '',
            company_role: contact.company_role || '',
        })
        openModal()
    }

    const handleSubmit = async () => {
        if (!form.name) {
            notifications.show({ title: 'Erro', message: 'Nome é obrigatório', color: 'red' })
            return
        }

        // Validate email
        if (form.email && !validateEmail(form.email)) {
            notifications.show({ title: 'Erro', message: 'Email inválido', color: 'red' })
            return
        }

        // Validate CPF
        if (form.cpf && !validateCPF(form.cpf)) {
            notifications.show({ title: 'Erro', message: 'CPF inválido', color: 'red' })
            return
        }

        // Validate CNPJ
        if (form.cnpj && !validateCNPJ(form.cnpj)) {
            notifications.show({ title: 'Erro', message: 'CNPJ inválido', color: 'red' })
            return
        }

        try {
            if (editingContact) {
                await updateContact.mutateAsync({ id: editingContact.id, ...form })
            } else {
                await createContact.mutateAsync(form as CreateContactInput)
            }
            closeModal()
            resetForm()
        } catch (e) {
            // Error handled by hook
        }
    }

    const handleDelete = async (id: string) => {
        if (window.confirm('Deseja realmente excluir este contato?')) {
            await deleteContact.mutateAsync(id)
        }
    }

    const handleBulkDelete = async () => {
        if (selectedContacts.size === 0) return
        if (window.confirm(`Deseja excluir ${selectedContacts.size} contato(s)?`)) {
            await bulkDelete.mutateAsync(Array.from(selectedContacts))
            setSelectedContacts(new Set())
        }
    }

    const handleBulkAddTag = async (tagName: string) => {
        if (selectedContacts.size === 0) return
        try {
            await bulkTag.mutateAsync({
                ids: Array.from(selectedContacts),
                tags: [tagName],
                action: 'add',
            })
            notifications.show({ title: 'Etiqueta adicionada', message: `${selectedContacts.size} contatos atualizados`, color: 'green' })
            setSelectedContacts(new Set())
        } catch (e) {
            // Error handled by hook
        }
    }

    const handleBulkStatus = async (status: Contact['status']) => {
        if (selectedContacts.size === 0) return
        try {
            await bulkUpdate.mutateAsync({
                ids: Array.from(selectedContacts),
                updates: { status },
            })
            notifications.show({ title: 'Status alterado', message: `${selectedContacts.size} contatos atualizados para "${status}"`, color: 'green' })
            setSelectedContacts(new Set())
        } catch (e) {
            // Error handled by hook
        }
    }

    const handleBulkType = async (type: Contact['type']) => {
        if (selectedContacts.size === 0) return
        try {
            await bulkUpdate.mutateAsync({
                ids: Array.from(selectedContacts),
                updates: { type },
            })
            const label = CONTACT_TYPES.find(t => t.value === type)?.label || type
            notifications.show({ title: 'Tipo alterado', message: `${selectedContacts.size} contatos alterados para "${label}"`, color: 'green' })
            setSelectedContacts(new Set())
        } catch (e) {
            // Error handled by hook
        }
    }

    const handleExport = () => {
        if (!contacts || contacts.length === 0) {
            notifications.show({ title: 'Nada para exportar', message: 'Nenhum contato encontrado', color: 'yellow' })
            return
        }

        // Export only basic fields (no architecture exposure)
        const exportData = contacts.map(c => ({
            nome: c.name,
            email: c.email || '',
            telefone: c.phone ? formatPhone(c.phone) : '',
            whatsapp: c.whatsapp ? formatPhone(c.whatsapp) : '',
            tipo: c.type,
            status: c.status,
            etiquetas: (c.tags || []).join(', '),
            empresa: c.company_name || '',
            cargo: c.company_role || '',
            observacoes: c.notes || '',
            criado_em: new Date(c.created_at).toLocaleDateString('pt-BR'),
        }))

        // Generate CSV
        const headers = Object.keys(exportData[0])
        const csv = [
            headers.join(','),
            ...exportData.map(row => headers.map(h => `"${(row as any)[h] || ''}"`).join(','))
        ].join('\n')

        // Download
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `contatos_${selectedCompany?.name || 'export'}_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)

        notifications.show({ title: 'Exportado!', message: `${exportData.length} contatos exportados`, color: 'green' })
    }

    const toggleSelectContact = (id: string) => {
        const next = new Set(selectedContacts)
        if (next.has(id)) {
            next.delete(id)
        } else {
            next.add(id)
        }
        setSelectedContacts(next)
    }

    const toggleSelectAll = () => {
        if (selectedContacts.size === contacts?.length) {
            setSelectedContacts(new Set())
        } else {
            setSelectedContacts(new Set(contacts?.map(c => c.id) || []))
        }
    }

    // Render setup screen if table doesn't exist
    if (needsSetup || (!isLoading && error)) {
        return (
            <Stack gap="md">
                <Group justify="space-between">
                    <div>
                        <Title order={2}>Contatos</Title>
                        <Text c="dimmed" size="sm">Base de contatos de {selectedCompany?.name}</Text>
                    </div>
                </Group>

                <Alert color="orange" title="Tabela de contatos não encontrada" icon={<IconDatabase size={20} />}>
                    <Stack gap="sm">
                        <Text size="sm">
                            A tabela de contatos ainda não foi criada no banco de dados.
                            Execute o SQL abaixo no Supabase do cliente.
                        </Text>
                        <Paper withBorder p="xs" style={{ maxHeight: 300, overflow: 'auto' }}>
                            <Code block style={{ fontSize: 11 }}>{CONTACTS_SQL}</Code>
                        </Paper>
                        <Group>
                            <CopyButton value={CONTACTS_SQL}>
                                {({ copied, copy }) => (
                                    <Button
                                        color={copied ? 'green' : 'blue'}
                                        leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                                        onClick={copy}
                                    >
                                        {copied ? 'Copiado!' : 'Copiar SQL'}
                                    </Button>
                                )}
                            </CopyButton>
                            <Button variant="light" onClick={() => { setNeedsSetup(false); refetch() }}>
                                Verificar Novamente
                            </Button>
                        </Group>
                    </Stack>
                </Alert>
            </Stack>
        )
    }

    // Render not configured alert
    if (!isConfigured) {
        return (
            <Stack gap="md">
                <Title order={2}>Contatos</Title>
                <Alert color="yellow" title="Banco de dados não configurado" icon={<IconDatabase size={20} />}>
                    Configure o banco de dados do cliente para gerenciar contatos.
                </Alert>
            </Stack>
        )
    }

    return (
        <Stack gap="md">
            {/* Header */}
            <Group justify="space-between">
                <div>
                    <Title order={2}>Contatos</Title>
                    <Text c="dimmed" size="sm">Base de contatos de {selectedCompany?.name}</Text>
                </div>
                <Group>
                    <Button variant="light" leftSection={<IconDownload size={16} />} onClick={openExportModal}>
                        Exportar
                    </Button>
                    <Button variant="light" leftSection={<IconUpload size={16} />} onClick={openImportModal}>
                        Importar
                    </Button>
                    <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
                        Novo Contato
                    </Button>
                </Group>
            </Group>

            {/* Stats */}
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                <Card withBorder p="sm">
                    <Group>
                        <ThemeIcon size={40} variant="light" color="blue">
                            <IconUsers size={20} />
                        </ThemeIcon>
                        <div>
                            <Text size="xs" c="dimmed">Total</Text>
                            <Text size="xl" fw={700}>{stats?.total || 0}</Text>
                        </div>
                    </Group>
                </Card>
                <Card withBorder p="sm">
                    <Group>
                        <ThemeIcon size={40} variant="light" color="green">
                            <IconPlus size={20} />
                        </ThemeIcon>
                        <div>
                            <Text size="xs" c="dimmed">Este mês</Text>
                            <Text size="xl" fw={700}>{stats?.newThisMonth || 0}</Text>
                        </div>
                    </Group>
                </Card>
                <Card withBorder p="sm">
                    <Group>
                        <ThemeIcon size={40} variant="light" color="yellow">
                            <IconTag size={20} />
                        </ThemeIcon>
                        <div>
                            <Text size="xs" c="dimmed">Leads</Text>
                            <Text size="xl" fw={700}>{stats?.byType?.lead || 0}</Text>
                        </div>
                    </Group>
                </Card>
                <Card withBorder p="sm">
                    <Group>
                        <ThemeIcon size={40} variant="light" color="teal">
                            <IconBuilding size={20} />
                        </ThemeIcon>
                        <div>
                            <Text size="xs" c="dimmed">Clientes</Text>
                            <Text size="xl" fw={700}>{stats?.byType?.customer || 0}</Text>
                        </div>
                    </Group>
                </Card>
            </SimpleGrid>

            {/* Filters */}
            <Paper withBorder p="md">
                <Group>
                    <TextInput
                        placeholder="Buscar por nome, email, telefone..."
                        leftSection={<IconSearch size={16} />}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ flex: 1, maxWidth: 400 }}
                    />
                    <Select
                        placeholder="Tipo"
                        data={CONTACT_TYPES}
                        value={selectedType}
                        onChange={setSelectedType}
                        clearable
                        w={150}
                    />
                    <TagsInput
                        placeholder="Etiquetas"
                        data={tags?.map(t => t.name) || []}
                        value={selectedTags}
                        onChange={setSelectedTags}
                        w={200}
                    />
                    <ActionIcon variant="light" onClick={() => refetch()}>
                        <IconRefresh size={16} />
                    </ActionIcon>
                </Group>
            </Paper>

            {/* Bulk Actions */}
            {selectedContacts.size > 0 && (
                <Paper withBorder p="sm" bg="blue.9">
                    <Group justify="space-between">
                        <Text size="sm">{selectedContacts.size} contato(s) selecionado(s)</Text>
                        <Group gap="xs">
                            <Menu shadow="md" width={180} position="bottom-start">
                                <Menu.Target>
                                    <Button size="xs" variant="light" leftSection={<IconTag size={14} />}>
                                        Etiquetas
                                    </Button>
                                </Menu.Target>
                                <Menu.Dropdown>
                                    <Menu.Label>Adicionar etiqueta</Menu.Label>
                                    {tags?.map(tag => (
                                        <Menu.Item key={tag.id} onClick={() => handleBulkAddTag(tag.name)}>
                                            {tag.name}
                                        </Menu.Item>
                                    ))}
                                </Menu.Dropdown>
                            </Menu>
                            <Menu shadow="md" width={150} position="bottom-start">
                                <Menu.Target>
                                    <Button size="xs" variant="light" leftSection={<IconUserCheck size={14} />}>
                                        Status
                                    </Button>
                                </Menu.Target>
                                <Menu.Dropdown>
                                    <Menu.Label>Alterar status</Menu.Label>
                                    <Menu.Item leftSection={<IconUserCheck size={14} />} onClick={() => handleBulkStatus('active')}>
                                        Ativo
                                    </Menu.Item>
                                    <Menu.Item leftSection={<IconUserOff size={14} />} onClick={() => handleBulkStatus('inactive')}>
                                        Inativo
                                    </Menu.Item>
                                    <Menu.Item leftSection={<IconX size={14} />} onClick={() => handleBulkStatus('blocked')}>
                                        Bloqueado
                                    </Menu.Item>
                                </Menu.Dropdown>
                            </Menu>
                            <Menu shadow="md" width={150} position="bottom-start">
                                <Menu.Target>
                                    <Button size="xs" variant="light" leftSection={<IconArrowRight size={14} />}>
                                        Tipo
                                    </Button>
                                </Menu.Target>
                                <Menu.Dropdown>
                                    <Menu.Label>Alterar tipo</Menu.Label>
                                    {CONTACT_TYPES.map(type => (
                                        <Menu.Item key={type.value} onClick={() => handleBulkType(type.value as Contact['type'])}>
                                            {type.label}
                                        </Menu.Item>
                                    ))}
                                </Menu.Dropdown>
                            </Menu>
                            <Button size="xs" variant="light" color="red" leftSection={<IconTrash size={14} />} onClick={handleBulkDelete}>
                                Excluir
                            </Button>
                            <Button size="xs" variant="light" onClick={() => setSelectedContacts(new Set())}>
                                Cancelar
                            </Button>
                        </Group>
                    </Group>
                </Paper>
            )}

            {/* Table */}
            <Card withBorder p={0}>
                {isLoading ? (
                    <Stack p="md">
                        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} height={50} />)}
                    </Stack>
                ) : (
                    <Table.ScrollContainer minWidth={800}>
                        <Table verticalSpacing="sm" highlightOnHover>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th w={40}>
                                        <Checkbox
                                            checked={selectedContacts.size === contacts?.length && contacts.length > 0}
                                            indeterminate={selectedContacts.size > 0 && selectedContacts.size < (contacts?.length || 0)}
                                            onChange={toggleSelectAll}
                                        />
                                    </Table.Th>
                                    <Table.Th>Contato</Table.Th>
                                    <Table.Th>WhatsApp</Table.Th>
                                    <Table.Th>Tipo</Table.Th>
                                    <Table.Th>Etiquetas</Table.Th>
                                    <Table.Th>Fonte</Table.Th>
                                    <Table.Th w={80}>Ações</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {contacts?.map(contact => (
                                    <Table.Tr key={contact.id}>
                                        <Table.Td>
                                            <Checkbox
                                                checked={selectedContacts.has(contact.id)}
                                                onChange={() => toggleSelectContact(contact.id)}
                                            />
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap="sm">
                                                <Avatar radius="xl" color="blue">
                                                    {contact.name.charAt(0).toUpperCase()}
                                                </Avatar>
                                                <div>
                                                    <Text size="sm" fw={500}>{contact.name}</Text>
                                                    <Text size="xs" c="dimmed">{contact.email || '-'}</Text>
                                                </div>
                                            </Group>
                                        </Table.Td>
                                        <Table.Td>
                                            {contact.whatsapp ? (
                                                <Group gap={4}>
                                                    <IconBrandWhatsapp size={14} color="var(--mantine-color-green-6)" />
                                                    <Text size="sm">{formatPhone(contact.whatsapp)}</Text>
                                                </Group>
                                            ) : '-'}
                                        </Table.Td>
                                        <Table.Td>
                                            <Badge variant="light" color={contact.type === 'customer' ? 'green' : contact.type === 'lead' ? 'yellow' : 'gray'}>
                                                {CONTACT_TYPES.find(t => t.value === contact.type)?.label || contact.type}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap={4}>
                                                {(contact.tags || []).slice(0, 3).map(tag => (
                                                    <Badge key={tag} size="xs" variant="outline">{tag}</Badge>
                                                ))}
                                                {(contact.tags || []).length > 3 && (
                                                    <Badge size="xs" variant="light">+{(contact.tags || []).length - 3}</Badge>
                                                )}
                                            </Group>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="sm" c="dimmed">{contact.source || '-'}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Menu shadow="md" width={160} position="bottom-end">
                                                <Menu.Target>
                                                    <ActionIcon variant="subtle">
                                                        <IconDotsVertical size={16} />
                                                    </ActionIcon>
                                                </Menu.Target>
                                                <Menu.Dropdown>
                                                    <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => handleOpenEdit(contact)}>
                                                        Editar
                                                    </Menu.Item>
                                                    <Menu.Item leftSection={<IconMessageCircle size={14} />}>
                                                        Conversar
                                                    </Menu.Item>
                                                    <Menu.Divider />
                                                    <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => handleDelete(contact.id)}>
                                                        Excluir
                                                    </Menu.Item>
                                                </Menu.Dropdown>
                                            </Menu>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </Table.ScrollContainer>
                )}

                {contacts?.length === 0 && !isLoading && (
                    <Paper p="xl" ta="center">
                        <ThemeIcon size={60} radius="xl" variant="light" color="gray" mb="md">
                            <IconUsers size={30} />
                        </ThemeIcon>
                        <Text c="dimmed">Nenhum contato encontrado</Text>
                        <Button variant="light" mt="md" onClick={handleOpenCreate}>
                            Adicionar primeiro contato
                        </Button>
                    </Paper>
                )}
            </Card>

            {/* Create/Edit Modal */}
            <Modal opened={modalOpened} onClose={closeModal} title={editingContact ? 'Editar Contato' : 'Novo Contato'} size="lg">
                <Stack gap="md">
                    <TextInput
                        label="Nome"
                        placeholder="Nome completo"
                        required
                        value={form.name || ''}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />

                    <SimpleGrid cols={2}>
                        <TextInput
                            label="Email"
                            placeholder="email@exemplo.com"
                            leftSection={<IconMail size={16} />}
                            value={form.email || ''}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            error={form.email && !validateEmail(form.email) ? 'Email inválido' : undefined}
                        />
                        <TextInput
                            label="WhatsApp"
                            placeholder="+55 11 99999-9999"
                            leftSection={<IconBrandWhatsapp size={16} />}
                            value={form.whatsapp || ''}
                            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                        />
                    </SimpleGrid>

                    <SimpleGrid cols={2}>
                        <TextInput
                            label="Telefone"
                            placeholder="(11) 9999-9999"
                            leftSection={<IconPhone size={16} />}
                            value={form.phone || ''}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        />
                        <Select
                            label="Tipo"
                            data={CONTACT_TYPES}
                            value={form.type || 'lead'}
                            onChange={(v) => setForm({ ...form, type: v as Contact['type'] })}
                        />
                    </SimpleGrid>

                    <SimpleGrid cols={2}>
                        <TextInput
                            label="CPF"
                            placeholder="000.000.000-00"
                            value={form.cpf || ''}
                            onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                            error={form.cpf && !validateCPF(form.cpf) ? 'CPF inválido' : undefined}
                        />
                        <TextInput
                            label="CNPJ"
                            placeholder="00.000.000/0000-00"
                            value={form.cnpj || ''}
                            onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                            error={form.cnpj && !validateCNPJ(form.cnpj) ? 'CNPJ inválido' : undefined}
                        />
                    </SimpleGrid>

                    <SimpleGrid cols={2}>
                        <TextInput
                            label="Empresa"
                            placeholder="Nome da empresa"
                            leftSection={<IconBuilding size={16} />}
                            value={form.company_name || ''}
                            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                        />
                        <TextInput
                            label="Cargo"
                            placeholder="Cargo ou função"
                            value={form.company_role || ''}
                            onChange={(e) => setForm({ ...form, company_role: e.target.value })}
                        />
                    </SimpleGrid>

                    <TagsInput
                        label="Etiquetas"
                        placeholder="Adicione etiquetas"
                        data={tags?.map(t => t.name) || []}
                        value={form.tags || []}
                        onChange={(v) => setForm({ ...form, tags: v })}
                    />

                    <Textarea
                        label="Observações"
                        placeholder="Notas sobre o contato..."
                        rows={3}
                        value={form.notes || ''}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />

                    <Group justify="flex-end" mt="md">
                        <Button variant="default" onClick={closeModal}>Cancelar</Button>
                        <Button
                            onClick={handleSubmit}
                            loading={createContact.isPending || updateContact.isPending}
                        >
                            {editingContact ? 'Salvar' : 'Criar'}
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            {/* Import Wizard */}
            <ImportWizard
                opened={importModalOpened}
                onClose={closeImportModal}
                onComplete={refetch}
                existingEmails={contacts?.map(c => c.email).filter(Boolean) as string[]}
                existingPhones={contacts?.map(c => c.whatsapp).filter(Boolean) as string[]}
            />

            {/* Export Wizard */}
            <ExportWizard
                opened={exportModalOpened}
                onClose={closeExportModal}
                contacts={contacts || []}
                selectedIds={selectedContacts}
                companyName={selectedCompany?.name}
            />
        </Stack>
    )
}
