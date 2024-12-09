import {Component, forwardRef} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {ChildFormAsFormControl} from '../../enhanced-form-mixin';
import {MenuComponent} from '../menu.component';
import {RdpProfile} from '../../../domain/profile/RdpProfile';
import {MatSlideToggle} from '@angular/material/slide-toggle';

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
  ],
  templateUrl: './rdp-profile-form.component.html',
  styleUrl: './rdp-profile-form.component.css'
})
export class RdpProfileFormComponent extends ChildFormAsFormControl(MenuComponent)  {

  constructor(
    private fb: FormBuilder,
    ) {
    super();
  }

  onInitForm(): FormGroup {
    return this.fb.group(
      {
        host: ['', [Validators.required]], // we shall avoid use ngModel and formControl at same time;
        fullScreen: ['', [Validators.required]], // we shall avoid use ngModel and formControl at same time;
        asAdmin: ['', [Validators.required]], // we shall avoid use ngModel and formControl at same time;
      });
  }

  formToModel(): any {
    let rdpProfile = new RdpProfile();
    rdpProfile.host = this.form.get('host')?.value;
    rdpProfile.fullScreen = this.form.get('fullScreen')?.value;
    rdpProfile.asAdmin = this.form.get('asAdmin')?.value;
    return rdpProfile;
  }

  refreshForm(rdpProfile: any): void {
    if (this.form) {
      this.form.reset();

      this.form.get('host')?.setValue(rdpProfile?.host);
      this.onSubmit(); // reset dirty and invalid status
    }
  }

}
