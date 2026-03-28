// Mock de useAuth para pruebas unitarias
const useAuth = jest.fn(() => ({
  user: null,
  ready: true,
  login: jest.fn(),
  logout: jest.fn(),
}));

module.exports = { useAuth };
