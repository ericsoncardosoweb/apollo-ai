import { Title, Text, Card, Stack, Group, TextInput, Button, Switch, Divider, PasswordInput, Select } from '@mantine/core'
import { IconDeviceFloppy } from '@tabler/icons-react'

export default function AdminSettings() {
    return (
        <Stack gap="lg">
            <div>
                <Title order={2}>Configurações</Title>
                <Text c="dimmed" size="sm">Configurações gerais da plataforma</Text>
            </div>

            <Card withBorder padding="lg" radius="md">
                <Text fw={600} mb="md">Configurações Gerais</Text>
                <Stack gap="md">
                    <TextInput
                        label="Nome da Plataforma"
                        defaultValue="Apollo A.I. Advanced"
                    />
                    <TextInput
                        label="URL Base"
                        defaultValue="https://app.apolloai.com.br"
                    />
                    <Select
                        label="Timezone Padrão"
                        defaultValue="America/Sao_Paulo"
                        data={[
                            { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
                            { value: 'America/New_York', label: 'New York (GMT-5)' },
                            { value: 'Europe/London', label: 'London (GMT+0)' },
                        ]}
                    />
                </Stack>
            </Card>

            <Card withBorder padding="lg" radius="md">
                <Text fw={600} mb="md">Integrações</Text>
                <Stack gap="md">
                    <Group justify="space-between">
                        <div>
                            <Text size="sm" fw={500}>Evolution API</Text>
                            <Text size="xs" c="dimmed">WhatsApp Business API</Text>
                        </div>
                        <Switch defaultChecked color="green" />
                    </Group>
                    <Divider />
                    <Group justify="space-between">
                        <div>
                            <Text size="sm" fw={500}>OpenAI GPT-4</Text>
                            <Text size="xs" c="dimmed">Motor de IA principal</Text>
                        </div>
                        <Switch defaultChecked color="green" />
                    </Group>
                    <Divider />
                    <PasswordInput
                        label="OpenAI API Key"
                        placeholder="sk-..."
                    />
                </Stack>
            </Card>

            <Group justify="flex-end">
                <Button leftSection={<IconDeviceFloppy size={16} />}>
                    Salvar Configurações
                </Button>
            </Group>
        </Stack>
    )
}
