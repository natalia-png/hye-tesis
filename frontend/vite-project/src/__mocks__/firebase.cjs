// Mock de Firebase para pruebas unitarias
const mockDb = {};

module.exports = {
  db: mockDb,
  auth: {
    currentUser: { uid: "test-uid", email: "test@test.com" },
    onAuthStateChanged: jest.fn((cb) => { cb(null); return jest.fn(); }),
  },
  storage: {},
};
