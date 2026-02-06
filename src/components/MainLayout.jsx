import { useNavigate, useLocation } from 'react-router-dom'
import {
  FiLogOut,
  FiHome,
  FiSettings,
  FiUsers,
  FiPackage,
  FiSidebar,
  FiMenu,
  FiX,
  FiDroplet,
  FiDollarSign,
  FiFileText,
  FiToggleLeft,
  FiCreditCard,
  FiClipboard,
  FiTrendingUp,
  FiCalendar,
  FiTool,
  FiLink ,
  FiUser
} from 'react-icons/fi'
import { message, Layout, Menu, Button, theme, Drawer, Badge, Dropdown, Avatar } from 'antd'
import { useAuth } from '../hooks/useAuth'
import { useState, useEffect } from 'react'
import { apiService } from '../services/apiService'
import '../styles/sidebar.css'
import Logo from './Logo'
import LogoIcon from './LogoIcon'

const { SubMenu } = Menu

function MainLayout ({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [activeProposalId, setActiveProposalId] = useState(null)
  const [openKeys, setOpenKeys] = useState([])
  const {
    token: { colorBgContainer, borderRadiusLG }
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

  // Fetch active proposal for customer users
  useEffect(() => {
    const fetchActiveProposal = async () => {
      if (user?.role === 'customer') {
        try {
          const response = await apiService.get('/customer/proposals')
          if (response.success && response.data && response.data.length > 0) {
            // Get the first proposal or the most recent one
            const activeProposal = response.data[0]
            setActiveProposalId(activeProposal.id)
          }
        } catch (error) {
          console.error('Failed to fetch proposals:', error)
        }
      }
    }

    fetchActiveProposal()
  }, [user])

  const handleLogout = () => {
    logout()
    message.success('Logged out successfully')
    navigate('/login')
  }

  const handleMenuClick = path => {
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
    }
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
      key: 'pricing-engine',
      path: '/pricing-engine',
      icon: <FiDollarSign size={20} />,
      label: 'Pricing Engine',
      onClick: () => handleMenuClick('/pricing-engine')
      // children: [
      //   {
      //     key: 'pricing-engine',
      //     path: '/pricing-engine',
      //     icon: <FiDollarSign size={18} />,
      //     label: 'Labor & Pricing',
      //     onClick: () => handleMenuClick('/pricing-engine')
      //   },
      //   // {
      //   //   key: 'product-tiers',
      //   //   path: '/products/tiers',
      //   //   icon: <FiPackage size={18} />,
      //   //   label: 'Product Tiers',
      //   //   onClick: () => handleMenuClick('/products/tiers')
      //   // },
      // ]
    },
    {
      key: 'pipeline',
      icon: <FiTrendingUp size={20} />,
      label: 'Pipeline',
      children: [
        // {
        //   label: 'New Quote',
        //   key: 'quotes-new',
        //   path: '/quotes/new',
        //   exactMatch: true,
        //   icon: <Badge dot offset={[-5, 5]}>
        //     <FiFileText size={18} />
        //   </Badge>,
        //   onClick: () => handleMenuClick('/quotes/new')
        // },
        {
          key: 'leads',
          path: '/leads',
          icon: <FiUsers size={18} />,
          label: 'Leads',
          onClick: () => handleMenuClick('/leads/forms')
        },
        {
          key: 'quotes',
          path: '/quotes',
          icon: <FiClipboard size={18} />,
          label: 'Quotes',
          onClick: () => handleMenuClick('/quotes')
        },
        {
          key: 'jobs',
          path: '/jobs',
          icon: <FiTool size={18} />,
          label: 'Jobs',
          onClick: () => handleMenuClick('/jobs')
        },
        // {
        //   key: 'job-analytics',
        //   path: '/job-analytics',
        //   icon: <FiTrendingUp size={18} />,
        //   label: 'Job Analytics',
        //   onClick: () => handleMenuClick('/job-analytics')
        // }
      ]
    },
    {
      key: 'cadence-pulse',
      path: '/cadence-pulse',
      icon: <FiLink size={20} />,
      label: 'Cadence Pulse',
      onClick: () => handleMenuClick('/cadence-pulse')
    },
    {
      key: 'settings-submenu',
      icon: <FiSettings size={20} />,
      label: 'Settings',
      children: [
        {
          key: 'proposal-defaults',
          path: '/proposal-defaults',
          icon: <FiFileText size={18} />,
          label: 'Proposal Defaults',
          onClick: () => handleMenuClick('/proposal-defaults')
        },
        {
          key: 'settings',
          path: '/settings',
          icon: <FiSettings size={18} />,
          label: 'General Settings',
          onClick: () => handleMenuClick('/settings')
        }
      ]
    }
  ]

  const customerMenuItems = [
    {
      key: 'portal-dashboard',
      path: '/portal/dashboard',
      exactMatch: true,
      icon: <FiHome size={20} />,
      label: 'Dashboard',
      onClick: () => handleMenuClick('/portal/dashboard')
    },
    ...(activeProposalId
      ? [
          {
            key: 'portal-proposal',
            path: `/portal/proposal/${activeProposalId}`,
            icon: <FiFileText size={20} />,
            label: 'My Proposal',
            onClick: () =>
              handleMenuClick(`/portal/proposal/${activeProposalId}`)
          },
          {
            key: 'portal-job-progress',
            path: `/portal/jobs/${activeProposalId}`,
            icon: <FiTool size={20} />,
            label: 'Job Progress',
            onClick: () =>
              handleMenuClick(`/portal/jobs/${activeProposalId}`)
          },
          {
            key: 'portal-selections',
            path: `/portal/colors/${activeProposalId}`,
            icon: <FiPackage size={20} />,
            label: 'Color Selections',
            onClick: () => handleMenuClick(`/portal/colors/${activeProposalId}`)
          },
          {
            key: 'portal-documents',
            path: `/portal/documents/${activeProposalId}`,
            icon: <FiClipboard size={20} />,
            label: 'Documents',
            onClick: () =>
              handleMenuClick(`/portal/documents/${activeProposalId}`)
          }
        ]
      : [])
  ]

  const menuItems =
    user?.role === 'admin'
      ? adminMenuItems
      : user?.role === 'customer'
      ? customerMenuItems
      : normalMenuItems

  // Generic and dynamic selectedKey logic
  const getSelectedKey = () => {
    const currentPath = location.pathname

    // Flatten menu items to include submenu children
    const flattenedItems = []
    menuItems.forEach(item => {
      if (item.children) {
        // Add submenu children to flattened list
        item.children.forEach(child => flattenedItems.push(child))
      } else {
        flattenedItems.push(item)
      }
    })

    // First pass: Check for exact matches (highest priority)
    const exactMatch = flattenedItems.find(
      item => item.exactMatch && item.path === currentPath
    )
    if (exactMatch) return exactMatch.key

    // Second pass: Find the longest matching path (most specific match)
    let bestMatch = null
    let longestMatchLength = 0

    for (const item of flattenedItems) {
      if (item.path && currentPath.startsWith(item.path)) {
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

  // Find current menu item label (including submenu items)
  const findMenuItem = (items, key) => {
    for (const item of items) {
      if (item.key === key) return item
      if (item.children) {
        const found = item.children.find(child => child.key === key)
        if (found) return found
      }
    }
    return null
  }

  const currentMenuItem = findMenuItem(menuItems, selectedKey)
  const headerTitle = currentMenuItem?.label || 'Dashboard'

  // Sidebar content component (reusable for both desktop and mobile)
  const SidebarContent = () => (
    <div className='h-full flex flex-col'>
      <div
        style={{ background: '#eff0f4' }}
        className='flex items-center h-32 p-6 border-b flex-shrink-0'
      >
        <div className='flex flex-col'>
          <span className='text-[#4a8bff] font-bold text-lg truncate'>
            {collapsed && !isMobile ? <LogoIcon /> : <Logo />}
          </span>
        </div>
      </div>

      <div className='overflow-y-auto flex-1 overflow-x-hidden'>
        <Menu
          mode='inline'
          selectedKeys={[selectedKey]}
          openKeys={collapsed && !isMobile ? [] : openKeys}
          onOpenChange={keys => setOpenKeys(keys)}
          style={{
            background: '#fafafa',
            border: 'none'
          }}
          items={menuItems}
          className='px-3 py-4'
          rootClassName='custom-menu'
        />
      </div>

      <div className='mt-auto p-4 bg-[#fafafa] border-t'>
        <Button
          danger
          type='primary'
          block
          onClick={handleLogout}
          icon={<FiLogOut />}
          className='flex items-center justify-center'
        >
          {(!collapsed || isMobile) && 'Logout'}
        </Button>
      </div>
    </div>
  )

  return (
    <Layout hasSider className='min-h-screen'>
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
            flexDirection: 'column'
          }}
          width={240}
          collapsible
          collapsed={collapsed}
          trigger={null}
          collapsedWidth={80}
          className='transition-all duration-200 ease-in-out'
        >
          <SidebarContent />
        </Layout.Sider>
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          placement='left'
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
          <div
            className='h-full flex flex-col'
            style={{ background: '#fafafa' }}
          >
            <SidebarContent />
          </div>
        </Drawer>
      )}

      <Layout
        className='transition-all duration-200 ease-in-out min-h-screen bg-gray-50'
        style={{
          marginLeft: isMobile ? 0 : collapsed ? 80 : 240
        }}
      >
        <Layout.Header
          className='fixed top-0 z-[998] shadow-sm flex items-center justify-between gap-3 px-4 md:px-6'
          style={{
            background: colorBgContainer,
            width: isMobile ? '100%' : `calc(100% - ${collapsed ? 80 : 240}px)`,
            left: isMobile ? 0 : collapsed ? 80 : 240
          }}
        >
          <div className='flex items-center gap-3'>
            <Button
              type='text'
              icon={
                isMobile ? (
                  mobileOpen ? (
                    <FiX size={22} />
                  ) : (
                    <FiMenu size={22} />
                  )
                ) : (
                  <FiSidebar size={20} />
                )
              }
              onClick={() =>
                isMobile ? setMobileOpen(!mobileOpen) : setCollapsed(!collapsed)
              }
              className='text-gray-500 flex items-center justify-center'
            />
            <span className='text-base md:text-lg font-semibold'>
              {headerTitle}
            </span>
          </div>

          {/* User Profile Section */}
          <Dropdown
            menu={{
              items: [
                {
                  key: 'profile',
                  label: (
                    <div className='px-2 py-1'>
                      <div className='font-semibold text-gray-900'>{user?.fullName || 'User'}</div>
                      <div className='text-sm text-gray-500'>{user?.email || 'No email'}</div>
                      <div className='text-xs text-gray-400 mt-1 capitalize'>{user?.role?.replace('_', ' ') || 'Role'}</div>
                    </div>
                  ),
                  disabled: true
                },
                {
                  type: 'divider'
                },
                {
                  key: 'logout',
                  icon: <FiLogOut />,
                  label: 'Logout',
                  danger: true,
                  onClick: handleLogout
                }
              ]
            }}
            placement='bottomRight'
            trigger={['click']}
          >
            <div className='flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors'>
              {
                user?.tenant?.companyLogoUrl ? (
                  <Avatar 
                    style={{ backgroundColor: '#fff',objectFit:"cover", border:"1px solid #ccc" }}
                    src={user.tenant.companyLogoUrl}
                    size={48}
                  />
                ) :
                <Avatar 
                style={{ backgroundColor: '#4a8bff' }} 
                icon={<FiUser />}
                size={32}
              />}
              {!isMobile && (
                <div className='flex flex-col'>
                  <span className='text-sm font-medium text-gray-900'>
                    {user?.fullName || 'User'}
                  </span>
                  <span className='text-xs text-gray-500'>
                    {user?.tenant?.companyName}
                  </span>
                  <span className='text-xs text-gray-500'>
                    {user?.email || 'No email'}
                  </span>
                </div>
              )}
            </div>
          </Dropdown>
        </Layout.Header>

        <Layout.Content
          className='mt-16 p-3 md:p-6 transition-all duration-200'
          style={{
            minHeight: 'calc(100vh - 64px)',
            background: isMobile ? '#f9fafb' : colorBgContainer,
            borderRadius: isMobile ? 0 : borderRadiusLG
          }}
        >
          {children}
        </Layout.Content>
      </Layout>
    </Layout>
  )
}

export default MainLayout
