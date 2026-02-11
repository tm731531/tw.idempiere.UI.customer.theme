import antfu from '@antfu/eslint-config'

export default antfu(
  {
    vue: true,
    typescript: true,
    formatters: {
      css: true,
      html: true,
    },
    ignores: [
      '**/*.md', // 排除 Markdown 檔案（CLAUDE.md, README.md 等）
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
    ],
  },
  {
    rules: {
      // 自訂規則：放寬或覆寫預設
      'no-console': 'off', // 允許 console.log（開發時需要）
      'no-alert': 'off', // 允許 alert/confirm（用戶交互提示）
      'vue/multi-word-component-names': 'off', // 允許單字 component 名稱
      'ts/no-use-before-define': 'off', // Vue 3 Composition API 常見模式
      'no-unmodified-loop-condition': 'off', // 日期對象的 setDate() 會修改對象，ESLint 誤判
    },
  },
)
