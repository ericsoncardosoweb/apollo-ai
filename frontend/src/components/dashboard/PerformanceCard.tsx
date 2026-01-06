/**
 * PerformanceCard - Componente reutilizável para Performance de Agentes
 * Usado em: Dashboard Admin, Dashboard Master
 */

import { Paper, Stack, Group, Text, Badge, RingProgress, Avatar, Skeleton } from '@mantine/core'
import { IconUsers } from '@tabler/icons-react'

export interface AgentPerformance {
    name: string
    avatar?: string
    conversations: number
    score: number // 0-100
}

export interface PerformanceCardProps {
    /** Título do card */
    title?: string
    /** Badge com período */
    badgeText?: string
    /** Lista de agentes */
    agents: AgentPerformance[]
    /** Score médio geral */
    averageScore?: number
    /** Se está carregando */
    loading?: boolean
}

export function PerformanceCard({
    title = 'Performance dos Agentes',
    badgeText,
    agents,
    averageScore,
    loading = false,
}: PerformanceCardProps) {
    const calcAverageScore = averageScore ?? (
        agents.length > 0
            ? agents.reduce((acc, a) => acc + a.score, 0) / agents.length
            : 0
    )

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'teal'
        if (score >= 75) return 'green'
        if (score >= 60) return 'yellow'
        return 'red'
    }

    if (loading) {
        return (
            <Paper p="lg" withBorder radius="md">
                <Group justify="space-between" mb="md">
                    <Skeleton width={160} height={20} />
                    <Skeleton width={80} height={22} radius="xl" />
                </Group>
                <Group justify="center" mb="md">
                    <Skeleton circle height={120} />
                </Group>
                <Stack gap="sm">
                    {[1, 2, 3].map((i) => (
                        <Group key={i} justify="space-between">
                            <Group gap="sm">
                                <Skeleton circle height={32} />
                                <Skeleton width={80} height={16} />
                            </Group>
                            <Skeleton width={40} height={16} />
                        </Group>
                    ))}
                </Stack>
            </Paper>
        )
    }

    return (
        <Paper p="lg" withBorder radius="md">
            <Group justify="space-between" mb="md">
                <Group gap="xs">
                    <IconUsers size={18} />
                    <Text fw={600}>{title}</Text>
                </Group>
                {badgeText && (
                    <Badge color="blue" variant="light">{badgeText}</Badge>
                )}
            </Group>

            {/* Score médio central */}
            <Group justify="center" mb="md">
                <RingProgress
                    size={120}
                    thickness={10}
                    roundCaps
                    sections={[
                        { value: calcAverageScore, color: getScoreColor(calcAverageScore) }
                    ]}
                    label={
                        <Stack align="center" gap={0}>
                            <Text size="xl" fw={700}>{calcAverageScore.toFixed(0)}%</Text>
                            <Text size="xs" c="dimmed">Score Médio</Text>
                        </Stack>
                    }
                />
            </Group>

            {/* Lista de agentes */}
            <Stack gap="sm">
                {agents.map((agent) => (
                    <Group key={agent.name} justify="space-between">
                        <Group gap="sm">
                            <Avatar src={agent.avatar} size="sm" radius="xl" color="blue">
                                {agent.name.charAt(0)}
                            </Avatar>
                            <div>
                                <Text size="sm" fw={500}>{agent.name}</Text>
                                <Text size="xs" c="dimmed">{agent.conversations} conversas</Text>
                            </div>
                        </Group>
                        <Badge
                            color={getScoreColor(agent.score)}
                            variant="light"
                            size="lg"
                        >
                            {agent.score}%
                        </Badge>
                    </Group>
                ))}
            </Stack>
        </Paper>
    )
}

export default PerformanceCard
