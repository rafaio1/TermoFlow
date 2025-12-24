import React from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../shared/components/PageHeader';

import './styles.less';

const Header = () => {
  const { t } = useTranslation('header');

  return <PageHeader title={t('title')} />;
};

export default Header;
