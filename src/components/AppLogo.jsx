import React from 'react';

export default function AppLogo({ className = "w-10 h-10" }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 100 100" 
      fill="none" 
      className={className}
    >
      <defs>
        <linearGradient id="ezpos-logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" /> {/* cyan-500 */}
          <stop offset="100%" stopColor="#3b82f6" /> {/* blue-500 */}
        </linearGradient>
      </defs>
      
      {/* Outer receipt paper shape with an E-like cutout */}
      <path 
        d="M30 75 V25 A10 10 0 0 1 40 15 H60 A10 10 0 0 1 70 25 V35 A5 5 0 0 1 65 40 H45 A5 5 0 0 0 40 45 V45 A5 5 0 0 0 45 50 H60 A5 5 0 0 1 65 55 V65" 
        stroke="url(#ezpos-logo-gradient)" 
        strokeWidth="8" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      {/* Bottom detached line of the E */}
      <path 
        d="M40 65 H55" 
        stroke="url(#ezpos-logo-gradient)" 
        strokeWidth="8" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      {/* Receipt bottom zig-zag */}
      <path 
        d="M30 75 Q35 80 40 75 T50 75 T60 75" 
        stroke="url(#ezpos-logo-gradient)" 
        strokeWidth="8" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <path 
        d="M60 75 V55" 
        stroke="url(#ezpos-logo-gradient)" 
        strokeWidth="8" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </svg>
  );
}
