import React from 'react';
import { Table } from 'antd';

import { AuditLogEntry } from '../../controllers/registry';
import { formatDate } from './ui';

type Props = {
  logs: AuditLogEntry[];
};

export default function AuditTab({ logs }: Props) {
  return (
    <Table
      rowKey="id"
      pagination={{ pageSize: 10 }}
      dataSource={logs}
      columns={[
        { title: 'Quando', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => formatDate(v) },
        { title: 'Ação', dataIndex: 'action', key: 'action' },
        { title: 'Entidade', dataIndex: 'entityType', key: 'entityType' },
        { title: 'Entity ID', dataIndex: 'entityId', key: 'entityId' }
      ]}
    />
  );
}

