import React, { useMemo, useState } from 'react';
import { Button, Checkbox, Form, Modal, Select, Space, Table, Tag, Typography } from 'antd';

import {
  Company,
  Organization,
  Role,
  User,
  UserCompanyMembership,
  UserRoleAssignment,
  createUserRoleAssignment,
  removeUserCompanyMembership,
  removeUserRoleAssignment,
  upsertUserCompanyMembership
} from '../../controllers/registry';
import { formatDate, renderStatusTag } from './ui';

const { Text } = Typography;

type Props = {
  tenantId: string;
  users: User[];
  companies: Company[];
  organizations: Organization[];
  roles: Role[];
  memberships: UserCompanyMembership[];
  roleAssignments: UserRoleAssignment[];
  currentUserId: string | null;
  onChanged: () => void;
};

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

export default function UserAccessTab({
  tenantId,
  users,
  companies,
  organizations,
  roles,
  memberships,
  roleAssignments,
  currentUserId,
  onChanged
}: Props) {
  const [selectedUserId, setSelectedUserId] = useState(() => {
    const canUseCurrent = currentUserId && users.some(u => u.id === currentUserId);
    if (canUseCurrent) return currentUserId as string;
    return users[0] ? users[0].id : '';
  });

  const selectedUser = users.find(u => u.id === selectedUserId) || null;

  const membershipsForUser = memberships.filter(m => m.userId === selectedUserId);
  const assignmentsForUser = roleAssignments.filter(a => a.userId === selectedUserId);

  const allowedCompanyIds = useMemo(() => {
    const allowed: string[] = [];
    const activeCompanies = companies.filter(c => c.deletedAt === null);
    const rolesById = new Map<string, Role>(roles.filter(r => r.deletedAt === null).map(r => [r.id, r]));

    membershipsForUser.forEach(m => {
      if (m.status !== 'ACTIVE') return;
      allowed.push(m.companyId);
    });

    assignmentsForUser.forEach(a => {
      const role = rolesById.get(a.roleId);
      if (!role) return;

      if (role.scope === 'TENANT') {
        activeCompanies.forEach(c => allowed.push(c.id));
        return;
      }

      if (role.scope === 'COMPANY') {
        if (a.scopeCompanyId) allowed.push(a.scopeCompanyId);
        return;
      }

      if (role.scope === 'ORGANIZATION') {
        if (!a.scopeOrganizationId) return;
        activeCompanies.forEach(c => {
          if (c.organizationId === a.scopeOrganizationId) allowed.push(c.id);
        });
      }
    });

    const valid = new Set(activeCompanies.map(c => c.id));
    return dedupe(allowed).filter(id => valid.has(id));
  }, [membershipsForUser, assignmentsForUser, companies, roles]);

  const defaultMembership =
    membershipsForUser.find(m => m.status === 'ACTIVE' && m.isDefault) ||
    membershipsForUser.find(m => m.status === 'ACTIVE') ||
    null;

  const [membershipModal, setMembershipModal] = useState<{
    open: boolean;
    editing: UserCompanyMembership | null;
  }>({ open: false, editing: null });
  const [membershipForm] = Form.useForm();

  const openMembershipModal = (editing?: UserCompanyMembership) => {
    setMembershipModal({ open: true, editing: editing || null });
    membershipForm.setFieldsValue(
      editing
        ? {
            companyId: editing.companyId,
            status: editing.status,
            isDefault: editing.isDefault
          }
        : { companyId: null, status: 'ACTIVE', isDefault: false }
    );
  };

  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [assignmentForm] = Form.useForm();

  const selectedRole = roles.find(r => r.id === selectedRoleId) || null;

  const openAssignmentModal = () => {
    setAssignmentModalOpen(true);
    setSelectedRoleId('');
    assignmentForm.setFieldsValue({ roleId: null, scopeCompanyId: null, scopeOrganizationId: null });
  };

  if (!selectedUserId) {
    return <Text type="secondary">Crie um usuário para gerenciar acessos.</Text>;
  }

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Text type="secondary">Usuário:</Text>
        <Select style={{ minWidth: 260 }} value={selectedUserId} onChange={(value: string) => setSelectedUserId(value)}>
          {users.map(u => (
            <Select.Option key={u.id} value={u.id}>
              {u.email}
            </Select.Option>
          ))}
        </Select>
        {selectedUser && selectedUser.id === currentUserId ? <Tag color="gold">Atual</Tag> : null}
        {defaultMembership ? (
          <Text type="secondary">
            Empresa padrão:{' '}
            {(() => {
              const company = companies.find(c => c.id === defaultMembership.companyId);
              return company ? company.tradeName : defaultMembership.companyId;
            })()}
          </Text>
        ) : (
          <Text type="secondary">Empresa padrão: -</Text>
        )}
      </Space>

      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={() => openMembershipModal()}>
          Vincular empresa
        </Button>
      </Space>

      <Table
        rowKey={(row: UserCompanyMembership) => `${row.userId}:${row.companyId}`}
        pagination={{ pageSize: 8 }}
        dataSource={membershipsForUser}
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
          {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (value: string, row: UserCompanyMembership) => (
              <Space>
                {renderStatusTag(value)}
                {row.isDefault ? <Tag color="blue">default</Tag> : null}
              </Space>
            )
          },
          { title: 'Atualizado', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => formatDate(v) },
          {
            title: 'Ações',
            key: 'actions',
            render: (_: any, row: UserCompanyMembership) => (
              <Space>
                <Button size="small" onClick={() => openMembershipModal(row)}>
                  Editar
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    upsertUserCompanyMembership(tenantId, selectedUserId, row.companyId, { isDefault: true });
                    onChanged();
                  }}
                  disabled={row.status !== 'ACTIVE'}
                >
                  Definir padrão
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    upsertUserCompanyMembership(tenantId, selectedUserId, row.companyId, {
                      status: row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
                    });
                    onChanged();
                  }}
                >
                  {row.status === 'ACTIVE' ? 'Inativar' : 'Ativar'}
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() =>
                    Modal.confirm({
                      title: 'Remover vínculo?',
                      content: 'Isso remove o vínculo do usuário com a empresa.',
                      okText: 'Remover',
                      okButtonProps: { danger: true },
                      cancelText: 'Cancelar',
                      onOk: () => {
                        removeUserCompanyMembership(tenantId, selectedUserId, row.companyId);
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

      <Space style={{ marginTop: 20, marginBottom: 12 }}>
        <Button type="primary" onClick={openAssignmentModal}>
          Atribuir role
        </Button>
        <Text type="secondary">
          Empresas permitidas (calculado):{' '}
          {allowedCompanyIds.length
            ? allowedCompanyIds
                .map(id => {
                  const company = companies.find(c => c.id === id);
                  return company ? company.tradeName : id;
                })
                .join(', ')
            : '-'}
        </Text>
      </Space>

      <Table
        rowKey={(row: UserRoleAssignment) =>
          `${row.userId}:${row.roleId}:${row.scopeCompanyId || ''}:${row.scopeOrganizationId || ''}`
        }
        pagination={{ pageSize: 8 }}
        dataSource={assignmentsForUser}
        columns={[
          {
            title: 'Role',
            dataIndex: 'roleId',
            key: 'roleId',
            render: (value: string) => {
              const role = roles.find(r => r.id === value);
              return role ? role.name : value;
            }
          },
          {
            title: 'Scope',
            key: 'scope',
            render: (_: any, row: UserRoleAssignment) => {
              const role = roles.find(r => r.id === row.roleId);
              return role ? role.scope : '-';
            }
          },
          {
            title: 'Organização',
            dataIndex: 'scopeOrganizationId',
            key: 'scopeOrganizationId',
            render: (value: string | null) => {
              if (!value) return '-';
              const org = organizations.find(o => o.id === value);
              return org ? org.name : value;
            }
          },
          {
            title: 'Empresa',
            dataIndex: 'scopeCompanyId',
            key: 'scopeCompanyId',
            render: (value: string | null) => {
              if (!value) return '-';
              const company = companies.find(c => c.id === value);
              return company ? company.tradeName : value;
            }
          },
          { title: 'Criado', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => formatDate(v) },
          {
            title: 'Ações',
            key: 'actions',
            render: (_: any, row: UserRoleAssignment) => (
              <Space>
                <Button
                  size="small"
                  danger
                  onClick={() =>
                    Modal.confirm({
                      title: 'Remover role?',
                      content: 'Isso remove a atribuição de role ao usuário.',
                      okText: 'Remover',
                      okButtonProps: { danger: true },
                      cancelText: 'Cancelar',
                      onOk: () => {
                        removeUserRoleAssignment(tenantId, {
                          userId: row.userId,
                          roleId: row.roleId,
                          scopeCompanyId: row.scopeCompanyId,
                          scopeOrganizationId: row.scopeOrganizationId
                        });
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
        visible={membershipModal.open}
        title={membershipModal.editing ? 'Editar vínculo empresa' : 'Vincular empresa'}
        okText="Salvar"
        cancelText="Cancelar"
        onCancel={() => setMembershipModal({ open: false, editing: null })}
        onOk={async () => {
          const values = await membershipForm.validateFields();
          upsertUserCompanyMembership(tenantId, selectedUserId, values.companyId, {
            status: values.status,
            isDefault: values.isDefault
          });
          setMembershipModal({ open: false, editing: null });
          onChanged();
        }}
      >
        <Form form={membershipForm} layout="vertical">
          <Form.Item name="companyId" label="Empresa" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="children"
              disabled={!!membershipModal.editing}
              placeholder="Selecione"
            >
              {companies
                .filter(c => c.deletedAt === null)
                .map(c => (
                  <Select.Option key={c.id} value={c.id}>
                    {c.tradeName}
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
          <Form.Item name="isDefault" valuePropName="checked">
            <Checkbox>Empresa padrão</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        visible={assignmentModalOpen}
        title="Atribuir role"
        okText="Salvar"
        cancelText="Cancelar"
        onCancel={() => setAssignmentModalOpen(false)}
        onOk={async () => {
          const values = await assignmentForm.validateFields();
          createUserRoleAssignment(tenantId, {
            userId: selectedUserId,
            roleId: values.roleId,
            scopeCompanyId: values.scopeCompanyId,
            scopeOrganizationId: values.scopeOrganizationId
          });
          setAssignmentModalOpen(false);
          onChanged();
        }}
      >
        <Form
          form={assignmentForm}
          layout="vertical"
          onValuesChange={(changed: any) => {
            if (changed.roleId) {
              setSelectedRoleId(changed.roleId);
              assignmentForm.setFieldsValue({ scopeCompanyId: null, scopeOrganizationId: null });
            }
          }}
        >
          <Form.Item name="roleId" label="Role" rules={[{ required: true }]}>
            <Select placeholder="Selecione">
              {roles
                .filter(r => r.deletedAt === null)
                .map(r => (
                  <Select.Option key={r.id} value={r.id}>
                    {r.name} ({r.scope})
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>

          {selectedRole && selectedRole.scope === 'COMPANY' ? (
            <Form.Item name="scopeCompanyId" label="Empresa" rules={[{ required: true }]}>
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
          ) : null}

          {selectedRole && selectedRole.scope === 'ORGANIZATION' ? (
            <Form.Item name="scopeOrganizationId" label="Organização" rules={[{ required: true }]}>
              <Select placeholder="Selecione">
                {organizations
                  .filter(o => o.deletedAt === null)
                  .map(o => (
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
