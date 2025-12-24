import React from 'react';
import { Typography, Space } from 'antd';

type Props = {
  title?: React.ReactNode;
  subTitle?: React.ReactNode;
  extra?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

const PageHeader: React.FC<Props> = ({ title, subTitle, extra, className, style }) => {
  return (
    <div className={className} style={{ padding: '8px 0 16px', ...style }}>
      <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
        <div>
          {title ? (
            <Typography.Title level={3} style={{ margin: 0 }}>
              {title}
            </Typography.Title>
          ) : null}
          {subTitle ? (
            <Typography.Text type="secondary" style={{ display: 'block' }}>
              {subTitle}
            </Typography.Text>
          ) : null}
        </div>
        {extra ? <div>{extra}</div> : null}
      </Space>
    </div>
  );
};

export default PageHeader;
