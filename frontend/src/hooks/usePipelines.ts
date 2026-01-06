/**
 * usePipelines Hook - CRM Pipeline Management
 * Handles fetching and managing pipelines and templates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Types
export interface Stage {
    id: string
    name: string
    color: string
    position: number
    is_conversion_point: boolean
    automations_config?: Record<string, unknown>
}

export interface Pipeline {
    id: string
    name: string
    description: string | null
    stages: Stage[]
    is_default: boolean
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface PipelineTemplate {
    id: string
    name: string
    description: string | null
    category: string
    stages: Stage[]
    usage_count: number
    is_featured: boolean
}

interface CreatePipelineData {
    name: string
    description?: string
    stages: Stage[]
    is_default?: boolean
}

interface UpdatePipelineData {
    name?: string
    description?: string
    stages?: Stage[]
    is_active?: boolean
}

interface SaveAsTemplateData {
    name: string
    description?: string
    category?: string
}

// =============================================================================
// FETCH PIPELINES
// =============================================================================

export function usePipelines(includeInactive: boolean = false) {
    return useQuery({
        queryKey: ['pipelines', { includeInactive }],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (includeInactive) params.append('include_inactive', 'true')

            const response = await api.get<{ items: Pipeline[] }>(`/pipelines?${params.toString()}`)
            return response.data.items
        },
        staleTime: 60000, // Cache for 1 minute
    })
}

// =============================================================================
// FETCH SINGLE PIPELINE
// =============================================================================

export function usePipeline(pipelineId: string | null) {
    return useQuery({
        queryKey: ['pipeline', pipelineId],
        queryFn: async () => {
            if (!pipelineId) return null
            const response = await api.get<Pipeline>(`/pipelines/${pipelineId}`)
            return response.data
        },
        enabled: !!pipelineId,
    })
}

// =============================================================================
// FETCH PIPELINE TEMPLATES (From Master DB)
// =============================================================================

export function usePipelineTemplates(category?: string, featuredOnly: boolean = false) {
    return useQuery({
        queryKey: ['pipelineTemplates', { category, featuredOnly }],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (category) params.append('category', category)
            if (featuredOnly) params.append('featured_only', 'true')

            const response = await api.get<{ items: PipelineTemplate[] }>(`/pipelines/templates?${params.toString()}`)
            return response.data.items
        },
        staleTime: 300000, // Cache for 5 minutes
    })
}

// =============================================================================
// CREATE PIPELINE
// =============================================================================

export function useCreatePipeline() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: CreatePipelineData) => {
            const response = await api.post<Pipeline>('/pipelines', data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pipelines'] })
        },
    })
}

// =============================================================================
// CREATE FROM TEMPLATE
// =============================================================================

export function useCreateFromTemplate() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ templateId, name }: { templateId: string, name?: string }) => {
            const params = name ? `?name=${encodeURIComponent(name)}` : ''
            const response = await api.post<Pipeline>(`/pipelines/from-template/${templateId}${params}`)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pipelines'] })
        },
    })
}

// =============================================================================
// UPDATE PIPELINE
// =============================================================================

export function useUpdatePipeline() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ pipelineId, data }: { pipelineId: string, data: UpdatePipelineData }) => {
            const response = await api.patch<Pipeline>(`/pipelines/${pipelineId}`, data)
            return response.data
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['pipelines'] })
            queryClient.invalidateQueries({ queryKey: ['pipeline', variables.pipelineId] })
        },
    })
}

// =============================================================================
// SAVE AS TEMPLATE
// =============================================================================

export function useSaveAsTemplate() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ pipelineId, data }: { pipelineId: string, data: SaveAsTemplateData }) => {
            const response = await api.post<{ success: boolean, template: PipelineTemplate }>(
                `/pipelines/${pipelineId}/save-template`,
                data
            )
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pipelineTemplates'] })
        },
    })
}

// =============================================================================
// DELETE PIPELINE
// =============================================================================

export function useDeletePipeline() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (pipelineId: string) => {
            await api.delete(`/pipelines/${pipelineId}`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pipelines'] })
        },
    })
}
