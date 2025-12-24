import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FinanceTitlesTab from './FinanceTitlesTab';

describe('FinanceTitlesTab (visual)', () => {
  it('gera markup estável (sem empresa selecionada)', () => {
    expect(
      renderToStaticMarkup(
        <FinanceTitlesTab
          tenantId="t1"
          type="PAYABLE"
          companies={[]}
          currentCompanyId={null}
          customers={[]}
          suppliers={[]}
          onCompanySelected={() => {}}
          onChanged={() => {}}
        />
      )
    ).toMatchSnapshot();
  });
});

