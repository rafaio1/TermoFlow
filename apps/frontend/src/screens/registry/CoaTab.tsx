import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tabs,
  Typography
} from 'antd';

import {
  CodeSequence,
  CodeTemplate,
  CodeTemplateTarget,
  CoaAccount,
  CoaAccountKind,
  CoaChart,
  CoaChartScope,
  Company,
  CompanyGroup,
  Organization,
  UUID,
  createCoaAccount,
  createCoaChart,
  createCodeTemplate,
  deleteCoaAccount,
  deleteCoaChart,
  deleteCodeTemplate,
  updateCodeTemplate,
  generateCodeFromTemplate,
  getDefaultChartForCompany,
  listCodeSequences,
  listCodeTemplates,
  listCoaAccounts,
  listCoaCharts,
  updateCoaAccount,
  updateCoaChart
} from '../../controllers/registry';
import { renderStatusTag } from './ui';

const { Text } = Typography;

type Props = {
  tenantId: UUID;
  companies: Company[];
  organizations: Organization[];
  currentCompanyId: UUID | null;
  onCompanySelected: (companyId: UUID) => void;
  onChanged: () => void;
};

const scopeOptions: { value: CoaChartScope; label: string }[] = [
  { value: 'TENANT', label: 'Tenant (global)' },
  { value: 'ORGANIZATION', label: 'Organização' },
  { value: 'COMPANY', label: 'Empresa' }
];

const templateTargets: { value: CodeTemplateTarget; label: string }[] = [
  { value: 'ORGANIZATION_CODE', label: 'Código da organização' },
  { value: 'COMPANY_CODE', label: 'Código da empresa' },
  { value: 'COA_ACCOUNT_CODE', label: 'Código da conta' },
  { value: 'CUSTOMER_CODE', label: 'Código de cliente' },
  { value: 'SUPPLIER_CODE', label: 'Código de fornecedor' }
];

export default function CoaTab({
  tenantId,
  companies,
  organizations,
  currentCompanyId,
  onCompanySelected,
  onChanged
}: Props) {
  const [selectedChartId, setSelectedChartId] = useState<UUID | null>(null);
  const [chartModal, setChartModal] = useState<{ open: boolean; editing: CoaChart | null }>({
    open: false,
    editing: null
  });
  const [accountModal, setAccountModal] = useState<{ open: boolean; editing: CoaAccount | null }>({
    open: false,
    editing: null
  });
  const [templateModal, setTemplateModal] = useState<{ open: boolean; editing: CodeTemplate | null }>({
    open: false,
    editing: null
  });

  const [chartForm] = Form.useForm();
  const [accountForm] = Form.useForm();
  const [templateForm] = Form.useForm();

  const charts = useMemo(() => (tenantId ? listCoaCharts(tenantId) : []), [tenantId]);
  const chartsById = useMemo(() => new Map(charts.map(chart => [chart.id, chart])), [charts]);
  const chartOptions = useMemo(
    () =>
      charts.map(chart => ({
        label: `${chart.name} (${chart.scope})`,
        value: chart.id
      })),
    [charts]
  );

  const accounts = useMemo(
    () => (tenantId && selectedChartId ? listCoaAccounts(tenantId, selectedChartId) : []),
    [tenantId, selectedChartId, charts]
  );
  const accountParents = accounts.filter(account => account.id !== accountModal.editing?.id);

  const templates = useMemo(() => (tenantId ? listCodeTemplates(tenantId) : []), [tenantId]);
  const sequences = useMemo(() => (tenantId ? listCodeSequences(tenantId) : []), [tenantId]);

  const companyMap = useMemo(() => new Map(companies.map(c => [c.id, c])), [companies]);
  const organizationMap = useMemo(() => new Map(organizations.map(o => [o.id, o])), [organizations]);

  useEffect(() => {
    const defaultChart = getDefaultChartForCompany(tenantId, currentCompanyId);
    if (defaultChart) {
      setSelectedChartId(defaultChart.id);
      return;
    }
    if (charts.length) {
      setSelectedChartId(charts[0].id);
      return;
    }
    setSelectedChartId(null);
  }, [tenantId, currentCompanyId, charts]);

  const selectedChart = selectedChartId ? chartsById.get(selectedChartId) || null : null;

  const openChartModal = (chart?: CoaChart) => {
    setChartModal({ open: true, editing: chart || null });
    chartForm.setFieldsValue(
      chart
        ? {
            name: chart.name,
            scope: chart.scope,
            organizationId: chart.organizationId,
            companyId: chart.companyId,
            isDefault: chart.isDefault
          }
        : { name: '', scope: 'TENANT', organizationId: null, companyId: null, isDefault: false }
    );
  };

  const openAccountModal = (account?: CoaAccount) => {
    setAccountModal({ open: true, editing: account || null });
    accountForm.setFieldsValue(
      account
        ? {
            parentAccountId: account.parentAccountId,
            code: account.code,
            name: account.name,
            type: account.type,
            isPostable: account.isPostable,
            status: account.status
          }
        : { parentAccountId: null, code: '', name: '', type: 'ASSET', isPostable: true, status: 'ACTIVE' }
    );
  };

  const openTemplateModal = (template?: CodeTemplate) => {
    setTemplateModal({ open: true, editing: template || null });
    templateForm.setFieldsValue(
      template
        ? {
            name: template.name,
            target: template.target,
            pattern: template.pattern,
            exampleOutput: template.exampleOutput
          }
        : { name: '', target: 'COA_ACCOUNT_CODE', pattern: '', exampleOutput: '' }
    );
  };

  const handleChartSubmit = async () => {
    const values = await chartForm.validateFields();
    try {
      if (chartModal.editing) {
        updateCoaChart(tenantId, chartModal.editing.id, values);
      } else {
        createCoaChart(tenantId, values);
      }
      setChartModal({ open: false, editing: null });
      onChanged();
    } catch (err) {
      Modal.error({ title: 'Erro ao salvar chart', content: String(err) });
    }
  };

  const handleAccountSubmit = async () => {
    if (!selectedChartId) return;
    const values = await accountForm.validateFields();
    try {
      if (accountModal.editing) {
        updateCoaAccount(tenantId, accountModal.editing.id, values);
      } else {
        createCoaAccount(tenantId, { chartId: selectedChartId, ...values });
      }
      setAccountModal({ open: false, editing: null });
      onChanged();
    } catch (err) {
      Modal.error({ title: 'Erro ao salvar conta', content: String(err) });
    }
  };

  const handleTemplateSubmit = async () => {
    const values = await templateForm.validateFields();
    try {
      if (templateModal.editing) {
        updateCodeTemplate(tenantId, templateModal.editing.id, values);
      } else {
        createCodeTemplate(tenantId, values);
      }
      setTemplateModal({ open: false, editing: null });
      onChanged();
    } catch (err) {
      Modal.error({ title: 'Erro ao salvar template', content: String(err) });
    }
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space>
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
      </Space>

      <Tabs defaultActiveKey="charts">
        <Tabs.TabPane tab="Charts e contas" key="charts">
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Space>
              <Text type="secondary">Chart atual:</Text>
              <Select
                style={{ minWidth: 260 }}
                value={selectedChartId || undefined}
                placeholder="Selecione um gráfico"
                onChange={(value: UUID) => setSelectedChartId(value)}
              >
                {chartOptions.map(option => (
                  <Select.Option key={option.value} value={option.value}>
                    {option.label}
                  </Select.Option>
                ))}
              </Select>
              <Button type="primary" onClick={() => openChartModal()}>
                Criar chart
              </Button>
            </Space>

            <Table
              rowKey="id"
              dataSource={charts}
              pagination={false}
              columns={[
                { title: 'Nome', dataIndex: 'name', key: 'name' },
                {
                  title: 'Escopo',
                  dataIndex: 'scope',
                  key: 'scope',
                  render: (value: CoaChartScope) => value
                },
                {
                  title: 'Organização',
                  key: 'organization',
                  render: (_: any, row: CoaChart) =>
                    row.organizationId ? organizationMap.get(row.organizationId)?.name || row.organizationId : '-'
                },
                {
                  title: 'Empresa',
                  key: 'company',
                  render: (_: any, row: CoaChart) => (row.companyId ? companyMap.get(row.companyId)?.tradeName : '-')
                },
                {
                  title: 'Default',
                  key: 'isDefault',
                  render: (_: any, row: CoaChart) =>
                    row.isDefault ? <Tag color="blue">Padrão</Tag> : <Tag>—</Tag>
                },
                {
                  title: 'Ações',
                  key: 'actions',
                  render: (_: any, row: CoaChart) => (
                    <Space>
                      <Button size="small" onClick={() => openChartModal(row)}>
                        Editar
                      </Button>
                      <Button
                        size="small"
                        danger
                        onClick={() =>
                          Modal.confirm({
                            title: 'Remover chart?',
                            content: `Isso vai remover o chart "${row.name}".`,
                            okText: 'Remover',
                            okButtonProps: { danger: true },
                            cancelText: 'Cancelar',
                            onOk: () => {
                              deleteCoaChart(tenantId, row.id);
                              if (selectedChartId === row.id) setSelectedChartId(null);
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

            <Card title="Contas" size="small">
              <Button type="primary" disabled={!selectedChartId} onClick={() => openAccountModal()}>
                Criar conta
              </Button>

              {!selectedChartId ? (
                <Text type="secondary">Selecione um chart para gerenciar contas.</Text>
              ) : (
                <Table
                  rowKey="id"
                  style={{ marginTop: 16 }}
                  pagination={{ pageSize: 10 }}
                  dataSource={accounts}
                  columns={[
                    {
                      title: 'Conta pai',
                      key: 'parent',
                      render: (_: any, row: CoaAccount) =>
                        row.parentAccountId ? (accounts.find(a => a.id === row.parentAccountId)?.code || '-') : '—'
                    },
                    { title: 'Código', dataIndex: 'code', key: 'code' },
                    { title: 'Nome', dataIndex: 'name', key: 'name' },
                    { title: 'Tipo', dataIndex: 'type', key: 'type' },
                    {
                      title: 'Pode lançar',
                      dataIndex: 'isPostable',
                      key: 'isPostable',
                      render: (value: boolean) => (value ? <Tag color="green">Sim</Tag> : <Tag>Não</Tag>)
                    },
                    { title: 'Status', dataIndex: 'status', key: 'status', render: (value: string) => renderStatusTag(value) },
                    {
                      title: 'Ações',
                      key: 'actions',
                      render: (_: any, row: CoaAccount) => (
                        <Space>
                          <Button size="small" onClick={() => openAccountModal(row)}>
                            Editar
                          </Button>
                          <Button
                            size="small"
                            danger
                            onClick={() =>
                              Modal.confirm({
                                title: 'Remover conta?',
                                content: `Isso vai marcar a conta "${row.code}" como removida.`,
                                okText: 'Remover',
                                okButtonProps: { danger: true },
                                cancelText: 'Cancelar',
                                onOk: () => {
                                  deleteCoaAccount(tenantId, row.id);
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
            </Card>
          </Space>
        </Tabs.TabPane>

        <Tabs.TabPane tab="Templates de código" key="templates">
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Space>
              <Button type="primary" onClick={() => openTemplateModal()}>
                Novo template
              </Button>
            </Space>

            <Table
              rowKey="id"
              pagination={{ pageSize: 5 }}
              dataSource={templates}
              columns={[
                { title: 'Nome', dataIndex: 'name', key: 'name' },
                {
                  title: 'Destino',
                  dataIndex: 'target',
                  key: 'target',
                  render: (value: CodeTemplateTarget) => value
                },
                { title: 'Pattern', dataIndex: 'pattern', key: 'pattern' },
                { title: 'Exemplo', dataIndex: 'exampleOutput', key: 'exampleOutput', render: (value: string | null) => value || '-' },
                {
                  title: 'Ações',
                  key: 'actions',
                  render: (_: any, row: CodeTemplate) => (
                    <Space>
                      <Button size="small" onClick={() => openTemplateModal(row)}>
                        Editar
                      </Button>
                      <Button
                        size="small"
                        onClick={() => {
                          try {
                            const generated = generateCodeFromTemplate(tenantId, {
                              templateId: row.id,
                              scopeCompanyId: currentCompanyId,
                              scopeOrganizationId: currentCompanyId ? companyMap.get(currentCompanyId)?.organizationId : null
                            });
                            Modal.info({
                              title: 'Código gerado',
                              content: `${generated}`
                            });
                            onChanged();
                          } catch (err) {
                            Modal.error({ title: 'Erro ao gerar código', content: String(err) });
                          }
                        }}
                      >
                        Gerar
                      </Button>
                      <Button
                        size="small"
                        danger
                        onClick={() =>
                          Modal.confirm({
                            title: 'Remover template?',
                            okText: 'Remover',
                            okButtonProps: { danger: true },
                            cancelText: 'Cancelar',
                            onOk: () => {
                              deleteCodeTemplate(tenantId, row.id);
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

            <Card title="Sequências" size="small">
              <Table
                rowKey="id"
                pagination={false}
                dataSource={sequences}
                columns={[
                  { title: 'Template', dataIndex: 'templateId', key: 'template', render: (value: UUID) => templates.find(t => t.id === value)?.name || value },
                  { title: 'Empresa', dataIndex: 'scopeCompanyId', key: 'company', render: (value: UUID | null) => (value ? companyMap.get(value)?.tradeName : 'Tenant') },
                  { title: 'Organização', dataIndex: 'scopeOrganizationId', key: 'org', render: (value: UUID | null) => (value ? organizationMap.get(value)?.name : '—') },
                  { title: 'Valor atual', dataIndex: 'currentValue', key: 'value' }
                ]}
              />
            </Card>
          </Space>
        </Tabs.TabPane>
      </Tabs>

      <Modal
        visible={chartModal.open}
        title={chartModal.editing ? 'Editar chart' : 'Criar chart'}
        okText="Salvar"
        cancelText="Cancelar"
        onCancel={() => setChartModal({ open: false, editing: null })}
        onOk={handleChartSubmit}
      >
        <Form form={chartForm} layout="vertical">
          <Form.Item name="name" label="Nome" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="scope" label="Escopo" rules={[{ required: true }]}>
            <Select>
              {scopeOptions.map(option => (
                <Select.Option key={option.value} value={option.value}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {() => {
              const scope = chartForm.getFieldValue('scope') as CoaChartScope;
              if (scope === 'ORGANIZATION') {
                return (
                  <Form.Item name="organizationId" label="Organização" rules={[{ required: true }]}>
                    <Select allowClear placeholder="Selecione">
                      {organizations.map(org => (
                        <Select.Option key={org.id} value={org.id}>
                          {org.name}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                );
              }
              if (scope === 'COMPANY') {
                return (
                  <Form.Item name="companyId" label="Empresa" rules={[{ required: true }]}>
                    <Select allowClear placeholder="Selecione">
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
              }
              return null;
            }}
          </Form.Item>
          <Form.Item name="isDefault" valuePropName="checked">
            <Switch /> <Text>Marcar como padrão</Text>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        visible={accountModal.open}
        title={accountModal.editing ? 'Editar conta' : 'Criar conta'}
        okText="Salvar"
        cancelText="Cancelar"
        onCancel={() => setAccountModal({ open: false, editing: null })}
        onOk={handleAccountSubmit}
      >
        <Form form={accountForm} layout="vertical">
          <Form.Item name="parentAccountId" label="Conta pai">
            <Select allowClear placeholder="(raiz)">
              {accountParents.map(account => (
                <Select.Option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="code" label="Código" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="Nome" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="Tipo" rules={[{ required: true }]}>
            <Select>
              {(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'OFF_BALANCE'] as CoaAccountKind[]).map(type => (
                <Select.Option key={type} value={type}>
                  {type}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="isPostable" valuePropName="checked">
            <Switch /> <Text>Conta postável</Text>
          </Form.Item>
          <Form.Item name="status" label="Status" initialValue="ACTIVE">
            <Select>
              <Select.Option value="ACTIVE">ACTIVE</Select.Option>
              <Select.Option value="INACTIVE">INACTIVE</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        visible={templateModal.open}
        title={templateModal.editing ? 'Editar template' : 'Criar template'}
        okText="Salvar"
        cancelText="Cancelar"
        onCancel={() => setTemplateModal({ open: false, editing: null })}
        onOk={handleTemplateSubmit}
      >
        <Form form={templateForm} layout="vertical">
          <Form.Item name="name" label="Nome" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="target" label="Destino" rules={[{ required: true }]}>
            <Select>
              {templateTargets.map(option => (
                <Select.Option key={option.value} value={option.value}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="pattern" label="Padrão" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="exampleOutput" label="Exemplo de saída">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
