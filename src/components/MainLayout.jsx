import { useNavigate, useLocation } from 'react-router-dom'
import { FiLogOut, FiHome, FiSettings, FiUsers, FiPackage, FiSidebar, FiMenu, FiX } from 'react-icons/fi'
import { message, Layout, Menu, Button, theme, Drawer } from 'antd'
import { useAuth } from '../hooks/useAuth'
import { useState, useEffect } from 'react'
import '../styles/sidebar.css'
import Logo from './Logo'
import LogoIcon from './LogoIcon'

function MainLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAuth()
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

  const menuItems = [
    {
      key: 'dashboard',
      icon: <FiHome size={20} />,
      label: 'Dashboard',
      onClick: () => handleMenuClick('/dashboard')
    },
    {
      key: 'products',
      icon: <FiPackage size={20} />,
     label: 'Product & Rates',
          onClick: () => handleMenuClick('/products/catalog')
      // children: [
      //   {
      //     key: 'product-catalog',
      //     label: 'Product & Rates',
      //     onClick: () => handleMenuClick('/products/catalog')
      //   },
      //   // {
      //   //   key: 'color-library',
      //   //   label: 'Color Library',
      //   //   onClick: () => handleMenuClick('/products/colors')
      //   // }
      // ]
    },
   
    {
      key: 'leads',
      icon: <FiUsers size={20} />,
      label: 'Leads',
      onClick: () => handleMenuClick('/leads/forms'),
     
    },
    
    {
      key: 'settings',
      icon: <FiSettings size={20} />,
      label: 'Settings',
      onClick: () => handleMenuClick('/settings'),
    },
  ]

  // Sidebar content component (reusable for both desktop and mobile)
  const SidebarContent = () => (
    <>
      <div style={{ background: '#eff0f4' }} className="flex items-center h-32 p-6 border-b flex-shrink-0">
        <span className="text-[#4a8bff] font-bold text-lg truncate">
          {collapsed && !isMobile ? <LogoIcon/> : <Logo />}
        </span>
      </div>
      <div className="overflow-y-auto flex-1 overflow-x-hidden">
        <Menu
          mode="inline"
          selectedKeys={[location.pathname.slice(1) || 'dashboard']}
          style={{
            background: '#fafafa',
            border: 'none',
          }}
          items={menuItems}
          className="px-3 py-4"
          rootClassName="custom-menu"
        />
      </div>
      <div className="flex-shrink-0 p-4 bg-[#fafafa] border-t">
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
    </>
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
