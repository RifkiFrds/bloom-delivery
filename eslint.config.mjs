import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';

/**
 * ── ARCHITECTURAL BOUNDARIES ARE A LINT RULE, NOT A CONVENTION ───────────
 * Doc 01 §2.1 rule B1: `machine/` and `detection/` must not import React,
 * Zustand, Three or Framer Motion. That rule is violated by a single convenient
 * import, silently, and the cost surfaces three phases later. So it is
 * enforced here and checked in CI.
 * ─────────────────────────────────────────────────────────────────────────
 */

const FRAMEWORK_PACKAGES = [
  'react',
  'react-dom',
  'zustand',
  'three',
  'motion',
  'motion/react',
  'framer-motion',
  'howler',
  'next',
];

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'tools/spike/**', // throwaway, its own tsconfig
      'scripts/**',
      'public/**', // vendored MediaPipe runtime — never ours to lint
      'next-env.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Config files sit outside tsconfig's `include` but still deserve linting.
          // Only files outside tsconfig's `include`. The .ts configs are
          // already covered by the project service.
          allowDefaultProject: [
            'eslint.config.mjs',
            'next.config.mjs',
            'postcss.config.mjs',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // Code quality rules from the execution brief.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },

  // B1 — the machine is framework-free.
  {
    files: ['src/machine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: FRAMEWORK_PACKAGES.map((name) => ({
            name,
            message:
              'machine/ must be framework-free (Doc 01 §2.1 rule B1). Move this to a layer that owns the capability.',
          })),
          patterns: [
            {
              group: ['@/store/*', '@/components/*', '@/scenes/*', '@/scene3d/*'],
              message: 'machine/ must not depend on presentation layers.',
            },
          ],
        },
      ],
    },
  },

  // B1 — detection is framework-free (Phase 3 onward).
  {
    files: ['src/detection/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: FRAMEWORK_PACKAGES.map((name) => ({
            name,
            message:
              'detection/ must be framework-free (Doc 01 §2.1 rule B1). It writes a ref; it never renders.',
          })),
        },
      ],
    },
  },

  // B6 — Phase A code must not reach the 3D chunk.
  {
    files: ['src/scenes/**/*.tsx', 'src/components/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['three', '@react-three/*', '@/scene3d/*'],
              message:
                'Phase B only. The 3D chunk must stay unreachable from Phase A (Doc 01 §2.1 rule B6).',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['tests/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },

  // Build configuration runs in Node and follows framework-imposed shapes.
  {
    files: ['*.mjs'],
    languageOptions: { globals: { process: 'readonly' } },
    rules: {
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-deprecated': 'off',
    },
  },
);
