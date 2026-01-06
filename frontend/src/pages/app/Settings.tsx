import { Title, Text, Card, Stack, Group, TextInput, Button, Switch, Divider, Select } from '@mantine/core'
import { IconDeviceFloppy, IconBrandWhatsapp } from '@tabler/icons-react'
import { PhoneInput, EmailInput, RichTextEditor } from '@/components/form'

export default function AppSettings() {
    return (
        <Stack gap="lg">
            <div>
                <Title order={2}>Configurações</Title>
                <Text c="dimmed" size="sm">Configurações da sua empresa</Text>
            </div>

            <Card withBorder padding="lg" radius="md">
                <Text fw={600} mb="md">Dados da Empresa</Text>
                <Stack gap="md">
                    <TextInput
                        label="Nome da Empresa"
                        placeholder="Sua empresa"
                    />
                    <EmailInput
                        label="E-mail de Contato"
                        placeholder="contato@empresa.com"
                    />
                    <PhoneInput
                        label="Telefone"
                    />
                    <Select
                        label="Fuso Horário"
                        defaultValue="America/Sao_Paulo"
                        data={[
                            { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
                            { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
                            { value: 'America/Fortaleza', label: 'Fortaleza (GMT-3)' },
                        ]}
                    />
                </Stack>
            </Card>

            <Card withBorder padding="lg" radius="md">
                <Group gap="xs" mb="md">
                    <IconBrandWhatsapp size={20} />
                    <Text fw={600}>WhatsApp Business</Text>
                </Group>
                <Stack gap="md">
                    <PhoneInput
                        label="Número do WhatsApp"
                    />
                    <div>
                        <Text size="sm" fw={500} mb={4}>Mensagem de Boas-vindas</Text>
                        <RichTextEditor
                            content=""
                            onChange={() => { }}
                            placeholder="Olá! Bem-vindo à nossa empresa..."
                            minHeight={80}
                            maxHeight={200}
                        />
                    </div>
                    <Group justify="space-between">
                        <div>
                            <Text size="sm" fw={500}>Respostas Automáticas</Text>
                            <Text size="xs" c="dimmed">Permitir que os agentes respondam automaticamente</Text>
                        </div>
                        <Switch defaultChecked color="teal" />
                    </Group>
                    <Divider />
                    <Group justify="space-between">
                        <div>
                            <Text size="sm" fw={500}>Horário de Atendimento</Text>
                            <Text size="xs" c="dimmed">Definir horário de funcionamento dos agentes</Text>
                        </div>
                        <Switch defaultChecked color="teal" />
                    </Group>
                </Stack>
            </Card>

            <Card withBorder padding="lg" radius="md">
                <Text fw={600} mb="md">Notificações</Text>
                <Stack gap="md">
                    <Group justify="space-between">
                        <div>
                            <Text size="sm" fw={500}>Notificações por E-mail</Text>
                            <Text size="xs" c="dimmed">Receber alertas de novas conversas por e-mail</Text>
                        </div>
                        <Switch defaultChecked color="teal" />
                    </Group>
                    <Divider />
                    <Group justify="space-between">
                        <div>
                            <Text size="sm" fw={500}>Relatório Semanal</Text>
                            <Text size="xs" c="dimmed">Receber resumo de performance toda segunda-feira</Text>
                        </div>
                        <Switch defaultChecked color="teal" />
                    </Group>
                </Stack>
            </Card>

            <Group justify="flex-end">
                <Button leftSection={<IconDeviceFloppy size={16} />} color="teal">
                    Salvar Configurações
                </Button>
            </Group>
        </Stack>
    )
}
