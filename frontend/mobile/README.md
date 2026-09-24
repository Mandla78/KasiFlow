# Akayza mobile

Expo (SDK 57) + Expo Router. Runs as a **development build**, not Expo Go.

## Folder layout

The app follows the same domain idea as the backend: areas hold features, and every feature owns its own folder.

```
src/
  app/                          routes only; each file just re-exports a screen
    (auth)/                     welcome, create account, verify email, Google, sign in, reset
    (onboarding)/               business name (Google), business type, about you, tools
    (dashboard)/
      informal-business/        spaza, builders, other hustles
        (tabs)/                 Home · Account · Suppliers · More
        credit-book/            one folder per feature
        jobs/
        notifications.tsx
      supplier/                 placeholder (suppliers use the backend integration for now)
                                a formal-business/ folder can sit beside these later

  features/                     the real screens and logic
    auth/
      api/                      authApi.ts picks mockAuthApi now, httpAuthApi later
      session/                  SessionProvider: signedOut, unverified, onboarding, active
      screens/
      types.ts
    onboarding/screens/
    dashboard/
      informal-business/<feature>/
        screens/                the feature's screens
        components/             (when needed) components only this feature uses
        mock.ts                 sample data until the endpoint exists
      supplier/<feature>/

  shared/
    components/                 Button, TextField, Screen, Parts, TopBar, Brand, ComingSoon
    theme/tokens.ts             colours, fonts, spacing (from the UX design PDF)
    lib/                        money (integer cents), validation
```

To debug a feature, open its folder: `src/features/dashboard/informal-business/credit-book/` holds everything for the credit book.

### Adding a feature

1. Create `src/features/dashboard/informal-business/<feature>/screens/<Name>Screen.tsx`.
2. Add the route file `src/app/(dashboard)/informal-business/<feature>/index.tsx`:
   `export { default } from '@/features/dashboard/informal-business/<feature>/screens/<Name>Screen';`
3. Keep the feature's mock data in its own `mock.ts`. Import from `shared/`, never from another feature.

## Routing and auth

`src/app/_layout.tsx` guards each route group with `Stack.Protected` on the session status. When the status changes, the router moves the user on by itself.

Auth is mocked: nothing leaves the phone. Mock rules:

- Any 6-digit code verifies, except `000000`, which shows the error state.
- In the Google sheet, `ndlamini.work@gmail.com` counts as already registered, so it shows the link-Google screen.
- Sign-in works with any email and an 8+ character password.

## Money

Money is always integer cents. Use `formatRand(cents)` from `shared/lib/money`, and never do maths on the formatted string.

## Branding

The logo sources are in `assets/akayza-images/`. `shared/components/Brand.tsx` draws the mark and the wordmark. The app icon, Android adaptive icons, splash and favicon in `assets/images/` are rendered from the same SVG.

## Commands

```
npm install
npx expo start            # dev server (open in the Akayza dev build)
npx tsc --noEmit          # typecheck
npx expo-doctor           # dependency / config check
```
