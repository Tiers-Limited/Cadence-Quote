import { Alert, Tag, Tooltip } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, LockOutlined, WarningOutlined } from '@ant-design/icons';

function PortalStatusIndicator({ proposal, compact = false }) {
  if (!proposal) return null;

  // Calculate days remaining if portal is open
  let daysRemaining = null;
  let hoursRemaining = null;
  
  if (proposal.portalOpen && proposal.portalClosedAt) {
    const now = new Date();
    const closedAt = new Date(proposal.portalClosedAt);
    const msRemaining = closedAt - now;
    daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    hoursRemaining = Math.ceil(msRemaining / (1000 * 60 * 60));
  }

  // Determine status
  const getStatus = () => {
    if (proposal.selectionsComplete) {
      return {
        type: 'success',
        icon: <CheckCircleOutlined />,
        title: 'Selections Complete',
        message: 'All product selections have been submitted.',
        color: 'success'
      };
    }

    if (!proposal.depositVerified) {
      return {
        type: 'warning',
        icon: <LockOutlined />,
        title: 'Deposit Required',
        message: 'Portal will open after deposit payment is verified.',
        color: 'warning'
      };
    }

    if (!proposal.finishStandardsAcknowledged) {
      return {
        type: 'info',
        icon: <WarningOutlined />,
        title: 'Action Required',
        message: 'Please acknowledge finish standards to begin selections.',
        color: 'processing'
      };
    }

    if (proposal.portalOpen && daysRemaining !== null) {
      if (daysRemaining < 0) {
        return {
          type: 'error',
          icon: <LockOutlined />,
          title: 'Portal Expired',
          message: 'Portal access has expired. Contact your contractor to reopen.',
          color: 'error'
        };
      } else if (daysRemaining === 0) {
        return {
          type: 'warning',
          icon: <ClockCircleOutlined />,
          title: 'Portal Expires Today',
          message: `Portal closes in ${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}. Complete your selections soon!`,
          color: 'warning'
        };
      } else if (daysRemaining <= 3) {
        return {
          type: 'warning',
          icon: <ClockCircleOutlined />,
          title: `${daysRemaining} Day${daysRemaining !== 1 ? 's' : ''} Remaining`,
          message: `Portal access expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}. Please complete your selections soon.`,
          color: 'warning'
        };
      } else {
        return {
          type: 'info',
          icon: <ClockCircleOutlined />,
          title: 'Portal Open',
          message: `You have ${daysRemaining} days to complete your product selections. Expires ${new Date(proposal.portalClosedAt).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}.`,
          color: 'processing'
        };
      }
    }

    if (!proposal.portalOpen) {
      return {
        type: 'default',
        icon: <LockOutlined />,
        title: 'Portal Closed',
        message: 'Contact your contractor if you need to make changes.',
        color: 'default'
      };
    }

    return null;
  };

  const status = getStatus();
  if (!status) return null;

  // Compact mode (for headers, cards)
  if (compact) {
    return (
      <Tooltip title={status.message}>
        <Tag icon={status.icon} color={status.color}>
          {status.title}
        </Tag>
      </Tooltip>
    );
  }

  // Full alert mode (for prominent display)
  return (
    <Alert
      type={status.type}
      icon={status.icon}
      message={status.title}
      description={status.message}
      showIcon
      style={{ marginBottom: 16 }}
    />
  );
}

export default PortalStatusIndicator;
