import { Layout, Typography } from 'antd';

const { Footer } = Layout;
const { Text, Link } = Typography;

/**
 * Subtle footer for customer portal
 * Shows "Powered by Cadence" branding
 */
function PortalFooter() {
  const currentYear = new Date().getFullYear();
  return (
    <Footer style={{ 
      textAlign: 'center', 
      background: 'var(--portal-secondary-color, #fafafa)',
      borderTop: '1px solid #f0f0f0',
      padding: '12px 24px',
      fontSize: 12
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
        <Text type="secondary">© {currentYear} · </Text>
        <Text strong>{localStorage.getItem('tenantBranding') ? JSON.parse(localStorage.getItem('tenantBranding')).companyName : 'Contractor'}</Text>
        <Text type="secondary">·</Text>
        <Text type="secondary">Powered by <Link href="https://cadencequote.com" target="_blank">Cadence</Link></Text>
      </div>
    </Footer>
  );
}

export default PortalFooter;
