module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/tests/foundation/**/*.test.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  clearMocks: true,
  moduleDirectories: ["node_modules", "<rootDir>/node_modules"],
};
