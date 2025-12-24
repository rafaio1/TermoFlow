import React, { useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Table } from 'antd';

import { Group, Organization, createGroup, deleteGroup, updateGroup } from '../../controllers/registry';

type Props = {
  tenantId: string;
  groups: Group[];
  organizations: Organization[];
  canUseOrganizations: boolean;
  onChanged: () => void;
};

export default function GroupsTab({
  tenantId,
  groups,
  organizations,
  canUseOrganizations,
  onChanged
}: Props) {
  const [modal, setModal] = useState<{ open: boolean; editing: Group | null }>({
    open: false,
    editing: null
  });
  const [form] = Form.useForm();

  const openModal = (editing?: Group) => {
    setModal({ open: true, editing: editing || null });
    form.setFieldsValue(
      editing
        ? {
            name: editing.name,
            code: editing.code,
            organizationId: editing.organizationId,
          }
        : { name: '', code: null, organizationId: null }
    );
  };

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => openModal()}>
          Criar grupo
        </Button>
      </Space>

      <Table
        rowKey="id"
        pagination={{ pageSize: 8 }}
        dataSource={groups}
        columns={[
          { title: 'Código', dataIndex: 'code', key: 'code' },
          { title: 'Nome', dataIndex: 'name', key: 'name' },
          ...(canUseOrganizations
            ? [
                {
                  title: 'Organização',
                  dataIndex: 'organizationId',
                  key: 'organizationId',
                  render: (value: string | null) => {
                    const org = organizations.find(o => o.id === value);
                    return org ? org.name : '-';
                  }
                }
              ]
            : []),
          {
            title: 'Ações',
            key: 'actions',
            render: (_: any, row: Group) => (
              <Space>
                <Button size="small" onClick={() => openModal(row)}>
                  Editar
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() =>
                    Modal.confirm({
                      title: 'Remover grupo?',
                      content: `Isso vai remover "${row.name}".`,
                      okText: 'Remover',
                      okButtonProps: { danger: true },
                      cancelText: 'Cancelar',
                      onOk: () => {
                        deleteGroup(tenantId, row.id);
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
        title={modal.editing ? 'Editar grupo' : 'Criar grupo'}
        okText="Salvar"
        cancelText="Cancelar"
        onCancel={() => setModal({ open: false, editing: null })}
        onOk={async () => {
          const values = await form.validateFields();
          if (modal.editing) updateGroup(tenantId, modal.editing.id, values);
          else createGroup(tenantId, values);
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
          {canUseOrganizations ? (
            <Form.Item name="organizationId" label="Organização">
              <Select allowClear placeholder="Selecione">
                {organizations.map(o => (
                  <Select.Option key={o.id} value={o.id}>
                    {o.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </>
  );
}
