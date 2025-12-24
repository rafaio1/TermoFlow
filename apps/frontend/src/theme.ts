import { ThemeConfig } from 'antd';

const theme: ThemeConfig = {
  token: {
    colorPrimary: '#1a73e8',
    colorLink: '#1a73e8',
    colorSuccess: '#34a853',
    colorWarning: '#f9ab00',
    colorError: '#ea4335',
    fontFamily: "'Google Sans', 'Roboto', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
    fontSize: 14,
    colorTextHeading: '#202124',
    colorText: 'rgba(32, 33, 36, 0.88)',
    colorTextSecondary: 'rgba(95, 99, 104, 0.92)',
    colorTextDisabled: 'rgba(60, 64, 67, 0.38)',
    borderRadius: 12,
    colorBorder: '#dadce0',
    boxShadow: '0 1px 2px rgba(60, 64, 67, 0.12), 0 1px 3px rgba(60, 64, 67, 0.08)',
  },
  components: {
    Layout: {
      bodyBg: '#f8f9fa',
      headerBg: '#ffffff',
      siderBg: '#ffffff',
    },
    Card: {
      actionsBg: '#ffffff'
    }
  },
};

export default theme;
