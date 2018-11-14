// jest.config.js
module.exports = {
    verbose: true,
    testURL: "http://localhost:8000/",
    "setupFiles": [
      "./jest/globals.js"
    ], 
   "coverageDirectory": "./tests/coverage",

   "coveragePathIgnorePatterns": [
      "./jest",
    ],
  };