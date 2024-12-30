import {Component, forwardRef} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {ChildFormAsFormControl} from '../../../enhanced-form-mixin';
import {MenuComponent} from '../../menu.component';
import {RdpProfile} from '../../../../domain/profile/RdpProfile';
import {MatSlideToggle} from '@angular/material/slide-toggle';
import {
  FormFieldWithPrecondition,
  ModelFieldWithPrecondition,
  ModelFormController
} from '../../../../utils/ModelFormController';

@Component({
  selector: 'app-rdp-profile-form',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatFormFieldModule,

    MatInput,
    MatIcon,
    MatIconButton,
    MatSlideToggle,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RdpProfileFormComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => RdpProfileFormComponent),
      multi: true,
    },
  ],
  templateUrl: './rdp-profile-form.component.html',
  styleUrl: './rdp-profile-form.component.css'
})
export class RdpProfileFormComponent extends ChildFormAsFormControl(MenuComponent)  {

  private modelFormController : ModelFormController<RdpProfile>;
  constructor(
    private fb: FormBuilder,
    ) {
    super();

    let mappings = new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>();

    mappings.set('host' ,       {name: 'host', formControlOption:  ['', [Validators.required]]});
    mappings.set('fullScreen' , {name: 'fullScreen', formControlOption:  ['', [Validators.required]]});
    mappings.set('asAdmin' ,    {name: 'asAdmin', formControlOption:  ['', [Validators.required]]});

    this.modelFormController = new ModelFormController<RdpProfile>(mappings);
  }

  onInitForm(): FormGroup {
    return this.modelFormController.onInitForm(this.fb);
  }

  formToModel(): any {
    return this.modelFormController.formToModel(new RdpProfile(), this.form);
  }

  refreshForm(rdpProfile: any): void {
    if (this.form) {
      return this.modelFormController.refreshForm(rdpProfile, this.form);
    }
  }

}
