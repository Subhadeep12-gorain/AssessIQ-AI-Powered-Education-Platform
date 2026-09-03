import React from 'react';

const AuthLogo = () => {
  return (
    <div className="auth-logo-svg-wrapper">
      <svg
        width="80"
        height="80"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="auth-logo-svg"
      >
        <defs>
          <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {/* Brain Part */}
        <path
          d="M100 60C85 60 72 70 70 85C65 85 60 90 60 97C60 105 67 110 75 110C78 125 90 135 100 135C110 135 122 125 125 110C133 110 140 105 140 97C140 90 135 85 130 85C128 70 115 60 100 60Z"
          fill="url(#logo-gradient)"
          filter="url(#glow)"
        />
        
        {/* Brain Detail Lines */}
        <path
          d="M100 65V130M80 75C85 85 95 85 100 85M120 75C115 85 105 85 100 85"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.3"
        />

        {/* Graduation Cap */}
        <path
          d="M100 30L150 50L100 70L50 50L100 30Z"
          fill="#fff"
          stroke="#8b5cf6"
          strokeWidth="2"
        />
        <path
          d="M70 58V75C70 75 85 85 100 85C115 85 130 75 130 75V58"
          stroke="#fff"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M150 50V75"
          stroke="#fff"
          strokeWidth="2"
        />
        <circle cx="150" cy="75" r="4" fill="#fff" />
      </svg>
    </div>
  );
};

export default AuthLogo;
