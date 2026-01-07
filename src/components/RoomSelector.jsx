import React, { useState } from 'react';
import { Card, Button, Tag, Input, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

const interiorRooms = [
  'Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 
  'Dining Room', 'Hallway', 'Office', 'Laundry Room',
  'Closet', 'Pantry', 'Bonus Room'
];

const exteriorAreas = [
  'Exterior Siding',
  'Garage', 'Deck', 'Porch', 'Fence', 'Shutters'
];

export const RoomSelector = ({ jobType, selectedRooms, onRoomAdd, onRoomRemove, onRoomEdit }) => {
  const [customRoom, setCustomRoom] = useState('');
  const availableRooms = jobType === 'interior' ? interiorRooms : exteriorAreas;
  
  const handleAddCustomRoom = () => {
    if (customRoom.trim()) {
      onRoomAdd(customRoom.trim());
      setCustomRoom('');
    }
  };

  return (
    <Card className="mb-4">
      <div className="mb-4">
        <h4 className="font-medium mb-3">Select Rooms/Areas</h4>
        <div className="flex flex-wrap gap-2">
          {availableRooms.map(room => {
            const isSelected = selectedRooms.some(r => r.name === room);
            return (
              <Tag
                key={room}
                color={isSelected ? 'blue' : 'default'}
                className="cursor-pointer px-3 py-1"
                onClick={() => isSelected ? onRoomRemove(selectedRooms.find(r => r.name === room)?.id) : onRoomAdd(room)}
              >
                {room}
              </Tag>
            );
          })}
        </div>
      </div>

      <div className="mb-4">
        <h4 className="font-medium mb-2 text-sm">Add Custom Room/Area</h4>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="Enter custom room name"
            value={customRoom}
            onChange={(e) => setCustomRoom(e.target.value)}
            onPressEnter={handleAddCustomRoom}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCustomRoom}>
            Add
          </Button>
        </Space.Compact>
      </div>

      {selectedRooms.length > 0 && (
        <div>
          <h4 className="font-medium mb-2 text-sm">Selected Rooms ({selectedRooms.length})</h4>
          <div className="flex flex-wrap gap-2">
            {selectedRooms.map(room => (
              <Tag
                key={room.id}
                color="blue"
                closable
                onClose={() => onRoomRemove(room.id)}
                className="px-3 py-1 cursor-pointer"
                onClick={() => onRoomEdit && onRoomEdit(room.id)}
              >
                {room.name}
              </Tag>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
