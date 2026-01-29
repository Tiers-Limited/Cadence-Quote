// components/CustomerPortal/JobProgressView.jsx
// Read-only job progress view for customer portal

import { List, Tag, Space, Typography, Progress, Card } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

function JobProgressView({ job }) {
  const getItemStatus = (itemKey) => {
    if (!job.areaProgress || !job.areaProgress[itemKey]) {
      return 'not_started';
    }
    return job.areaProgress[itemKey].status;
  };

  const getStatusLabel = (status) => {
    const labels = {
      'not_started': 'Not Started',
      'prepped': 'Prepped',
      'in_progress': 'In Progress',
      'touch_ups': 'Touch-Ups',
      'completed': 'Completed'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      'not_started': 'default',
      'prepped': 'blue',
      'in_progress': 'processing',
      'touch_ups': 'warning',
      'completed': 'success'
    };
    return colors[status] || 'default';
  };

  const pricingSchemeType = job.quote?.pricingScheme?.type;
  
  // Determine what to display based on pricing scheme
  let items = [];
  let totalItems = 0;
  let completedItems = 0;
  
  if (pricingSchemeType === 'flat_rate_unit') {
    // Flat rate pricing - show interior and exterior items
    let flatRateItems = job.quote?.flatRateItems || {};
    
    // If flatRateItems is empty but we have breakdown, build it from breakdown
    if ((!flatRateItems.interior && !flatRateItems.exterior) && job.quote?.breakdown) {
      flatRateItems = { interior: {}, exterior: {} };
      
      job.quote.breakdown.forEach(item => {
        const category = item.category?.toLowerCase() || 'interior';
        const itemKey = item.itemKey;
        const quantity = item.quantity || 0;
        
        if (category === 'interior' && itemKey) {
          flatRateItems.interior[itemKey] = quantity;
        } else if (category === 'exterior' && itemKey) {
          flatRateItems.exterior[itemKey] = quantity;
        }
      });
    }
    
    // Interior items
    if (flatRateItems.interior) {
      const interiorLabels = {
        doors: 'Interior Doors',
        smallRooms: 'Small Rooms',
        mediumRooms: 'Medium Rooms',
        largeRooms: 'Large Rooms',
        closets: 'Closets',
        accentWalls: 'Accent Walls',
        cabinets: 'Cabinets',
        cabinetFaces: 'Cabinet Faces',
        cabinetDoors: 'Cabinet Doors'
      };
      
      Object.entries(flatRateItems.interior).forEach(([key, count]) => {
        if (count > 0) {
          const itemKey = `interior_${key}`;
          const status = getItemStatus(itemKey);
          items.push({
            key: itemKey,
            name: interiorLabels[key] || key,
            category: 'Interior',
            quantity: count,
            unit: 'unit(s)',
            status
          });
          totalItems++;
          if (status === 'completed') completedItems++;
        }
      });
    }
    
    // Exterior items
    if (flatRateItems.exterior) {
      const exteriorLabels = {
        doors: 'Doors',
        windows: 'Windows',
        garageDoor1Car: '1-Car Garage Door',
        garageDoor2Car: '2-Car Garage Door',
        garageDoor3Car: '3-Car Garage Door',
        shutters: 'Shutters'
      };
      
      Object.entries(flatRateItems.exterior).forEach(([key, count]) => {
        if (count > 0) {
          const itemKey = `exterior_${key}`;
          const status = getItemStatus(itemKey);
          items.push({
            key: itemKey,
            name: exteriorLabels[key] || key,
            category: 'Exterior',
            quantity: count,
            unit: 'unit(s)',
            status
          });
          totalItems++;
          if (status === 'completed') completedItems++;
        }
      });
    }
    
  } else if (pricingSchemeType === 'turnkey' || pricingSchemeType === 'sqft_turnkey') {
    // Turnkey pricing - show single "Whole House" item
    const itemKey = 'whole_house';
    const status = getItemStatus(itemKey);
    items.push({
      key: itemKey,
      name: 'Whole House',
      category: 'Complete Project',
      quantity: 1,
      unit: 'project',
      status
    });
    totalItems = 1;
    if (status === 'completed') completedItems = 1;
    
  } else {
    // Production-based or rate-based pricing - show areas
    const areas = job.quote?.areas || [];
    
    areas.forEach(area => {
      const status = getItemStatus(area.id);
      items.push({
        key: area.id,
        name: area.name || area.surfaceType,
        category: area.surfaceType,
        quantity: area.quantity,
        unit: area.unit,
        status
      });
      totalItems++;
      if (status === 'completed') completedItems++;
    });
  }

  if (items.length === 0) {
    return <Text type="secondary">No progress information available</Text>;
  }

  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div>
      {/* Overall Progress */}
      <Card size="small" className="mb-4" style={{ backgroundColor: '#fafafa' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>Overall Project Progress</Text>
            <Text strong style={{ fontSize: 18, color: progressPercent === 100 ? '#52c41a' : '#1890ff' }}>
              {progressPercent}%
            </Text>
          </div>
          <Progress 
            percent={progressPercent} 
            status={progressPercent === 100 ? 'success' : 'active'}
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
            strokeWidth={12}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {completedItems} of {totalItems} {pricingSchemeType === 'flat_rate_unit' ? 'items' : pricingSchemeType === 'turnkey' || pricingSchemeType === 'sqft_turnkey' ? 'project' : 'areas'} completed
          </Text>
        </Space>
      </Card>

      {/* Item List */}
      <List
        dataSource={items}
        renderItem={(item) => {
          const isCompleted = item.status === 'completed';
          
          return (
            <List.Item
              style={{
                backgroundColor: isCompleted ? '#f6ffed' : '#ffffff',
                border: isCompleted ? '2px solid #b7eb8f' : '1px solid #f0f0f0',
                borderRadius: 8,
                marginBottom: 12,
                padding: 16,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <div style={{ width: '100%' }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                  <Space>
                    {isCompleted && <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} />}
                    <div>
                      <Text strong style={{ fontSize: 15 }}>{item.name}</Text>
                      {item.category && (
                        <>
                          <br />
                          <Tag color="blue" style={{ fontSize: 11, marginTop: 4 }}>{item.category}</Tag>
                        </>
                      )}
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.quantity} {item.unit}
                      </Text>
                    </div>
                  </Space>
                  
                  <Tag 
                    color={getStatusColor(item.status)}
                    style={{ fontSize: 13, padding: '4px 12px', fontWeight: 500 }}
                  >
                    {getStatusLabel(item.status)}
                  </Tag>
                </Space>
              </div>
            </List.Item>
          );
        }}
      />
    </div>
  );
}

export default JobProgressView;
