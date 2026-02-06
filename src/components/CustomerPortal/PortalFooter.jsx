import { Layout, Typography } from 'antd';
import { useState, useEffect } from 'react';

const { Footer } = Layout;
const { Text, Link } = Typography;

/**
 * Subtle footer for customer portal
 * Shows "Powered by Cadence" branding
 */
function PortalFooter() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <Footer 
      className="text-center px-3 sm:px-6"
      style={{ 
        background: 'var(--portal-secondary-color, #fafafa)',
        borderTop: '1px solid #f0f0f0',
        padding: isMobile ? '12px 16px' : '12px 24px',
        fontSize: isMobile ? 11 : 12
      }}
    >
      <div 
        className={isMobile ? 'flex-col' : 'flex-row'}
        style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          gap: isMobile ? 4 : 8,
          flexWrap: 'wrap'
        }}
      >
        <Text type="secondary">© {currentYear}</Text>
        {!isMobile && <Text type="secondary">·</Text>}
        <Text strong>{localStorage.getItem('tenantBranding') ? JSON.parse(localStorage.getItem('tenantBranding')).companyName : 'Contractor'}</Text>
        {!isMobile && <Text type="secondary">·</Text>}
        <Text type="secondary">
          Powered by <Link href="https://cadencequote.com" target="_blank">Cadence</Link>
        </Text>
      </div>
    </Footer>
  );
}

export default PortalFooter;
