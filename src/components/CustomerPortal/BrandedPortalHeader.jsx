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
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      className="px-3 sm:px-6"
      style={{ 
        background: '#fff', 
        borderBottom: `3px solid ${primaryColor}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        height: 'auto',
        lineHeight: 'normal',
        paddingTop: isMobile ? '10px' : '16px',
        paddingBottom: isMobile ? '10px' : '16px'
      }}
    >
      {isMobile ? (
        // Mobile Layout - Stacked vertically
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Top Row: Logo and Company Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {branding.logo && (
              <Avatar 
                src={branding.logo} 
                size={56}
                shape="square"
                style={{ borderRadius: '6px', flexShrink: 0 }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Typography.Title 
                level={5}
                style={{ 
                  margin: 0,
                  color: primaryColor,
                  fontWeight: 600,
                  fontSize: '16px',
                  lineHeight: '1.3',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {branding.companyName}
              </Typography.Title>
              {/* Show contact on mobile in compact form */}
              <div style={{ marginTop: '4px' }}>
                {branding.phone && (
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
                    <FiPhone style={{ fontSize: '10px', marginRight: '4px' }} />
                    {branding.phone}
                  </Text>
                )}
              </div>
            </div>
          </div>

          {/* Client Info Row (if exists) */}
          {client && (
            <div style={{ 
              padding: '8px 12px', 
              background: '#f5f5f5', 
              borderRadius: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text strong style={{ fontSize: '13px', display: 'block' }}>
                  {client.name}
                </Text>
                {client.email && (
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {client.email}
                  </Text>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons Row */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button 
              onClick={() => navigate('/portal/dashboard')} 
              type="default" 
              size="small"
              style={{ flex: 1 }}
            >
              Back to Portal
            </Button>
            {branding.website && (
              <Button
                href={branding.website}
                target="_blank"
                rel="noopener noreferrer"
                type="link"
                size="small"
                icon={<FiGlobe />}
                style={{ color: primaryColor, padding: '4px 8px' }}
              >
                Website
              </Button>
            )}
          </div>
        </div>
      ) : (
        // Desktop Layout - Horizontal
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          {/* Left: Logo, Company Name, and Contractor Contact */}
          <Space size="large" align="center" style={{ flexShrink: 0 }}>
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
            <Button 
              onClick={() => navigate('/portal/dashboard')} 
              type="default"
            >
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
      )}
    </Header>
  );
}

export default BrandedPortalHeader;
