// Jest config para CI/SonarCloud — solo tests puros de JS (sin React/jsdom)
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
  testMatch: [
    "**/src/__tests__/timeAgo.test.js",
    "**/src/__tests__/roles.test.js",
    "**/src/__tests__/garantias.test.js",
    "**/src/__tests__/projectUtils.test.js",
    "**/src/__tests__/fases.test.js",
  ],
  collectCoverage: true,
  coverageReporters: ["lcov", "text-summary"],
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/utils/timeAgo.js",
    "src/utils/projectUtils.js",
    "src/data/roles.js",
    "src/data/garantias.js",
    "src/data/fases.js",
  ],
  moduleNameMapper: {
    "\\.(css|less|scss|png|jpg|jpeg|gif|svg|webp)$": "<rootDir>/src/__mocks__/fileMock.cjs",
    "^../lib/firebase$": "<rootDir>/src/__mocks__/firebase.cjs",
    "^../../lib/firebase$": "<rootDir>/src/__mocks__/firebase.cjs",
    "^../../../lib/firebase$": "<rootDir>/src/__mocks__/firebase.cjs",
  },
};
