<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/branding/Bulwark_Logo_with_Lettering_White_and_Color.svg" />
  <source media="(prefers-color-scheme: light)" srcset="public/branding/Bulwark_Logo_with_Lettering_Dark_Color.svg" />
  <img src="public/branding/Bulwark_Logo_with_Lettering_Dark_Color.svg" alt="Bulwark Webmail" width="280" />
</picture>

</div>

# Contributing to Bulwark Webmail

We're writing the webmail we wanted in 2026 and didn't find: a JMAP-native client with an interface built this decade. It's AGPL and self-hosted, run by the people who use it rather than sold to them.

If that sounds like your kind of project, we'd love the help.

## Join the community

You don't need to be an expert to contribute. A dev environment that won't start, a bug you're not sure how to report, a translation you're stuck on: Discord is the fastest way to get unstuck and to meet the people working on this.

- **Get support** - real-time help with development hurdles
- **Share ideas** - feature suggestions, design feedback, doc improvements
- **Collaborate** - meet the team and other contributors

[**Join the Bulwark Discord Server**](https://discord.gg/tYCujymGrT)

---

## Getting started

### Development setup

1. **Fork and clone** the repository:

   ```bash
   git clone https://github.com/bulwarkmail/webmail.git
   cd webmail
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Set up environment**:

   ```bash
   cp .env.dev.example .env.local
   ```

   This enables the built-in mock JMAP server (`DEV_MOCK_JMAP=true`), so you can
   develop without a mail server. Log in with any username and password. To work
   against a real server instead, copy `.env.example` and set `JMAP_SERVER_URL`.

4. **Start development server**:

   ```bash
   npm run dev
   ```

   Then open http://localhost:3000.

### Code quality

Before submitting a pull request, ensure your code passes all checks:

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Fix lint issues automatically
npm run lint:fix
```

These checks run automatically on commit via Husky pre-commit hooks.

### Testing

| Suite            | Command                    | What it covers                                                     |
| ---------------- | -------------------------- | ------------------------------------------------------------------ |
| **Unit**         | `npx vitest run`           | Vitest + jsdom. Tests live in `__tests__/` folders next to the code |
| **Translations** | `npm run test:translations` | Locale files checked for structural drift against English           |
| **Integration**  | `npm run test:integration`  | Playwright against a real Stalwart server in Docker                 |
| **E2E smoke**    | `npx playwright test`      | UI smoke tests against `npm run dev`                                |

Run a single unit test file with `npx vitest run lib/__tests__/<name>.test.ts`, or `npx vitest` to watch.

The integration suite needs Docker and takes several minutes; it has its own setup notes and findings log in [integration/README.md](integration/README.md). New behavior that touches mail/folder synchronization or multi-account handling belongs there.

## Code style guidelines

### TypeScript

- Use TypeScript for all new code
- Define proper types and interfaces
- Avoid `any` types when possible
- Use meaningful variable and function names

### React components

- Use functional components with hooks
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks
- Place components in appropriate directories under `/components`

### Styling

- Use Tailwind CSS utility classes
- Follow the existing design system
- Support both dark and light themes
- Use CSS variables for theme colors

## Internationalization (i18n)

This project uses **next-intl**. English (`/locales/en/common.json`) is the source of truth; we ship 23 additional locales (ar, ca, cs, da, de, es, fa, fr, he, hu, it, ja, ko, lv, nl, pl, pt, ro, ru, sk, tr, uk, zh).

Arabic, Hebrew, and Persian render right-to-left (see `i18n/direction.ts`). Use Tailwind's **logical** utilities (`ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`) rather than physical ones (`ml-*`, `pl-*`, `left-*`) so layouts flip correctly. For popovers positioned in JS via `getBoundingClientRect()`, check `isDocumentRTL()`: inline `position: fixed` styles don't pick up logical utilities.

### Rules

1. **Never hardcode user-facing text** - always use translations:

   ```tsx
   const t = useTranslations("namespace");
   return <div>{t("key")}</div>;
   ```

2. **Add new keys to `en/common.json` first.** Other locales can follow in the same PR or a follow-up - missing keys fall back to English.

3. **Namespace organization**:
   - `login.*` - login page
   - `sidebar.*` - sidebar navigation
   - `email_list.*` - email list
   - `email_viewer.*` - email viewer
   - `email_composer.*` - composer
   - `settings.*` - settings page
   - `notifications.*` - toasts and alerts
   - `common.*` - shared strings

4. **Locale-aware navigation**:

   ```tsx
   router.push(`/${params.locale}/settings`);
   ```

### Adding a new locale

Registering a new locale takes edits in four places:

1. `locales/<code>/common.json` - copy `locales/en/common.json` and translate
2. `i18n/routing.ts` - add the code to `SUPPORTED_LOCALES`
3. `i18n/request.ts` - add a `case` to the static-import switch
4. `components/ui/language-switcher.tsx` - add `{ value, label }` with the **native** language name, plus a flag in `components/ui/flag-icons.tsx`

For a right-to-left language, also add the code to `rtlLocales` in `i18n/direction.ts`.

Run `npm run test:translations` afterwards - it checks the locale files for structural drift against English.

## Pull request process

### Before submitting

1. **Create a feature branch**:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code style guidelines

3. **Test your changes** thoroughly, and add unit tests for new logic

4. **Update translations** if you added user-facing text

5. **Run all checks**:
   ```bash
   npm run typecheck && npm run lint && npx vitest run
   ```

### Submitting

1. **Push your branch** to your fork

2. **Open a Pull Request** with:
   - Clear title describing the change
   - Description of what was changed and why
   - Screenshots for UI changes
   - Reference to any related issues

### Commit message convention

Follow the conventional commits format:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:

```
feat: add email threading support
fix: resolve attachment download issue
docs: update README with keyboard shortcuts
```

## Project structure

```
webmail/
├── app/                       # Next.js App Router
│   ├── (main)/[locale]/      # Locale-aware app pages (mail, calendar, contacts, files, settings)
│   ├── (main)/admin/         # Admin dashboard
│   ├── (main)/setup/         # First-launch setup wizard
│   ├── (sandbox)/            # Isolated plugin sandbox routes
│   └── api/                  # Route handlers (auth, admin, jmap, caldav, …)
├── components/               # React components
│   ├── email/               # Email list, viewer, composer
│   ├── calendar/ contacts/ files/ filters/ templates/
│   ├── layout/              # Sidebar, shell, navigation
│   ├── settings/            # Settings panels
│   ├── plugins/             # Plugin host UI
│   └── ui/                  # Reusable primitives
├── contexts/                 # React contexts
├── hooks/                    # Custom React hooks
├── i18n/                     # next-intl routing, locale detection, RTL direction
├── lib/                      # Utilities and libraries
│   ├── jmap/                # JMAP client implementation
│   ├── stalwart/            # Stalwart-specific admin/API helpers
│   ├── admin/ auth/ oauth/  # Config, sessions, OAuth flows
│   ├── plugin-sandbox/      # Plugin sandbox bridge and hardening
│   └── __tests__/           # Vitest unit tests
├── locales/                  # Translation files, one directory per locale
├── stores/                   # Zustand state stores
├── public/                   # Static assets and branding
├── e2e/                      # Playwright smoke tests (against `npm run dev`)
└── integration/              # Dockerized Stalwart + Playwright suite
```

## Security

- **Never commit secrets** - API keys, passwords, tokens, `.env*` files
- **Sanitize user input** and email content
- **Block external content** by default - privacy is the point
- **Report vulnerabilities privately** to bulwark@rbm.systems, not via public issues

## Questions?

Open an issue, search existing ones, or ask in Discord. Thanks for helping build the webmail we all wished existed.
