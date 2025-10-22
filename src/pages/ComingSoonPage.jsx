import { Card, Typography } from 'antd';
import { FiSettings } from 'react-icons/fi';

const { Title, Paragraph } = Typography;

const ComingSoonPage = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="max-w-lg text-center">
        <div className="flex justify-center mb-4">
          <FiSettings className="text-5xl text-blue-600" />
        </div>
        <Title level={3}>Coming Soon</Title>
        <Paragraph>
          This feature is not yet available for Business Admin users. Stay tuned for updates!
        </Paragraph>
      </Card>
    </div>
  );
};

export default ComingSoonPage;