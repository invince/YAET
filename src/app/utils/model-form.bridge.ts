import {AbstractControlOptions, FormBuilder, FormControl, FormGroup, ValidatorFn} from '@angular/forms';

export interface FieldSpec<T> {
  form: string;
  model?: keyof T;
  defaultValue?: () => unknown;
  validators?: ValidatorFn[];
  visibleWhen?: (form: FormGroup) => boolean;
  fromModel?: (value: unknown, model: T) => unknown;
  toModel?: (value: unknown, model: T) => void;
}

export class FormModelBridge<T extends object> {
  constructor(private readonly specs: readonly FieldSpec<T>[]) {
  }

  createForm(fb: FormBuilder, options?: AbstractControlOptions | null): FormGroup {
    const controls: Record<string, FormControl> = {};
    for (const spec of this.specs) {
      controls[spec.form] = new FormControl(this.defaultValue(spec), spec.validators ?? []);
    }
    return options ? fb.group(controls, options) : fb.group(controls);
  }

  isVisible(form: FormGroup, spec: FieldSpec<T>): boolean {
    return spec.visibleWhen ? spec.visibleWhen(form) : true;
  }

  isVisibleByField(form: FormGroup, field: string): boolean {
    const spec = this.specs.find(one => one.form === field);
    return spec ? this.isVisible(form, spec) : true;
  }

  patchFormFromModel(form: FormGroup, model: T | null | undefined): void {
    const source = (model ?? {}) as T;
    for (const spec of this.specs) {
      const control = form.get(spec.form);
      if (!control) {
        continue;
      }

      if (!this.isVisible(form, spec)) {
        control.setValue(this.defaultValue(spec), {emitEvent: false});
        continue;
      }

      const raw = source[spec.model ?? (spec.form as keyof T)];
      const mapped = spec.fromModel ? spec.fromModel(raw, source) : raw;
      control.setValue(
        mapped === undefined && !spec.fromModel ? this.defaultValue(spec) : mapped ?? null,
        {emitEvent: false},
      );
    }

    form.markAsPristine();
    form.markAsUntouched();
  }

  applyFormToModel(form: FormGroup, target: T): T {
    for (const spec of this.specs) {
      const control = form.get(spec.form);
      if (!control) {
        continue;
      }

      if (!this.isVisible(form, spec)) {
        this.setModelValue(target, spec.model ?? (spec.form as keyof T), undefined);
        continue;
      }

      if (spec.toModel) {
        spec.toModel(control.value, target);
      } else {
        this.setModelValue(target, spec.model ?? (spec.form as keyof T), control.value);
      }
    }
    return target;
  }

  private defaultValue(spec: FieldSpec<T>): unknown {
    return spec.defaultValue ? spec.defaultValue() : null;
  }

  private setModelValue(target: T, key: keyof T, value: unknown): void {
    if (value === undefined) {
      delete (target as Record<string, unknown>)[key as string];
    } else {
      (target as Record<string, unknown>)[key as string] = value;
    }
  }
}
