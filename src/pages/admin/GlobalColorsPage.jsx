import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Tag, Popconfirm, Upload } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, LinkOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';

const { Option } = Select;

const GlobalColorsPage = () => {
  const [colors, setColors] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [mappingModalVisible, setMappingModalVisible] = useState(false);
  const [bulkUploadModalVisible, setBulkUploadModalVisible] = useState(false);
  const [editingColor, setEditingColor] = useState(null);
  const [selectedColorForMapping, setSelectedColorForMapping] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState(null);
  const [form] = Form.useForm();
  const [mappingForm] = Form.useForm();

  useEffect(() => {
    fetchBrands();
    fetchColors();
  }, []);

  const fetchBrands = async () => {
    try {
      const response = await apiService.getAdminBrands();
      setBrands(response.data || []);
    } catch (error) {
      console.error('Error fetching brands:', error);
      message.error('Failed to fetch brands');
    }
  };

  const fetchColors = async (search = '') => {
    try {
      setLoading(true);
      const params = search ? { search } : {};
      const response = await apiService.getGlobalColors(params);
      setColors(response.data || []);
    } catch (error) {
      console.error('Error fetching colors:', error);
      message.error('Failed to fetch colors');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value) => {
    setSearchText(value);
    fetchColors(value);
  };

  const showModal = (color = null) => {
    setEditingColor(color);
    if (color) {
      form.setFieldsValue({
        brandId: color.brandId,
        name: color.name,
        code: color.code,
        hexValue: color.hexValue || '#FFFFFF',
        red: color.red,
        green: color.green,
        blue: color.blue,
        sampleImage: color.sampleImage || '',
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ hexValue: '#FFFFFF' });
    }
    setModalVisible(true);
  };

  const showMappingModal = (color) => {
    setSelectedColorForMapping(color);
    mappingForm.resetFields();
    setMappingModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      const data = {
        brandId: values.brandId,
        name: values.name,
        code: values.code,
        hexValue: values.hexValue,
        red: values.red || null,
        green: values.green || null,
        blue: values.blue || null,
        sampleImage: values.sampleImage || null,
      };

      if (editingColor) {
        await apiService.updateGlobalColor(editingColor.id, data);
        message.success('Color updated successfully');
      } else {
        await apiService.createGlobalColor(data);
        message.success('Color created successfully');
      }

      setModalVisible(false);
      form.resetFields();
      fetchColors(searchText);
    } catch (error) {
      console.error('Error saving color:', error);
      message.error(error.message || 'Failed to save color');
    }
  };

  const handleAddMapping = async (values) => {
    try {
      await apiService.addCrossBrandMapping(selectedColorForMapping.id, {
        mappedColorId: values.mappedColorId,
        notes: values.notes || '',
      });
      message.success('Cross-brand mapping added successfully');
      setMappingModalVisible(false);
      mappingForm.resetFields();
      fetchColors(searchText);
    } catch (error) {
      console.error('Error adding mapping:', error);
      message.error('Failed to add mapping');
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiService.deleteGlobalColor(id);
      message.success('Color deleted successfully');
      fetchColors(searchText);
    } catch (error) {
      console.error('Error deleting color:', error);
      message.error('Failed to delete color');
    }
  };

  // Bulk upload handlers
  const showBulkUploadModal = () => {
    if (!brands || brands.length === 0) {
      message.error('Please add brands first before uploading colors');
      return;
    }

    if (!selectedBrandFilter) {
      message.warning('Please select a brand filter before uploading colors');
      return;
    }

    setBulkUploadModalVisible(true);
  };

  const handleBulkUpload = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('brandId', selectedBrandFilter);

      const response = await apiService.postFile('/admin/colors/bulk-upload', formData);
      
      if (response.success) {
        message.success(`Successfully uploaded ${response.data.created} colors`);
        if (response.data.errors > 0) {
          message.warning(`${response.data.errors} colors failed to upload`);
          console.error('Upload errors:', response.data.errorDetails);
        }
        setBulkUploadModalVisible(false);
        fetchColors(searchText);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      message.error(error.message || 'Failed to upload colors');
    }
    return false; // Prevent default upload behavior
  };

  const downloadTemplate = () => {
    const brandName = brands.find(b => b.id === selectedBrandFilter)?.name || 'Brand';
    const csvContent = 'Color Name,Color Code,Hex Value,Red,Green,Blue,Sample Image\n' +
      `Example White,${brandName.substring(0, 2).toUpperCase()}-001,#FFFFFF,255,255,255,\n` +
      `Example Black,${brandName.substring(0, 2).toUpperCase()}-002,#000000,0,0,0,`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${brandName}_colors_template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const uploadProps = {
    beforeUpload: handleBulkUpload,
    showUploadList: true,
    accept: '.csv,.xlsx,.xls',
    maxCount: 1,
  };

  // Filter colors based on selected brand
  const filteredColors = colors.filter(c => {
    if (!selectedBrandFilter || selectedBrandFilter === 'all') return true;
    return c.brandId === selectedBrandFilter;
  });

  const columns = [
    {
      title: 'Preview',
      key: 'preview',
      width: 80,
      render: (_, record) => (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 4,
            backgroundColor: record.hexValue || '#FFFFFF',
            border: '2px solid #303030',
          }}
        />
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: 'Brand',
      key: 'brand',
      render: (_, record) => record.brand?.name || '-',
      filters: brands.map(b => ({ text: b.name, value: b.id })),
      onFilter: (value, record) => record.brandId === value,
    },
    {
      title: 'Hex Value',
      dataIndex: 'hexValue',
      key: 'hexValue',
      render: (hex) => <code style={{ color: '#52c41a' }}>{hex}</code>,
    },
    {
      title: 'RGB',
      key: 'rgb',
      render: (_, record) => {
        if (record.red !== null && record.green !== null && record.blue !== null) {
          return <code style={{ color: '#1890ff' }}>({record.red}, {record.green}, {record.blue})</code>;
        }
        return '-';
      },
    },
    {
      title: 'Mappings',
      key: 'mappings',
      render: (_, record) => {
        const mappings = record.crossBrandMappings || [];
        return mappings.length > 0 ? (
          <Tag color="purple">{mappings.length} mapped</Tag>
        ) : (
          <Tag>No mappings</Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 160,
      render: (_, record) => (
        <Space>
          <Button
            icon={<LinkOutlined />}
            onClick={() => showMappingModal(record)}
            size="small"
            title="Add Cross-Brand Mapping"
          />
          <Button
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
            size="small"
          />
          <Popconfirm
            title="Delete color"
            description="Are you sure you want to delete this color?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Global Colors Management</h1>
        <Space>
          <Button
            icon={<UploadOutlined />}
            onClick={showBulkUploadModal}
          >
            Bulk Upload
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => showModal()}
          >
            Add Color
          </Button>
        </Space>
      </div>

      <div className="mb-4 flex gap-4">
        <Select
          placeholder="Filter by Brand"
          style={{ width: 200 }}
          onChange={(value) => setSelectedBrandFilter(value)}
          value={selectedBrandFilter}
          allowClear
        >
          <Option value="all">All Brands</Option>
          {brands.map((brand) => (
            <Option key={brand.id} value={brand.id}>
              {brand.name}
            </Option>
          ))}
        </Select>
        <Input
          placeholder="Search by color name or code..."
          prefix={<SearchOutlined />}
          onChange={(e) => handleSearch(e.target.value)}
          style={{ maxWidth: 400 }}
          allowClear
        />
      </div>

      <Table
        columns={columns}
        dataSource={filteredColors}
        loading={loading}
        rowKey="id"
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 20 }}
      />

      {/* Add/Edit Color Modal */}
      <Modal
        title={editingColor ? 'Edit Color' : 'Add Color'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="brandId"
            label="Brand"
            rules={[{ required: true, message: 'Please select a brand' }]}
          >
            <Select placeholder="Select a brand" showSearch>
              {brands.map((brand) => (
                <Option key={brand.id} value={brand.id}>
                  {brand.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="name"
            label="Color Name"
            rules={[{ required: true, message: 'Please enter color name' }]}
          >
            <Input placeholder="e.g., Alabaster" />
          </Form.Item>

          <Form.Item
            name="code"
            label="Color Code"
            rules={[{ required: true, message: 'Please enter color code' }]}
          >
            <Input placeholder="e.g., SW 7008" />
          </Form.Item>

          <Form.Item
            name="hexValue"
            label="Hex Color Value"
            rules={[
              { required: true, message: 'Please select a color' },
              { pattern: /^#[0-9A-Fa-f]{6}$/, message: 'Invalid hex color' }
            ]}
          >
            <Input type="color" style={{ width: 100, height: 40 }} />
          </Form.Item>

          <div className="grid grid-cols-3 gap-4">
            <Form.Item name="red" label="Red (0-255)">
              <Input type="number" min={0} max={255} placeholder="R" />
            </Form.Item>
            <Form.Item name="green" label="Green (0-255)">
              <Input type="number" min={0} max={255} placeholder="G" />
            </Form.Item>
            <Form.Item name="blue" label="Blue (0-255)">
              <Input type="number" min={0} max={255} placeholder="B" />
            </Form.Item>
          </div>

          <Form.Item name="sampleImage" label="Sample Image URL (Optional)">
            <Input placeholder="https://example.com/sample.jpg" />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
              }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
                {editingColor ? 'Update' : 'Create'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Cross-Brand Mapping Modal */}
      <Modal
        title="Add Cross-Brand Mapping"
        open={mappingModalVisible}
        onCancel={() => {
          setMappingModalVisible(false);
          mappingForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        {selectedColorForMapping && (
          <div className="mb-4 p-3 bg-gray-100 rounded">
            <div className="flex items-center gap-3">
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 4,
                  backgroundColor: selectedColorForMapping.hexValue,
                  border: '2px solid #e5e7eb',
                }}
              />
              <div>
                <div className="font-semibold">{selectedColorForMapping.name}</div>
                <div className="text-gray-600 text-sm">{selectedColorForMapping.code}</div>
              </div>
            </div>
          </div>
        )}

        <Form
          form={mappingForm}
          layout="vertical"
          onFinish={handleAddMapping}
        >
          <Form.Item
            name="mappedColorId"
            label="Map to Color"
            rules={[{ required: true, message: 'Please select a color to map' }]}
          >
            <Select
              placeholder="Search and select a color"
              showSearch
              filterOption={(input, option) =>
                option.label.toLowerCase().includes(input.toLowerCase())
              }
              options={colors
                .filter(c => c.id !== selectedColorForMapping?.id)
                .map(c => ({
                  label: `${c.name} (${c.code}) - ${c.brand?.name}`,
                  value: c.id,
                }))}
            />
          </Form.Item>

          <Form.Item name="notes" label="Notes (Optional)">
            <Input.TextArea rows={2} placeholder="e.g., Very close match, slight warmth difference" />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => {
                setMappingModalVisible(false);
                mappingForm.resetFields();
              }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
                Add Mapping
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal
        title="Bulk Upload Colors"
        open={bulkUploadModalVisible}
        onCancel={() => setBulkUploadModalVisible(false)}
        footer={null}
        width={600}
      >
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            Upload an Excel or CSV file with colors for{' '}
            <strong>{brands.find(b => b.id === selectedBrandFilter)?.name}</strong>
          </p>
          <p className="text-sm text-gray-600 mb-4">
            The file should contain the following columns: Color Name, Color Code, Hex Value, Red, Green, Blue, Sample Image
          </p>
          <Button
            icon={<DownloadOutlined />}
            onClick={downloadTemplate}
            className="mb-4"
          >
            Download Template
          </Button>
        </div>

        <Upload {...uploadProps}>
          <Button icon={<UploadOutlined />} block>
            Select File to Upload
          </Button>
        </Upload>

        <div className="mt-4 text-xs text-gray-500">
          <p>Supported formats: .csv, .xlsx, .xls</p>
          <p>Maximum file size: 5MB</p>
        </div>
      </Modal>
    </div>
  );
};

export default GlobalColorsPage;
