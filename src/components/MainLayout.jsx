import { useNavigate, useLocation } from 'react-router-dom'
import { FiLogOut, FiHome, FiSettings, FiUsers, FiPackage, FiFileText, FiMail, FiSidebar } from 'react-icons/fi'
import { BarChart2Icon, Calculator } from 'lucide-react'
import { message, Layout, Menu, Button, theme } from 'antd'
import { useAuth } from '../hooks/useAuth'
import { useState } from 'react'
import '../styles/sidebar.css'
import Logo from './Logo'
import LogoIcon from './LogoIcon'

function MainLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const handleLogout = () => {
    logout()
    message.success('Logged out successfully')
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  const menuItems = [
    {
      key: 'dashboard',
      icon: <FiHome size={20} />,
      label: 'Dashboard',
      onClick: () => navigate('/dashboard')
    },
    {
      key: 'products',
      icon: <FiPackage size={20} />,
      label: 'Products & Colors',
      children: [
        {
          key: 'product-catalog',
          label: 'Product Catalog',
          onClick: () => navigate('/products/catalog')
        },
        {
          key: 'color-library',
          label: 'Color Library',
          onClick: () => navigate('/products/colors')
        }
      ]
    },
   
    {
      key: 'leads',
      icon: <FiUsers size={20} />,
      label: 'Leads',
      onClick: () => navigate('/leads/forms'),
     
    },
    
    {
      key: 'settings',
      icon: <FiSettings size={20} />,
      label: 'Settings',
      onClick: () => navigate('/settings'),
    },
  ]

  return (
    <Layout hasSider className="min-h-screen">
      <Layout.Sider
        style={{
          background: '#fafafa',
          borderRight: '1px solid #e5e7eb',
          overflow: 'hidden',
          height: '100dvh',
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
        breakpoint="lg"
        onBreakpoint={(broken) => {
          setCollapsed(broken)
        }}
        className={`transition-all  duration-200 ease-in-out ${collapsed ? 'shadow-lg' : ''}`}
      >
        <div style={{ background: '#eff0f4' }} className="flex items-center h-32 p-6 border-b flex-shrink-0">
          <span className="text-[#4a8bff] font-bold text-lg truncate">
            {collapsed ? <LogoIcon/> : <Logo />}
          </span>
        </div>
        <div className=" overflow-y-auto flex-1 h-[calc(100dvh-12rem)] overflow-x-hidden">
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
            {!collapsed && 'Logout'}
          </Button>
        </div>
      </Layout.Sider>

      {/* Mobile backdrop overlay */}
      {/* {!collapsed && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-[1000]"
          onClick={() => setCollapsed(true)}
        />
      )} */}

      <Layout 
        className="transition-all duration-200 ease-in-out min-h-screen bg-gray-50"
        style={{ 
          marginLeft: collapsed ? 80 : 240,
          ['@media (max-width: 992px)']: {
            marginLeft: 0
          }
        }}
      >
        <Layout.Header 
          className="fixed top-0 z-[999] shadow-sm flex items-center gap-3 px-6"
          style={{ 
            background: colorBgContainer,
            width: `calc(100% - ${collapsed ? 80 : 240}px)`,
            ['@media (max-width: 992px)']: {
              width: '100%'
            }
          }}
        >
          <Button 
            type="text" 
            icon={<FiSidebar size={20} />} 
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-500 flex items-center justify-center"
          />
          <span className="text-lg font-semibold">Dashboard</span>
        </Layout.Header>

        <Layout.Content
          className="mt-16 p-4 md:p-6 transition-all duration-200"
          style={{
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          {children}
        </Layout.Content>
      </Layout>
    </Layout>
  )
}

export default MainLayout
