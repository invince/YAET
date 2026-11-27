# Profile / Plugin Form System Refactor Spec（表单系统重构设计）

Status: phases 1–3 complete; phase 4 cleanup done for form usages (`ModelFormController` retained for out-of-scope non-profile forms)

Scope: frontend profile-form authoring, model mapping, validation and the dynamic plugin-form host.

Non-goals: IPC channels, session lifecycle, backend plugin loading, the external-plugin Web Component contract, and the profile JSON format are unchanged.

## 1. Background

- Bundled plugin profile forms still inherit `ChildFormAsFormControl(MenuComponent)` (`src/app/components/EnhancedFormMixin.ts:98`); there is no signal/standalone replacement in the repo, even though the app is on Angular 20.
- `ModelFormController` has asymmetric `precondition` semantics: a model-side condition only affects `formToModel()` (`src/app/utils/ModelFormController.ts:45`), a form-side condition only affects `refreshForm()` (`:65`). UI visibility is maintained separately by hand.
- Each form duplicates the auth radio/secret/password UI and a copy of `secretOrPasswordMatchValidator` (e.g. `plugins/vnc-remote-desktop/frontend/form/vnc-profile-form.component.ts:93`). RDP currently has no group validator at all (`rdp-profile-form.component.ts:95`).
- `PluginFormHostComponent` reimplements CVA/dedup logic (`src/app/plugin/components/plugin-form-host.component.ts:91-118`) and never unsubscribes from the inner component's `dirtyStateChange` (`:109`).
- The parent form hard-codes every plugin control name (`src/app/components/menu/profile-form/profile-form.component.ts:96-115`), so adding a bundled plugin means editing core.
- Plugin templates contain no `mat-error`; users only see Save/Connect turn grey.
- `ModelFormController` is also used by non-profile forms: `secret-quick-form`, `proxy-form`, `secret-form`, `setting-menu`, and their mixins. It cannot be deleted as part of a profile-form-only refactor.

External plugins already avoid all of this by using a Web Component + `window.__<ID>_PLUGIN__` (`docs/plugin-development.md:441`), so the pain is specific to bundled plugins.

## 2. Goals

1. New bundled forms should be declarative, not mixin-based.
2. One field definition drives control creation, model mapping, default values, visibility and validation.
3. Auth UI/validation is written once and reused.
4. Validation failures produce readable, translated messages instead of only disabled buttons.
5. Adding a bundled plugin form requires no edits to the parent form's control list.
6. Existing profile JSON, external plugins, and current dirty/Save behaviour keep working.

## 3. Proposed design

### 3.1 `ProfileFormBase<T>` — `src/app/components/forms/profile-form.base.ts`

Explicit `ControlValueAccessor` + `Validator` base class, no mixin. It **extends `MenuComponent`** so `clear()`, `closeEvent` and `onSave()` remain available (the current mixin composes `MenuComponent`).

The base is decorated with `@Component({selector: 'app-profile-form-base', standalone: true, template: ''})`, not `@Directive()`: Angular rejects a directive that inherits a component (`NG0903`), while a component base is valid and keeps `inject()`/lifecycle support.

- `form: FormGroup` created from a `FieldSpec[]` schema.
- `writeValue(value)` handles `null`/`undefined` as a new model and applies schema defaults; it patches with `_writing = true` so `valueChanges` does not echo back into the parent. This replaces the `if (value)` guard (`EnhancedFormMixin.ts:170`).
- Keeps a baseline snapshot and uses `isEqual` from lodash (already a dependency) instead of `JSON.stringify` (`EnhancedFormMixin.ts:142-151`) to preserve "edit then revert → parent control pristine". This is the **only** place a lazy `NgControl` lookup remains, and it is documented as such; it is not a general change-propagation mechanism.
- `registerOnChange/registerOnTouched` are plain fields.
- `validate()` returns `{invalidChildForm: true, details: ValidationIssue[]}` where `ValidationIssue` is `{field: string; code: string}`; the parent keeps its existing `form.invalid` behaviour.
- `errorFor(field): string | null` maps control errors to an i18n key for `mat-error`.
- `isVisible(field): boolean` is the single UI-visibility entry point; templates must use it rather than duplicating conditions.
- `setDisabledState()` disables/enables the inner form; `onSubmit()` marks it pristine/untouched.

Provider boilerplate is reduced with one helper:

```ts
export function profileFormProviders<T>(type: () => Type<T>): Provider[] {
  return [
    {provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(type), multi: true},
    {provide: NG_VALIDATORS, useExisting: forwardRef(type), multi: true},
  ];
}
```

Each form uses `providers: profileFormProviders(() => VncProfileFormComponent)`. Angular does not inherit decorator providers from a base class, so this helper is the agreed pattern rather than claiming providers disappear.

### 3.2 `FormModelBridge<T>` — `src/app/utils/model-form.bridge.ts`

```ts
export interface FieldSpec<T> {
  form: string;                               // FormControl name
  model?: keyof T;                            // defaults to `form`
  defaultValue?: () => unknown;               // factory, avoids shared mutable values
  validators?: ValidatorFn[];
  visibleWhen?: (form: FormGroup) => boolean; // drives UI + read + write
  fromModel?: (value: unknown, model: T) => unknown;
  toModel?: (value: unknown, model: T) => void;
}
```

- `createForm(fb)` builds the `FormGroup` from `validators` and `defaultValue`.
- `patchFormFromModel(model)` patches visible fields, applying defaults; hidden fields are cleared.
- `applyFormToModel(target)` writes visible fields and leaves hidden model fields absent when building a fresh model; auth-style grouped fields clear their hidden sub-fields.
- `visibleWhen` is evaluated by both directions and by `ProfileFormBase.isVisible()`, so UI and mapping cannot drift apart.
- `ModelFormController` stays in place for non-profile forms; it is not part of this refactor's deletion scope.

### 3.3 Shared auth field

Reuse `AuthFormComponent` (`src/app/components/menu/profile-form/auth-form.component.ts:103`) as the auth control:

```ts
{ form: 'auth', fromModel: (_, m) => pickAuth(m), toModel: (v, m) => mergeAuth(m, v) }
```

- Fix the existing input bug: `authOptions = this.supportedAuthTypes` (`:108`) runs before `@Input` binding, so limited auth lists from external plugins never apply. Implemented as an `authOptions` getter, so it always reads the current input.
- Add `NG_VALIDATORS` to its providers (`:38-42`) and implement `Validator` via a shared `authRequiredValidator` in `src/app/utils/AuthValidators.ts` (replaces per-form copies such as `vnc-profile-form.component.ts:93`).
- Inputs: `supportedAuthTypes`, `secretTypes`, `hideLogin`, `authRequired`, `requireLogin`. Logins that need a username (FTP/Samba/custom/remote-terminal) set `requireLogin`; VNC sets only `authRequired` because it hides login.
- `mergeAuth`/`pickAuth` clear stale fields when switching types; reuse `clearAuthFields` (`src/app/utils/PasswordValidators.ts:14`) instead of leaving old `password`/`secretId` on the model.
- `passwordRequired` / `secretRequired` errors map to i18n keys in `src/assets/i18n/{en,zh,de,es,fr}.json` under a new `VALIDATION` block.
- Templates add `<mat-error>{{ errorFor('host') | translate }}</mat-error>` etc.; no more silent grey buttons.

### 3.4 `PluginFormHostComponent` — `src/app/plugin/components/plugin-form-host.component.ts:49`

- Keep only dynamic component creation and CVA forwarding.
- Remove duplicate `JSON.stringify` comparison and parent `markAsPristine()` calls (`:91-100`); the inner base class owns write suppression and revert handling.
- Forward `writeValue`, `registerOnChange`, `registerOnTouched`, `setDisabledState` and `validate()` to the inner component.
- Keep `pendingValue` for component-creation timing, but unsubscribe from `dirtyStateChange` in `ngOnDestroy` (`:152`).

### 3.5 Dynamic parent control

- Replace the fixed control list in `profile-form.component.ts:96-115` with `addControl/removeControl` driven by `profileType` changes, using `registry.getFormMetadata()` (`profile-form.component.ts:377-386`) for the control name.
- Subscribe to `profileType.valueChanges`: add the new control, remove the previous plugin control, and call `updateValueAndValidity()` so Save/Connect state is correct immediately.
- Expose `ensurePluginControl(name)` so `refreshForm()` can patch a profile before the view creates the host; `patchValue` (`profile-form.component.ts:171`) must never receive a missing plugin control.
- Core-only controls (`customProfileForm`, `remoteTerminalProfileForm`, `externalPluginForm`, `externalPluginAuth`) stay as they are. `remoteTerminalProfileForm` is retained because external terminal plugins use it without bundled-plugin metadata.
- Result: a new bundled plugin only registers a form metadata name; no core form edit.

### 3.6 i18n and messages

- Add `VALIDATION.REQUIRED`, `VALIDATION.PASSWORD_REQUIRED`, `VALIDATION.SECRET_REQUIRED`, `VALIDATION.INVALID_CHILD_FORM` to all five language files.
- `ProfileFormComponent`'s existing hardcoded `mat-error` strings (`profile-form.component.html:13,95,109`) can be switched to the same keys in a follow-up.

## 4. Migration phases

1. **Infrastructure + tests**: `ProfileFormBase`, `FormModelBridge`, `profileFormProviders`, `AuthValidators`, i18n keys, unit specs.
2. **Pilot**: migrate RDP and VNC forms; verify create/edit/auth switching/save/connect/dirty/revert.
3. **Roll-out**: migrate the remaining `ChildFormAsFormControl` forms — FTP, Samba, Serial, custom and remote-terminal; simplify `PluginFormHostComponent`; switch the parent form to dynamic controls.
4. **Cleanup**: remove all `ChildFormAsFormControl` usages. Keep `ModelFormController` for non-profile forms (secret/proxy/setting) unless a separate refactor explicitly takes them on. Optionally align `PluginManifest.frontend` (`src/app/plugin/plugin-manifest.ts:32-36`) with `frontend.entry` and add a plugin scaffold command in a follow-up.

## 5. Compatibility

- `Profile` serialization keys are unchanged; old profiles open with defaults applied by `patchFormFromModel()`.
- External plugin contract (`window.__<ID>_PLUGIN__`, Web Component form) is untouched.
- IPC channels, session factories, manifest/IPC whitelist generation and backend plugin loading are untouched.
- Current dirty/Save semantics are preserved via the baseline + lodash `isEqual` check.
- `HasChildForm` / `IsAChildForm` (`EnhancedFormMixin.ts:7,34`) stay for parent menus; only `ChildFormAsFormControl` is retired.

## 6. Verification

- `npx ng build --configuration development --base-href ./`
- `ng test` (or the project's current test command) after updating `src/app/utils/ModelFormController.spec.ts`; add specs for the bridge, auth validator, CVA write/revert/dirty, and host forwarding/unsubscribe.
- E2E regression: `npx playwright test e2e/_15_profile_form_refactor.spec.ts` (RDP validation/N-A, dirty-revert, plugin-control switching).
- Manual spot-check: reload of an old profile JSON, external plugin profile form, real serial-port scan.

## 7. Acceptance criteria

- A new profile form can be written with a schema, `ProfileFormBase`, `profileFormProviders`, and `<app-auth-form>` without copying validator logic.
- `writeValue(null)` applies schema defaults; `writeValue` never marks the parent dirty.
- Editing and reverting a value marks the parent control pristine again (Save greys out).
- Hidden fields are cleared from both the form and the saved model when visibility changes.
- Switching `profileType` removes the old plugin control and leaves no stale value or stale validity.
- Auth type switching does not leave a stale `password` or `secretId` in the saved profile.
- Every invalid field has a translated `mat-error`; Save/Connect gating still works through `form.invalid`.
- `ChildFormAsFormControl` is no longer referenced by any bundled form; `ModelFormController` remains only where explicitly out of scope.

## 8. Open questions

1. Scope: keep this to the form layer, or also include manifest schema validation / plugin scaffold generator in phase 4?
2. Auth policy: resolved — all profile forms use shared strict validation when login/secret is selected; N/A is the explicit way to skip auth. Each form declares its own `supportedAuthTypes`.
3. Should `ModelFormController` eventually be unified with `FormModelBridge`, or remain the generic helper for secret/proxy/setting forms?
