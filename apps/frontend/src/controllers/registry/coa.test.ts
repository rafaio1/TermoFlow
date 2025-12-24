import { loadRegistryStore } from './store';
import {
  createCoaAccount,
  createCoaChart,
  createCodeTemplate,
  deleteCoaChart,
  generateCodeFromTemplate,
  listCodeSequences,
  listCoaAccounts,
  listCoaCharts
} from './coa';

describe('COA registry controllers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('builds charts and accounts with scope-aware defaults', () => {
    const store = loadRegistryStore();
    const tenantId = store.tenants[0].id;
    const companyId = store.companies[0].id;

    const chart = createCoaChart(tenantId, { name: 'Chart Org', scope: 'TENANT', isDefault: true });
    expect(listCoaCharts(tenantId).some(c => c.id === chart.id)).toBe(true);

    const account = createCoaAccount(tenantId, {
      chartId: chart.id,
      code: '1',
      name: 'Caixa',
      type: 'ASSET',
      isPostable: true
    });
    expect(listCoaAccounts(tenantId, chart.id).some(a => a.id === account.id)).toBe(true);

    deleteCoaChart(tenantId, chart.id);
    const after = loadRegistryStore();
    const deleted = after.coaCharts.find(c => c.id === chart.id);
    expect(deleted).toBeDefined();
    expect(deleted && deleted.deletedAt).not.toBeNull();
  });

  it('prevents duplicate codes inside the same chart', () => {
    const store = loadRegistryStore();
    const tenantId = store.tenants[0].id;
    const chart = createCoaChart(tenantId, { name: 'Chart Dup', scope: 'TENANT', isDefault: true });

    createCoaAccount(tenantId, {
      chartId: chart.id,
      code: '1',
      name: 'Conta 1',
      type: 'ASSET',
      isPostable: true
    });

    expect(() =>
      createCoaAccount(tenantId, {
        chartId: chart.id,
        code: '1',
        name: 'Conta 2',
        type: 'ASSET',
        isPostable: true
      })
    ).toThrow('coa_code_already_exists');
  });

  it('generates code sequences from templates', () => {
    const store = loadRegistryStore();
    const tenantId = store.tenants[0].id;
    const template = createCodeTemplate(tenantId, {
      name: 'Template Seq',
      target: 'COA_ACCOUNT_CODE',
      pattern: '{{static:FIN}}-{{seq:3}}',
      exampleOutput: 'FIN-001'
    });

    const first = generateCodeFromTemplate(tenantId, { templateId: template.id });
    expect(first.endsWith('-001')).toBe(true);

    const second = generateCodeFromTemplate(tenantId, { templateId: template.id });
    expect(second.endsWith('-002')).toBe(true);

    const sequences = listCodeSequences(tenantId);
    expect(sequences.some(seq => seq.templateId === template.id && seq.currentValue === 2)).toBe(true);
  });
});
