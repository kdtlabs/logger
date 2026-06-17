import kdt from '@kdtlabs/eslint-config'

export default kdt({}, [
    {
        rules: {
            'perfectionist/sort-objects': 'off',
            'security/detect-non-literal-regexp': 'off',
        },
    },
    {
        files: ['playground.ts'],
        rules: {
            'no-console': 'off',
        },
    },
    {
        files: ['scripts/**'],
        rules: {
            'n/no-process-exit': 'off',
        },
    },
])
