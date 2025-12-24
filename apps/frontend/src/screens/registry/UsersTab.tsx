import React, { useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Table, Tag } from 'antd';

import { User, actAsUser, createUser, deleteUser, updateUser } from '../../controllers/registry';
import { formatDate, renderStatusTag } from './ui';

type Props = {
  tenantId: string;
  users: User[];
  currentUserId: string | null;
  onChanged: () => void;
};

export default function UsersTab({ tenantId, users, currentUserId, onChanged }: Props) {
  const [modal, setModal] = useState<{ open: boolean; editing: User | null }>({
    open: false,
    editing: null
  });
  const [form] = Form.useForm();

  const openModal = (editing?: User) => {
    setModal({ open: true, editing: editing || null });
    form.setFieldsValue(
      editing
        ? {
            email: editing.email,
            name: editing.name,
            status: editing.status,
            authProvider: editing.authProvider,
            passwordHash: editing.passwordHash
          }
        : {
            email: '',
            name: '',
            status: 'INVITED',
            authProvider: null,
            passwordHash: null
          }
    );
  };

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => openModal()}>
          Criar usuário
        </Button>
      </Space>

      <Table
        rowKey="id"
        pagination={{ pageSize: 8 }}
        dataSource={users}
        columns={[
          { title: 'Email', dataIndex: 'email', key: 'email' },
          {
            title: 'Nome',
            dataIndex: 'name',
            key: 'name',
            render: (value: string, row: User) => (
              <Space>
                <span>{value}</span>
                {row.id === currentUserId ? <Tag color="gold">Atual</Tag> : null}
              </Space>
            )
          },
          { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => renderStatusTag(v) },
          {
            title: 'Auth',
            key: 'auth',
            render: (_: any, row: User) => row.authProvider || (row.passwordHash ? 'LOCAL' : '-')
          },
          {
            title: 'Último login',
            dataIndex: 'lastLoginAt',
            key: 'lastLoginAt',
            render: (v: string | null) => (v ? formatDate(v) : '-')
          },
          { title: 'Atualizado', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => formatDate(v) },
          {
            title: 'Ações',
            key: 'actions',
            render: (_: any, row: User) => (
              <Space>
                <Button size="small" onClick={() => openModal(row)}>
                  Editar
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    actAsUser(tenantId, row.id);
                    onChanged();
                  }}
                >
                  Atuar como
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() =>
                    Modal.confirm({
                      title: 'Remover usuário?',
                      content: `Isso vai bloquear/remover "${row.email}".`,
                      okText: 'Remover',
                      okButtonProps: { danger: true },
                      cancelText: 'Cancelar',
                      onOk: () => {
                        deleteUser(tenantId, row.id);
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
        title={modal.editing ? 'Editar usuário' : 'Criar usuário'}
        okText="Salvar"
        cancelText="Cancelar"
        onCancel={() => setModal({ open: false, editing: null })}
        onOk={async () => {
          const values = await form.validateFields();
          if (modal.editing) updateUser(tenantId, modal.editing.id, values);
          else createUser(tenantId, values);
          setModal({ open: false, editing: null });
          onChanged();
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="email" label="Email" rules={[{ required: true }]}>
            <Input placeholder="ex.: usuario@empresa.com" />
          </Form.Item>
          <Form.Item name="name" label="Nome" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="status" label="Status" initialValue="INVITED">
            <Select>
              <Select.Option value="ACTIVE">ACTIVE</Select.Option>
              <Select.Option value="INVITED">INVITED</Select.Option>
              <Select.Option value="BLOCKED">BLOCKED</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="authProvider" label="Auth provider (SSO, opcional)">
            <Input placeholder="ex.: google, azuread" />
          </Form.Item>
          <Form.Item name="passwordHash" label="Password hash (auth local, opcional)">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

