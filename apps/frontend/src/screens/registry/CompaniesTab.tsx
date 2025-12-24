import React, { useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Table } from 'antd';

import {
  Company,
  CompanyGroup,
  Group,
  Organization,
  createCompany,
  deleteCompany,
  updateCompany
} from '../../controllers/registry';
import { formatDate, renderStatusTag } from './ui';

type Props = {
  tenantId: string;
  companies: Company[];
  companyGroups: CompanyGroup[];
  organizations: Organization[];
  groups: Group[];
  canUseOrganizations: boolean;
  canUseGroups: boolean;
  onChanged: () => void;
};

export default function CompaniesTab({
  tenantId,
  companies,
  companyGroups,
  organizations,
  groups,
  canUseOrganizations,
  canUseGroups,
  onChanged
}: Props) {
  const [modal, setModal] = useState<{ open: boolean; editing: Company | null }>({
    open: false,
    editing: null
  });
  const [form] = Form.useForm();

  const groupIdsForCompany = (companyId: string) =>
    companyGroups.filter(cg => cg.companyId === companyId).map(cg => cg.groupId);

  const openModal = (editing?: Company) => {
    setModal({ open: true, editing: editing || null });
    form.setFieldsValue(
      editing
        ? {
            tradeName: editing.tradeName,
            code: editing.code,
            legalName: editing.legalName,
            taxId: editing.taxId,
            organizationId: editing.organizationId,
            groupIds: groupIdsForCompany(editing.id),
            status: editing.status
          }
        : {
            tradeName: '',
            code: null,
            legalName: null,
            taxId: null,
            organizationId: null,
            groupIds: [],
            status: 'ACTIVE'
          }
    );
  };

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => openModal()}>
          Criar empresa
        </Button>
      </Space>

      <Table
        rowKey="id"
        pagination={{ pageSize: 8 }}
        dataSource={companies}
        columns={[
          { title: 'Código', dataIndex: 'code', key: 'code' },
          { title: 'Nome', dataIndex: 'tradeName', key: 'tradeName' },
          { title: 'Tax ID', dataIndex: 'taxId', key: 'taxId' },
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
          ...(canUseGroups
            ? [
                {
                  title: 'Grupos',
                  key: 'groupIds',
                  render: (_: any, row: Company) => {
                    const ids = groupIdsForCompany(row.id);
                    if (!ids.length) return '-';
                    return ids
                      .map(id => {
                        const group = groups.find(g => g.id === id);
                        return group ? group.name : id;
                      })
                      .join(', ');
                  }
                }
              ]
            : []),
          { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => renderStatusTag(v) },
          { title: 'Atualizado', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => formatDate(v) },
          {
            title: 'Ações',
            key: 'actions',
            render: (_: any, row: Company) => (
              <Space>
                <Button size="small" onClick={() => openModal(row)}>
                  Editar
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() =>
                    Modal.confirm({
                      title: 'Remover empresa?',
                      content: `Isso vai desativar/remover a empresa "${row.tradeName}".`,
                      okText: 'Remover',
                      okButtonProps: { danger: true },
                      cancelText: 'Cancelar',
                      onOk: () => {
                        deleteCompany(tenantId, row.id);
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
        title={modal.editing ? 'Editar empresa' : 'Criar empresa'}
        okText="Salvar"
        cancelText="Cancelar"
        onCancel={() => setModal({ open: false, editing: null })}
        onOk={async () => {
          const values = await form.validateFields();
          if (!canUseOrganizations) values.organizationId = null;
          if (!canUseGroups) values.groupIds = [];

          if (modal.editing) updateCompany(tenantId, modal.editing.id, values);
          else createCompany(tenantId, values);

          setModal({ open: false, editing: null });
          onChanged();
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="Código">
            <Input />
          </Form.Item>
          <Form.Item name="tradeName" label="Nome" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="legalName" label="Razão social">
            <Input />
          </Form.Item>
          <Form.Item name="taxId" label="Tax ID (CNPJ/CPF)">
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
          {canUseGroups ? (
            <Form.Item name="groupIds" label="Grupos">
              <Select mode="multiple" allowClear placeholder="Selecione">
                {groups.map(g => (
                  <Select.Option key={g.id} value={g.id}>
                    {g.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          ) : null}
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
