import React from 'react';
import { Table } from 'antd';

import { Permission } from '../../controllers/registry';

type Props = {
  permissions: Permission[];
};

export default function PermissionsTab({ permissions }: Props) {
  return (
    <Table
      rowKey="id"
      pagination={{ pageSize: 10 }}
      dataSource={permissions}
      columns={[
        { title: 'Key', dataIndex: 'key', key: 'key' },
        { title: 'Descrição', dataIndex: 'description', key: 'description' }
      ]}
    />
  );
}

