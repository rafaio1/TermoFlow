import React, { useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Table, Tag } from 'antd';

import {
  Permission,
  Role,
  RolePermission,
  createRole,
  deleteRole,
  setRolePermissions,
  updateRole
} from '../../controllers/registry';
import { formatDate } from './ui';

type Props = {
  tenantId: string;
  roles: Role[];
  permissions: Permission[];
  rolePermissions: RolePermission[];
  onChanged: () => void;
};

export default function RolesTab({ tenantId, roles, permissions, rolePermissions, onChanged }: Props) {
  const [modal, setModal] = useState<{ open: boolean; editing: Role | null }>({
    open: false,
    editing: null
  });
  const [form] = Form.useForm();

  const permissionIdsForRole = (roleId: string) =>
    rolePermissions.filter(rp => rp.roleId === roleId).map(rp => rp.permissionId);

  const permissionCountForRole = (roleId: string) =>
    rolePermissions.filter(rp => rp.roleId === roleId).length;

  const openModal = (editing?: Role) => {
    setModal({ open: true, editing: editing || null });
    form.setFieldsValue(
      editing
        ? {
            name: editing.name,
            scope: editing.scope,
            permissionIds: permissionIdsForRole(editing.id)
          }
        : { name: '', scope: 'TENANT', permissionIds: [] }
    );
  };

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => openModal()}>
          Criar role
        </Button>
      </Space>

      <Table
        rowKey="id"
        pagination={{ pageSize: 8 }}
        dataSource={roles}
        columns={[
          {
            title: 'Nome',
            dataIndex: 'name',
            key: 'name',
            render: (value: string, row: Role) => (
              <Space>
                <span>{value}</span>
                {row.isSystem ? <Tag>system</Tag> : null}
              </Space>
            )
          },
          { title: 'Scope', dataIndex: 'scope', key: 'scope' },
          { title: 'Permissões', key: 'permissions', render: (_: any, row: Role) => permissionCountForRole(row.id) },
          { title: 'Atualizado', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => formatDate(v) },
          {
            title: 'Ações',
            key: 'actions',
            render: (_: any, row: Role) => (
              <Space>
                <Button size="small" onClick={() => openModal(row)}>
                  Editar
                </Button>
                <Button
                  size="small"
                  danger
                  disabled={row.isSystem}
                  onClick={() =>
                    Modal.confirm({
                      title: 'Remover role?',
                      content: `Isso vai desativar/remover a role "${row.name}".`,
                      okText: 'Remover',
                      okButtonProps: { danger: true },
                      cancelText: 'Cancelar',
                      onOk: () => {
                        deleteRole(tenantId, row.id);
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
        title={modal.editing ? 'Editar role' : 'Criar role'}
        okText="Salvar"
        cancelText="Cancelar"
        onCancel={() => setModal({ open: false, editing: null })}
        onOk={async () => {
          const values = await form.validateFields();

          if (modal.editing) {
            if (!modal.editing.isSystem) {
              updateRole(tenantId, modal.editing.id, { name: values.name, scope: values.scope });
            }
            setRolePermissions(tenantId, modal.editing.id, values.permissionIds || []);
          } else {
            const role = createRole(tenantId, { name: values.name, scope: values.scope });
            setRolePermissions(tenantId, role.id, values.permissionIds || []);
          }

          setModal({ open: false, editing: null });
          onChanged();
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Nome" rules={[{ required: true }]}>
            <Input disabled={!!(modal.editing && modal.editing.isSystem)} />
          </Form.Item>
          <Form.Item name="scope" label="Scope" initialValue="TENANT">
            <Select disabled={!!(modal.editing && modal.editing.isSystem)}>
              <Select.Option value="TENANT">TENANT</Select.Option>
              <Select.Option value="ORGANIZATION">ORGANIZATION</Select.Option>
              <Select.Option value="COMPANY">COMPANY</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="permissionIds" label="Permissões">
            <Select mode="multiple" allowClear placeholder="Selecione">
              {permissions.map(p => (
                <Select.Option key={p.id} value={p.id}>
                  {p.key}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
