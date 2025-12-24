import React, { useEffect, useMemo } from 'react';
import { Button, Card, Form, Input, message, Result, Space, Typography, Upload } from 'antd';
import PageHeader from '../../shared/components/PageHeader';
import { UploadOutlined } from '@ant-design/icons';
import { isCurrentUserAdmin } from '@utils/access';
import {
  applyBrandingToDom,
  DEFAULT_BRANDING,
  getCurrentTenantId,
  loadBrandingForTenant,
  resetBrandingForTenant,
  saveBrandingForTenant,
  Branding
} from '@utils/branding';

import './Branding.less';

const { Paragraph, Text } = Typography;

type ColorInputProps = {
  value?: string;
  onChange?: (value: string) => void;
};

function ColorInput({ value, onChange }: ColorInputProps) {
  const normalized = value || '';

  return (
    <Space className="tf-branding__colorField" size={8}>
      <Input
        type="color"
        value={normalized}
        onChange={e => onChange?.(e.target.value)}
        className="tf-branding__colorPicker"
        aria-label="Selecionar cor"
      />
      <Input
        value={normalized}
        onChange={e => onChange?.(e.target.value)}
        placeholder="#3f51b5"
        className="tf-branding__colorText"
        aria-label="Cor (hex/RGB)"
      />
    </Space>
  );
}

export default function BrandingSettings() {
  const canAdmin = isCurrentUserAdmin();
  const tenantId = getCurrentTenantId();
  const initialValues = useMemo(() => loadBrandingForTenant(tenantId), [tenantId]);
  const [form] = Form.useForm<Branding>();

  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [form, initialValues]);

  if (!canAdmin) {
    return (
      <Result
        status="403"
        title="Acesso restrito"
        subTitle="Apenas usuários com perfil de Administrador podem editar a identidade visual."
      />
    );
  }

  const onSave = async () => {
    const currentTenantId = getCurrentTenantId();
    if (!currentTenantId) {
      message.error('Selecione um tenant antes de configurar a identidade visual.');
      return;
    }

    const values = await form.validateFields();
    const next: Branding = { ...DEFAULT_BRANDING, ...values };

    saveBrandingForTenant(currentTenantId, next);
    applyBrandingToDom(next);
    message.success('Identidade visual atualizada.');
  };

  const onReset = () => {
    const currentTenantId = getCurrentTenantId();
    if (!currentTenantId) return;

    resetBrandingForTenant(currentTenantId);
    applyBrandingToDom(DEFAULT_BRANDING);
    form.setFieldsValue(DEFAULT_BRANDING);
    message.success('Identidade visual restaurada para o padrão.');
  };

  return (
    <div className="tf-branding">
      <PageHeader
        title="Identidade visual"
        subTitle="Admin: personalize logo e cores do sistema (por tenant)."
      />

      <Card className="tf-branding__card" bordered>
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Alterações são aplicadas imediatamente no navegador (e persistidas em <Text code>localStorage</Text>).
        </Paragraph>

        <Form form={form} layout="vertical" initialValues={initialValues}>
          <div className="tf-branding__grid">
            <Form.Item
              name="appName"
              label="Nome do sistema"
              rules={[{ required: true, message: 'Informe o nome do sistema.' }]}
            >
              <Input placeholder="TermoFlow" />
            </Form.Item>

            <Form.Item name="logoDataUrl" label="Logo (PNG/SVG/JPG)">
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={file => {
                    const isImage = file.type.startsWith('image/');
                    if (!isImage) {
                      message.error('Envie um arquivo de imagem.');
                      return false;
                    }
                    const maxBytes = 256 * 1024;
                    if (file.size > maxBytes) {
                      message.error('Logo muito grande (máx. 256KB).');
                      return false;
                    }

                    const reader = new FileReader();
                    reader.onload = () => {
                      const result = typeof reader.result === 'string' ? reader.result : null;
                      form.setFieldsValue({ logoDataUrl: result });
                      if (result) {
                        const branding = { ...DEFAULT_BRANDING, ...form.getFieldsValue(), logoDataUrl: result };
                        applyBrandingToDom(branding);
                      }
                    };
                    reader.readAsDataURL(file);
                    return false;
                  }}
                >
                  <Button icon={<UploadOutlined />}>Enviar logo</Button>
                </Upload>
                <Form.Item noStyle shouldUpdate>
                  {() => (
                    <Button
                      onClick={() => {
                        form.setFieldsValue({ logoDataUrl: null });
                        const branding = { ...DEFAULT_BRANDING, ...form.getFieldsValue(), logoDataUrl: null };
                        applyBrandingToDom(branding);
                      }}
                      disabled={!form.getFieldValue('logoDataUrl')}
                    >
                      Remover logo
                    </Button>
                  )}
                </Form.Item>
              </Space>
            </Form.Item>

            <Form.Item name="primaryColor" label="Cor primária">
              <ColorInput />
            </Form.Item>

            <Form.Item name="headerBg" label="Cor do cabeçalho">
              <ColorInput />
            </Form.Item>

            <Form.Item name="headerTextColor" label="Texto do cabeçalho">
              <ColorInput />
            </Form.Item>

            <Form.Item name="siderBg" label="Cor do menu lateral">
              <ColorInput />
            </Form.Item>

            <Form.Item name="siderTextColor" label="Texto do menu lateral">
              <ColorInput />
            </Form.Item>

            <Form.Item name="siderActiveBg" label="Fundo do item selecionado (menu)">
              <ColorInput />
            </Form.Item>

            <Form.Item name="siderActiveTextColor" label="Texto do item selecionado (menu)">
              <ColorInput />
            </Form.Item>

            <Form.Item name="contentBg" label="Fundo do conteúdo">
              <ColorInput />
            </Form.Item>
          </div>

          <Space size={12} style={{ marginTop: 8 }}>
            <Button type="primary" onClick={onSave}>
              Salvar
            </Button>
            <Button onClick={onReset}>Restaurar padrão</Button>
            <Button
              onClick={() => {
                const branding = { ...DEFAULT_BRANDING, ...form.getFieldsValue() };
                applyBrandingToDom(branding);
                message.success('Pré-visualização aplicada.');
              }}
            >
              Pré-visualizar
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
