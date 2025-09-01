module.exports = {
  extends: ['next/core-web-vitals'],
  overrides: [
    {
      files: ['src/utils/tokenManager.ts'],
      rules: {
        'no-restricted-syntax': 'off'
      }
    }
  ],
  rules: {
    // Ban direct axios imports (use @/api/http instead)
    'no-restricted-imports': ['error', {
      paths: [{
        name: 'axios',
        message: 'Use @/api/http instead of direct axios imports'
      }],
      patterns: [{
        group: ['**/axios'],
        message: 'Use @/api/http instead of direct axios imports'
      }]
    }],
    
    // Ban API_URL usage
    'no-restricted-globals': ['error', {
      name: 'API_URL',
      message: 'Use relative paths with @/api/http instead of API_URL'
    }],
    
    // Ban process.env.NEXT_PUBLIC_API_URL direct usage
    'no-restricted-syntax': ['error', {
      selector: 'MemberExpression[object.object.name="process"][object.property.name="env"][property.name="NEXT_PUBLIC_API_URL"]',
      message: 'Do not use process.env.NEXT_PUBLIC_API_URL directly. Use @/api/http instead'
    }, {
      selector: 'Identifier[name="API_URL"]',
      message: 'Do not use API_URL variable. Use @/api/http with relative paths'
    }, {
      selector: 'CallExpression[callee.property.name="getItem"][arguments.0.value="clubos_token"]',
      message: 'Use tokenManager.getToken() instead of localStorage.getItem("clubos_token")'
    }, {
      selector: 'CallExpression[callee.property.name="setItem"][arguments.0.value="clubos_token"]',
      message: 'Use tokenManager.setToken() instead of localStorage.setItem("clubos_token")'
    }]
  }
};