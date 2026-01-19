import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, Button, Input, Select, Typography, Space, message, Spin, Alert, 
  Tag, Modal, Row, Col, Empty, Divider 
} from 'antd';
import { 
  FiCheckCircle, FiSearch, FiPlus, FiLock, FiInfo 
} from 'react-icons/fi';
import { magicLinkApiService } from '../../services/magicLinkApiService';
import BrandedPortalHeader from '../../components/CustomerPortal/BrandedPortalHeader';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

function ColorSelections() {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Data states
  const [proposal, setProposal] = useState(null);
  const [areas, setAreas] = useState([]);
  const [brands, setBrands] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [allColors, setAllColors] = useState([]);
  const [sheens, setSheens] = useState([]);
  
  // UI states
  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredColors, setFilteredColors] = useState([]);
  
  // Modal states
  const [customColorModal, setCustomColorModal] = useState(false);
  const [otherBrandModal, setOtherBrandModal] = useState(false);
  const [submitModal, setSubmitModal] = useState(false);
  
  // Form states
  const [selections, setSelections] = useState({});
  const [customColorData, setCustomColorData] = useState({
    type: '',
    notes: ''
  });
  const [otherBrandData, setOtherBrandData] = useState({
    brandName: '',
    colorName: '',
    colorCode: ''
  });

  useEffect(() => {
    fetchProposalData();
  }, [proposalId]);

  useEffect(() => {
    if (selectedBrand && allColors.length > 0) {
      filterColors();
    }
  }, [selectedBrand, searchQuery, allColors]);

  const fetchProposalData = async () => {
    try {
      setLoading(true);
      
      // Fetch proposal
      const proposalResponse = await magicLinkApiService.get(`/api/customer-portal/proposals/${proposalId}`);
      if (proposalResponse.success) {
        setProposal(proposalResponse.data);
        
        // Extract areas from proposal
        const proposalAreas = proposalResponse.data.areas || [];
        const areasWithSelections = proposalAreas.map(area => ({
          id: area.id,
          name: area.name,
          jobType: area.jobType,
          surfaces: area.laborItems?.filter(item => item.selected).map(item => ({
            type: item.categoryName,
            quantity: item.quantity,
            unit: item.measurementUnit
          })) || []
        }));
        
        setAreas(areasWithSelections);
        if (areasWithSelections.length > 0) {
          setSelectedArea(areasWithSelections[0].id);
        }

        // Load existing selections
        if (proposalResponse.data.productSelections) {
          setSelections(proposalResponse.data.productSelections);
        }
      }

      // Fetch brands, products, colors, sheens in parallel
      const selectedTier = proposalResponse.data.selectedTier;
      const tierParam = selectedTier 
        ? `&tier=${selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)}`
        : '';
      
      const [brandsRes, productsRes, colorsRes, sheensRes] = await Promise.all([
        magicLinkApiService.get('/api/customer-portal/brands'),
        // Filter products by selected tier (capitalize for enum match)
        magicLinkApiService.get(`/api/customer-portal/products?limit=1000${tierParam}`),
        magicLinkApiService.get('/api/customer-portal/colors?limit=1000'),
        magicLinkApiService.get('/api/customer-portal/sheens')
      ]);

      if (brandsRes.success) setBrands(brandsRes.data || []);
      if (productsRes.success) setAllProducts(productsRes.data || []);
      if (colorsRes.success) setAllColors(colorsRes.data || []);
      if (sheensRes.success) setSheens(sheensRes.data || []);

    } catch (error) {
      console.error('Failed to load data:', error);
      message.error('Failed to load data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filterColors = () => {
    if (!selectedBrand) {
      setFilteredColors([]);
      return;
    }

    let filtered = allColors.filter(color => color.brandId === selectedBrand);

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(color =>
        color.name?.toLowerCase().includes(query) ||
        color.code?.toLowerCase().includes(query)
      );
    }

    setFilteredColors(filtered);
  };

  const handleBrandChange = (brandId) => {
    setSelectedBrand(brandId);
    setSearchQuery('');
  };

  const handleColorSelect = (color) => {
    if (!selectedArea) {
      message.warning('Please select an area first');
      return;
    }

    // Get the selected product for tier
    const selectedProduct = allProducts.find(p => 
      p.brandId === selectedBrand && 
      p.tier?.toLowerCase() === proposal.selectedTier?.toLowerCase()
    );

    setSelections(prev => ({
      ...prev,
      [selectedArea]: {
        ...prev[selectedArea],
        brandId: selectedBrand,
        productId: selectedProduct?.id,
        colorId: color.id,
        colorName: color.name,
        colorCode: color.code,
        hexValue: color.hexValue,
        isCustom: false
      }
    }));

    message.success(`Color "${color.name}" selected for ${getCurrentAreaName()}`);
  };

  const handleCustomColor = () => {
    if (!customColorData.type) {
      message.warning('Please select a custom option');
      return;
    }

    setSelections(prev => ({
      ...prev,
      [selectedArea]: {
        ...prev[selectedArea],
        isCustom: true,
        customType: customColorData.type,
        customNotes: customColorData.notes,
        colorName: customColorData.type,
        colorCode: null,
        hexValue: null
      }
    }));

    message.success('Custom color request added');
    setCustomColorModal(false);
    setCustomColorData({ type: '', notes: '' });
  };

  const handleOtherBrand = () => {
    if (!otherBrandData.brandName || !otherBrandData.colorName) {
      message.warning('Please provide both brand name and color name');
      return;
    }

    setSelections(prev => ({
      ...prev,
      [selectedArea]: {
        ...prev[selectedArea],
        isOtherBrand: true,
        otherBrandName: otherBrandData.brandName,
        colorName: otherBrandData.colorName,
        colorCode: otherBrandData.colorCode,
        hexValue: null
      }
    }));

    message.success('Other brand color added');
    setOtherBrandModal(false);
    setOtherBrandData({ brandName: '', colorName: '', colorCode: '' });
  };

  const handleSheenChange = (areaId, sheen) => {
    setSelections(prev => ({
      ...prev,
      [areaId]: {
        ...prev[areaId],
        sheen
      }
    }));
  };

  const handleSubmitSelections = async () => {
    try {
      setSaving(true);

      // Validate all areas have selections
      const missingAreas = areas.filter(area => !selections[area.id] || !selections[area.id].sheen);
      
      if (missingAreas.length > 0) {
        message.warning(`Please complete selections for: ${missingAreas.map(a => a.name).join(', ')}`);
        return;
      }

      const response = await magicLinkApiService.post(
        `/api/customer-portal/proposals/${proposalId}/submit-selections`,
        { selections }
      );

      if (response.success) {
        message.success('Selections submitted successfully!');
        setSubmitModal(false);
        navigate(`/portal/dashboard/${proposalId}`);
      }
    } catch (error) {
      message.error('Failed to submit selections: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getCurrentAreaName = () => {
    return areas.find(a => a.id === selectedArea)?.name || '';
  };

  const getAreaSelection = (areaId) => {
    return selections[areaId];
  };

  const getCompletionStatus = () => {
    const completed = areas.filter(area => 
      selections[area.id] && 
      (selections[area.id].colorId || selections[area.id].isCustom || selections[area.id].isOtherBrand) &&
      selections[area.id].sheen
    ).length;
    return { completed, total: areas.length };
  };

  if (loading) {
    return (
      <div>
        
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <Spin size="large" tip="Loading color selection..." />
        </div>
      </div>
    );
  }

  if (!proposal || !proposal.portalOpen) {
    return (
      <div>
        
        <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
          <Alert
            message="Portal Closed"
            description="The customer portal is currently closed. Please contact your contractor."
            type="warning"
            showIcon
          />
        </div>
      </div>
    );
  }

  const status = getCompletionStatus();

  return (
   
      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Card>
          <Title level={2}>Select Your Colors</Title>
          <Paragraph type="secondary">
            Choose colors for each area of your project. All colors will be reviewed by your contractor.
          </Paragraph>
          <Space>
            <Tag color={status.completed === status.total ? 'success' : 'processing'}>
              {status.completed} of {status.total} areas completed
            </Tag>
            <Tag color="blue">Tier: {proposal.selectedTier?.toUpperCase()}</Tag>
            {proposal.depositVerified && (
              <Tag color="green" icon={<FiCheckCircle />}>Deposit Verified - Tier Locked</Tag>
            )}
          </Space>
          
          {proposal.selectedTier && (
            <Alert
              message="Product Tier Selection"
              description={`You have selected the ${proposal.selectedTier.toUpperCase()} tier. Only products from this tier will be available for selection. ${proposal.depositVerified ? 'Your tier is now locked after deposit payment. Contact your contractor to change tiers.' : 'You can change your tier selection before making a deposit payment.'}`}
              type="info"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </Card>

        {/* Step 1: Area Overview */}
        <Card>
          <Title level={4}>Step 1: Your Project Areas</Title>
          <Paragraph type="secondary">
            View your color selections for each area. Click an area to modify its color.
          </Paragraph>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            {areas.map(area => {
              const selection = getAreaSelection(area.id);
              const isComplete = selection && (selection.colorId || selection.isCustom || selection.isOtherBrand) && selection.sheen;
              const isSelected = selectedArea === area.id;

              return (
                <Col xs={24} sm={12} md={8} lg={6} key={area.id}>
                  <Card
                    hoverable
                    onClick={() => setSelectedArea(area.id)}
                    style={{
                      border: isSelected ? '2px solid #1890ff' : '1px solid #d9d9d9',
                      backgroundColor: isSelected ? '#e6f7ff' : '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {/* Color Swatch */}
                      <div
                        style={{
                          width: '100%',
                          height: 80,
                          borderRadius: 8,
                          border: '1px solid #d9d9d9',
                          backgroundColor: selection?.hexValue || '#f0f0f0',
                          backgroundImage: !selection?.hexValue ? 
                            'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)' : 
                            undefined,
                          backgroundSize: !selection?.hexValue ? '20px 20px' : undefined,
                          backgroundPosition: !selection?.hexValue ? '0 0, 0 10px, 10px -10px, -10px 0px' : undefined
                        }}
                      />

                      {/* Area Info */}
                      <div>
                        <Text strong style={{ fontSize: 14 }}>{area.name}</Text>
                        {selection && (
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                              {selection.isCustom ? 'Custom: ' + selection.customType : 
                               selection.isOtherBrand ? selection.otherBrandName : 
                               brands.find(b => b.id === selection.brandId)?.name || 'Brand'}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                              {selection.colorName || 'No color selected'}
                            </Text>
                            {selection.colorCode && (
                              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                                {selection.colorCode}
                              </Text>
                            )}
                            {selection.sheen && (
                              <Tag size="small" style={{ marginTop: 4 }}>{selection.sheen}</Tag>
                            )}
                          </div>
                        )}
                        {!selection && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            No selection yet
                          </Text>
                        )}
                      </div>

                      {/* Status */}
                      <div>
                        {isComplete ? (
                          <Tag color="success" icon={<FiCheckCircle />}>Complete</Tag>
                        ) : (
                          <Tag color="warning">Incomplete</Tag>
                        )}
                      </div>

                      {isSelected && (
                        <Text style={{ fontSize: 12, color: '#1890ff' }}>
                          ← Currently editing
                        </Text>
                      )}
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Card>

        {/* Step 2: Brand Selection */}
        {selectedArea && (
          <Card>
            <Title level={4}>Step 2: Choose Colors for {getCurrentAreaName()}</Title>
            <Paragraph type="secondary">
              Select from paint brands, add other brands, or specify custom colors.
            </Paragraph>

            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={12}>
                <Text strong>Paint Brand</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  placeholder="Select paint brand"
                  value={selectedBrand}
                  onChange={handleBrandChange}
                  showSearch
                  filterOption={(input, option) =>
                    option.children.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {brands.map(brand => (
                    <Option key={brand.id} value={brand.id}>{brand.name}</Option>
                  ))}
                </Select>
              </Col>

              <Col span={12}>
                <Text strong>Search Colors</Text>
                <Input
                  style={{ marginTop: 8 }}
                  placeholder="Search by name or code (e.g., 'Alabaster' or 'SW 7008')"
                  prefix={<FiSearch />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={!selectedBrand}
                />
              </Col>
            </Row>

            <Divider />

            {/* Quick Actions */}
            <Space style={{ marginBottom: 16 }}>
              <Button 
                icon={<FiPlus />}
                onClick={() => setOtherBrandModal(true)}
              >
                Add Other Brand
              </Button>
              <Button 
                icon={<FiPlus />}
                onClick={() => setCustomColorModal(true)}
              >
                Custom Color Match
              </Button>
            </Space>

            {/* Color Disclaimer */}
            {selectedBrand && (
              <Alert
                message="Color Accuracy Notice"
                description="Color swatches are for selection purposes only and are not true representations of actual paint colors. Colors may appear different in your home due to lighting conditions, surrounding colors, and screen display variations. We recommend getting physical paint samples for final color confirmation."
                type="info"
                showIcon
                icon={<FiInfo />}
                style={{ marginBottom: 16 }}
              />
            )}

            {/* Color Grid */}
            {selectedBrand ? (
              <div>
                {searchQuery && (
                  <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                    Showing {filteredColors.length} colors matching "{searchQuery}"
                  </Text>
                )}

                {filteredColors.length > 0 ? (
                  <Row gutter={[12, 12]}>
                    {filteredColors.map(color => {
                      const isSelected = selections[selectedArea]?.colorId === color.id;
                      
                      return (
                        <Col xs={12} sm={8} md={6} lg={4} key={color.id}>
                          <Card
                            hoverable
                            onClick={() => handleColorSelect(color)}
                            style={{
                              border: isSelected ? '2px solid #52c41a' : '1px solid #d9d9d9',
                              cursor: 'pointer'
                            }}
                          >
                            <Space direction="vertical" style={{ width: '100%' }} size="small">
                              {/* Color Swatch */}
                              <div
                                style={{
                                  width: '100%',
                                  height: 60,
                                  borderRadius: 4,
                                  border: '1px solid #d9d9d9',
                                  backgroundColor: color.hexValue || '#f0f0f0'
                                }}
                              />
                              
                              {/* Color Name */}
                              <div>
                                <Text strong style={{ fontSize: 13, display: 'block' }}>
                                  {color.name}
                                </Text>
                                {color.code && (
                                  <Text type="secondary" style={{ fontSize: 11 }}>
                                    {color.code}
                                  </Text>
                                )}
                              </div>

                              {isSelected && (
                                <Tag color="success" size="small" icon={<FiCheckCircle />}>
                                  Selected
                                </Tag>
                              )}
                            </Space>
                          </Card>
                        </Col>
                      );
                    })}
                  </Row>
                ) : (
                  <Empty 
                    description={
                      searchQuery ? 
                      `No colors found matching "${searchQuery}"` : 
                      'No colors available for this brand'
                    }
                  />
                )}
              </div>
            ) : (
              <Empty description="Please select a brand to view colors" />
            )}

            {/* Sheen Selection */}
            {selections[selectedArea]?.colorId && (
              <div style={{ marginTop: 24 }}>
                <Divider />
                <Title level={5}>Select Sheen / Finish</Title>
                <Select
                  style={{ width: '100%', maxWidth: 400 }}
                  placeholder="Select sheen"
                  value={selections[selectedArea]?.sheen}
                  onChange={(value) => handleSheenChange(selectedArea, value)}
                >
                  {sheens.map(sheen => (
                    <Option key={sheen.id} value={sheen.name}>
                      {sheen.name}
                      {sheen.description && (
                        <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                          - {sheen.description}
                        </Text>
                      )}
                    </Option>
                  ))}
                </Select>
              </div>
            )}
          </Card>
        )}

        {/* Submit Button */}
        <Card>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Title level={4}>Ready to Submit?</Title>
              <Paragraph>
                Review all your selections above. Once submitted, the portal will be locked.
              </Paragraph>
              <Alert
                message="Progress Status"
                description={`You have completed ${status.completed} out of ${status.total} areas. ${status.total - status.completed > 0 ? 'Please complete all areas before submitting.' : 'All areas are complete!'}`}
                type={status.completed === status.total ? 'success' : 'warning'}
                showIcon
                style={{ marginBottom: 16 }}
              />
            </div>

            <Button
              type="primary"
              size="large"
              icon={status.completed === status.total ? <FiCheckCircle /> : <FiLock />}
              onClick={() => setSubmitModal(true)}
              disabled={status.completed !== status.total || proposal.selectionsComplete}
              block
            >
              {proposal.selectionsComplete ? 
                'Selections Already Submitted' : 
                `Submit All Selections (${status.completed}/${status.total} complete)`
              }
            </Button>
          </Space>
        </Card>
      </Space>

      {/* Custom Color Modal */}
      <Modal
        title="Custom Color Match Request"
        open={customColorModal}
        onCancel={() => setCustomColorModal(false)}
        onOk={handleCustomColor}
        okText="Add Custom Color"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>Custom Option *</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Select custom option"
              value={customColorData.type}
              onChange={(value) => setCustomColorData({ ...customColorData, type: value })}
            >
              <Option value="Match Current Wall">Match Current Wall</Option>
              <Option value="Match Existing Trim">Match Existing Trim</Option>
              <Option value="Match Furniture">Match Furniture</Option>
              <Option value="Custom Sample">Custom Sample</Option>
            </Select>
          </div>

          <div>
            <Text strong>Notes for Contractor</Text>
            <TextArea
              style={{ marginTop: 8 }}
              rows={4}
              placeholder="Provide additional details about the color match request..."
              value={customColorData.notes}
              onChange={(e) => setCustomColorData({ ...customColorData, notes: e.target.value })}
            />
          </div>
        </Space>
      </Modal>

      {/* Other Brand Modal */}
      <Modal
        title="Add Other Brand Color"
        open={otherBrandModal}
        onCancel={() => setOtherBrandModal(false)}
        onOk={handleOtherBrand}
        okText="Add Color"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Paragraph type="secondary">
            Add a color from a brand not listed in our database for {getCurrentAreaName()}.
          </Paragraph>

          <div>
            <Text strong>Brand Name *</Text>
            <Input
              style={{ marginTop: 8 }}
              placeholder="e.g., Dutch Boy, Glidden"
              value={otherBrandData.brandName}
              onChange={(e) => setOtherBrandData({ ...otherBrandData, brandName: e.target.value })}
            />
          </div>

          <div>
            <Text strong>Color Name *</Text>
            <Input
              style={{ marginTop: 8 }}
              placeholder="e.g., Ocean Breeze"
              value={otherBrandData.colorName}
              onChange={(e) => setOtherBrandData({ ...otherBrandData, colorName: e.target.value })}
            />
          </div>

          <div>
            <Text strong>Color Code (Optional)</Text>
            <Input
              style={{ marginTop: 8 }}
              placeholder="e.g., DB-123"
              value={otherBrandData.colorCode}
              onChange={(e) => setOtherBrandData({ ...otherBrandData, colorCode: e.target.value })}
            />
          </div>
        </Space>
      </Modal>

      {/* Submit Confirmation Modal */}
      <Modal
        title="Submit All Selections"
        open={submitModal}
        onCancel={() => setSubmitModal(false)}
        onOk={handleSubmitSelections}
        confirmLoading={saving}
        okText="Confirm Submission"
        okButtonProps={{ danger: false, type: 'primary' }}
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

          <div style={{ marginTop: 16 }}>
            <Text strong>Summary:</Text>
            <ul style={{ marginTop: 8 }}>
              {areas.map(area => {
                const sel = selections[area.id];
                return (
                  <li key={area.id}>
                    <Text>{area.name}: </Text>
                    <Text type="secondary">
                      {sel?.colorName || 'Not selected'} - {sel?.sheen || 'No sheen'}
                    </Text>
                  </li>
                );
              })}
            </ul>
          </div>
        </Space>
      </Modal>
    </div>
  );
}

export default ColorSelections;
