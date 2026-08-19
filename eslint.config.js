import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,

  // architecture.md section 1: the fight simulation is pure TypeScript with
  // zero Phaser imports, because in phase 7 it moves onto the Colyseus server.
  // Enforced here rather than by discipline.
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['phaser', 'phaser/*', '**/game/**'],
              message:
                'sim/ must not import Phaser or game/. See architecture.md section 1.',
            },
          ],
        },
      ],
    },
  },

  prettier,
);
