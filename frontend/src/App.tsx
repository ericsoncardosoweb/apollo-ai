/**
 * Apollo A.I. Advanced - Main Application Router
 * Role-based routing with 3 environments:
 * - /master: Global platform administration
 * - /admin: Company-specific administration (requires selectedCompany)
 * - /app: Client/user view
 */

import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { ViewContextProvider } from '@/contexts/ViewContext'
import { Center, Loader, Stack, Text } from '@mantine/core'
import { isPlatformAdmin } from '@/types'

// Layouts
import MasterLayout from '@/components/layout/MasterLayout'
import AdminLayout from '@/components/layout/AdminLayout'
import ClientLayout from '@/components/layout/ClientLayout'

// Public Pages
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'

// Master Pages (Global Platform Admin)
import MasterDashboard from '@/pages/admin/Dashboard'
import MasterCompanies from '@/pages/admin/Companies'
import MasterKanban from '@/pages/admin/CompanyKanban'
import MasterPlans from '@/pages/admin/Plans'
import MasterUsers from '@/pages/admin/Users'
import MasterAnalytics from '@/pages/admin/Analytics'
import MasterSettings from '@/pages/admin/Settings'

// Admin Pages (Company-Specific)
import AdminDashboardNew from '@/pages/admin/AdminDashboard'
import AdminInbox from '@/pages/admin/Inbox'
import AdminContacts from '@/pages/admin/Contacts'
import AdminMessaging from '@/pages/admin/Messaging'
import AdminServices from '@/pages/admin/Services'
import AdminAgents from '@/pages/admin/Agents'
import AdminTools from '@/pages/admin/Tools'
import AdminKnowledge from '@/pages/admin/Knowledge'
import AdminAnalytics from '@/pages/admin/Analytics'
import AdminSettings from '@/pages/admin/Settings'
import AdminCRMBoard from '@/pages/admin/CRMBoard'

// Client/App Pages (subset of admin - shared components)
import AppDashboard from '@/pages/app/Dashboard'
import AppCRM from '@/pages/app/CRM'
import AppAnalytics from '@/pages/app/Analytics'
import AppSettings from '@/pages/app/Settings'

// Loading Screen
function LoadingScreen() {
    return (
        <Center h="100vh" bg="dark.9">
            <Stack align="center" gap="md">
                <Loader size="lg" color="indigo" type="bars" />
                <Text size="sm" c="dimmed">Carregando Apollo A.I...</Text>
            </Stack>
        </Center>
    )
}

// Protected Route - Requires authentication
function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth()
    const location = useLocation()

    if (loading) {
        return <LoadingScreen />
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    return <>{children}</>
}

// Platform Admin Route - Requires master/admin/operator role
function PlatformAdminRoute({ children }: { children: React.ReactNode }) {
    const { user, role, loading } = useAuth()
    const location = useLocation()

    if (loading) {
        return <LoadingScreen />
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    // Only platform admins can access these routes
    if (!isPlatformAdmin(role)) {
        return <Navigate to="/app" replace />
    }

    return <>{children}</>
}

// Public Route - Redirects authenticated users
function PublicRoute({ children }: { children: React.ReactNode }) {
    const { user, role, loading } = useAuth()
    const location = useLocation()

    if (loading) {
        return <LoadingScreen />
    }

    if (user) {
        // Client and attendant roles always go to /app
        if (role === 'client' || role === 'attendant') {
            return <Navigate to="/app" replace />
        }

        // Platform admins (master, admin, operator) - use last visited panel or default to /admin
        const lastPanel = localStorage.getItem('apollo_last_panel')
        const validPanels = ['/master', '/admin', '/app']

        if (lastPanel && validPanels.some(p => lastPanel.startsWith(p))) {
            return <Navigate to={lastPanel} replace />
        }

        // Default: admin goes to admin view, master goes to master
        return <Navigate to={role === 'master' ? '/master' : '/admin'} replace />
    }

    return <>{children}</>
}

// Smart Home Redirect - Goes to correct dashboard based on role
function HomeRedirect() {
    const { user, role, loading } = useAuth()
    const location = useLocation()

    if (loading) {
        return <LoadingScreen />
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    // Client and attendant roles always go to /app
    if (role === 'client' || role === 'attendant') {
        return <Navigate to="/app" replace />
    }

    // Platform admins (master, admin, operator) - use last visited panel
    const lastPanel = localStorage.getItem('apollo_last_panel')
    const validPanels = ['/master', '/admin', '/app']

    if (lastPanel && validPanels.some(p => lastPanel.startsWith(p))) {
        return <Navigate to={lastPanel} replace />
    }

    // Default: master to master, others to admin
    return <Navigate to={role === 'master' ? '/master' : '/admin'} replace />
}

function AppRoutes() {
    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/login" element={
                <PublicRoute>
                    <Login />
                </PublicRoute>
            } />
            <Route path="/register" element={
                <PublicRoute>
                    <Register />
                </PublicRoute>
            } />
            <Route path="/forgot-password" element={
                <PublicRoute>
                    <ForgotPassword />
                </PublicRoute>
            } />
            <Route path="/reset-password" element={
                <ResetPassword />
            } />

            {/* Master Routes - Global Platform Administration */}
            <Route path="/master" element={
                <PlatformAdminRoute>
                    <ViewContextProvider>
                        <MasterLayout />
                    </ViewContextProvider>
                </PlatformAdminRoute>
            }>
                <Route index element={<MasterDashboard />} />
                <Route path="companies" element={<MasterCompanies />} />
                <Route path="kanban" element={<MasterKanban />} />
                <Route path="plans" element={<MasterPlans />} />
                <Route path="users" element={<MasterUsers />} />
                <Route path="analytics" element={<MasterAnalytics />} />
                <Route path="settings" element={<MasterSettings />} />
            </Route>

            {/* Admin Routes - Company-Specific Administration */}
            <Route path="/admin" element={
                <PlatformAdminRoute>
                    <ViewContextProvider>
                        <AdminLayout />
                    </ViewContextProvider>
                </PlatformAdminRoute>
            }>
                <Route index element={<AdminDashboardNew />} />
                <Route path="inbox" element={<AdminInbox />} />
                <Route path="crm" element={<AdminCRMBoard />} />
                <Route path="contacts" element={<AdminContacts />} />
                <Route path="messaging" element={<AdminMessaging />} />
                <Route path="services" element={<AdminServices />} />
                <Route path="agents" element={<AdminAgents />} />
                <Route path="tools" element={<AdminTools />} />
                <Route path="knowledge" element={<AdminKnowledge />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="settings" element={<AdminSettings />} />
            </Route>

            {/* Client Routes - Company Users (subset of admin features) */}
            <Route path="/app" element={
                <ProtectedRoute>
                    <ViewContextProvider>
                        <ClientLayout />
                    </ViewContextProvider>
                </ProtectedRoute>
            }>
                <Route index element={<AppDashboard />} />
                <Route path="inbox" element={<AdminInbox />} />
                <Route path="crm" element={<AppCRM />} />
                <Route path="contacts" element={<AdminContacts />} />
                <Route path="knowledge" element={<AdminKnowledge />} />
                <Route path="analytics" element={<AppAnalytics />} />
                <Route path="settings" element={<AppSettings />} />
            </Route>

            {/* Home Redirect */}
            <Route path="/" element={<HomeRedirect />} />

            {/* Catch all - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

function App() {
    return (
        <AuthProvider>
            <AppRoutes />
        </AuthProvider>
    )
}

export default App
