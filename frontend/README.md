# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

---

## Architecture: `src/api/`

### Structure

| Fichier | Rôle |
|---|---|
| `client.ts` | Primitives HTTP (`httpFetch`, `httpJson`) — usage interne uniquement |
| `workspaceSession.ts` | Session & erreurs (`HasApiError`, `setApiWorkspaceId`, `buildHeaders`) |
| `hasApi.ts` | Surface API typée exposée aux composants |
| `types.ts` | Types request/response maintenus manuellement |
| `index.ts` | Barrel : re-exporte `workspaceSession`, `types`, `hasApi` — **pas** `httpFetch`/`httpJson` |

### Stratégie `types.ts` vs `generated.ts` (décision B)

`src/api/types.ts` est la **source de vérité frontend** pour les contrats request/response.

Le script `npm run codegen` peut générer un fichier `src/api/generated.ts` depuis l'OpenAPI du backend, mais celui-ci sert uniquement de **référence/validation** — les imports dans le code source pointent vers `types.ts`.

**Pourquoi B et pas A (suppression de `types.ts`) :**
- Le CI n'a pas accès au backend en live, donc codegen ne peut pas tourner automatiquement.
- `types.ts` est stable, versionné, et indépendant de l'état du serveur.

**Workflow de mise à jour :** quand le backend évolue, mettre à jour `types.ts` manuellement, puis vérifier avec `codegen` si disponible.

