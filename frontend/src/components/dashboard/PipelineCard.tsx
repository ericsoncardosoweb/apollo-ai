/**
 * PipelineCard - Componente reutilizável para Pipeline de Vendas
 * Usado em: Dashboard Admin, Dashboard Cliente, CRM
 */

import { Paper, Stack, Group, Text, Badge, Progress, Skeleton } from '@mantine/core'
import { IconBriefcase } from '@tabler/icons-react'

export interface PipelineStage {
    name: string
    count: number
    color?: string
}

export interface PipelineCardProps {
    /** Título do card */
    title?: string
    /** Badge com total */
    badgeText?: string
    /** Lista de estágios do pipeline */
    stages: PipelineStage[]
    /** Se está carregando */
    loading?: boolean
    /** Total para cálculo de porcentagem */
    total?: number
}

export function PipelineCard({
    title = 'Pipeline de Vendas',
    badgeText,
    stages,
    loading = false,
    total,
}: PipelineCardProps) {
    const calculatedTotal = total || stages.reduce((acc, s) => acc + s.count, 0)

    if (loading) {
        return (
            <Paper p="lg" withBorder radius="md">
                <Group justify="space-between" mb="md">
                    <Group gap="xs">
                        <Skeleton width={18} height={18} />
                        <Skeleton width={120} height={20} />
                    </Group>
                    <Skeleton width={100} height={22} radius="xl" />
                </Group>
                <Stack gap="md">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} height={24} />
                    ))}
                </Stack>
            </Paper>
        )
    }

    return (
        <Paper p="lg" withBorder radius="md">
            <Group justify="space-between" mb="md">
                <Group gap="xs">
                    <IconBriefcase size={18} />
                    <Text fw={600}>{title}</Text>
                </Group>
                {badgeText && (
                    <Badge color="teal" variant="light">{badgeText}</Badge>
                )}
            </Group>

            <Stack gap="md">
                {stages.map((stage) => {
                    const percentage = calculatedTotal > 0
                        ? (stage.count / calculatedTotal) * 100
                        : 0

                    return (
                        <div key={stage.name}>
                            <Group justify="space-between" mb={4}>
                                <Text size="sm">{stage.name}</Text>
                                <Text size="sm" fw={500}>{stage.count}</Text>
                            </Group>
                            <Progress
                                value={percentage}
                                color={stage.color || 'blue'}
                                size="sm"
                                radius="md"
                            />
                        </div>
                    )
                })}
            </Stack>
        </Paper>
    )
}

export default PipelineCard
