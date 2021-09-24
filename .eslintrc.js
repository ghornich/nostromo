const INDENT_DEPTH = 4;

exports = module.exports = {
    parser: '@typescript-eslint/parser',
    extends: 'eslint:recommended',
    parserOptions: {
        sourceType: 'module',
        ecmaVersion: 6,
        ecmaFeatures: {
            modules: true,
        },
    },
    plugins: ['jest', '@typescript-eslint'],
    env: {
        node: true,
        browser: true,
        es6: true,
        'jest/globals': true,
    },
    rules: {
        // from http://eslint.org/docs/rules/

        // Possible Errors

        'no-console': ['warn'],

        // Best Practices
        'complexity': ['error'],
        'curly': ['error', 'all'],
        'default-case': ['error'],
        'eqeqeq': ['error', 'always'],
        'no-caller': ['error'],
        'no-else-return': ['error'],
        'no-eq-null': ['error'],
        'no-eval': ['error'],
        'no-extend-native': ['error'],
        'no-extra-bind': ['error'],
        'no-floating-decimal': ['error'],
        'no-global-assign': ['error'],
        'no-dupe-class-members': 0,
        '@typescript-eslint/no-dupe-class-members': 2,
        'no-implicit-coercion': ['error'],
        'no-implicit-globals': ['error'],
        'no-implied-eval': ['error'],
        'no-iterator': ['error'],
        'no-lone-blocks': ['error'],
        'no-loop-func': ['error'],
        'no-multi-spaces': ['error'],
        'no-multi-str': ['error'],
        'no-new': ['error'],
        'no-new-func': ['error'],
        'no-new-wrappers': ['error'],
        'no-octal': ['error'],
        'no-octal-escape': ['error'],
        'no-proto': ['error'],
        'no-redeclare': 0,
        '@typescript-eslint/no-redeclare': ['error'],
        // 'no-return-assign': ['error'],
        'no-return-await': ['error'],
        'no-script-url': ['error'],
        'no-self-assign': ['error'],
        'no-self-compare': ['error'],
        'no-sequences': ['error'],
        'no-throw-literal': ['error'],
        'no-unmodified-loop-condition': ['error'],
        'no-unused-expressions': ['error'],
        'no-useless-call': ['error'],
        'no-useless-concat': ['error'],
        'no-useless-escape': ['error'],
        'no-useless-return': ['error'],
        'no-void': ['error'],
        'no-warning-comments': ['warn'],
        'no-with': ['error'],
        'prefer-promise-reject-errors': ['error'],
        'radix': ['error'],
        // 'require-await': ['error'],
        'wrap-iife': ['error'],
        'yoda': ['error'],

        // Strict Mode
        // 'strict': ['error', 'safe'],

        // Variables
        'no-catch-shadow': ['error'],
        'no-delete-var': ['error'],
        'no-label-var': ['error'],
        'no-shadow': ['error'],
        'no-undef': ['error'],
        'no-undef-init': ['error'],
        'no-unused-vars': 0,
        '@typescript-eslint/no-unused-vars': 2,
        'no-use-before-define': 0,
        '@typescript-eslint/no-use-before-define': ['error', { functions: false, classes: true, variables: true }],

        // Node.js and CommonJS

        'no-buffer-constructor': ['error'],
        'no-path-concat': ['error'],
        'no-sync': ['warn'],

        // Stylistic Issues

        'array-bracket-spacing': ['error'],
        'brace-style': ['error', 'stroustrup'],
        'camelcase': ['error'],
        'comma-dangle': ['error', 'always-multiline'],
        'comma-spacing': ['error'],
        'comma-style': ['error'],
        'consistent-this': ['error', 'self'],
        'eol-last': ['error'],
        'func-call-spacing': ['error'],
        'indent': ['error', INDENT_DEPTH, { 'SwitchCase': 1, 'MemberExpression': 0 }],
        'jsx-quotes': ['error'],
        'key-spacing': ['error', { mode: 'minimum' }],
        'keyword-spacing': ['error'],
        'line-comment-position': [0],
        'linebreak-style': [0],
        'max-depth': ['error'],
        'max-len': 0,
        'max-params': ['error'],
        'max-statements': [0],
        'new-cap': ['error'],
        'new-parens': ['error'],
        'no-array-constructor': ['error'],
        'no-bitwise': ['error'],
        'no-inline-comments': [0],
        'no-lonely-if': ['error'],
        'no-nested-ternary': ['error'],
        'no-new-object': ['error'],
        'no-tabs': ['error'],
        'no-trailing-spaces': ['error'],
        'no-unneeded-ternary': ['error'],
        'no-whitespace-before-property': ['error'],
        'object-curly-spacing': ['error', 'always'],
        'operator-linebreak': ['error'],
        'quote-props': ['error', 'as-needed', { unnecessary: false }],
        'quotes': ['error', 'single'],
        'semi': ['error'],
        'semi-spacing': ['error'],
        'semi-style': ['error'],
        'space-before-blocks': ['error'],
        'space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
        'space-in-parens': ['error'],
        'space-infix-ops': ['error'],
        'space-unary-ops': ['error'],
        'spaced-comment': ['error'],
        'switch-colon-spacing': ['error'],

        // ECMAScript 6

        'arrow-spacing': ['error'],
        'constructor-super': ['error'],
        'no-var': ['error'],
        'prefer-const': ['error'],
        'prefer-rest-params': ['error'],
        'prefer-spread': ['error'],
        // 'prefer-template': ['error'],
        'template-curly-spacing': ['error'],
        '@typescript-eslint/type-annotation-spacing': 2,
    },
};
