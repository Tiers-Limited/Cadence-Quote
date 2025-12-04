import { useNavigate, useLocation } from 'react-router-dom'
import { FiLogOut, FiHome, FiSettings, FiUsers, FiPackage, FiSidebar, FiMenu, FiX, FiDroplet, FiDollarSign, FiFileText, FiToggleLeft, FiCreditCard, FiClipboard } from 'react-icons/fi'
import { message, Layout, Menu, Button, theme, Drawer, Badge } from 'antd'
import { useAuth } from '../hooks/useAuth'
import { useState, useEffect } from 'react'
import '../styles/sidebar.css'
import Logo from './Logo'
import LogoIcon from './LogoIcon'

function MainLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 992)
      if (window.innerWidth >= 992) {
        setMobileOpen(false)
      }
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleLogout = () => {
    logout()
    message.success('Logged out successfully')
    navigate('/login')
  }

  const handleMenuClick = (path) => {
    navigate(path)
    if (isMobile) {
      setMobileOpen(false)
    }
  }

  const adminMenuItems = [
    {
      key: 'dashboard',
      path: '/admin/dashboard',
      icon: <FiHome size={20} />,
      label: 'Dashboard',
      onClick: () => handleMenuClick('/admin/dashboard')
    },
    {
      key: 'products',
      path: '/admin/products',
      icon: <FiPackage size={20} />,
      label: 'Product Management',
      onClick: () => handleMenuClick('/admin/products')
    },
    {
      key: 'colors',
      path: '/admin/colors',
      icon: <FiDroplet size={20} />,
      label: 'Color Management',
      onClick: () => handleMenuClick('/admin/colors')
    },
    {
      key: 'pricing-schemes',
      path: '/admin/pricing-schemes',
      icon: <FiDollarSign size={20} />,
      label: 'Pricing Schemes',
      onClick: () => handleMenuClick('/admin/pricing-schemes')
    },
    {
      key: 'audit-logs',
      path: '/admin/audit-logs',
      icon: <FiFileText size={20} />,
      label: 'Audit Logs',
      onClick: () => handleMenuClick('/admin/audit-logs')
    },
    {
      key: 'tenants',
      path: '/admin/tenants',
      icon: <FiUsers size={20} />,
      label: 'Tenant Management',
      onClick: () => handleMenuClick('/admin/tenants')
    },
    {
      key: 'features',
      path: '/admin/features',
      icon: <FiToggleLeft size={20} />,
      label: 'Feature Flags / Add-ons',
      onClick: () => handleMenuClick('/admin/features')
    },
    {
      key: 'billing',
      path: '/admin/billing',
      icon: <FiCreditCard size={20} />,
      label: 'Stripe Billing',
      onClick: () => handleMenuClick('/admin/billing')
    },
    {
      key: 'settings',
      path: '/admin/settings',
      icon: <FiSettings size={20} />,
      label: 'Settings',
      onClick: () => handleMenuClick('/admin/settings')
    },
  ]

  const normalMenuItems = [
    {
      key: 'dashboard',
      path: '/dashboard',
      exactMatch: true,
      icon: <FiHome size={20} />,
      label: 'Dashboard',
      onClick: () => handleMenuClick('/dashboard')
    },
    {
      key: 'products',
      path: '/products',
      icon: <FiPackage size={20} />,
      label: 'Product & Rates',
      onClick: () => handleMenuClick('/products/catalog')
    },
     {
      label: 'New Quote',
      key: 'quotes-new',
      path: '/quotes/new',
      exactMatch: true,
      icon: <Badge dot offset={[-5, 5]}>
        <FiFileText size={20} />
      </Badge>,
      onClick: () => handleMenuClick('/quotes/new')
    },
    {
      key: 'quotes',
      path: '/quotes',
      icon: <FiClipboard size={20} />,
      label: 'Quotes',
      onClick: () => handleMenuClick('/quotes')
    },
   
    {
      key: 'leads',
      path: '/leads',
      icon: <FiUsers size={20} />,
      label: 'Leads',
      onClick: () => handleMenuClick('/leads/forms')
    },
    {
      key: 'proposal-defaults',
      path: '/proposal-defaults',
      icon: <FiFileText size={20} />,
      label: 'Proposal Defaults',
      onClick: () => handleMenuClick('/proposal-defaults')
    },
    // {
    //   key: 'service-types',
    //   path: '/service-types',
    //   icon: <FiPackage size={20} />,
    //   label: 'Service Types',
    //   onClick: () => handleMenuClick('/service-types')
    // },
    {
      key: 'labor-rates',
      path: '/labor-rates',
      icon: <FiDollarSign size={20} />,
      label: 'Labor Rates',
      onClick: () => handleMenuClick('/labor-rates')
    },
    {
      key: 'settings',
      path: '/settings',
      icon: <FiSettings size={20} />,
      label: 'Settings',
      onClick: () => handleMenuClick('/settings'),
    },
  ]

  const menuItems = (user && user.role === 'admin') ? adminMenuItems : normalMenuItems
  
  // Generic and dynamic selectedKey logic
  const getSelectedKey = () => {
    const currentPath = location.pathname
    
    // First pass: Check for exact matches (highest priority)
    const exactMatch = menuItems.find(item => 
      item.exactMatch && item.path === currentPath
    )
    if (exactMatch) return exactMatch.key
    
    // Second pass: Find the longest matching path (most specific match)
    let bestMatch = null
    let longestMatchLength = 0
    
    for (const item of menuItems) {
      if (currentPath.startsWith(item.path)) {
        const matchLength = item.path.length
        if (matchLength > longestMatchLength) {
          longestMatchLength = matchLength
          bestMatch = item
        }
      }
    }
    
    if (bestMatch) return bestMatch.key
    
    // Default to dashboard if no match found
    return 'dashboard'
  }
  
  const selectedKey = getSelectedKey()

  // Sidebar content component (reusable for both desktop and mobile)
  const SidebarContent = () => (
    <div className="h-full flex flex-col">
      <div style={{ background: '#eff0f4' }} className="flex items-center h-32 p-6 border-b flex-shrink-0">
        <div className="flex flex-col">
          <span className="text-[#4a8bff] font-bold text-lg truncate">
            {collapsed && !isMobile ? <LogoIcon/> : <Logo />}
          </span>
         
        </div>
      </div>

      <div className="overflow-y-auto flex-1 overflow-x-hidden">
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          style={{
            background: '#fafafa',
            border: 'none',
          }}
          items={menuItems}
          className="px-3 py-4"
          rootClassName="custom-menu"
        />
      </div>

      <div className="mt-auto p-4 bg-[#fafafa] border-t">
        <Button 
          danger 
          type="primary" 
          block 
          onClick={handleLogout} 
          icon={<FiLogOut />}
          className="flex items-center justify-center"
        >
          {(!collapsed || isMobile) && 'Logout'}
        </Button>
      </div>
    </div>
  )

  return (
    <Layout hasSider className="min-h-screen">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Layout.Sider
          style={{
            background: '#fafafa',
            borderRight: '1px solid #e5e7eb',
            overflow: 'hidden',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 999,
            display: 'flex',
            flexDirection: 'column',
          }}
          width={240}
          collapsible
          collapsed={collapsed}
          trigger={null}
          collapsedWidth={80}
          className="transition-all duration-200 ease-in-out"
        >
          <SidebarContent />
        </Layout.Sider>
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          placement="left"
          onClose={() => setMobileOpen(false)}
          open={mobileOpen}
          closable={false}
          width={280}
          styles={{
            body: { padding: 0, background: '#fafafa' },
            header: { display: 'none' }
          }}
          zIndex={1050}
        >
          <div className="h-full flex flex-col" style={{ background: '#fafafa' }}>
            <SidebarContent />
          </div>
        </Drawer>
      )}

      <Layout 
        className="transition-all duration-200 ease-in-out min-h-screen bg-gray-50"
        style={{ 
          marginLeft: isMobile ? 0 : (collapsed ? 80 : 240),
        }}
      >
        <Layout.Header 
          className="fixed top-0 z-[998] shadow-sm flex items-center gap-3 px-4 md:px-6"
          style={{ 
            background: colorBgContainer,
            width: isMobile ? '100%' : `calc(100% - ${collapsed ? 80 : 240}px)`,
            left: isMobile ? 0 : (collapsed ? 80 : 240),
          }}
        >
          <Button 
            type="text" 
            icon={isMobile ? (mobileOpen ? <FiX size={22} /> : <FiMenu size={22} />) : <FiSidebar size={20} />} 
            onClick={() => isMobile ? setMobileOpen(!mobileOpen) : setCollapsed(!collapsed)}
            className="text-gray-500 flex items-center justify-center"
          />
          <span className="text-base md:text-lg font-semibold">Dashboard</span>
        </Layout.Header>

        <Layout.Content
          className="mt-16 p-3 md:p-6 transition-all duration-200"
          style={{
            minHeight: 'calc(100vh - 64px)',
            background: isMobile ? '#f9fafb' : colorBgContainer,
            borderRadius: isMobile ? 0 : borderRadiusLG,
          }}
        >
          {children}
        </Layout.Content>
      </Layout>
    </Layout>
  )
}

export default MainLayout
