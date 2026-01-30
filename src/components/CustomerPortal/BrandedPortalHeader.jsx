import { Layout, Space, Typography, Avatar, Button } from 'antd';
import { FiPhone, FiMail, FiGlobe } from 'react-icons/fi';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const { Header } = Layout;
const { Text } = Typography;

/**
 * Branded header for customer portal
 * Shows contractor's logo, name, and contact info
 */
function BrandedPortalHeader() {
  const [branding, setBranding] = useState(null);
  const [client, setClient] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Load branding from localStorage
    const brandingData = localStorage.getItem('tenantBranding');
    if (brandingData) {
      setBranding(JSON.parse(brandingData));
    }
    
    // Load client info from localStorage
    const clientData = localStorage.getItem('portalClient');
    if (clientData) {
      setClient(JSON.parse(clientData));
    }
  }, []);
  // Compute safe color values so hooks remain stable
  const primaryColor = (branding && branding.primaryColor) || '#1890ff';
  const secondaryColor = (branding && branding.secondaryColor) || '#f5f7fa';

  // Apply simple CSS variables so portal picks up contractor colors
  useEffect(() => {
    if (!branding) return;
    try {
      document.documentElement.style.setProperty('--portal-primary-color', primaryColor);
      document.documentElement.style.setProperty('--portal-secondary-color', secondaryColor);
      document.documentElement.style.setProperty('--portal-accent-color', branding.accentColor || primaryColor);
    } catch (err) {
      // ignore in non-browser contexts
    }
  }, [branding, primaryColor, secondaryColor]);

  if (!branding) return null;

  return (
    <Header 
      style={{ 
        background: '#fff', 
        padding: '0 24px',
        borderBottom: `3px solid ${primaryColor}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        height: 'auto',
        lineHeight: 'normal',
        paddingTop: '16px',
        paddingBottom: '16px'
      }}
    >
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Left: Logo, Company Name, and Contractor Contact */}
        <Space size="large" align="center">
          {branding.logo && (
            <Avatar 
              src={branding.logo} 
              size={96}
              shape="square"
              style={{ borderRadius: '8px' }}
            />
          )}
          <div>
            <Typography.Title 
              level={3} 
              style={{ 
                margin: 0,
                color: primaryColor,
                fontWeight: 600
              }}
            >
              {branding.companyName}
            </Typography.Title>
           
            <Space direction="vertical" size={2}>
              {branding.phone && (
                <Space size="small">
                  <FiPhone style={{ color: primaryColor, fontSize: '12px' }} />
                  <Text style={{ fontSize: '12px' }}>{branding.phone}</Text>
                </Space>
              )}
              {branding.email && (
                <Space size="small">
                  <FiMail style={{ color: primaryColor, fontSize: '12px' }} />
                  <Text style={{ fontSize: '12px' }}>{branding.email}</Text>
                </Space>
              )}
            </Space>
          </div>
        </Space>

        {/* Right: Customer Info and Actions */}
        <Space size="large" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <Button onClick={() => navigate('/portal/dashboard')} type="default" style={{ marginRight: 8 }}>
            Back to Portal
          </Button>
          {client && (
            <div style={{ textAlign: 'right' }}>
              <Text strong style={{ display: 'block', fontSize: '14px' }}>
                {client.name}
              </Text>
              <Space direction="vertical" size={2} style={{ alignItems: 'flex-end' }}>
                {client.email && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {client.email}
                  </Text>
                )}
                {client.phone && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {client.phone}
                  </Text>
                )}
              </Space>
            </div>
          )}
          {branding.website && (
            <a 
              href={branding.website} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: primaryColor, fontWeight: 500, fontSize: '12px' }}
            >
              <Space size="small">
                <FiGlobe />
                <span>Visit Website</span>
              </Space>
            </a>
          )}
        </Space>
      </div>
    </Header>
  );
}

export default BrandedPortalHeader;
