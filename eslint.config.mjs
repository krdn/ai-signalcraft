import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import-x';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // 전역 무시
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/drizzle/**',
      'apps/web/src/components/ui/**', // shadcn/ui 자동 생성 파일
    ],
  },

  // 기본 규칙
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // 공통 규칙
  {
    plugins: {
      'import-x': importPlugin,
    },
    rules: {
      // TypeScript 실용적 조정
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // Import 정리
      'import-x/no-duplicates': 'error',
      'import-x/order': ['error', {
        groups: [
          'builtin',
          ['external', 'internal'],
          'parent',
          'sibling',
          'index',
        ],
        'newlines-between': 'never',
      }],

      // 순환 의존성 방지 (CI에서만 실행 — 로컬에서는 메모리 과다 사용)
      // 'import-x/no-cycle': ['error', { maxDepth: 3 }],

      // 일반
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
    },
  },

  // FSD 의존성 방향 강제 (web 앱 전용)
  // shared ← entities ← features ← widgets ← app (상위→하위만 참조)
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          // packages 내부 경로 직접 참조 금지 (public API만 사용)
          {
            group: ['@ai-signalcraft/core/src/*'],
            message: '@ai-signalcraft/core에서 내부 경로 대신 public API를 사용하세요.',
          },
          {
            group: ['@ai-signalcraft/collectors/src/*'],
            message: '@ai-signalcraft/collectors에서 내부 경로 대신 public API를 사용하세요.',
          },
        ],
      }],
    },
  },

  // Service Worker (브라우저 전역 변수)
  {
    files: ['**/sw.js', '**/service-worker.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        addEventListener: 'readonly',
        skipWaiting: 'readonly',
        clients: 'readonly',
      },
    },
  },

  // 스크립트 파일 완화
  {
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
      'import-x/order': 'off', // dotenv 로드 순서 등 특수 임포트 패턴
    },
  },

  // 테스트 파일 완화
  {
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'off',
    },
  },

  // Prettier 호환 (마지막에 적용)
  prettier,
);
