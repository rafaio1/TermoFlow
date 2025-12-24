import React from 'react';
import { Space, Switch, Typography } from 'antd';

import { Tenant, TenantSettings, updateTenantSettings } from '../../controllers/registry';
import { renderStatusTag } from './ui';

const { Text } = Typography;

type Props = {
  tenant: Tenant | null;
  tenantId: string | null;
  settings: TenantSettings | null;
  onChanged: () => void;
};

export default function TenantSettingsTab({ tenant, tenantId, settings, onChanged }: Props) {
  if (!tenant || !tenantId || !settings) {
    return <Text type="secondary">Selecione um tenant.</Text>;
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Text>
        <b>{tenant.name}</b> {renderStatusTag(tenant.status)}
      </Text>

      <Space>
        <Text>Usar Organizações</Text>
        <Switch
          checked={settings.useOrganizations}
          onChange={checked => {
            updateTenantSettings(tenantId, { useOrganizations: checked });
            onChanged();
          }}
        />
      </Space>

      <Space>
        <Text>Usar Grupos</Text>
        <Switch
          checked={settings.useGroups}
          onChange={checked => {
            updateTenantSettings(tenantId, { useGroups: checked });
            onChanged();
          }}
        />
      </Space>

      <Text type="secondary">Dica: desativar Organizações/Grupos limpa os vínculos (sem apagar cadastros).</Text>
    </Space>
  );
}

