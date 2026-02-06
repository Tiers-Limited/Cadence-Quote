import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { Layout } from 'antd'
import { Outlet } from 'react-router-dom'
import BrandedPortalHeader from './components/CustomerPortal/BrandedPortalHeader'
import PortalFooter from './components/CustomerPortal/PortalFooter'

const { Content } = Layout

export function CustomerPortalLayout() {
     const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
       useEffect(() => {
         const handleResize = () => setIsMobile(window.innerWidth <= 768);
         window.addEventListener('resize', handleResize);
         return () => window.removeEventListener('resize', handleResize);
       }, []);
	return (
		<Layout style={{ minHeight: '100vh' }}>
			<BrandedPortalHeader />
			<Content style={{ padding: isMobile ? '4px' : '24px' }}>
				<div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
					<Outlet />
				</div>
			</Content>
			<PortalFooter />
		</Layout>
	)
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
