import React, { useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Table } from 'antd';

import { Organization, createOrganization, deleteOrganization, updateOrganization } from '../../controllers/registry';
import { formatDate, renderStatusTag } from './ui';

type Props = {
  tenantId: string;
  organizations: Organization[];
  onChanged: () => void;
};

export default function OrganizationsTab({ tenantId, organizations, onChanged }: Props) {
  const [modal, setModal] = useState<{ open: boolean; editing: Organization | null }>({
    open: false,
    editing: null
  });
  const [form] = Form.useForm();

  const openModal = (editing?: Organization) => {
    setModal({ open: true, editing: editing || null });
    form.setFieldsValue(
      editing
        ? { name: editing.name, code: editing.code, status: editing.status }
        : { name: '', code: null, status: 'ACTIVE' }
    );
  };

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => openModal()}>
          Criar organização
        </Button>
      </Space>

      <Table
        rowKey="id"
        pagination={{ pageSize: 8 }}
        dataSource={organizations}
        columns={[
          { title: 'Código', dataIndex: 'code', key: 'code' },
          { title: 'Nome', dataIndex: 'name', key: 'name' },
          { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => renderStatusTag(v) },
          { title: 'Atualizado', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => formatDate(v) },
          {
            title: 'Ações',
            key: 'actions',
            render: (_: any, row: Organization) => (
              <Space>
                <Button size="small" onClick={() => openModal(row)}>
                  Editar
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() =>
                    Modal.confirm({
                      title: 'Remover organização?',
                      content: `Isso vai remover "${row.name}".`,
                      okText: 'Remover',
                      okButtonProps: { danger: true },
                      cancelText: 'Cancelar',
                      onOk: () => {
                        deleteOrganization(tenantId, row.id);
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
        title={modal.editing ? 'Editar organização' : 'Criar organização'}
        okText="Salvar"
        cancelText="Cancelar"
        onCancel={() => setModal({ open: false, editing: null })}
        onOk={async () => {
          const values = await form.validateFields();
          if (modal.editing) updateOrganization(tenantId, modal.editing.id, values);
          else createOrganization(tenantId, values);
          setModal({ open: false, editing: null });
          onChanged();
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="Código">
            <Input />
          </Form.Item>
          <Form.Item name="name" label="Nome" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="status" label="Status" initialValue="ACTIVE">
            <Select>
              <Select.Option value="ACTIVE">ACTIVE</Select.Option>
              <Select.Option value="INACTIVE">INACTIVE</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
