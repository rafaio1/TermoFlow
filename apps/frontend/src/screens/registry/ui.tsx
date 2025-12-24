import React from 'react';
import { Tag } from 'antd';

export function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch (_err) {
    return value;
  }
}

export function renderStatusTag(status: string) {
  const color =
    status === 'ACTIVE'
      ? 'green'
      : status === 'INVITED'
        ? 'blue'
        : status === 'BLOCKED'
          ? 'red'
          : status === 'SUSPENDED'
            ? 'volcano'
            : status === 'OPEN'
              ? 'blue'
              : status === 'DRAFT'
                ? 'default'
                : status === 'PARTIALLY_PAID'
                  ? 'gold'
                  : status === 'PAID'
                    ? 'green'
                    : status === 'CANCELED'
                      ? 'volcano'
                      : status === 'OVERDUE'
                        ? 'red'
            : 'default';
  return <Tag color={color}>{status}</Tag>;
}
