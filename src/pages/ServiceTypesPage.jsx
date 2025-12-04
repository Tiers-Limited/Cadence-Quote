import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, message, Popconfirm, Switch, Tag } from 'antd';
import { FiPlus, FiEdit, FiTrash2, FiRefreshCw } from 'react-icons/fi';
import { apiService } from '../services/apiService';

const { TextArea } = Input;
const { Option } = Select;

function ServiceTypesPage() {
  const [loading, setLoading] = useState(false);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchServiceTypes();
  }, []);

  const fetchServiceTypes = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/service-types');
      if (response.success) {
        setServiceTypes(response.data);
      }
    } catch (error) {
      message.error('Failed to load service types: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeDefaults = async () => {
    try {
      setLoading(true);
      const response = await apiService.post('/service-types/initialize-defaults');
      if (response.success) {
        message.success(response.message);
        fetchServiceTypes();
      }
    } catch (error) {
      message.error('Failed to initialize defaults: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingService(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingService(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      const response = await apiService.delete(`/service-types/${id}`);
      if (response.success) {
        message.success('Service type deleted successfully');
        fetchServiceTypes();
      }
    } catch (error) {
      message.error('Failed to delete: ' + error.message);
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingService) {
        await apiService.put(`/service-types/${editingService.id}`, values);
        message.success('Service type updated successfully');
      } else {
        await apiService.post('/service-types', values);
        message.success('Service type created successfully');
      }
      setModalVisible(false);
      fetchServiceTypes();
    } catch (error) {
      message.error('Failed to save: ' + error.message);
    }
  };

  const columns = [
    {
      title: 'Service Type',
      dataIndex: 'serviceType',
      key: 'serviceType',
      render: (text) => <Tag color="blue">{text.replace(/_/g, ' ').toUpperCase()}</Tag>
    },
    {
      title: 'Display Name',
      dataIndex: 'displayName',
      key: 'displayName',
    },
    {
      title: 'Sub-Type',
      dataIndex: 'subType',
      key: 'subType',
    },
    {
      title: 'Labor Rate',
      dataIndex: 'laborRate',
      key: 'laborRate',
      render: (rate, record) => `$${rate} ${record.laborRateType.replace('per_', '/')}`
    },
    {
      title: 'Prep Included',
      dataIndex: 'prepIncluded',
      key: 'prepIncluded',
      render: (included) => <Switch checked={included} disabled />
    },
    {
      title: 'Crew Size',
      dataIndex: 'crewSizeDefault',
      key: 'crewSizeDefault',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <div className="flex gap-2">
          <Button size="small" icon={<FiEdit />} onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this service type?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button size="small" danger icon={<FiTrash2 />}>
              Delete
            </Button>
          </Popconfirm>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Types</h1>
          <p className="text-gray-600 mt-1">
            Manage service types for labor rates and estimation
          </p>
        </div>
        <div className="flex gap-2">
          <Button icon={<FiRefreshCw />} onClick={handleInitializeDefaults}>
            Initialize Defaults
          </Button>
          <Button type="primary" icon={<FiPlus />} onClick={handleCreate}>
            Add Service Type
          </Button>
        </div>
      </div>

      <Card>
        <Table
          dataSource={serviceTypes}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title={editingService ? 'Edit Service Type' : 'Create Service Type'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              label="Service Type"
              name="serviceType"
              rules={[{ required: true }]}
            >
              <Select placeholder="Select type">
                <Option value="interior_painting">Interior Painting</Option>
                <Option value="exterior_painting">Exterior Painting</Option>
                <Option value="specialty_services">Specialty Services</Option>
                <Option value="prep_finishing">Prep & Finishing</Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="Sub-Type"
              name="subType"
              rules={[{ required: true }]}
            >
              <Input placeholder="E.g., Walls, Ceilings, Siding" />
            </Form.Item>

            <Form.Item
              label="Display Name"
              name="displayName"
              rules={[{ required: true }]}
            >
              <Input placeholder="E.g., Interior Walls" />
            </Form.Item>

            <Form.Item
              label="Labor Rate Type"
              name="laborRateType"
              rules={[{ required: true }]}
            >
              <Select>
                <Option value="per_sqft">Per Square Foot</Option>
                <Option value="per_hour">Per Hour</Option>
                <Option value="per_unit">Per Unit</Option>
                <Option value="flat_rate">Flat Rate</Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="Labor Rate"
              name="laborRate"
              rules={[{ required: true }]}
            >
              <InputNumber className="w-full" prefix="$" min={0} step={0.01} />
            </Form.Item>

            <Form.Item
              label="Crew Size Default"
              name="crewSizeDefault"
            >
              <InputNumber className="w-full" min={1} max={10} />
            </Form.Item>

            <Form.Item
              label="Productivity Rate (sqft/hour)"
              name="productivityRate"
            >
              <InputNumber className="w-full" min={0} step={10} />
            </Form.Item>

            <Form.Item
              label="Display Order"
              name="displayOrder"
            >
              <InputNumber className="w-full" min={0} />
            </Form.Item>
          </div>

          <Form.Item
            label="Prep Requirements"
            name="prepRequirements"
          >
            <TextArea rows={3} placeholder="E.g., Sanding, priming, drop cloths" />
          </Form.Item>

          <Form.Item
            label="Prep Included"
            name="prepIncluded"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="Prep Add-On Cost"
            name="prepAddOnCost"
          >
            <InputNumber className="w-full" prefix="$" min={0} step={0.01} />
          </Form.Item>

          <Form.Item
            label="Duration Estimate"
            name="durationEstimate"
          >
            <Input placeholder="E.g., 2-4 days for 500 sq ft" />
          </Form.Item>

          <Form.Item
            label="Description"
            name="description"
          >
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ServiceTypesPage;
