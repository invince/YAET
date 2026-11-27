import {Component} from '@angular/core';
import {FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {TestBed} from '@angular/core/testing';
import {ProfileFormBase, profileFormProviders} from './profile-form.base';
import {FormModelBridge} from '../../utils/model-form.bridge';

interface TestModel {
  name: string;
  mode: string;
  secret?: string;
  count: number;
}

@Component({
  selector: 'app-test-profile-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  providers: profileFormProviders(() => TestProfileFormComponent),
  template: '',
})
class TestProfileFormComponent extends ProfileFormBase<TestModel> {
  protected override readonly bridge = new FormModelBridge<TestModel>([
    {form: 'name', validators: [Validators.required], defaultValue: () => ''},
    {form: 'mode', defaultValue: () => 'simple'},
    {
      form: 'secret',
      model: 'secret',
      defaultValue: () => '',
      visibleWhen: form => form.get('mode')?.value === 'secure',
    },
    {form: 'count', defaultValue: () => 0},
  ]);

  protected override createEmptyModel(): TestModel {
    return {name: '', mode: 'simple', secret: undefined, count: 0};
  }
}

@Component({
  selector: 'app-test-profile-form-host',
  standalone: true,
  imports: [ReactiveFormsModule, TestProfileFormComponent],
  template: `<app-test-profile-form [formControl]="control"></app-test-profile-form>`,
})
class TestProfileFormHostComponent {
  control = new FormControl<TestModel | null>(null);
}

describe('ProfileFormBase', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<TestProfileFormHostComponent>>;
  let host: TestProfileFormHostComponent;
  let form: TestProfileFormComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({imports: [TestProfileFormHostComponent]});
    fixture = TestBed.createComponent(TestProfileFormHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    form = fixture.debugElement.children[0].componentInstance as TestProfileFormComponent;
  });

  const write = (value: TestModel | null) => {
    host.control.setValue(value);
    fixture.detectChanges();
    host.control.markAsPristine();
    host.control.markAsUntouched();
  };

  it('creates the form and applies a written model', () => {
    write({name: 'box', mode: 'secure', secret: 's', count: 2});

    expect(form.form.get('name')?.value).toBe('box');
    expect(form.form.get('mode')?.value).toBe('secure');
    expect(form.form.get('secret')?.value).toBe('s');
    expect(form.form.get('count')?.value).toBe(2);
  });

  it('treats a null write as an empty model and applies defaults', () => {
    write(null);

    expect(form.form.get('name')?.value).toBe('');
    expect(form.form.get('mode')?.value).toBe('simple');
    expect(form.form.get('count')?.value).toBe(0);
  });

  it('propagates edits and returns to pristine after reverting', () => {
    const baseline: TestModel = {name: 'box', mode: 'simple', count: 1};
    write(baseline);

    form.form.get('name')?.setValue('changed');
    expect(host.control.value?.name).toBe('changed');
    expect(host.control.dirty).toBeTrue();

    form.form.get('name')?.setValue('box');
    expect(host.control.value?.name).toBe('box');
    expect(host.control.dirty).toBeFalse();
  });

  it('exposes validation errors with translation keys', () => {
    write(null);

    expect(form.form.get('name')?.hasError('required')).toBeTrue();
    expect(form.errorFor('name')).toBe('VALIDATION.REQUIRED');
    expect(host.control.invalid).toBeTrue();
  });

  it('reports visibility from the field schema', () => {
    write({name: 'box', mode: 'simple', count: 1});

    expect(form.isVisible('secret')).toBeFalse();

    form.form.get('mode')?.setValue('secure');
    expect(form.isVisible('secret')).toBeTrue();
  });

  it('disables and enables the inner form', () => {
    write(null);

    form.setDisabledState(true);
    expect(form.form.disabled).toBeTrue();

    form.setDisabledState(false);
    expect(form.form.enabled).toBeTrue();
  });
});
