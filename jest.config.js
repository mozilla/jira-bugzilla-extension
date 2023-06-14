export default {
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!**/node_modules/**',
    '!**/vendor/**',
  ],
  coverageDirectory: 'coverage',
  setupFiles: ['./jest.setup.js'],
  testEnvironment: 'jsdom',
  transform: {},
};
