import React, { useState } from 'react';
import { Button, Checkbox, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';

import {
  Company,
  Customer,
  CustomerCompanyAccess,
  createCustomer,
  deleteCustomer,
  updateCustomer
} from '../../controllers/registry';
import { formatDate, renderStatusTag } from './ui';

const { Text } = Typography;

type Props = {
  tenantId: string;
  companies: Company[];
  currentCompanyId: string | null;
  customers: Customer[];
  access: CustomerCompanyAccess[];
  onCompanySelected: (companyId: string) => void;
  onChanged: () => void;
};

export default function CustomersTab({
  tenantId,
  companies,
  currentCompanyId,
  customers,
  access,
  onCompanySelected,
  onChanged
}: Props) {
  const [modal, setModal] = useState<{ open: boolean; editing: Customer | null }>({
    open: false,
    editing: null
  });
  const [form] = Form.useForm();

  const companiesById = new Map(companies.map(c => [c.id, c]));

  const companyNamesForCustomer = (customerId: string) => {
    const ids = access.filter(a => a.customerId === customerId).map(a => a.companyId);
    if (!ids.length) return '-';
    return ids
      .map(id => {
        const company = companiesById.get(id);
        return company ? company.tradeName : id;
      })
      .join(', ');
  };

  const openModal = (editing?: Customer) => {
    const companyIds = editing ? access.filter(a => a.customerId === editing.id).map(a => a.companyId) : [];
    setModal({ open: true, editing: editing || null });
    form.setFieldsValue(
      editing
        ? {
            name: editing.name,
            documentType: editing.documentType,
            documentNumber: editing.documentNumber,
            email: editing.email,
            phone: editing.phone,
            status: editing.status,
            isShared: editing.isShared,
            companyIds: editing.isShared ? [] : companyIds
          }
        : {
            name: '',
            documentType: 'CNPJ',
            documentNumber: '',
            email: null,
            phone: null,
            status: 'ACTIVE',
            isShared: false,
            companyIds: currentCompanyId ? [currentCompanyId] : []
          }
    );
  };

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Text type="secondary">Empresa:</Text>
        <Select
          style={{ minWidth: 260 }}
          value={currentCompanyId || undefined}
          placeholder="Selecione"
          onChange={(value: string) => onCompanySelected(value)}
        >
          {companies
            .filter(c => c.deletedAt === null)
            .map(c => (
              <Select.Option key={c.id} value={c.id}>
                {c.tradeName}
              </Select.Option>
            ))}
        </Select>

        <Button type="primary" disabled={!currentCompanyId} onClick={() => openModal()}>
          Criar cliente
        </Button>
      </Space>

      {!currentCompanyId ? (
        <Text type="secondary">Selecione uma empresa para ver os clientes visíveis.</Text>
      ) : (
        <Table
          rowKey="id"
          pagination={{ pageSize: 8 }}
          dataSource={customers}
          columns={[
            { title: 'Nome', dataIndex: 'name', key: 'name' },
            {
              title: 'Documento',
              key: 'document',
              render: (_: any, row: Customer) => `${row.documentType} ${row.documentNumber}`
            },
            {
              title: 'Visibilidade',
              key: 'visibility',
              render: (_: any, row: Customer) => (row.isShared ? <Tag color="blue">shared</Tag> : <Tag>restrito</Tag>)
            },
            {
              title: 'Acesso empresas',
              key: 'companyAccess',
              render: (_: any, row: Customer) => (row.isShared ? 'Todas' : companyNamesForCustomer(row.id))
            },
            { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => renderStatusTag(v) },
            { title: 'Atualizado', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => formatDate(v) },
            {
              title: 'Ações',
              key: 'actions',
              render: (_: any, row: Customer) => (
                <Space>
                  <Button size="small" onClick={() => openModal(row)}>
                    Editar
                  </Button>
                  <Button
                    size="small"
                    danger
                    onClick={() =>
                      Modal.confirm({
                        title: 'Remover cliente?',
                        content: `Isso vai desativar/remover "${row.name}".`,
                        okText: 'Remover',
                        okButtonProps: { danger: true },
                        cancelText: 'Cancelar',
                        onOk: () => {
                          deleteCustomer(tenantId, row.id);
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
      )}

      <Modal
        visible={modal.open}
        title={modal.editing ? 'Editar cliente' : 'Criar cliente'}
        okText="Salvar"
        cancelText="Cancelar"
        onCancel={() => setModal({ open: false, editing: null })}
        onOk={async () => {
          const values = await form.validateFields();
          if (values.isShared) values.companyIds = [];
          if (modal.editing) updateCustomer(tenantId, modal.editing.id, values);
          else createCustomer(tenantId, values);
          setModal({ open: false, editing: null });
          onChanged();
        }}
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(changed: any) => {
            if (changed.isShared) {
              form.setFieldsValue({ companyIds: [] });
            } else if (changed.isShared === false && currentCompanyId) {
              const current = form.getFieldValue('companyIds') || [];
              if (!current.length) form.setFieldsValue({ companyIds: [currentCompanyId] });
            }
          }}
        >
          <Form.Item name="name" label="Nome" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="documentType" label="Tipo de documento" rules={[{ required: true }]} initialValue="CNPJ">
            <Select>
              <Select.Option value="CPF">CPF</Select.Option>
              <Select.Option value="CNPJ">CNPJ</Select.Option>
              <Select.Option value="OUTRO">OUTRO</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="documentNumber" label="Número do documento" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Telefone">
            <Input />
          </Form.Item>
          <Form.Item name="status" label="Status" initialValue="ACTIVE">
            <Select>
              <Select.Option value="ACTIVE">ACTIVE</Select.Option>
              <Select.Option value="INACTIVE">INACTIVE</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="isShared" valuePropName="checked">
            <Checkbox>Shared (visível para todas as empresas)</Checkbox>
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {() => {
              const isShared = !!form.getFieldValue('isShared');
              if (isShared) return null;
              return (
                <Form.Item name="companyIds" label="Empresas com acesso">
                  <Select mode="multiple" allowClear placeholder="Selecione">
                    {companies
                      .filter(c => c.deletedAt === null)
                      .map(c => (
                        <Select.Option key={c.id} value={c.id}>
                          {c.tradeName}
                        </Select.Option>
                      ))}
                  </Select>
                </Form.Item>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

