import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Button, Card, Typography } from 'antd';
import { fetchList } from '@redux/actions';
import { GITHUB_LINK } from '@constants/general';
import LogoIcon from '@icons/LogoIcon';
import ListItem from '@components/data_entry/ListItem';



type Props = {};

const Home: React.FC<Props> = () => {
  const { t } = useTranslation('homeScreen');
  const [fetching, setFetching] = useState(true);
  const list = useSelector((state: IReducerStates) => state.list);
  const dispatch = useDispatch();

  useEffect(() => {
    (async () => {
      await setFetching(true);

      try {
        await dispatch(fetchList());
      } catch (error) {
        // console.log(error)
      }

      setFetching(false);
    })();
  }, [dispatch]);

  return (
    <>
      <div className="home">
        <div className="home__header">
          <Typography.Title level={3}>{t('title')}</Typography.Title>
          <Typography.Text type="secondary">Visão geral do ambiente</Typography.Text>
          <div className="home__extra">
            <a key="github" className="home__link" href={GITHUB_LINK} target="_blank" rel="noopener noreferrer">
              <LogoIcon fill="var(--tf-primary-color)" /> {t('githubLink')}
            </a>
          </div>
        </div>
        <Card
          className="home__card"
          title="Itens"
        >
          {fetching ? (
            <p>{t('loading')}</p>
          ) : (
            list.map((item: IItem) => <ListItem key={item.id} item={item.name} />)
          )}
          <div style={{ marginTop: 16 }}>
            <Link to="/cadastros">
              <Button type="primary">Central de Cadastramento</Button>
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Home;
