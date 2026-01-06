import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { TenantProvider } from '@/contexts/TenantContext'
import { LoadingOverlay, Center, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconRocket } from '@tabler/icons-react'

// Layouts
import AdminLayout from '@/components/layout/AdminLayout'
import ClientLayout from '@/components/layout/ClientLayout'

// Pages - Auth
import Login from '@/pages/Login'

// Pages - Admin
import AdminDashboard from '@/pages/admin/Dashboard'
import AdminCompanies from '@/pages/admin/Companies'
import AdminAgents from '@/pages/admin/Agents'
import AdminUsers from '@/pages/admin/Users'
import AdminWebhooks from '@/pages/admin/Webhooks'
import AdminAnalytics from '@/pages/admin/Analytics'
import AdminSettings from '@/pages/admin/Settings'

// Pages - Client (App)
import AppDashboard from '@/pages/app/Dashboard'
import AppInbox from '@/pages/app/Inbox'
import AppCRM from '@/pages/app/CRM'
import AppContacts from '@/pages/app/Contacts'
import AppAgents from '@/pages/app/Agents'
import AppAnalytics from '@/pages/app/Analytics'
import AppSettings from '@/pages/app/Settings'

function LoadingScreen() {
    return (
        <Center h="100vh">
            <Stack align="center" gap="md">
                <ThemeIcon size={60} radius="xl" variant="gradient" gradient={{ from: 'indigo', to: 'violet' }}>
                    <IconRocket size={32} />
                </ThemeIcon>
                <Text size="lg" fw={500} c="dimmed">Carregando Apollo A.I...</Text>
                <LoadingOverlay visible={true} zIndex={1000} overlayProps={{ blur: 2 }} loaderProps={{ type: 'bars' }} />
            </Stack>
        </Center>
    )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth()

    if (loading) {
        return <LoadingScreen />
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    return <TenantProvider>{children}</TenantProvider>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth()

    if (loading) {
        return <LoadingScreen />
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    // TODO: Check if user is platform admin
    // For now, allow access (will be restricted by role check later)
    return <>{children}</>
}

function App() {
    return (
        <AuthProvider>
            <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />

                {/* Admin routes (Platform owner/team) */}
                <Route
                    path="/admin"
                    element={
                        <AdminRoute>
                            <AdminLayout />
                        </AdminRoute>
                    }
                >
                    <Route index element={<AdminDashboard />} />
                    <Route path="companies" element={<AdminCompanies />} />
                    <Route path="agents" element={<AdminAgents />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="webhooks" element={<AdminWebhooks />} />
                    <Route path="analytics" element={<AdminAnalytics />} />
                    <Route path="settings" element={<AdminSettings />} />
                </Route>

                {/* Client routes (Company users) */}
                <Route
                    path="/app"
                    element={
                        <ProtectedRoute>
                            <ClientLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route index element={<AppDashboard />} />
                    <Route path="inbox" element={<AppInbox />} />
                    <Route path="crm" element={<AppCRM />} />
                    <Route path="contacts" element={<AppContacts />} />
                    <Route path="agents" element={<AppAgents />} />
                    <Route path="analytics" element={<AppAnalytics />} />
                    <Route path="settings" element={<AppSettings />} />
                </Route>

                {/* Default redirect */}
                <Route path="/" element={<Navigate to="/app" replace />} />

                {/* Catch all - redirect to app */}
                <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
        </AuthProvider>
    )
}

export default App
