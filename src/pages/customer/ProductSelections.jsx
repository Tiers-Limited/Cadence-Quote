import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Select, Typography, Space, message, Spin, Alert, Tag, Modal, Table, Empty } from 'antd';
import { FiCheckCircle, FiEdit, FiLock } from 'react-icons/fi';
import { apiService } from '../../services/apiService';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

function ProductSelections() {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [proposal, setProposal] = useState(null);
  const [areas, setAreas] = useState([]);
  const [products, setProducts] = useState([]);
  const [colors, setColors] = useState([]);
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
    fetchProducts();
    fetchColors();
    fetchSheens();
  }, [proposalId]);

  const fetchProposal = async () => {
    try {
      setLoading(true);
      const response = await apiService.get(`/customer/proposals/${proposalId}`);
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

  const fetchProducts = async () => {
    try {
      const response = await apiService.get('/global-products?limit=1000');
      if (response.success) {
        setProducts(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const fetchColors = async () => {
    try {
      const response = await apiService.get('/global-colors?limit=1000');
      if (response.success) {
        setColors(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load colors:', error);
    }
  };

  const fetchSheens = async () => {
    // Typically sheens are: Flat, Eggshell, Satin, Semi-Gloss, Gloss
    setSheens([
      { id: 1, name: 'Flat' },
      { id: 2, name: 'Eggshell' },
      { id: 3, name: 'Satin' },
      { id: 4, name: 'Semi-Gloss' },
      { id: 5, name: 'Gloss' }
    ]);
  };

  const handleEditArea = (area) => {
    if (!proposal.portalOpen) {
      message.warning('Portal is closed. Contact contractor to reopen.');
      return;
    }

    setEditingArea(area);
    setEditForm({
      brand: area.selections?.brand || null,
      product: area.selections?.productId || null,
      color: area.selections?.colorId || null,
      customColor: area.selections?.customColor || null,
      sheen: area.selections?.sheen || null
    });
    setEditModalVisible(true);
  };

  const handleSaveSelection = async () => {
    if (!editForm.brand || !editForm.product || (!editForm.color && !editForm.customColor) || !editForm.sheen) {
      message.warning('Please complete all selections');
      return;
    }

    try {
      setSaving(true);
      const response = await apiService.post(`/customer/proposals/${proposalId}/areas/${editingArea.id}/selections`, {
        brand: editForm.brand,
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

  const getAvailableProducts = () => {
    if (!proposal?.selectedTier) return products;
    
    // Filter products by tier
    return products.filter(product => {
      const tier = product.tier?.toLowerCase();
      if (proposal.selectedTier === 'good') return tier === 'good';
      if (proposal.selectedTier === 'better') return tier === 'good' || tier === 'better';
      return proposal.selectedTier === 'best';
    });
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
      render: (_, record) => record.selections?.brand || <Text type="secondary">Not selected</Text>
    },
    {
      title: 'Product',
      key: 'product',
      render: (_, record) => {
        if (!record.selections?.productId) return <Text type="secondary">Not selected</Text>;
        const product = products.find(p => p.id === record.selections.productId);
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
        const color = colors.find(c => c.id === record.selections.colorId);
        return (
          <Space>
            {color && (
              <div 
                style={{ 
                  width: 20, 
                  height: 20, 
                  backgroundColor: color.hexCode, 
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
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" tip="Loading selections..." />
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
            <Text strong>Paint Brand</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Select brand"
              value={editForm.brand}
              onChange={(value) => setEditForm({ ...editForm, brand: value })}
              showSearch
            >
              <Option value="Sherwin Williams">Sherwin Williams</Option>
              <Option value="Benjamin Moore">Benjamin Moore</Option>
              <Option value="Behr">Behr</Option>
              <Option value="PPG">PPG</Option>
            </Select>
          </div>

          <div>
            <Text strong>Paint Product</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Select product"
              value={editForm.product}
              onChange={(value) => setEditForm({ ...editForm, product: value })}
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {getAvailableProducts().map(product => (
                <Option key={product.id} value={product.id}>
                  {product.name} - {product.tier}
                </Option>
              ))}
            </Select>
          </div>

          <div>
            <Text strong>Color</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Select color or enter custom"
              value={editForm.color}
              onChange={(value) => setEditForm({ ...editForm, color: value, customColor: null })}
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {colors.map(color => (
                <Option key={color.id} value={color.id}>
                  {color.name} ({color.colorCode})
                </Option>
              ))}
            </Select>
          </div>

          <div>
            <Text strong>Sheen</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Select sheen"
              value={editForm.sheen}
              onChange={(value) => setEditForm({ ...editForm, sheen: value })}
            >
              {sheens.map(sheen => (
                <Option key={sheen.id} value={sheen.name}>
                  {sheen.name}
                </Option>
              ))}
            </Select>
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
