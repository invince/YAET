import {Component, Inject, OnDestroy, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {Secret, SecretType} from '../../../domain/Secret';
import {CommonModule, KeyValuePipe} from '@angular/common';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatSelectChange, MatSelectModule} from '@angular/material/select';
import {ModelFormController} from '../../../utils/ModelFormController';
import {SecretStorageService} from '../../../services/secret-storage.service';
import {MenuComponent} from '../../menu/menu.component';
import {SecretService} from '../../../services/secret.service';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from '@angular/material/dialog';
import {SecretFormMixin} from '../../menu/secrets-menu/secret-form/secretFormMixin';

@Component({
  selector: 'app-secret-quick-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    KeyValuePipe,
    MatInput,
    MatDialogContent,
    MatDialogTitle,
    MatDialogActions,
  ],
  templateUrl: './secret-quick-form.component.html',
  styleUrl: './secret-quick-form.component.scss'
})
export class SecretQuickFormComponent extends  MenuComponent implements OnInit, OnDestroy {


  secretTypeOptions: SecretType[] = [];


  private modelFormController : ModelFormController<Secret>;
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private secretStorageService: SecretStorageService,
    private secretService: SecretService,
    public dialogRef: MatDialogRef<SecretQuickFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {secretTypes: SecretType[]}
  ) {
    super();
    this.modelFormController = SecretFormMixin.generateModelForm();
    this.secretTypeOptions = data.secretTypes || [];

  }

  ngOnDestroy(): void {
  }

  ngOnInit(): void {
    this.form = this.onInitForm();
    if (this.secretTypeOptions.length === 1) {
      this.form?.get('secretType')?.setValue(this.secretTypeOptions[0]);
    }
  }

  onInitForm(): FormGroup {
    return this.modelFormController.onInitForm(this.fb,
      {
        validators: [
          SecretFormMixin.secretNameShouldBeUnique(this.secretStorageService),
          SecretFormMixin.checkCurrentSecret,
          SecretFormMixin.passwordMatchValidator
        ]
      });

  }

  onSelectType($event: MatSelectChange) {
    SecretFormMixin.onSelectType(this.form, $event);
  }

  shouldShowField(fieldName: string) {
    return SecretFormMixin.shouldShowField(this.form, fieldName);
  }

  onSaveOne() {
    if (this.form.valid) {
      let secret = this.formToModel();
      this.secretService.updateOne(secret);
      this.secretService.saveAll().then(
        () => this.dialogRef.close()
      );
    }
  }


  onCancel() {
    this.dialogRef.close();
  }

  formToModel(): Secret {
    return this.modelFormController.formToModel(new Secret(), this.form);
  }



}
