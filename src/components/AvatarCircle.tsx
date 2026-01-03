'use client';

import { useState } from 'react';

interface AvatarCircleProps {
  name: string;
  initials?: string;
  color?: string;
  imagePath?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
}

// Sizes based on 8px scale
const sizeConfig = {
  xs: { size: 28, text: 10 },   // 28px - Extra small for inline use
  sm: { size: 40, text: 14 },   // 40px
  md: { size: 56, text: 18 },   // 56px
  lg: { size: 88, text: 28 },   // 88px - Primary size for grid
  xl: { size: 112, text: 36 },  // 112px
};

export function AvatarCircle({
  name,
  initials,
  color = '#b8860b',
  imagePath,
  size = 'lg',
  className = '',
  onClick,
  interactive = true,
}: AvatarCircleProps) {
  const [imageError, setImageError] = useState(false);
  const displayInitials = initials || name.substring(0, 2).toUpperCase();
  const config = sizeConfig[size];

  const Component = onClick && interactive ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`
        rounded-full flex items-center justify-center
        font-serif font-semibold
        transition-all duration-200 ease-out
        ${interactive && onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2
        ${className}
      `}
      style={{
        width: `${config.size}px`,
        height: `${config.size}px`,
        fontSize: `${config.text}px`,
        backgroundColor: imagePath && !imageError ? 'transparent' : color,
        color: '#fff',
        textShadow: '0 1px 2px rgba(0,0,0,0.15)',
        boxShadow: interactive && onClick ? 'var(--shadow-md)' : 'var(--shadow-sm)',
      }}
      aria-label={onClick ? `View prayers for ${name}` : name}
    >
      {imagePath && !imageError ? (
        <img
          src={imagePath}
          alt={name}
          className="w-full h-full rounded-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="select-none">{displayInitials}</span>
      )}
    </Component>
  );
}
