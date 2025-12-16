module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.js'],
  moduleFileExtensions: ['js'],

  // Setup file to initialize the AsciiEditor namespace
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],

  // Verbose output
  verbose: true,

  // Coverage settings
  collectCoverageFrom: [
    'js/**/*.js',
    '!js/main.js'
  ]
};
