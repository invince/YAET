import {AbstractControlOptions, FormBuilder, FormGroup} from '@angular/forms';

export class ModelFieldWithPrecondition {
  name!: string;

  precondition? : (form: FormGroup)=> boolean;
}

export class FormFieldWithPrecondition{

  name!: string;

  precondition? : (form: FormGroup)=> boolean;
  formControlOption?: any = [];
}

export class ModelFormController<Model> {

  constructor( private mappings: Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>) {
  }

  onInitForm(fb: FormBuilder, options?: AbstractControlOptions | null | {[key: string]: any;} ): FormGroup {
    let controls:  {[key: string]: any} = {};

    this.mappings.forEach((formField: string | FormFieldWithPrecondition, modelField: string | ModelFieldWithPrecondition) => {
      let formFieldName = typeof formField === 'string' ? formField : formField.name;
      controls[formFieldName] =  typeof formField === 'string' ? [] : formField.formControlOption || [];
    });

    if (options) {
      return  fb.group(
        controls,
        options
      );
    } else {
      return  fb.group(
        controls
      );
    }
  }

  formToModel(newCreatedModel: Model, form: FormGroup): Model {
    this.mappings.forEach((formField: string | FormFieldWithPrecondition, modelField: string | ModelFieldWithPrecondition) => {
      let modelFieldName = typeof modelField === 'string' ? modelField : modelField.name;
      let modelFieldPrecondition = typeof modelField === 'string' ?  ()=> true : modelField.precondition || (()=> true);
      let formFieldName = typeof formField === 'string' ? formField : formField.name;
      // let formFieldPrecondition =  typeof formField === 'string' ?  ()=> true : formField.precondition || (()=> true);

      if (modelFieldPrecondition(form)) {
        const formControl = form.get(formFieldName);
        if (formControl) {
          newCreatedModel[modelFieldName as keyof Model] = formControl.value;
        }
      }
    });
    return newCreatedModel;
  }

  refreshForm(model: Model, form: FormGroup) {
    form.reset();
    this.mappings.forEach((formField: string | FormFieldWithPrecondition, modelField: string | ModelFieldWithPrecondition) => {
      let modelFieldName = typeof modelField === 'string' ? modelField : modelField.name;
      // let modelFieldPrecondition = typeof modelField === 'string' ?  ()=> true : modelField.precondition || (()=> true);
      let formFieldName = typeof formField === 'string' ? formField : formField.name;
      let formFieldPrecondition =  typeof formField === 'string' ?  ()=> true : formField.precondition || (()=> true);

      if (formFieldPrecondition(form)) {
        const formControl = form.get(formFieldName);
        if (formControl) {
          formControl.setValue(model[modelFieldName as keyof Model] );
        }
      }
    });
    form.markAsPristine();
    form.markAsUntouched();
  }
}
