import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { getMe, logout } from '@datalking/pivot-store';
import {
  ActionIcon,
  Avatar,
  Button,
  Center,
  Divider,
  Group,
  IconLanguage,
  IconLogout,
  IconUsersGroup,
  Image,
  Menu,
  Text,
} from '@datalking/pivot-ui';

import logo from '../../assets/logo.svg';

export const Header: React.FC = () => {
  const { i18n, t } = useTranslation();
  const language = i18n.language;
  const me = useSelector(getMe);
  const dispatch = useDispatch();

  return (
    <Group
      px='xs'
      h={50}
      bg='white'
      py={6}
      sx={(theme) => ({ borderBottom: '1px solid ' + theme.colors.gray[3] })}
      position='apart'
    >
      <Center>
        <Link
          to='/'
          style={{
            display: 'flex',
            textDecorationLine: 'none',
            alignItems: 'center',
            userSelect: 'none',
          }}
        >
          <Image src={logo} alt='undb' width='20px' height='20px' />
          <Text pl='xs' color='blue.9' fw={600}>
            undb
          </Text>
        </Link>
      </Center>

      <Center mr='lg'>
        <Link to='/members'>
          <Button
            compact
            size='sm'
            color='gray'
            variant='subtle'
            leftIcon={<IconUsersGroup size={16} />}
          >
            {t('Members', { ns: 'common' })}
          </Button>
        </Link>
        <Divider mx={20} size='xs' orientation='vertical' />
        <Menu>
          <Menu.Target>
            <ActionIcon>
              <IconLanguage />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              fw={language === 'zh-CN' ? 600 : 'normal'}
              onClick={() => i18n.changeLanguage('zh-CN')}
            >
              简体中文
            </Menu.Item>
            <Menu.Item
              fw={language === 'en' ? 600 : 'normal'}
              onClick={() => i18n.changeLanguage('en')}
            >
              English
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        {me && (
          <Menu width={200}>
            <Menu.Target>
              <Avatar
                radius='xl'
                ml='sm'
                role='button'
                sx={{ cursor: 'pointer' }}
              >
                {me.username.slice(0, 2).toUpperCase()}
              </Avatar>
            </Menu.Target>

            <Menu.Dropdown>
              <Link to='/me/profile'>
                <Menu.Item fw={600}>
                  <Group spacing='xs'>
                    <Avatar size='xs' src={me.avatar}>
                      {me.username.slice(0, 2)}
                    </Avatar>
                    {me.username}
                  </Group>
                </Menu.Item>
              </Link>
              <Menu.Divider />
              <Menu.Item
                icon={<IconLogout size={16} />}
                onClick={() => dispatch(logout())}
              >
                {t('logout', { ns: 'auth' })}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Center>
    </Group>
  );
};
