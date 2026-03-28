module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterFramework: ["@testing-library/jest-dom"],
  setupFiles: ["<rootDir>/src/__mocks__/setupTests.cjs"],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
  moduleNameMapper: {
    "\\.(css|less|scss|png|jpg|jpeg|gif|svg|webp)$": "<rootDir>/src/__mocks__/fileMock.cjs",
    "^../lib/firebase$": "<rootDir>/src/__mocks__/firebase.cjs",
    "^../../lib/firebase$": "<rootDir>/src/__mocks__/firebase.cjs",
    "^../../../lib/firebase$": "<rootDir>/src/__mocks__/firebase.cjs",
    "^../app/useAuth$": "<rootDir>/src/__mocks__/useAuth.cjs",
    "^../../app/useAuth$": "<rootDir>/src/__mocks__/useAuth.cjs",
  },
  collectCoverage: true,
  coverageReporters: ["lcov", "text", "text-summary"],
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/utils/timeAgo.js",
    "src/utils/projectUtils.js",
    "src/data/roles.js",
    "src/data/garantias.js",
  ],
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],
};
