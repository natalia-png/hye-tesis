module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterFramework: ["@testing-library/jest-dom"],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
  moduleNameMapper: {
    "\\.(css|less|scss|png|jpg|jpeg|gif|svg|webp)$": "<rootDir>/src/__mocks__/fileMock.cjs",
    "^../lib/firebase$": "<rootDir>/src/__mocks__/firebase.cjs",
    "^../../lib/firebase$": "<rootDir>/src/__mocks__/firebase.cjs",
    "^../../../lib/firebase$": "<rootDir>/src/__mocks__/firebase.cjs",
  },
  collectCoverage: true,
  coverageReporters: ["lcov", "text", "text-summary"],
  coverageDirectory: "coverage",
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/android/",
    "/src/__mocks__/",
    "/src/__tests__/",
  ],
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],
};
