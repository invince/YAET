import {FormBuilder, Validators} from '@angular/forms';
import {FieldSpec, FormModelBridge} from './model-form.bridge';

interface TestModel {
  host: string;
  port: number;
  authType: string;
  password?: string;
  secretId?: string;
  enabled: boolean;
}

const createBridge = () => new FormModelBridge<TestModel>([
  {form: 'host', validators: [Validators.required]},
  {form: 'port', defaultValue: () => 3389},
  {form: 'authType', defaultValue: () => 'N/A'},
  {form: 'password', visibleWhen: form => form.get('authType')?.value === 'login', defaultValue: () => ''},
  {form: 'secretId', visibleWhen: form => form.get('authType')?.value === 'secret', defaultValue: () => ''},
  {form: 'enabled', defaultValue: () => false},
]);

describe('FormModelBridge', () => {
  let fb: FormBuilder;
  let bridge: FormModelBridge<TestModel>;

  beforeEach(() => {
    fb = new FormBuilder();
    bridge = createBridge();
  });

  it('creates controls with defaults and validators', () => {
    const form = bridge.createForm(fb);

    expect(form.get('host')?.value).toBeNull();
    expect(form.get('host')?.hasError('required')).toBeTrue();
    expect(form.get('port')?.value).toBe(3389);
    expect(form.get('authType')?.value).toBe('N/A');
    expect(form.get('enabled')?.value).toBeFalse();
  });

  it('uses a factory so mutable defaults are not shared', () => {
    const mutableBridge = new FormModelBridge<{ items: string[] }>([
      {form: 'items', defaultValue: () => []},
    ]);

    const first = mutableBridge.createForm(fb).get('items')?.value;
    const second = mutableBridge.createForm(fb).get('items')?.value;

    expect(first).not.toBe(second);
  });

  it('patches visible fields and resets hidden fields', () => {
    const form = bridge.createForm(fb);
    form.get('password')?.setValue('stale');

    bridge.patchFormFromModel(form, {
      host: 'example.com',
      port: 3390,
      authType: 'secret',
      password: 'old',
      secretId: 'secret-1',
      enabled: true,
    });

    expect(form.get('host')?.value).toBe('example.com');
    expect(form.get('port')?.value).toBe(3390);
    expect(form.get('authType')?.value).toBe('secret');
    expect(form.get('password')?.value).toBe('');
    expect(form.get('secretId')?.value).toBe('secret-1');
    expect(form.get('enabled')?.value).toBeTrue();
    expect(form.pristine).toBeTrue();
  });

  it('applies model defaults when the model is null', () => {
    const form = bridge.createForm(fb);
    bridge.patchFormFromModel(form, null);

    expect(form.get('port')?.value).toBe(3389);
    expect(form.get('enabled')?.value).toBeFalse();
  });

  it('applies fromModel and toModel mappings', () => {
    const mapped = new FormModelBridge<TestModel>([
      {
        form: 'host',
        model: 'host',
        fromModel: value => String(value ?? '').toUpperCase(),
        toModel: (value, model) => {
          model.host = String(value ?? '').toLowerCase();
        },
      },
    ]);
    const form = mapped.createForm(fb);
    const model: TestModel = {
      host: 'example.com',
      port: 3389,
      authType: 'N/A',
      enabled: false,
    };

    mapped.patchFormFromModel(form, model);
    expect(form.get('host')?.value).toBe('EXAMPLE.COM');

    form.get('host')?.setValue('OTHER.COM');
    const result = mapped.applyFormToModel(form, {} as TestModel);
    expect(result.host).toBe('other.com');
  });

  it('writes visible fields and clears hidden model fields', () => {
    const form = bridge.createForm(fb);
    bridge.patchFormFromModel(form, {
      host: 'example.com',
      port: 3389,
      authType: 'login',
      password: 'secret',
      secretId: 'secret-1',
      enabled: true,
    });

    const result = bridge.applyFormToModel(form, {} as TestModel);

    expect(result.host).toBe('example.com');
    expect(result.password).toBe('secret');
    expect(result.secretId).toBeUndefined();
  });

  it('exposes field visibility', () => {
    const form = bridge.createForm(fb);

    expect(bridge.isVisibleByField(form, 'password')).toBeFalse();
    form.get('authType')?.setValue('login');
    expect(bridge.isVisibleByField(form, 'password')).toBeTrue();
    expect(bridge.isVisibleByField(form, 'secretId')).toBeFalse();
  });
});
