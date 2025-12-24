import React, { useMemo, useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Table, Typography } from 'antd';

import {
  CoaAccount,
  Company,
  Customer,
  FinanceSettlement,
  FinanceSettlementMethod,
  FinanceTitle,
  FinanceTitleType,
  Supplier,
  UUID,
  cancelFinanceTitle,
  createFinanceSettlement,
  createFinanceTitle,
  deleteFinanceSettlement,
  deleteFinanceTitle,
  getFinanceTitle,
  listCoaAccounts,
  listFinanceSettlementsForTitle,
  listFinanceTitles,
  updateFinanceTitle
} from '../../controllers/registry';
import { formatDate, renderStatusTag } from './ui';

const { Text } = Typography;

type Props = {
  tenantId: UUID;
  type: FinanceTitleType;
  companies: Company[];
  currentCompanyId: UUID | null;
  customers: Customer[];
  suppliers: Supplier[];
  onCompanySelected: (companyId: UUID) => void;
  onChanged: () => void;
};

function formatMoney(value: number, currency: string): string {
  const amount = typeof value === 'number' ? value : Number(value) || 0;
  try {
    return amount.toLocaleString(undefined, { style: 'currency', currency });
  } catch (_err) {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default function FinanceTitlesTab({
  tenantId,
  type,
  companies,
  currentCompanyId,
  customers,
  suppliers,
  onCompanySelected,
  onChanged
}: Props) {
  const [modal, setModal] = useState<{ open: boolean; editing: FinanceTitle | null }>({
    open: false,
    editing: null
  });
  const [settlementsModal, setSettlementsModal] = useState<{ open: boolean; titleId: UUID | null }>({
    open: false,
    titleId: null
  });

  const [form] = Form.useForm();
  const [settlementForm] = Form.useForm();

  const titles = currentCompanyId ? listFinanceTitles(tenantId, currentCompanyId, type) : [];

  const coaAccounts = currentCompanyId ? listCoaAccounts(tenantId, currentCompanyId) : [];

  const customersById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
  const suppliersById = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);
  const coaById = useMemo(() => new Map(coaAccounts.map(a => [a.id, a])), [coaAccounts]);

  const openCreateModal = (editing?: FinanceTitle) => {
    setModal({ open: true, editing: editing || null });
    form.setFieldsValue(
      editing
        ? {
            issueDate: editing.issueDate,
            dueDate: editing.dueDate,
            competenceDate: editing.competenceDate,
            amountOriginal: editing.amountOriginal,
            currency: editing.currency,
            description: editing.description,
            documentNumber: editing.documentNumber,
            installmentNumber: editing.installmentNumber,
            categoryCoaAccountId: editing.categoryCoaAccountId,
            createdFrom: editing.createdFrom,
            customerId: editing.customerId,
            supplierId: editing.supplierId
          }
        : {
            issueDate: null,
            dueDate: null,
            competenceDate: null,
            amountOriginal: 0,
            currency: 'BRL',
            description: null,
            documentNumber: null,
            installmentNumber: null,
            categoryCoaAccountId: null,
            createdFrom: 'MANUAL',
            customerId: customers[0] ? customers[0].id : null,
            supplierId: suppliers[0] ? suppliers[0].id : null
          }
    );
  };

  const openSettlementsModal = (titleId: UUID) => {
    setSettlementsModal({ open: true, titleId });
    settlementForm.setFieldsValue({ amount: 0, method: 'PIX', reference: null });
  };

  const currentTitle = (() => {
    if (!settlementsModal.open || !settlementsModal.titleId) return null;
    try {
      return getFinanceTitle(tenantId, settlementsModal.titleId);
    } catch (_err) {
      return null;
    }
  })();

  const currentSettlements = settlementsModal.open && settlementsModal.titleId
    ? listFinanceSettlementsForTitle(tenantId, settlementsModal.titleId)
    : [];

  const titleLabel = type === 'PAYABLE' ? 'Contas a Pagar (AP)' : 'Contas a Receber (AR)';
  const counterpartyLabel = type === 'PAYABLE' ? 'Fornecedor' : 'Cliente';

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Text type="secondary">Empresa:</Text>
        <Select
          style={{ minWidth: 260 }}
          value={currentCompanyId || undefined}
          placeholder="Selecione"
          onChange={(value: UUID) => onCompanySelected(value)}
        >
          {companies
            .filter(c => c.deletedAt === null)
            .map(c => (
              <Select.Option key={c.id} value={c.id}>
                {c.tradeName}
              </Select.Option>
            ))}
        </Select>

        <Button type="primary" disabled={!currentCompanyId} onClick={() => openCreateModal()}>
          Criar título
        </Button>
      </Space>

      {!currentCompanyId ? (
        <Text type="secondary">Selecione uma empresa para gerenciar {titleLabel}.</Text>
      ) : (
        <Table
          rowKey="id"
          pagination={{ pageSize: 8 }}
          dataSource={titles}
          columns={[
            {
              title: counterpartyLabel,
              key: 'counterparty',
              render: (_: any, row: FinanceTitle) => {
                if (row.type === 'PAYABLE') {
                  const supplier = row.supplierId ? suppliersById.get(row.supplierId) : null;
                  return supplier ? supplier.name : row.supplierId || '-';
                }
                const customer = row.customerId ? customersById.get(row.customerId) : null;
                return customer ? customer.name : row.customerId || '-';
              }
            },
            { title: 'Documento', dataIndex: 'documentNumber', key: 'documentNumber', render: (v: string | null) => v || '-' },
            {
              title: 'Categoria (COA)',
              key: 'category',
              render: (_: any, row: FinanceTitle) => {
                if (!row.categoryCoaAccountId) return '-';
                const account = coaById.get(row.categoryCoaAccountId);
                return account ? `${account.code} - ${account.name}` : row.categoryCoaAccountId;
              }
            },
            {
              title: 'Vencimento',
              dataIndex: 'dueDate',
              key: 'dueDate',
              render: (v: string | null) => (v ? v : '-')
            },
            {
              title: 'Valor',
              key: 'amountOriginal',
              render: (_: any, row: FinanceTitle) => formatMoney(row.amountOriginal, row.currency)
            },
            {
              title: 'Em aberto',
              key: 'amountOpen',
              render: (_: any, row: FinanceTitle) => formatMoney(row.amountOpen, row.currency)
            },
            { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => renderStatusTag(v) },
            { title: 'Atualizado', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => formatDate(v) },
            {
              title: 'Ações',
              key: 'actions',
              render: (_: any, row: FinanceTitle) => (
                <Space>
                  <Button size="small" onClick={() => openCreateModal(row)}>
                    Editar
                  </Button>
                  <Button size="small" disabled={row.status === 'CANCELED' || row.status === 'DRAFT'} onClick={() => openSettlementsModal(row.id)}>
                    Baixas
                  </Button>
                  <Button
                    size="small"
                    onClick={() =>
                      Modal.confirm({
                        title: 'Cancelar título?',
                        content: 'Isso vai cancelar o título (sem baixas).',
                        okText: 'Cancelar título',
                        okButtonProps: { danger: true },
                        cancelText: 'Voltar',
                        onOk: () => {
                          cancelFinanceTitle(tenantId, row.id);
                          onChanged();
                        }
                      })
                    }
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="small"
                    danger
                    onClick={() =>
                      Modal.confirm({
                        title: 'Remover título?',
                        content: 'Isso vai remover o título e as baixas associadas.',
                        okText: 'Remover',
                        okButtonProps: { danger: true },
                        cancelText: 'Cancelar',
                        onOk: () => {
                          deleteFinanceTitle(tenantId, row.id);
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
        title={modal.editing ? `Editar título (${titleLabel})` : `Criar título (${titleLabel})`}
        okText="Salvar"
        cancelText="Cancelar"
        onCancel={() => setModal({ open: false, editing: null })}
        onOk={async () => {
          if (!currentCompanyId) return;
          const values = await form.validateFields();
          try {
            if (modal.editing) {
              updateFinanceTitle(tenantId, modal.editing.id, values);
            } else {
              createFinanceTitle(tenantId, {
                ...values,
                companyId: currentCompanyId,
                type
              });
            }
            setModal({ open: false, editing: null });
            onChanged();
          } catch (err) {
            const e: any = err;
            Modal.error({ title: 'Erro ao salvar', content: String(e && e.message ? e.message : e) });
          }
        }}
      >
        <Form form={form} layout="vertical">
          {type === 'PAYABLE' ? (
            <Form.Item name="supplierId" label="Fornecedor" rules={[{ required: true }]}>
              <Select placeholder="Selecione">
                {suppliers
                  .filter(s => s.deletedAt === null)
                  .map(s => (
                    <Select.Option key={s.id} value={s.id}>
                      {s.name}
                    </Select.Option>
                  ))}
              </Select>
            </Form.Item>
          ) : (
            <Form.Item name="customerId" label="Cliente" rules={[{ required: true }]}>
              <Select placeholder="Selecione">
                {customers
                  .filter(c => c.deletedAt === null)
                  .map(c => (
                    <Select.Option key={c.id} value={c.id}>
                      {c.name}
                    </Select.Option>
                  ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item name="amountOriginal" label="Valor" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>

          <Form.Item name="currency" label="Moeda" initialValue="BRL" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="dueDate" label="Vencimento (ISO, ex: 2025-12-31)">
            <Input />
          </Form.Item>

          <Form.Item name="issueDate" label="Emissão (ISO, ex: 2025-12-01)">
            <Input />
          </Form.Item>

          <Form.Item name="competenceDate" label="Competência (ISO, ex: 2025-12-01)">
            <Input />
          </Form.Item>

          <Form.Item name="documentNumber" label="Documento">
            <Input />
          </Form.Item>

          <Form.Item name="installmentNumber" label="Parcela (ex: 1/12)">
            <Input />
          </Form.Item>

          <Form.Item name="createdFrom" label="Origem" initialValue="MANUAL">
            <Select>
              {(['MANUAL', 'IMPORT', 'CONTRACT', 'WHATSAPP'] as FinanceTitle['createdFrom'][]).map(v => (
                <Select.Option key={v} value={v}>
                  {v}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="categoryCoaAccountId" label="Categoria (COA)">
            <Select allowClear placeholder="(opcional)">
              {coaAccounts
                .filter((a: CoaAccount) => a.deletedAt === null && a.status === 'ACTIVE' && a.isPostable)
                .map(a => (
                  <Select.Option key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item name="description" label="Descrição">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        visible={settlementsModal.open}
        title="Baixas / Pagamentos"
        okText="Fechar"
        cancelText="Fechar"
        onCancel={() => setSettlementsModal({ open: false, titleId: null })}
        onOk={() => setSettlementsModal({ open: false, titleId: null })}
      >
        {!currentTitle ? (
          <Text type="secondary">Selecione um título.</Text>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Space>
              <Text type="secondary">Em aberto:</Text>
              <Text>{formatMoney(currentTitle.amountOpen, currentTitle.currency)}</Text>
              <Text type="secondary">Status:</Text>
              {renderStatusTag(currentTitle.status)}
            </Space>

            <Form form={settlementForm} layout="inline">
              <Form.Item name="amount" label="Valor" rules={[{ required: true }]}>
                <Input type="number" style={{ width: 140 }} />
              </Form.Item>
              <Form.Item name="method" label="Método" rules={[{ required: true }]} initialValue="PIX">
                <Select style={{ width: 160 }}>
                  {(['PIX', 'BOLETO', 'TED', 'CASH', 'CARD'] as FinanceSettlementMethod[]).map(m => (
                    <Select.Option key={m} value={m}>
                      {m}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="reference" label="Referência">
                <Input style={{ width: 220 }} />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  onClick={async () => {
                    if (!currentTitle) return;
                    try {
                      const values = await settlementForm.validateFields();
                      createFinanceSettlement(tenantId, {
                        titleId: currentTitle.id,
                        amount: Number(values.amount),
                        method: values.method,
                        reference: values.reference
                      });
                      settlementForm.setFieldsValue({ amount: 0, reference: null });
                      onChanged();
                    } catch (err) {
                      const e: any = err;
                      Modal.error({ title: 'Erro ao baixar', content: String(e && e.message ? e.message : e) });
                    }
                  }}
                >
                  Baixar
                </Button>
              </Form.Item>
            </Form>

            <Table
              rowKey="id"
              pagination={{ pageSize: 5 }}
              dataSource={currentSettlements}
              columns={[
                { title: 'Pago em', dataIndex: 'paidAt', key: 'paidAt', render: (v: string) => formatDate(v) },
                {
                  title: 'Valor',
                  key: 'amount',
                  render: (_: any, row: FinanceSettlement) => formatMoney(row.amount, currentTitle.currency)
                },
                { title: 'Método', dataIndex: 'method', key: 'method' },
                { title: 'Referência', dataIndex: 'reference', key: 'reference', render: (v: string | null) => v || '-' },
                {
                  title: 'Ações',
                  key: 'actions',
                  render: (_: any, row: FinanceSettlement) => (
                    <Button
                      size="small"
                      danger
                      onClick={() =>
                        Modal.confirm({
                          title: 'Remover baixa?',
                          content: 'Isso vai estornar o valor para o título.',
                          okText: 'Remover',
                          okButtonProps: { danger: true },
                          cancelText: 'Cancelar',
                          onOk: () => {
                            deleteFinanceSettlement(tenantId, row.id);
                            onChanged();
                          }
                        })
                      }
                    >
                      Remover
                    </Button>
                  )
                }
              ]}
            />
          </Space>
        )}
      </Modal>
    </>
  );
}
