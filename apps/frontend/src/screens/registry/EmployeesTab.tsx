import React, { useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Table } from 'antd';

import {
  Company,
  Employee,
  JobFunction,
  User,
  createEmployee,
  deleteEmployee,
  updateEmployee
} from '../../controllers/registry';
import { formatDate, renderStatusTag } from './ui';

type Props = {
  tenantId: string;
  employees: Employee[];
  companies: Company[];
  users: User[];
  jobFunctions: JobFunction[];
  onChanged: () => void;
};

export default function EmployeesTab({ tenantId, employees, companies, users, jobFunctions, onChanged }: Props) {
  const [modal, setModal] = useState<{ open: boolean; editing: Employee | null }>({
    open: false,
    editing: null
  });
  const [form] = Form.useForm();

  const openModal = (editing?: Employee) => {
    setModal({ open: true, editing: editing || null });
    form.setFieldsValue(
      editing
        ? {
            companyId: editing.companyId,
            userId: editing.userId,
            jobFunctionId: editing.jobFunctionId,
            name: editing.name,
            document: editing.document,
            email: editing.email,
            phone: editing.phone,
            status: editing.status
          }
        : {
            companyId: null,
            userId: null,
            jobFunctionId: null,
            name: '',
            document: '',
            email: null,
            phone: null,
            status: 'ACTIVE'
          }
    );
  };

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => openModal()}>
          Criar funcionário
        </Button>
      </Space>

      <Table
        rowKey="id"
        pagination={{ pageSize: 8 }}
        dataSource={employees}
        columns={[
          {
            title: 'Empresa',
            dataIndex: 'companyId',
            key: 'companyId',
            render: (value: string) => {
              const company = companies.find(c => c.id === value);
              return company ? company.tradeName : value;
            }
          },
          { title: 'Nome', dataIndex: 'name', key: 'name' },
          { title: 'Documento', dataIndex: 'document', key: 'document' },
          { title: 'Email', dataIndex: 'email', key: 'email', render: (v: string | null) => v || '-' },
          { title: 'Telefone', dataIndex: 'phone', key: 'phone', render: (v: string | null) => v || '-' },
          {
            title: 'Login',
            dataIndex: 'userId',
            key: 'userId',
            render: (value: string | null) => {
              if (!value) return '-';
              const user = users.find(u => u.id === value);
              return user ? user.email : value;
            }
          },
          {
            title: 'Cargo',
            dataIndex: 'jobFunctionId',
            key: 'jobFunctionId',
            render: (value: string | null) => {
              if (!value) return '-';
              const job = jobFunctions.find(j => j.id === value);
              return job ? job.name : value;
            }
          },
          { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => renderStatusTag(v) },
          { title: 'Atualizado', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => formatDate(v) },
          {
            title: 'Ações',
            key: 'actions',
            render: (_: any, row: Employee) => (
              <Space>
                <Button size="small" onClick={() => openModal(row)}>
                  Editar
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() =>
                    Modal.confirm({
                      title: 'Remover funcionário?',
                      content: `Isso vai desativar/remover "${row.name}".`,
                      okText: 'Remover',
                      okButtonProps: { danger: true },
                      cancelText: 'Cancelar',
                      onOk: () => {
                        deleteEmployee(tenantId, row.id);
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
        title={modal.editing ? 'Editar funcionário' : 'Criar funcionário'}
        okText="Salvar"
        cancelText="Cancelar"
        onCancel={() => setModal({ open: false, editing: null })}
        onOk={async () => {
          const values = await form.validateFields();
          if (modal.editing) updateEmployee(tenantId, modal.editing.id, values);
          else createEmployee(tenantId, values);
          setModal({ open: false, editing: null });
          onChanged();
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="companyId" label="Empresa" rules={[{ required: true }]}>
            <Select placeholder="Selecione">
              {companies
                .filter(c => c.deletedAt === null)
                .map(c => (
                  <Select.Option key={c.id} value={c.id}>
                    {c.tradeName}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item name="name" label="Nome" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="document" label="Documento (CPF)" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Telefone">
            <Input />
          </Form.Item>
          <Form.Item name="userId" label="Usuário (login)">
            <Select allowClear placeholder="Selecione">
              {users
                .filter(u => u.deletedAt === null)
                .map(u => (
                  <Select.Option key={u.id} value={u.id}>
                    {u.email}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item name="jobFunctionId" label="Cargo">
            <Select allowClear placeholder="Selecione">
              {jobFunctions
                .filter(j => j.deletedAt === null)
                .map(j => (
                  <Select.Option key={j.id} value={j.id}>
                    {j.name}
                  </Select.Option>
                ))}
            </Select>
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

