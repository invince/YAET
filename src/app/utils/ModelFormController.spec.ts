import {TestBed} from '@angular/core/testing';
import {FormBuilder, ReactiveFormsModule} from '@angular/forms';
import {FormFieldWithPrecondition, ModelFieldWithPrecondition, ModelFormController} from './ModelFormController';

interface TestModel {
  name: string;
  email: string;
  age: number;
}

describe('ModelFormController', () => {
  let fb: FormBuilder;
  let controller: ModelFormController<TestModel>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
    });
    fb = TestBed.inject(FormBuilder);
  });

  describe('basic string mappings', () => {
    beforeEach(() => {
      const mappings = new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>([
        ['name', 'name'],
        ['email', 'email'],
        ['age', 'age'],
      ]);
      controller = new ModelFormController<TestModel>(mappings);
    });

    it('should initialize form with controls', () => {
      const form = controller.onInitForm(fb);
      expect(form.get('name')).toBeTruthy();
      expect(form.get('email')).toBeTruthy();
      expect(form.get('age')).toBeTruthy();
    });

    it('should map form to model', () => {
      const form = controller.onInitForm(fb);
      form.patchValue({ name: 'John', email: 'john@test.com', age: 30 });

      const model = controller.formToModel({} as TestModel, form);
      expect(model.name).toBe('John');
      expect(model.email).toBe('john@test.com');
      expect(model.age).toBe(30);
    });

    it('should refresh form from model', () => {
      const form = controller.onInitForm(fb);
      const model: TestModel = { name: 'Jane', email: 'jane@test.com', age: 25 };
      controller.refreshForm(model, form);

      expect(form.get('name')?.value).toBe('Jane');
      expect(form.get('email')?.value).toBe('jane@test.com');
      expect(form.get('age')?.value).toBe(25);
    });
  });

  describe('with preconditions', () => {
    it('should only map fields when precondition is met', () => {
      const mappings = new Map([
        [
          { name: 'name', precondition: () => true } as ModelFieldWithPrecondition,
          'name'
        ],
        [
          { name: 'email', precondition: () => false } as ModelFieldWithPrecondition,
          'email'
        ],
      ]);
      controller = new ModelFormController<TestModel>(mappings);

      const form = controller.onInitForm(fb);
      form.patchValue({ name: 'John', email: 'john@test.com' });

      const model = controller.formToModel({} as TestModel, form);
      expect(model.name).toBe('John');
      expect(model.email).toBeUndefined();
    });

    it('should use form field precondition for refreshForm', () => {
      const mappings = new Map([
        [
          'name' as string,
          { name: 'name', precondition: () => true } as FormFieldWithPrecondition
        ],
        [
          'email' as string,
          { name: 'email', precondition: () => false } as FormFieldWithPrecondition
        ],
      ]);
      controller = new ModelFormController<TestModel>(mappings);

      const form = controller.onInitForm(fb);
      form.patchValue({ name: 'old', email: 'old@test.com' });

      const model = { name: 'Jane', email: 'jane@test.com' } as TestModel;
      controller.refreshForm(model, form);

      expect(form.get('name')?.value).toBe('Jane');
      // email should NOT be refreshed because precondition returns false
      expect(form.get('email')?.value).toBeNull();
    });
  });

  describe('with formControlOptions', () => {
    it('should pass form control options', () => {
      const mappings = new Map([
        [
          'name' as string,
          { name: 'name', formControlOption: ['', []] } as FormFieldWithPrecondition
        ],
      ]);
      controller = new ModelFormController<TestModel>(mappings);

      const form = controller.onInitForm(fb);
      expect(form.get('name')).toBeTruthy();
    });
  });

  it('should handle form reset in refreshForm', () => {
    const mappings = new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>([
      ['name', 'name'],
    ]);
    controller = new ModelFormController<TestModel>(mappings);

    const form = controller.onInitForm(fb);
    form.patchValue({ name: 'dirty' });
    form.markAsDirty();

    controller.refreshForm({ name: 'clean' } as TestModel, form);
    expect(form.get('name')?.value).toBe('clean');
    expect(form.dirty).toBeFalse();
    expect(form.touched).toBeFalse();
  });
});
