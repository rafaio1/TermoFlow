import { loadRegistryStore } from './store';
import { createSupplier } from './suppliers';
import { createFinanceSettlement, createFinanceTitle, getFinanceTitle } from './finance';

describe('finance titles + settlements', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('enforces PAYABLE vs RECEIVABLE counterparty rules', () => {
    const store = loadRegistryStore();
    const tenantId = store.tenants[0].id;
    const companyId = store.companies[0].id;
    const customerId = store.customers[0].id;

    const supplier = createSupplier(tenantId, {
      name: 'Fornecedor 1',
      documentType: 'CNPJ',
      documentNumber: '11.111.111/0001-11',
      isShared: true
    });

    expect(() =>
      createFinanceTitle(tenantId, {
        companyId,
        type: 'PAYABLE',
        amountOriginal: 100,
        supplierId: supplier.id,
        customerId
      })
    ).toThrow('invalid_counterparty');

    expect(() =>
      createFinanceTitle(tenantId, {
        companyId,
        type: 'PAYABLE',
        amountOriginal: 100
      })
    ).toThrow('supplier_id_required');

    expect(() =>
      createFinanceTitle(tenantId, {
        companyId,
        type: 'RECEIVABLE',
        amountOriginal: 100,
        customerId,
        supplierId: supplier.id
      })
    ).toThrow('invalid_counterparty');

    expect(() =>
      createFinanceTitle(tenantId, {
        companyId,
        type: 'RECEIVABLE',
        amountOriginal: 100
      })
    ).toThrow('customer_id_required');
  });

  it('updates amount_open + status when settling', () => {
    const store = loadRegistryStore();
    const tenantId = store.tenants[0].id;
    const companyId = store.companies[0].id;
    const customerId = store.customers[0].id;

    const title = createFinanceTitle(tenantId, {
      companyId,
      type: 'RECEIVABLE',
      amountOriginal: 100,
      dueDate: '2099-01-01',
      customerId
    });

    createFinanceSettlement(tenantId, { titleId: title.id, amount: 40, method: 'PIX' });
    const afterPartial = getFinanceTitle(tenantId, title.id);
    expect(afterPartial.amountOpen).toBe(60);
    expect(afterPartial.status).toBe('PARTIALLY_PAID');

    expect(() => createFinanceSettlement(tenantId, { titleId: title.id, amount: 999, method: 'PIX' })).toThrow(
      'settlement_exceeds_open_amount'
    );

    createFinanceSettlement(tenantId, { titleId: title.id, amount: 60, method: 'PIX' });
    const afterPaid = getFinanceTitle(tenantId, title.id);
    expect(afterPaid.amountOpen).toBe(0);
    expect(afterPaid.status).toBe('PAID');
  });

  it('marks titles as OVERDUE when dueDate is in the past', () => {
    const store = loadRegistryStore();
    const tenantId = store.tenants[0].id;
    const companyId = store.companies[0].id;
    const customerId = store.customers[0].id;

    const title = createFinanceTitle(tenantId, {
      companyId,
      type: 'RECEIVABLE',
      amountOriginal: 100,
      dueDate: '2000-01-01',
      customerId
    });

    const hydrated = getFinanceTitle(tenantId, title.id);
    expect(hydrated.status).toBe('OVERDUE');
  });
});
