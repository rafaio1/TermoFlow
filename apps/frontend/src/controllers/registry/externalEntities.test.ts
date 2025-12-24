import { loadRegistryStore } from './store';
import { createCompany } from './companies';
import { createCustomer, listCustomersVisibleToCompany, updateCustomer } from './customers';
import { createSupplier, listSuppliersVisibleToCompany } from './suppliers';

describe('customers/suppliers visibility by company', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('enforces UNIQUE(tenant_id, document_type, document_number) on customers', () => {
    const store = loadRegistryStore();
    const tenantId = store.tenants[0].id;

    createCustomer(tenantId, {
      name: 'Cliente 1',
      documentType: 'CNPJ',
      documentNumber: '12.345.678/0001-90',
      isShared: true
    });

    expect(() =>
      createCustomer(tenantId, {
        name: 'Cliente 2',
        documentType: 'CNPJ',
        documentNumber: '12345678000190',
        isShared: true
      })
    ).toThrow('customer_document_already_exists');
  });

  it('applies customer visibility rules (shared vs company access)', () => {
    const store = loadRegistryStore();
    const tenantId = store.tenants[0].id;
    const company1Id = store.companies[0].id;
    const company2 = createCompany(tenantId, { tradeName: 'Empresa 2', code: 'C2' });

    const customer = createCustomer(tenantId, {
      name: 'Cliente Restrito',
      documentType: 'CPF',
      documentNumber: '123.456.789-00',
      isShared: false,
      companyIds: [company1Id]
    });

    expect(listCustomersVisibleToCompany(tenantId, company1Id).some(c => c.id === customer.id)).toBe(true);
    expect(listCustomersVisibleToCompany(tenantId, company2.id).some(c => c.id === customer.id)).toBe(false);

    updateCustomer(tenantId, customer.id, { isShared: true });

    expect(listCustomersVisibleToCompany(tenantId, company2.id).some(c => c.id === customer.id)).toBe(true);

    const after = loadRegistryStore();
    expect(after.customerCompanyAccess.some(a => a.customerId === customer.id)).toBe(false);
  });

  it('applies supplier visibility rules (shared vs company access)', () => {
    const store = loadRegistryStore();
    const tenantId = store.tenants[0].id;
    const company1Id = store.companies[0].id;
    const company2 = createCompany(tenantId, { tradeName: 'Empresa 2', code: 'C2' });

    const supplier = createSupplier(tenantId, {
      name: 'Fornecedor Restrito',
      documentType: 'CNPJ',
      documentNumber: '11.111.111/0001-11',
      isShared: false,
      companyIds: [company2.id]
    });

    expect(listSuppliersVisibleToCompany(tenantId, company1Id).some(s => s.id === supplier.id)).toBe(false);
    expect(listSuppliersVisibleToCompany(tenantId, company2.id).some(s => s.id === supplier.id)).toBe(true);
  });
});

