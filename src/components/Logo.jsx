import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

const Logo = ({ className = '', width = 180 }) => {
  return (
    <Link to="/" className={className}>
      <img 
        src="/assets/logo.jpg" 
        alt="Cadence Quote - The Rhythm Behind Every Great Quote" 
        width={width}
        className="h-auto mix-blend-multiply"
      />
    </Link>
  );
};

Logo.propTypes = {
  className: PropTypes.string,
  width: PropTypes.number
};

export default Logo;