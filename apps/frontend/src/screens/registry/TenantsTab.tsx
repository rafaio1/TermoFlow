import React, { useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Table } from 'antd';

import { Tenant, createTenant, deleteTenant, updateTenant } from '../../controllers/registry';
import { formatDate, renderStatusTag } from './ui';

type Props = {
  tenants: Tenant[];
  onChanged: () => void;
};

export default function TenantsTab({ tenants, onChanged }: Props) {
  const [modal, setModal] = useState<{ open: boolean; editing: Tenant | null }>({
    open: false,
    editing: null
  });
  const [form] = Form.useForm();

  const openModal = (editing?: Tenant) => {
    setModal({ open: true, editing: editing || null });
    form.setFieldsValue(
      editing
        ? { name: editing.name, status: editing.status, primaryDomain: editing.primaryDomain }
        : { name: '', status: 'ACTIVE', primaryDomain: null }
    );
  };

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => openModal()}>
          Criar tenant
        </Button>
      </Space>

      <Table
        rowKey="id"
        pagination={{ pageSize: 8 }}
        dataSource={tenants}
        columns={[
          { title: 'Nome', dataIndex: 'name', key: 'name' },
          { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => renderStatusTag(v) },
          { title: 'Domínio', dataIndex: 'primaryDomain', key: 'primaryDomain' },
          { title: 'Atualizado', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => formatDate(v) },
          {
            title: 'Ações',
            key: 'actions',
            render: (_: any, row: Tenant) => (
              <Space>
                <Button size="small" onClick={() => openModal(row)}>
                  Editar
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() =>
                    Modal.confirm({
                      title: 'Remover tenant?',
                      content: `Isso vai suspender/remover "${row.name}".`,
                      okText: 'Remover',
                      okButtonProps: { danger: true },
                      cancelText: 'Cancelar',
                      onOk: () => {
                        deleteTenant(row.id);
                        onChanged();
                      }
                    })
                  }
                >
                  Remover
                </Button>
              </Space>
            )
          }
        ]}
      />

      <Modal
        visible={modal.open}
        title={modal.editing ? 'Editar tenant' : 'Criar tenant'}
        okText="Salvar"
        cancelText="Cancelar"
        onCancel={() => setModal({ open: false, editing: null })}
        onOk={async () => {
          const values = await form.validateFields();
          if (modal.editing) updateTenant(modal.editing.id, values);
          else createTenant(values);
          setModal({ open: false, editing: null });
          onChanged();
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Nome" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="primaryDomain" label="Domínio primário">
            <Input placeholder="ex.: cliente.com.br" />
          </Form.Item>
          <Form.Item name="status" label="Status" initialValue="ACTIVE">
            <Select>
              <Select.Option value="ACTIVE">ACTIVE</Select.Option>
              <Select.Option value="SUSPENDED">SUSPENDED</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
