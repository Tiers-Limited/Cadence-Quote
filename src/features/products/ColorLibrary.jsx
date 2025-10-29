import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Tag, message, Card, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import {apiService} from '../../services/apiService';
// Server-side upload used; no client-side XLSX parsing for large files

const { Option } = Select;

const ColorLibrary = () => {
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingColor, setEditingColor] = useState(null);
  const [form] = Form.useForm();
  const [uploadPreviewVisible, setUploadPreviewVisible] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const fileInputRef = useRef(null);

  const fetchColors = async () => {
    setLoading(true);
    try {
      const response = await apiService.get('/colors');
      if (response.success) {
        setColors(response.data);
      }
    } catch (error) {
      message.error('Failed to fetch colors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchColors();
  }, []);

  const showModal = (color = null) => {
    setEditingColor(color);
    if (color) {
      form.setFieldsValue(color);
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      if (editingColor) {
        await apiService.put(`/colors/${editingColor.id}`, values);
        message.success('Color updated successfully');
      } else {
        await apiService.post('/colors', values);
        message.success('Color added successfully');
      }
      setModalVisible(false);
      fetchColors();
    } catch (error) {
      message.error('Failed to save color');
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiService.delete(`/colors/${id}`);
      message.success('Color deleted successfully');
      fetchColors();
    } catch (error) {
      message.error('Failed to delete color');
    }
  };

const columns = [
  {
    title: 'Preview',
    key: 'preview',
    render: (_, record) => (
      <div
        className="w-8 h-8 rounded border"
        style={{
          backgroundColor: record.hexValue || `rgb(${record.red}, ${record.green}, ${record.blue})`,
          border: '1px solid #d9d9d9',
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
    title: 'Locator',
    dataIndex: 'locator',
    key: 'locator',
  },
  // {
  //   title: 'Brand',
  //   dataIndex: 'brand',
  //   key: 'brand',
  //   render: (brand) => brand || <span style={{ color: '#999' }}>N/A</span>,
  // },
  // {
  //   title: 'Color Family',
  //   dataIndex: 'colorFamily',
  //   key: 'colorFamily',
  //   render: (family) =>
  //     family ? <Tag color="blue">{family}</Tag> : <Tag color="default">N/A</Tag>,
  // },
  {
    title: 'RGB',
    key: 'rgb',
    render: (_, record) => {
      const { red, green, blue } = record
      const hasRGB = red !== null && green !== null && blue !== null
      return hasRGB ? (
        <div className="flex items-center gap-2">
          
          <span style={{ fontFamily: 'monospace' }}>
            {`(${red}, ${green}, ${blue})`}
          </span>
        </div>
      ) : (
        <span style={{ color: '#999' }}>—</span>
      )
    },
  },
  {
    title: 'Hex Value',
    dataIndex: 'hexValue',
    key: 'hexValue',
    render: (hex) => (
      <span style={{ fontFamily: 'monospace' }}>{hex || '—'}</span>
    ),
  },
  {
    title: 'Type',
    key: 'type',
    render: (_, record) => (
      <Tag color={record.isCustomMatch ? 'orange' : 'green'}>
        {record.isCustomMatch ? 'Custom Match' : 'Standard'}
      </Tag>
    ),
  },
  {
    title: 'Active',
    dataIndex: 'isActive',
    key: 'isActive',
    render: (v) => (v ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>),
  },
  {
    title: 'Created At',
    dataIndex: 'createdAt',
    key: 'createdAt',
    render: (d) => new Date(d).toLocaleString(),
  },
  {
    title: 'Updated At',
    dataIndex: 'updatedAt',
    key: 'updatedAt',
    render: (d) => new Date(d).toLocaleString(),
  },
  {
    title: 'Notes',
    dataIndex: 'notes',
    key: 'notes',
    ellipsis: true,
  },
  {
    title: 'Actions',
    key: 'actions',
    fixed: 'right',
    render: (_, record) => (
      <Space>
        <Button
          icon={<EditOutlined />}
          onClick={() => showModal(record)}
        />
        <Button
          icon={<DeleteOutlined />}
          danger
          onClick={() => handleDelete(record.id)}
        />
      </Space>
    ),
  },
]



  // Client-side parsing removed; we upload the file to the server which will parse and import

  const onUploadClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  }

  const onFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    // Upload file to server using FormData
    const form = new FormData();
    form.append('file', f);
    apiService.postFile('/colors/upload', form)
      .then(resp => {
        if (resp && resp.success) {
          message.success('File imported successfully');
          fetchColors();
        } else {
          message.error(resp?.error || 'Import failed');
        }
      })
      .catch(err => {
        console.error('Upload error', err);
        message.error('Failed to upload file');
      });
    e.target.value = '';
  }

  const saveBulk = async () => {
    if (!previewData.length) return;
    try {
      const payload = previewData.map(p => ({
        name: p.name || 'Unnamed',
        code: p.code || '',
        brand: p.brand || 'Imported',
        colorFamily: p.colorFamily || 'Imported',
        hexValue: p.hexValue || '',
        locator: p.locator || null,
        red: p.red !== undefined && p.red !== null && p.red !== '' ? Number(p.red) : null,
        green: p.green !== undefined && p.green !== null && p.green !== '' ? Number(p.green) : null,
        blue: p.blue !== undefined && p.blue !== null && p.blue !== '' ? Number(p.blue) : null,
        isCustomMatch: !!p.isCustomMatch,
        notes: p.notes || ''
      }));
      const response = await apiService.post('/colors/bulk', payload);
      if (response && response.success) {
        message.success('Colors imported successfully');
        setUploadPreviewVisible(false);
        setPreviewData([]);
        fetchColors();
      } else {
        message.error(response?.error || 'Import failed');
      }
    } catch (err) {
      console.error(err);
      message.error('Failed to import colors');
    }
  }

  return (
    <div className="">
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-semibold">Color Library</h2>
        <div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => showModal()}
          >
            Add Color
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={onFileChange} style={{display:'none'}} />
          <Button style={{marginLeft:8}} onClick={onUploadClick}>Upload Excel/CSV</Button>
        </div>
      </div>

      {/* Color Family Grid View */}
      {/* <div className="mb-8">
        <h3 className="text-lg font-medium mb-4">Color Families</h3>
        <Row gutter={[16, 16]}>
          {colorFamilies.map(family => (
            <Col xs={24} sm={12} md={8} lg={6} key={family.name}>
              <Card title={family.name}>
                <div className="grid grid-cols-4 gap-2">
                  {family.colors.map(color => (
                    <div
                      key={color.id}
                      className="w-full pt-[100%] relative rounded cursor-pointer hover:scale-105 transition-transform"
                      style={{ 
                        backgroundColor: color.hexValue,
                        border: '1px solid #d9d9d9'
                      }}
                      onClick={() => showModal(color)}
                      title={`${color.name} (${color.code})`}
                    />
                  ))}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div> */}

      {/* Detailed List View */}
      <Table
    columns={columns}
    dataSource={colors}
    loading={loading}
    rowKey="id"
    scroll={{ x: 'max-content' }} // ✅ adds horizontal scroll
    pagination={{ pageSize: 20 }}
  />

     <Modal
  title={editingColor ? 'Edit Color' : 'Add Color'}
  open={modalVisible}
  onCancel={() => setModalVisible(false)}
  footer={null}
>
  <Form
    form={form}
    layout="vertical"
    onFinish={handleSubmit}
  >
    <Form.Item
      name="name"
      label="Color Name"
      rules={[{ required: true, message: 'Please enter color name' }]}
    >
      <Input />
    </Form.Item>

    <Form.Item
      name="code"
      label="Color Code"
      rules={[{ required: true, message: 'Please enter color code' }]}
    >
      <Input />
    </Form.Item>

    {/* <Form.Item
      name="brand"
      label="Brand"
    >
      <Select allowClear placeholder="Select or leave empty">
        <Option value="Sherwin-Williams">Sherwin-Williams</Option>
        <Option value="Benjamin Moore">Benjamin Moore</Option>
        <Option value="Behr">Behr</Option>
        <Option value="Other">Other</Option>
      </Select>
    </Form.Item>

    <Form.Item
      name="colorFamily"
      label="Color Family"
    >
      <Select allowClear placeholder="Select color family">
        <Option value="Whites">Whites</Option>
        <Option value="Neutrals">Neutrals</Option>
        <Option value="Blues">Blues</Option>
        <Option value="Greens">Greens</Option>
        <Option value="Reds">Reds</Option>
        <Option value="Yellows">Yellows</Option>
        <Option value="Other">Other</Option>
      </Select>
    </Form.Item> */}

    {/* locator */}
    <Form.Item
      name="locator"
      label="Locator"
      rules={[{ required: true, message: 'Please enter a locator' }]}
    >
      <Input />
    </Form.Item>

    <Form.Item
      label="RGB (Red, Green, Blue)"
      style={{ marginBottom: 0 }}
    >
      <Space.Compact block>
        <Form.Item
          name="red"
          noStyle
          rules={[{ type: 'number', min: 0, max: 255, message: '0–255' }]}
        >
          <Input type="number" placeholder="R" min={0} max={255} />
        </Form.Item>
        <Form.Item
          name="green"
          noStyle
          rules={[{ type: 'number', min: 0, max: 255, message: '0–255' }]}
        >
          <Input type="number" placeholder="G" min={0} max={255} />
        </Form.Item>
        <Form.Item
          name="blue"
          noStyle
          rules={[{ type: 'number', min: 0, max: 255, message: '0–255' }]}
        >
          <Input type="number" placeholder="B" min={0} max={255} />
        </Form.Item>
      </Space.Compact>
    </Form.Item>

    <Form.Item
      name="hexValue"
      label="Hex Color Code"
      rules={[
        { required: true, message: 'Please enter a hex color code' },
        { pattern: /^#[0-9A-Fa-f]{6}$/, message: 'Invalid hex color code' },
      ]}
    >
      <Input type="color" />
    </Form.Item>

    <Form.Item
      name="notes"
      label="Notes"
    >
      <Input.TextArea />
    </Form.Item>

    <Form.Item className="mb-0">
      <Space className="w-full justify-end">
        <Button onClick={() => setModalVisible(false)}>Cancel</Button>
        <Button type="primary" htmlType="submit">
          {editingColor ? 'Update' : 'Create'}
        </Button>
      </Space>
    </Form.Item>
  </Form>
</Modal>


      {/* Upload Preview Modal */}
      <Modal
        title="Preview Imported Colors"
        open={uploadPreviewVisible}
        onCancel={() => setUploadPreviewVisible(false)}
        width={1000}
        footer={null}
      >
        <div className="mb-4">
          <p className="text-sm text-gray-600">Preview the rows extracted from the uploaded file. You can edit values inline before saving.</p>
        </div>
        <Table
          dataSource={previewData}
          rowKey={(r, idx) => idx}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: 'Preview',
              key: 'preview',
              render: (_, rec) => (
                <div
                  className="w-8 h-8 rounded border"
                  style={{ 
                    backgroundColor: rec.hexValue || '#FFFFFF',
                    border: '1px solid #d9d9d9'
                  }}
                />
              ),
            },
            {
              title: 'COLOR #',
              dataIndex: 'code',
              key: 'code',
              render: (v, rec, i) => (
                <Input value={v || ''} onChange={(e) => {
                  const copy = [...previewData];
                  copy[i] = { ...copy[i], code: e.target.value };
                  setPreviewData(copy);
                }} />
              )
            },
            {
              title: 'COLOR NAME',
              dataIndex: 'name',
              key: 'name',
              render: (v, rec, i) => (
                <Input value={v || ''} onChange={(e) => {
                  const copy = [...previewData];
                  copy[i] = { ...copy[i], name: e.target.value };
                  setPreviewData(copy);
                }} />
              )
            },
            {
              title: 'LOCATOR #',
              dataIndex: 'locator',
              key: 'locator',
              render: (v, rec, i) => (
                <Input value={v || ''} onChange={(e) => {
                  const copy = [...previewData];
                  copy[i] = { ...copy[i], locator: e.target.value };
                  setPreviewData(copy);
                }} />
              )
            },
            {
              title: 'RED',
              dataIndex: 'red',
              key: 'red',
              render: (v, rec, i) => (
                <Input type="number" value={v || ''} onChange={(e) => {
                  const copy = [...previewData];
                  const newRed = e.target.value;
                  copy[i] = { ...copy[i], red: newRed };
                  // Update hexValue if RGB values are provided
                  if (newRed && copy[i].green && copy[i].blue) {
                    const to2 = (n) => {
                      const num = Number(n);
                      if (Number.isNaN(num)) return null;
                      const v = Math.max(0, Math.min(255, Math.round(num)));
                      return v.toString(16).padStart(2, '0');
                    };
                    const hr = to2(newRed), hg = to2(copy[i].green), hb = to2(copy[i].blue);
                    if (hr && hg && hb) {
                      copy[i].hexValue = `#${hr}${hg}${hb}`.toUpperCase();
                    }
                  }
                  setPreviewData(copy);
                }} />
              )
            },
            {
              title: 'GREEN',
              dataIndex: 'green',
              key: 'green',
              render: (v, rec, i) => (
                <Input type="number" value={v || ''} onChange={(e) => {
                  const copy = [...previewData];
                  const newGreen = e.target.value;
                  copy[i] = { ...copy[i], green: newGreen };
                  // Update hexValue if RGB values are provided
                  if (copy[i].red && newGreen && copy[i].blue) {
                    const to2 = (n) => {
                      const num = Number(n);
                      if (Number.isNaN(num)) return null;
                      const v = Math.max(0, Math.min(255, Math.round(num)));
                      return v.toString(16).padStart(2, '0');
                    };
                    const hr = to2(copy[i].red), hg = to2(newGreen), hb = to2(copy[i].blue);
                    if (hr && hg && hb) {
                      copy[i].hexValue = `#${hr}${hg}${hb}`.toUpperCase();
                    }
                  }
                  setPreviewData(copy);
                }} />
              )
            },
            {
              title: 'BLUE',
              dataIndex: 'blue',
              key: 'blue',
              render: (v, rec, i) => (
                <Input type="number" value={v || ''} onChange={(e) => {
                  const copy = [...previewData];
                  const newBlue = e.target.value;
                  copy[i] = { ...copy[i], blue: newBlue };
                  // Update hexValue if RGB values are provided
                  if (copy[i].red && copy[i].green && newBlue) {
                    const to2 = (n) => {
                      const num = Number(n);
                      if (Number.isNaN(num)) return null;
                      const v = Math.max(0, Math.min(255, Math.round(num)));
                      return v.toString(16).padStart(2, '0');
                    };
                    const hr = to2(copy[i].red), hg = to2(copy[i].green), hb = to2(newBlue);
                    if (hr && hg && hb) {
                      copy[i].hexValue = `#${hr}${hg}${hb}`.toUpperCase();
                    }
                  }
                  setPreviewData(copy);
                }} />
              )
            },
            {
              title: 'HEX',
              dataIndex: 'hexValue',
              key: 'hexValue',
              render: (v, rec, i) => (
                <Input value={v || ''} onChange={(e) => {
                  const copy = [...previewData];
                  copy[i] = { ...copy[i], hexValue: e.target.value.toUpperCase() };
                  setPreviewData(copy);
                }} />
              )
            },
           
          ]}
        />
        <div className="mt-4 flex justify-end">
          <Button onClick={() => { setUploadPreviewVisible(false); setPreviewData([]); }}>Cancel</Button>
          <Button type="primary" style={{marginLeft:8}} onClick={saveBulk}>Save All</Button>
        </div>
      </Modal>
    </div>
  );
};

export default ColorLibrary;