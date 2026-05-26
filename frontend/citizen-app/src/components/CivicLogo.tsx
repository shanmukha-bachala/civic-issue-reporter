import React from 'react';

interface CivicLogoProps {
  className?: string;
  size?: number;
}

const CivicLogo: React.FC<CivicLogoProps> = ({ className = '', size = 64 }) => {
  return (
    <div className={`inline-block ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="Civic Issues Platform Logo">
        {/* Outer circle */}
        <circle cx="100" cy="100" r="95" fill="none" stroke="#1e3a8a" strokeWidth="6"/>
        
        {/* Background buildings */}
        <g transform="translate(100,100) scale(0.8)">
          {/* Buildings with various heights */}
          <rect x="-80" y="-40" width="15" height="50" fill="#059669"/>
          <rect x="-60" y="-60" width="12" height="70" fill="#0891b2"/>
          <rect x="-45" y="-35" width="10" height="45" fill="#059669"/>
          <rect x="-32" y="-50" width="14" height="60" fill="#0891b2"/>
          <rect x="-15" y="-65" width="18" height="75" fill="#047857"/>
          <rect x="5" y="-30" width="12" height="40" fill="#0891b2"/>
          <rect x="20" y="-55" width="15" height="65" fill="#059669"/>
          <rect x="40" y="-45" width="13" height="55" fill="#0891b2"/>
          <rect x="58" y="-70" width="16" height="80" fill="#047857"/>
          
          {/* Street lights */}
          <g fill="#6b7280" stroke="#374151" strokeWidth="1">
            <line x1="-70" y1="10" x2="-70" y2="-20"/>
            <circle cx="-70" cy="-20" r="2"/>
            <line x1="-25" y1="10" x2="-25" y2="-25"/>
            <circle cx="-25" cy="-25" r="2"/>
            <line x1="15" y1="10" x2="15" y2="-18"/>
            <circle cx="15" cy="-18" r="2"/>
            <line x1="50" y1="10" x2="50" y2="-28"/>
            <circle cx="50" cy="-28" r="2"/>
          </g>
          
          {/* Road with curve */}
          <path d="M -80 10 Q -20 20 0 10 Q 30 0 80 10" fill="#374151" stroke="none"/>
          <path d="M -75 13 Q -18 23 3 13 Q 33 3 75 13" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="8,4"/>
          <path d="M -75 7 Q -22 17 -3 7 Q 27 -3 75 7" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="8,4"/>
        </g>
        
        {/* Handshake at bottom */}
        <g transform="translate(100,160) scale(0.6)">
          {/* Left hand */}
          <path d="M -25 -10 Q -30 -5 -28 0 L -20 8 Q -15 12 -10 10 L 0 5" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1"/>
          {/* Right hand */}
          <path d="M 25 -10 Q 30 -5 28 0 L 20 8 Q 15 12 10 10 L 0 5" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1"/>
          {/* Fingers interlocked */}
          <ellipse cx="0" cy="5" rx="12" ry="8" fill="#d6d3d1" stroke="#a8a29e" strokeWidth="1"/>
        </g>
      </svg>
    </div>
  );
};

export default CivicLogo;