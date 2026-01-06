/**
 * App Store - Global State Management with Zustand
 * Manages view mode, selected company, and session state
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ViewMode = 'ADMIN' | 'MANAGEMENT'

interface SelectedCompany {
    id: string
    name: string
    slug: string
    plan?: string
}

interface AppState {
    // View mode
    viewMode: ViewMode
    setViewMode: (mode: ViewMode) => void

    // Selected company (persisted)
    selectedCompanyId: string | null
    selectedCompany: SelectedCompany | null
    setSelectedCompany: (company: SelectedCompany | null) => void
    clearSelectedCompany: () => void

    // Session state
    isInitialized: boolean
    setInitialized: (value: boolean) => void

    // Reset
    reset: () => void
}

const initialState = {
    viewMode: 'ADMIN' as ViewMode,
    selectedCompanyId: null,
    selectedCompany: null,
    isInitialized: false,
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            ...initialState,

            setViewMode: (mode) => set({ viewMode: mode }),

            setSelectedCompany: (company) => set({
                selectedCompany: company,
                selectedCompanyId: company?.id || null,
                // Auto-switch to MANAGEMENT when company is selected
                viewMode: company ? 'MANAGEMENT' : 'ADMIN',
            }),

            clearSelectedCompany: () => set({
                selectedCompany: null,
                selectedCompanyId: null,
                viewMode: 'ADMIN',
            }),

            setInitialized: (value) => set({ isInitialized: value }),

            reset: () => set(initialState),
        }),
        {
            name: 'apollo-app-store',
            partialize: (state: AppState) => ({
                selectedCompanyId: state.selectedCompanyId,
                selectedCompany: state.selectedCompany,
                viewMode: state.viewMode,
            }),
        }
    )
)

// Utility selectors
export const useViewMode = () => useAppStore((state) => state.viewMode)
export const useSelectedCompany = () => useAppStore((state) => state.selectedCompany)
export const useIsAdminView = () => useAppStore((state) => state.viewMode === 'ADMIN')
export const useIsManagementView = () => useAppStore((state) => state.viewMode === 'MANAGEMENT')
