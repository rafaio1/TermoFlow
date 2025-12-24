import React from 'react';

type Props = {
  name: string;
  title?: string;
  size?: number;
  filled?: boolean;
  className?: string;
};

export default function MaterialIcon({ name, title, size = 20, filled = false, className }: Props) {
  const ariaProps = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true };

  return (
    <span
      {...ariaProps}
      className={`tf-micon material-symbols-rounded${className ? ` ${className}` : ''}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      }}
    >
      {name}
    </span>
  );
}

