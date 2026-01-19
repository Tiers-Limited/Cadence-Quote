import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Select, Typography, Space, message, Spin, Alert, Tag, Modal, Table, Empty } from 'antd';
import { FiCheckCircle, FiEdit, FiLock } from 'react-icons/fi';
import { apiService } from '../../services/apiService';
import PortalStatusIndicator from '../../components/PortalStatusIndicator';
import BrandedPortalHeader from '../../components/CustomerPortal/BrandedPortalHeader';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

function ProductSelections() {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [proposal, setProposal] = useState(null);
  const [areas, setAreas] = useState([]);
  const [brands, setBrands] = useState([]);
  const [allProducts, setAllProducts] = useState([]); // Store all products
  const [allColors, setAllColors] = useState([]); // Store all colors
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [filteredColors, setFilteredColors] = useState([]);
  const [sheens, setSheens] = useState([]);
  const [editingArea, setEditingArea] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [submitModalVisible, setSubmitModalVisible] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    brand: null,
    product: null,
    color: null,
    customColor: null,
    sheen: null
  });

  useEffect(() => {
    fetchProposal();
    fetchBrands();
    fetchAllProducts();
    fetchAllColors();
    fetchSheens();
  }, [proposalId]);

  const fetchProposal = async () => {
    try {
      setLoading(true);
      const response = await magicLinkApiService.get(`/api/customer-portal/proposals/${proposalId}`);
      if (response.success) {
        setProposal(response.data);
        setAreas(response.data.areas || []);

        // Check if portal is locked
        if (!response.data.portalOpen && !response.data.selectionsComplete) {
          message.warning('The customer portal is currently closed');
        }
      }
    } catch (error) {
      message.error('Failed to load proposal: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await magicLinkApiService.get('/api/customer-portal/brands');
      if (response.success) {
        setBrands(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load brands:', error);
      message.error('Failed to load brands');
    }
  };

  const fetchAllProducts = async () => {
    try {
      const response = await magicLinkApiService.get('/api/customer-portal/products?limit=1000');
      if (response.success) {
        setAllProducts(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
      message.error('Failed to load products');
    }
  };

  const fetchAllColors = async () => {
    try {
      const response = await magicLinkApiService.get('/api/customer-portal/colors?limit=1000');
      if (response.success) {
        setAllColors(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load colors:', error);
      message.error('Failed to load colors');
    }
  };

  const fetchSheens = async () => {
    try {
      const response = await magicLinkApiService.get('/api/customer-portal/sheens');
      if (response.success) {
        setSheens(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load sheens:', error);
      // Fallback to hardcoded sheens if API fails
      setSheens([
        { id: 1, name: 'Flat' },
        { id: 2, name: 'Eggshell' },
        { id: 3, name: 'Satin' },
        { id: 4, name: 'Semi-Gloss' },
        { id: 5, name: 'Gloss' }
      ]);
    }
  };

  const handleEditArea = (area) => {
    if (!proposal.portalOpen) {
      message.warning('Portal is closed. Contact contractor to reopen.');
      return;
    }

    setEditingArea(area);
    const savedBrandId = area.selections?.brandId || null;
    const savedProductId = area.selections?.productId || null;
    
    setEditForm({
      brand: savedBrandId,
      product: savedProductId,
      color: area.selections?.colorId || null,
      customColor: area.selections?.customColor || null,
      sheen: area.selections?.sheen || null
    });

    // Filter products and colors based on saved selections
    if (savedBrandId) {
      filterProductsByBrand(savedBrandId);
      if (savedProductId) {
        const product = allProducts.find(p => p.id === savedProductId);
        if (product) {
          filterColorsByBrandAndProduct(savedBrandId, product);
        }
      }
    }

    setEditModalVisible(true);
  };

  const filterProductsByBrand = (brandId) => {
    if (!brandId) {
      setFilteredProducts([]);
      return;
    }

    // Filter products by brand and tier
    const tierFiltered = allProducts.filter(product => {
      const matchesBrand = product.brandId === brandId;
      
      // Filter by tier based on proposal
      if (!proposal?.selectedTier) return matchesBrand;
      
      const productTier = product.tier?.toLowerCase();
      const selectedTier = proposal.selectedTier.toLowerCase();
      
      if (selectedTier === 'good') return matchesBrand && productTier === 'good';
      if (selectedTier === 'better') return matchesBrand && (productTier === 'good' || productTier === 'better');
      if (selectedTier === 'best') return matchesBrand; // All tiers available
      
      return matchesBrand;
    });

    setFilteredProducts(tierFiltered);
  };

  const filterColorsByBrandAndProduct = (brandId, product) => {
    if (!brandId) {
      setFilteredColors([]);
      return;
    }

    // Filter colors by brand
    // Some products may support all colors of the brand, others may have specific colors
    const brandColors = allColors.filter(color => color.brandId === brandId);
    
    setFilteredColors(brandColors);
  };

  const handleBrandChange = (brandId) => {
    setEditForm({
      brand: brandId,
      product: null,
      color: null,
      customColor: null,
      sheen: null
    });
    
    filterProductsByBrand(brandId);
    setFilteredColors([]);
  };

  const handleProductChange = (productId) => {
    setEditForm(prev => ({
      ...prev,
      product: productId,
      color: null,
      customColor: null,
      sheen: null
    }));
    
    const product = allProducts.find(p => p.id === productId);
    if (product && editForm.brand) {
      filterColorsByBrandAndProduct(editForm.brand, product);
    }
  };

  const handleSaveSelection = async () => {
    if (!editForm.brand || !editForm.product || (!editForm.color && !editForm.customColor) || !editForm.sheen) {
      message.warning('Please complete all selections');
      return;
    }

    try {
      setSaving(true);
      const response = await magicLinkApiService.post(`/api/customer-portal/proposals/${proposalId}/areas/${editingArea.id}/selections`, {
        brandId: editForm.brand,
        productId: editForm.product,
        colorId: editForm.color,
        customColor: editForm.customColor,
        sheen: editForm.sheen
      });

      if (response.success) {
        message.success('Selection saved successfully');
        setEditModalVisible(false);
        fetchProposal();
      }
    } catch (error) {
      message.error('Failed to save selection: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitAll = () => {
    const incomplete = areas.filter(area => !area.selections || !area.selections.productId);
    
    if (incomplete.length > 0) {
      message.warning(`Please complete selections for ${incomplete.length} remaining area(s)`);
      return;
    }

    setSubmitModalVisible(true);
  };

  const handleConfirmSubmit = async () => {
    try {
      setSaving(true);
      const response = await apiService.post(`/customer/proposals/${proposalId}/submit-selections`);
      
      if (response.success) {
        message.success('Selections submitted successfully');
        setSubmitModalVisible(false);
        navigate('/portal/dashboard');
      }
    } catch (error) {
      message.error('Failed to submit selections: ' + error.message);
    } finally {
      setSaving(false);
    }
  };



  const columns = [
    {
      title: 'Area / Room',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'Brand',
      key: 'brand',
      render: (_, record) => {
        if (!record.selections?.brandId) return <Text type="secondary">Not selected</Text>;
        const brand = brands.find(b => b.id === record.selections.brandId);
        return brand?.name || 'Unknown';
      }
    },
    {
      title: 'Product',
      key: 'product',
      render: (_, record) => {
        if (!record.selections?.productId) return <Text type="secondary">Not selected</Text>;
        const product = allProducts.find(p => p.id === record.selections.productId);
        return product?.name || 'Unknown';
      }
    },
    {
      title: 'Color',
      key: 'color',
      render: (_, record) => {
        if (record.selections?.customColor) {
          return <Text>{record.selections.customColor} (Custom)</Text>;
        }
        if (!record.selections?.colorId) return <Text type="secondary">Not selected</Text>;
        const color = allColors.find(c => c.id === record.selections.colorId);
        return (
          <Space>
            {color && color.hexValue && (
              <div 
                style={{ 
                  width: 20, 
                  height: 20, 
                  backgroundColor: color.hexValue, 
                  border: '1px solid #d9d9d9',
                  borderRadius: 4
                }} 
              />
            )}
            <Text>{color?.name || 'Unknown'}</Text>
          </Space>
        );
      }
    },
    {
      title: 'Sheen',
      key: 'sheen',
      render: (_, record) => record.selections?.sheen || <Text type="secondary">Not selected</Text>
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => {
        if (record.selections?.productId) {
          return <Tag icon={<FiCheckCircle />} color="success">Complete</Tag>;
        }
        return <Tag color="warning">Pending</Tag>;
      }
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button
          type={proposal?.portalOpen ? 'primary' : 'default'}
          icon={proposal?.portalOpen ? <FiEdit /> : <FiLock />}
          onClick={() => handleEditArea(record)}
          disabled={!proposal?.portalOpen}
        >
          {proposal?.portalOpen ? 'Edit' : 'Locked'}
        </Button>
      )
    }
  ];

  if (loading) {
    return (
      <div>
        
        <div className="flex items-center justify-center min-h-screen">
          <Spin size="large" tip="Loading selections..." />
        </div>
      </div>
    );
  }

  return (
   
      <div className="p-6 max-w-7xl mx-auto">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <Title level={2}>Product Selections</Title>
              <Text type="secondary">
                {proposal?.projectName || 'Painting Project'} • Tier: {proposal?.selectedTier?.toUpperCase()}
              </Text>
            </div>
            <Tag color={proposal?.portalOpen ? 'green' : 'default'}>
              {proposal?.portalOpen ? 'Portal Open' : 'Portal Closed'}
            </Tag>
          </div>
        </Card>

        {/* Portal Status Indicator */}
        <PortalStatusIndicator proposal={proposal} />

        {/* Status Alert */}
        {!proposal?.portalOpen && proposal?.selectionsComplete && (
          <Alert
            message="Selections Complete"
            description="Your selections have been submitted and the portal is now closed. You can view your selections and download documents below."
            type="success"
            showIcon
          />
        )}

        {proposal?.portalOpen && (
          <Alert
            message="Portal Open - Make Your Selections"
            description="Select paint products, colors, and sheens for each area. You can edit selections at any time while the portal is open."
            type="info"
            showIcon
          />
        )}

        {/* Selections Table */}
        <Card title="Your Selections">
          {areas.length === 0 ? (
            <Empty description="No areas available for selection" />
          ) : (
            <Table
              dataSource={areas}
              columns={columns}
              rowKey="id"
              pagination={false}
            />
          )}
        </Card>

        {/* Actions */}
        {proposal?.portalOpen && (
          <Card>
            <Space size="middle" className="w-full justify-end">
              <Button size="large" onClick={() => navigate('/portal/dashboard')}>
                Save & Exit
              </Button>
              <Button 
                type="primary" 
                size="large" 
                icon={<FiCheckCircle />}
                onClick={handleSubmitAll}
                disabled={areas.some(area => !area.selections?.productId)}
              >
                Submit All Selections
              </Button>
            </Space>
          </Card>
        )}

        {!proposal?.portalOpen && proposal?.selectionsComplete && (
          <Card>
            <Button 
              type="primary" 
              size="large"
              onClick={() => navigate(`/portal/documents/${proposalId}`)}
            >
              View Documents
            </Button>
          </Card>
        )}
      </Space>

      {/* Edit Selection Modal */}
      <Modal
        title={`Edit Selection: ${editingArea?.name}`}
        open={editModalVisible}
        onOk={handleSaveSelection}
        onCancel={() => setEditModalVisible(false)}
        confirmLoading={saving}
        okText="Save Selection"
        width={700}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Text strong>Paint Brand *</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Select brand first"
              value={editForm.brand}
              onChange={handleBrandChange}
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {brands.map(brand => (
                <Option key={brand.id} value={brand.id}>
                  {brand.name}
                </Option>
              ))}
            </Select>
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              Select a brand to see available products
            </Text>
          </div>

          <div>
            <Text strong>Paint Product *</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder={editForm.brand ? "Select product" : "Select brand first"}
              value={editForm.product}
              onChange={handleProductChange}
              disabled={!editForm.brand}
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {filteredProducts.map(product => (
                <Option key={product.id} value={product.id}>
                  {product.name} {product.tier && `- ${product.tier}`}
                </Option>
              ))}
            </Select>
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              {editForm.brand ? 
                `${filteredProducts.length} products available for selected brand` : 
                'Select a brand first'}
            </Text>
          </div>

          <div>
            <Text strong>Color *</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder={editForm.product ? "Select color" : "Select product first"}
              value={editForm.color}
              onChange={(value) => setEditForm({ ...editForm, color: value, customColor: null })}
              disabled={!editForm.product}
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {filteredColors.map(color => (
                <Option key={color.id} value={color.id}>
                  <Space>
                    {color.hexValue && (
                      <div 
                        style={{ 
                          width: 16, 
                          height: 16, 
                          backgroundColor: color.hexValue, 
                          border: '1px solid #d9d9d9',
                          borderRadius: 2,
                          display: 'inline-block'
                        }} 
                      />
                    )}
                    {color.name} {color.code && `(${color.code})`}
                  </Space>
                </Option>
              ))}
            </Select>
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              {editForm.product ? 
                `${filteredColors.length} colors available for selected brand` : 
                'Select a product first'}
            </Text>
          </div>

          <div>
            <Text strong>Sheen / Finish *</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder={editForm.product ? "Select sheen" : "Select product first"}
              value={editForm.sheen}
              onChange={(value) => setEditForm({ ...editForm, sheen: value })}
              disabled={!editForm.product}
            >
              {sheens.map(sheen => (
                <Option key={sheen.id} value={sheen.name}>
                  {sheen.name}
                </Option>
              ))}
            </Select>
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              Select the finish level for this area
            </Text>
          </div>
        </Space>
      </Modal>

      {/* Submit Confirmation Modal */}
      <Modal
        title="Submit All Selections"
        open={submitModalVisible}
        onOk={handleConfirmSubmit}
        onCancel={() => setSubmitModalVisible(false)}
        confirmLoading={saving}
        okText="Confirm Submission"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Paragraph>
            Are you sure you want to submit all your selections? Once submitted, the portal will be locked and you will not be able to make changes without contractor approval.
          </Paragraph>
          <Alert
            message="Important"
            description="After submission, your contractor will generate the final material list and work order based on your selections."
            type="info"
            showIcon
          />
        </Space>
      </Modal>
    </div>
  );
}

export default ProductSelections;
