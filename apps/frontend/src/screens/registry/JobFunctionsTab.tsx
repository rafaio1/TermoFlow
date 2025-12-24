import React, { useState } from 'react';
import { Button, Form, Input, Modal, Space, Table } from 'antd';

import { JobFunction, createJobFunction, deleteJobFunction, updateJobFunction } from '../../controllers/registry';
import { formatDate } from './ui';

type Props = {
  tenantId: string;
  jobFunctions: JobFunction[];
  onChanged: () => void;
};

export default function JobFunctionsTab({ tenantId, jobFunctions, onChanged }: Props) {
  const [modal, setModal] = useState<{ open: boolean; editing: JobFunction | null }>({
    open: false,
    editing: null
  });
  const [form] = Form.useForm();

  const openModal = (editing?: JobFunction) => {
    setModal({ open: true, editing: editing || null });
    form.setFieldsValue(editing ? { name: editing.name, code: editing.code } : { name: '', code: null });
  };

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => openModal()}>
          Criar cargo
        </Button>
      </Space>

      <Table
        rowKey="id"
        pagination={{ pageSize: 8 }}
        dataSource={jobFunctions}
        columns={[
          { title: 'Código', dataIndex: 'code', key: 'code', render: (v: string | null) => v || '-' },
          { title: 'Nome', dataIndex: 'name', key: 'name' },
          { title: 'Atualizado', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => formatDate(v) },
          {
            title: 'Ações',
            key: 'actions',
            render: (_: any, row: JobFunction) => (
              <Space>
                <Button size="small" onClick={() => openModal(row)}>
                  Editar
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() =>
                    Modal.confirm({
                      title: 'Remover cargo?',
                      content: `Isso vai remover "${row.name}".`,
                      okText: 'Remover',
                      okButtonProps: { danger: true },
                      cancelText: 'Cancelar',
                      onOk: () => {
                        deleteJobFunction(tenantId, row.id);
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
        title={modal.editing ? 'Editar cargo' : 'Criar cargo'}
        okText="Salvar"
        cancelText="Cancelar"
        onCancel={() => setModal({ open: false, editing: null })}
        onOk={async () => {
          const values = await form.validateFields();
          if (modal.editing) updateJobFunction(tenantId, modal.editing.id, values);
          else createJobFunction(tenantId, values);
          setModal({ open: false, editing: null });
          onChanged();
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Nome" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="Código (opcional)">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

