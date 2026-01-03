import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Select,
  Button,
  message,
  Space,
  Input,
  Modal,
  Tabs,
  Typography,
  Alert,
  Spin
} from 'antd';
import { SaveOutlined, ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';

const { Search } = Input;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

const ProductTierManager = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [changedProducts, setChangedProducts] = useState(new Set());

  useEffect(() => {
    fetchProducts();
    fetchBrands();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchText, categoryFilter, tierFilter, brandFilter]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await apiService.get('/admin/products?limit=1000');
      if (response.success) {
        setProducts(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      message.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await apiService.get('/admin/brands');
      if (response.success) {
        setBrands(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
      message.error('Failed to load brands');
    }
  };

  const filterProducts = () => {
    let filtered = [...products];

    // Search filter
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name?.toLowerCase().includes(searchLower) ||
          p.brand?.name?.toLowerCase().includes(searchLower) ||
          p.customBrand?.toLowerCase().includes(searchLower)
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((p) => p.category === categoryFilter);
    }

    // Brand filter
    if (brandFilter !== 'all') {
      if (brandFilter === 'custom') {
        filtered = filtered.filter((p) => !p.brandId && p.customBrand);
      } else {
        filtered = filtered.filter((p) => p.brandId === parseInt(brandFilter));
      }
    }

    // Tier filter
    if (tierFilter !== 'all') {
      if (tierFilter === 'unassigned') {
        filtered = filtered.filter((p) => !p.tier);
      } else {
        filtered = filtered.filter((p) => p.tier === tierFilter);
      }
    }

    setFilteredProducts(filtered);
  };

  const handleTierChange = (productId, newTier) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          setChangedProducts((changed) => new Set(changed).add(productId));
          return { ...p, tier: newTier === 'none' ? null : newTier };
        }
        return p;
      })
    );
  };

  const handleSaveAll = async () => {
    if (changedProducts.size === 0) {
      message.info('No changes to save');
      return;
    }

    Modal.confirm({
      title: 'Save Tier Assignments',
      content: `Save tier assignments for ${changedProducts.size} product(s)?`,
      okText: 'Save',
      cancelText: 'Cancel',
      onOk: async () => {
        setSaving(true);
        try {
          const updates = products
            .filter((p) => changedProducts.has(p.id))
            .map((p) => ({
              id: p.id,
              tier: p.tier
            }));

          const response = await apiService.put('/admin/products/bulk-update-tiers', {
            updates
          });

          if (response.success) {
            message.success('Tier assignments saved successfully');
            setChangedProducts(new Set());
            fetchProducts();
          }
        } catch (error) {
          console.error('Error saving tier assignments:', error);
          message.error('Failed to save tier assignments');
        } finally {
          setSaving(false);
        }
      }
    });
  };

  const handleResetChanges = () => {
    if (changedProducts.size === 0) {
      message.info('No changes to reset');
      return;
    }

    Modal.confirm({
      title: 'Reset Changes',
      content: 'Discard all unsaved tier assignments?',
      okText: 'Reset',
      cancelText: 'Cancel',
      okButtonProps: { danger: true },
      onOk: () => {
        setChangedProducts(new Set());
        fetchProducts();
        message.info('Changes reset');
      }
    });
  };

  const getTierColor = (tier) => {
    const colors = {
      Good: 'green',
      Better: 'blue',
      Best: 'purple'
    };
    return colors[tier] || 'default';
  };

  const getTierStats = () => {
    const interiorProducts = products.filter((p) => p.category === 'Interior');
    const exteriorProducts = products.filter((p) => p.category === 'Exterior');

    const getStats = (productList) => ({
      good: productList.filter((p) => p.tier === 'Good').length,
      better: productList.filter((p) => p.tier === 'Better').length,
      best: productList.filter((p) => p.tier === 'Best').length,
      unassigned: productList.filter((p) => !p.tier).length,
      total: productList.length
    });

    return {
      interior: getStats(interiorProducts),
      exterior: getStats(exteriorProducts)
    };
  };

  const columns = [
    {
      title: 'Product Name',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      fixed: 'left',
      render: (text, record) => (
        <div>
          <div>
            <strong>{text}</strong>
            {changedProducts.has(record.id) && (
              <Tag color="orange" style={{ marginLeft: 8 }}>
                Modified
              </Tag>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#888' }}>
            {record.brand?.name || record.customBrand || 'No Brand'}
          </div>
        </div>
      )
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category) => (
        <Tag color={category === 'Interior' ? 'blue' : 'green'}>{category}</Tag>
      )
    },
    {
      title: 'Current Tier',
      dataIndex: 'tier',
      key: 'currentTier',
      width: 130,
      render: (tier) =>
        tier ? (
          <Tag color={getTierColor(tier)}>{tier}</Tag>
        ) : (
          <Tag color="default">Unassigned</Tag>
        )
    },
    {
      title: 'Assign Tier',
      key: 'assignTier',
      width: 180,
      render: (_, record) => (
        <Select
          style={{ width: '100%' }}
          value={record.tier || 'none'}
          onChange={(value) => handleTierChange(record.id, value)}
        >
          <Select.Option value="none">
            <Text type="secondary">No Tier</Text>
          </Select.Option>
          <Select.Option value="Good">
            <Tag color="green">Good</Tag>
          </Select.Option>
          <Select.Option value="Better">
            <Tag color="blue">Better</Tag>
          </Select.Option>
          <Select.Option value="Best">
            <Tag color="purple">Best</Tag>
          </Select.Option>
        </Select>
      )
    },
    {
      title: 'Sheen Options',
      dataIndex: 'sheenOptions',
      key: 'sheenOptions',
      width: 200,
      render: (sheens) => (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {sheens || 'Not specified'}
        </Text>
      )
    }
  ];

  const stats = getTierStats();

  return (
    <div style={{ padding: '4px' }}>
      <Card style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <Title level={3}>
            Good / Better / Best Product Tier Management
          </Title>
          <Text type="secondary">
            Assign tiers to products for customer portal tier selection. Products will be filtered
            based on the customer's selected tier.
          </Text>
        </div>

       

        {/* Stats Cards */}
        <Tabs defaultActiveKey="interior" style={{ marginBottom: 24 }}>
          <TabPane tab="Interior Stats" key="interior">
            <Space size="large">
              <Card size="small">
                <div>
                  <Text strong style={{ color: '#52c41a' }}>
                    Good:
                  </Text>{' '}
                  {stats.interior.good}
                </div>
              </Card>
              <Card size="small">
                <div>
                  <Text strong style={{ color: '#1890ff' }}>
                    Better:
                  </Text>{' '}
                  {stats.interior.better}
                </div>
              </Card>
              <Card size="small">
                <div>
                  <Text strong style={{ color: '#722ed1' }}>
                    Best:
                  </Text>{' '}
                  {stats.interior.best}
                </div>
              </Card>
              <Card size="small">
                <div>
                  <Text strong style={{ color: '#8c8c8c' }}>
                    Unassigned:
                  </Text>{' '}
                  {stats.interior.unassigned}
                </div>
              </Card>
              <Card size="small">
                <div>
                  <Text strong>Total:</Text> {stats.interior.total}
                </div>
              </Card>
            </Space>
          </TabPane>
          <TabPane tab="Exterior Stats" key="exterior">
            <Space size="large">
              <Card size="small">
                <div>
                  <Text strong style={{ color: '#52c41a' }}>
                    Good:
                  </Text>{' '}
                  {stats.exterior.good}
                </div>
              </Card>
              <Card size="small">
                <div>
                  <Text strong style={{ color: '#1890ff' }}>
                    Better:
                  </Text>{' '}
                  {stats.exterior.better}
                </div>
              </Card>
              <Card size="small">
                <div>
                  <Text strong style={{ color: '#722ed1' }}>
                    Best:
                  </Text>{' '}
                  {stats.exterior.best}
                </div>
              </Card>
              <Card size="small">
                <div>
                  <Text strong style={{ color: '#8c8c8c' }}>
                    Unassigned:
                  </Text>{' '}
                  {stats.exterior.unassigned}
                </div>
              </Card>
              <Card size="small">
                <div>
                  <Text strong>Total:</Text> {stats.exterior.total}
                </div>
              </Card>
            </Space>
          </TabPane>
        </Tabs>

        {/* Filters and Actions */}
        <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }} size="middle">
          <Space wrap>
            <Search
              placeholder="Search by product name or brand..."
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
            />
            <Select
              style={{ width: 150 }}
              placeholder="Category"
              value={categoryFilter}
              onChange={setCategoryFilter}
            >
              <Select.Option value="all">All Categories</Select.Option>
              <Select.Option value="Interior">Interior</Select.Option>
              <Select.Option value="Exterior">Exterior</Select.Option>
            </Select>
            <Select
              style={{ width: 200 }}
              placeholder="Brand"
              value={brandFilter}
              onChange={setBrandFilter}
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              <Select.Option value="all">All Brands</Select.Option>
              {brands.map((brand) => (
                <Select.Option key={brand.id} value={brand.id.toString()}>
                  {brand.name}
                </Select.Option>
              ))}
              <Select.Option value="custom">Custom Brands</Select.Option>
            </Select>
            <Select
              style={{ width: 150 }}
              placeholder="Tier"
              value={tierFilter}
              onChange={setTierFilter}
            >
              <Select.Option value="all">All Tiers</Select.Option>
              <Select.Option value="Good">Good</Select.Option>
              <Select.Option value="Better">Better</Select.Option>
              <Select.Option value="Best">Best</Select.Option>
              <Select.Option value="unassigned">Unassigned</Select.Option>
            </Select>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveAll}
              loading={saving}
              disabled={changedProducts.size === 0}
            >
              Save Changes {changedProducts.size > 0 && `(${changedProducts.size})`}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleResetChanges}
              disabled={changedProducts.size === 0}
            >
              Reset
            </Button>
          </Space>
        </Space>

        {/* Products Table */}
        <Table
          columns={columns}
          dataSource={filteredProducts}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} products`
          }}
        />
      </Card>
    </div>
  );
};

export default ProductTierManager;
