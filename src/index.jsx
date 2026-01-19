import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { Layout } from 'antd'
import { Outlet } from 'react-router-dom'
import BrandedPortalHeader from './components/CustomerPortal/BrandedPortalHeader'
import PortalFooter from './components/CustomerPortal/PortalFooter'

const { Content } = Layout

export function CustomerPortalLayout() {
	return (
		<Layout style={{ minHeight: '100vh' }}>
			<BrandedPortalHeader />
			<Content style={{ padding: '24px' }}>
				<div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
					<Outlet />
				</div>
			</Content>
			<PortalFooter />
		</Layout>
	)
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
